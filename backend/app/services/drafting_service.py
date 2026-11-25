import asyncio
from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import GenerationUnavailable
from app.core.config import settings
from app.models.business import Business
from app.models.drafting import DraftBudget, DraftJob
from app.models.review import Review
from app.models.reply import Reply
from app.schemas.drafting import AutomationRule, DraftJobView
from app.schemas.review import GenerateReplyRequest
from app.services.reply_service import ReplyService
from app.utils.helpers import as_utc, now

PROCESSING_TIMEOUT = 75
LEASE_SECONDS = 120


class DraftingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def automation_rule(business: Business) -> AutomationRule:
        return AutomationRule.model_validate((business.settings or {}).get("draft_automation", {}))

    async def update_rule(self, business_id: UUID, rule: AutomationRule) -> AutomationRule:
        business = await self.db.get(Business, business_id, with_for_update=True)
        if business is None:
            raise HTTPException(404, "Business not found")
        business.settings = {**(business.settings or {}), "draft_automation": rule.model_dump()}
        await self.db.flush()
        return rule

    async def _take(self, scope: str, limit: int) -> None:
        insert = postgres_insert if self.db.get_bind().dialect.name == "postgresql" else sqlite_insert
        statement = insert(DraftBudget).values(day=now().date(), scope=scope, used=1)
        statement = statement.on_conflict_do_update(
            index_elements=[DraftBudget.day, DraftBudget.scope],
            set_={"used": DraftBudget.used + 1},
            where=DraftBudget.used < limit,
        ).returning(DraftBudget.used)
        if await self.db.scalar(statement) is None:
            raise HTTPException(429, "Today's AI draft limit has been reached. Limits reset at midnight UTC.")

    async def _expire(self, business_id: UUID) -> None:
        await self.db.execute(update(DraftJob).where(
            DraftJob.business_id == business_id,
            DraftJob.state == "processing",
            DraftJob.created_at < now() - timedelta(seconds=LEASE_SECONDS),
        ).values(state="failed", error="Processing was interrupted. Retry to start a new attempt.", finished_at=now()))

    async def remaining(self, user_id: UUID) -> int:
        used = await self.db.scalar(select(DraftBudget.used).where(
            DraftBudget.day == now().date(), DraftBudget.scope == "user:" + str(user_id),
        ))
        return max(settings.AI_USER_DAILY_LIMIT - (used or 0), 0)

    async def jobs(self, business_id: UUID, state: str | None) -> list[DraftJobView]:
        await self._expire(business_id)
        query = select(DraftJob).where(DraftJob.business_id == business_id)
        if state:
            query = query.where(DraftJob.state == state)
        rows = await self.db.scalars(query.order_by(DraftJob.created_at.desc(), DraftJob.id.desc()).limit(50))
        return [DraftJobView(
            id=row.id, review_id=row.review_id, state=row.state, trigger=row.trigger,
            created_at=as_utc(row.created_at), finished_at=as_utc(row.finished_at) if row.finished_at else None,
            error=row.error,
        ) for row in rows]

    async def run(
        self, business_id: UUID, actor_id: UUID, review_id: UUID, options: GenerateReplyRequest,
        *, trigger: str = "manual", replace: bool = False,
    ) -> Reply:
        review = await self.db.scalar(select(Review.id).where(Review.business_id == business_id, Review.id == review_id))
        if review is None:
            raise HTTPException(404, "Review not found")
        existing = await self.db.scalar(select(Reply).where(Reply.business_id == business_id, Reply.review_id == review_id))
        if existing and not replace:
            return existing
        if not settings.ai_ready:
            raise GenerationUnavailable("Live AI drafting is disabled for this deployment")
        if existing and existing.status == "published":
            raise HTTPException(409, "Published responses cannot be regenerated")

        # End the read transaction before locking the shared budget row.
        await self.db.commit()
        await self._take("global", settings.AI_GLOBAL_DAILY_LIMIT)
        await self._take("user:" + str(actor_id), settings.AI_USER_DAILY_LIMIT)
        await self._expire(business_id)
        active = DraftJob.state == "processing"
        recent = DraftJob.created_at >= now() - timedelta(seconds=LEASE_SECONDS)
        count = await self.db.scalar(select(func.count()).select_from(DraftJob).where(active, recent))
        if (count or 0) >= settings.AI_MAX_CONCURRENT:
            raise HTTPException(429, "AI drafting is busy. Try again shortly.")
        overlap = await self.db.scalar(select(DraftJob.id).where(
            DraftJob.review_id == review_id, active, recent,
        ).limit(1))
        if overlap:
            raise HTTPException(409, "A draft is already being generated for this review")
        job_id = uuid4()
        self.db.add(DraftJob(
            id=job_id, business_id=business_id, actor_id=actor_id, review_id=review_id, state="processing",
            trigger=trigger, options=options.model_dump(),
        ))
        await self.db.commit()

        try:
            async with asyncio.timeout(PROCESSING_TIMEOUT):
                reply = await ReplyService(self.db).generate_reply(
                    business_id, review_id, options.instructions(),
                    reuse_existing=not replace, requested_language=options.language,
                )
            await self._finish(job_id, "completed")
            return reply
        except BaseException as exc:
            await self.db.rollback()
            message = "Drafting exceeded its time limit. Retry to start a new attempt." if isinstance(exc, TimeoutError) else (
                str(exc) if isinstance(exc, GenerationUnavailable) else "Drafting failed. Review the input or retry."
            )
            await self._finish(job_id, "failed", message)
            if isinstance(exc, TimeoutError):
                raise GenerationUnavailable(message) from exc
            raise

    async def _finish(self, job_id: UUID, state: str, error: str | None = None) -> None:
        await self.db.execute(update(DraftJob).where(DraftJob.id == job_id).values(
            state=state, error=error, finished_at=now(),
        ))
        await self.db.commit()

    async def retry(self, business_id: UUID, actor_id: UUID, job_id: UUID) -> Reply:
        await self._expire(business_id)
        job = await self.db.scalar(select(DraftJob).where(DraftJob.id == job_id, DraftJob.business_id == business_id))
        if job is None:
            raise HTTPException(404, "Draft job not found")
        if job.state != "failed":
            raise HTTPException(409, "Only failed jobs can be retried")
        return await self.run(
            business_id, actor_id, job.review_id, GenerateReplyRequest.model_validate(job.options),
            trigger="retry", replace=True,
        )
