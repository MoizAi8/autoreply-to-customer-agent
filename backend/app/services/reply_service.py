from __future__ import annotations

from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.reply import Reply
from app.models.review import Review
from app.services.audit_service import AuditService

def translate_generation_error(exc: ValueError) -> HTTPException:
    from app.agents.orchestrator import GenerationConflict, GenerationUnavailable, ReviewNotFound

    status = {GenerationConflict: 409, GenerationUnavailable: 503, ReviewNotFound: 404}
    return HTTPException(status_code=status.get(type(exc), 400), detail=str(exc))


class ReplyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_reply(
        self, business_id: UUID, review_id: UUID, custom_instructions: Optional[str] = None,
        *, reuse_existing: bool = True,
    ) -> Reply:
        from app.agents.orchestrator import AIOrchestrator

        orchestrator = AIOrchestrator(self.db)
        try:
            result = await orchestrator.process_review(
                business_id, review_id, custom_instructions=custom_instructions, reuse_existing=reuse_existing
            )
        finally:
            await orchestrator.openai_client.close()
        await self.db.flush()
        await self.db.refresh(result.reply)
        return result.reply

    async def _locked_reply(self, business_id: UUID, reply_id: UUID) -> Optional[Reply]:
        return await self.db.scalar(
            select(Reply).where(Reply.business_id == business_id, Reply.id == reply_id).with_for_update()
        )

    async def _record(self, reply: Reply, action: str, user_id: UUID) -> Reply:
        await AuditService(self.db).log(
            reply.business_id, user_id, action, "review", str(reply.review_id),
            details={"reply_id": str(reply.id), "status": reply.status},
        )
        return reply

    async def save_draft(self, business_id: UUID, review_id: UUID, content: str, user_id: UUID) -> Optional[Reply]:
        review = await self.db.scalar(
            select(Review).where(Review.id == review_id, Review.business_id == business_id).with_for_update()
        )
        if not review:
            return None
        reply_id = await self.db.scalar(select(Reply.id).where(Reply.review_id == review_id, Reply.business_id == business_id))
        if reply_id:
            return await self.update_reply(business_id, reply_id, content, user_id)
        reply = Reply(
            id=uuid4(), business_id=business_id, review_id=review_id, content=content, status="pending_approval",
            ai_metadata={"source": "manual", "human_edited": True},
        )
        self.db.add(reply)
        return await self._record(reply, "draft_created", user_id)

    async def update_reply(self, business_id: UUID, reply_id: UUID, content: str, user_id: UUID) -> Optional[Reply]:
        reply = await self._locked_reply(business_id, reply_id)
        if reply and reply.content != content:
            if reply.status == "published":
                raise ValueError("Published responses cannot be edited")
            reply.content = content
            reply.status = "pending_approval"
            reply.rejection_reason = None
            reply.quality_score = None
            reply.safety_score = None
            reply.ai_metadata = {**(reply.ai_metadata or {}), "human_edited": True}
            return await self._record(reply, "draft_updated", user_id)
        return reply

    async def approve_reply(self, business_id: UUID, reply_id: UUID, user_id: UUID) -> Optional[Reply]:
        reply = await self._locked_reply(business_id, reply_id)
        if reply and reply.status != "approved":
            if reply.status not in ("pending", "pending_approval"):
                raise ValueError("Only a draft awaiting approval can be approved")
            reply.status = "approved"
            return await self._record(reply, "reply_approved", user_id)
        return reply

    async def reject_reply(self, business_id: UUID, reply_id: UUID, reason: str, user_id: UUID) -> Optional[Reply]:
        reply = await self._locked_reply(business_id, reply_id)
        if reply and reply.status != "rejected":
            if reply.status not in ("pending", "pending_approval"):
                raise ValueError("Only a draft awaiting approval can be rejected")
            reply.status = "rejected"
            reply.rejection_reason = reason
            return await self._record(reply, "reply_rejected", user_id)
        return reply

    async def publish_reply(self, business_id: UUID, reply_id: UUID) -> Optional[Reply]:
        raise ValueError("External publishing is unavailable. Copy the approved response to publish it manually.")

    async def regenerate_reply(
        self, business_id: UUID, review_id: UUID, custom_instructions: Optional[str] = None,
    ) -> Reply:
        return await self.generate_reply(business_id, review_id, custom_instructions, reuse_existing=False)

    async def get_pending_replies(self, business_id: UUID) -> list[Reply]:
        result = await self.db.execute(
            select(Reply)
            .where(
                Reply.business_id == business_id,
                Reply.status.in_(["pending", "pending_approval"]),
            )
            .options(selectinload(Reply.review))
            .order_by(Reply.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_reply(self, business_id: UUID, reply_id: UUID) -> Optional[Reply]:
        result = await self.db.execute(
            select(Reply)
            .where(Reply.business_id == business_id, Reply.id == reply_id)
            .options(selectinload(Reply.review))
        )
        return result.scalar_one_or_none()
