import logging
import secrets
from datetime import datetime, time, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_business, get_current_user, get_db, limiter
from app.models.audit_log import AuditLog
from app.models.business import Business
from app.models.reply import Reply
from app.models.usage import UsageMetric
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.reply import ReplyResponse, ReplyUpdateRequest
from app.schemas.drafting import AutomationRule, DraftJobView, JobState
from app.schemas.review import (
    FlagReviewRequest,
    GenerateReplyRequest,
    CSVImportRequest,
    ManualReviewRequest,
    ReviewFilterParams,
    ReviewListResponse,
    ReviewResponse,
    WebhookReviewRequest,
)
from app.services.reply_service import ReplyService, translate_generation_error
from app.services.audit_service import AuditService
from app.services.drafting_service import DraftingService
from app.services.review_service import ReviewService
from app.utils.helpers import as_utc
from sqlalchemy import func

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reviews", tags=["Reviews"])


@router.get("/", response_model=ReviewListResponse)
async def get_reviews(
    sentiment: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    rating: Optional[int] = Query(None, ge=1, le=5),
    risk_level: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=300),
    response_status: Optional[Literal["unanswered", "pending", "approved", "rejected", "published"]] = None,
    sort_by: Literal["created_at", "rating", "sentiment"] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        parsed_date_from: Optional[datetime] = None
        parsed_date_to: Optional[datetime] = None
        try:
            if date_from:
                parsed_date_from = ManualReviewRequest.normalize_date(datetime.fromisoformat(date_from))
            if date_to:
                parsed_date_to = ManualReviewRequest.normalize_date(datetime.fromisoformat(date_to))
                if len(date_to) == 10:
                    parsed_date_to = datetime.combine(parsed_date_to.date(), time.max, timezone.utc)
            if parsed_date_from and parsed_date_to and parsed_date_from > parsed_date_to:
                raise HTTPException(status_code=400, detail="Start date must precede end date")
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Use ISO 8601 (e.g. 2024-01-01T00:00:00)")

        filters = ReviewFilterParams(
            sentiment=sentiment,
            platform=platform,
            rating=rating,
            risk_level=risk_level,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
            search=search,
            response_status=response_status,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size,
        )
        service = ReviewService(db)
        result = await service.get_reviews(business_id=business.id, filters=filters)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch reviews")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch reviews")


@router.get("/stats")
async def get_review_stats(
    current_user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        service = ReviewService(db)
        stats = await service.get_review_stats(business_id=business.id)
        return stats
    except Exception as exc:
        logger.exception("Failed to fetch review stats")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch review stats")


@router.post("/", response_model=ReviewResponse, status_code=201)
async def create_review(
    body: ManualReviewRequest,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    service = ReviewService(db)
    try:
        review = await service.create_manual_review(business.id, body)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await AuditService(db).log(business.id, user.id, "review_added", "review", str(review.id))
    drafts = DraftingService(db)
    rule = drafts.automation_rule(business)
    if rule.enabled and rule.min_rating <= review.rating <= rule.max_rating:
        business_id, review_id, user_id = business.id, review.id, user.id
        await db.commit()
        try:
            await drafts.run(business_id, user_id, review_id, GenerateReplyRequest(language=rule.language), trigger="automation")
        except (HTTPException, ValueError):
            await db.rollback()
        return await service.get_review(business_id, review_id)
    return await service.get_review(business.id, review.id)


@router.get("/workflow")
async def workflow_status(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    awaiting = await db.scalar(select(func.count()).where(
        Reply.business_id == business.id, Reply.status.in_(["pending", "pending_approval"]),
    ))
    generated = await db.scalar(select(func.count()).where(
        UsageMetric.business_id == business.id, UsageMetric.metric_type == "ai_generation",
    ))
    return {"ai_enabled": settings.ai_ready, "provider": settings.AI_PROVIDER, "model": settings.ai_model,
            "awaiting_approval": awaiting, "generated": generated,
            "remaining_today": await DraftingService(db).remaining(user.id), "daily_limit": settings.AI_USER_DAILY_LIMIT}


@router.get("/automation", response_model=AutomationRule)
async def get_automation(business: Business = Depends(get_current_business)):
    return DraftingService.automation_rule(business)


@router.patch("/automation", response_model=AutomationRule)
async def set_automation(
    body: AutomationRule,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    return await DraftingService(db).update_rule(business.id, body)


@router.get("/jobs", response_model=list[DraftJobView])
async def draft_jobs(
    state: JobState | None = None,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    return await DraftingService(db).jobs(business.id, state)


@router.post("/jobs/{job_id}/retry", response_model=SuccessResponse)
@limiter.shared_limit("5/minute", scope="ai-drafting")
async def retry_drafting(
    request: Request,
    job_id: UUID,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        reply = await DraftingService(db).retry(business.id, user.id, job_id)
    except ValueError as exc:
        raise translate_generation_error(exc) from exc
    return SuccessResponse(message="Draft generated", data={"reply_id": str(reply.id)})


@router.post("/import")
async def import_reviews(
    body: CSVImportRequest,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await ReviewService(db).import_csv(business.id, body.csv, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/import/preview")
async def preview_import(body: CSVImportRequest, business: Business = Depends(get_current_business)):
    try:
        entries, errors = ReviewService.parse_csv(body.csv)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"valid": len(entries), "sample": [row.model_dump() for row in entries[:5]], "errors": errors}


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    review_id: UUID,
    current_user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        service = ReviewService(db)
        review = await service.get_review(business_id=business.id, review_id=review_id)
        if not review:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        return review
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch review")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch review")


@router.patch("/{review_id}/flag")
async def flag_review(
    review_id: UUID,
    body: FlagReviewRequest,
    current_user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        service = ReviewService(db)
        review = await service.flag_review(business_id=business.id, review_id=review_id, reason=body.reason)
        if not review:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        await AuditService(db).log(business.id, current_user.id, "review_flagged", "review", str(review_id))
        return SuccessResponse(message="Review flagged successfully", data={"review_id": str(review.id)})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to flag review")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to flag review")


@router.delete("/{review_id}")
async def delete_review(
    review_id: UUID,
    current_user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        service = ReviewService(db)
        review = await service.get_review(business_id=business.id, review_id=review_id)
        if not review:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        await db.execute(delete(AuditLog).where(
            AuditLog.business_id == business.id, AuditLog.resource_type == "review", AuditLog.resource_id == str(review.id),
        ))
        await db.delete(review)
        await db.flush()
        return SuccessResponse(message="Review deleted")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to delete review")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete review")


@router.get("/{review_id}/history")
async def review_history(
    review_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    if not await ReviewService(db).get_review(business.id, review_id):
        raise HTTPException(status_code=404, detail="Review not found")
    rows = await db.execute(select(AuditLog).where(
        AuditLog.business_id == business.id,
        AuditLog.resource_type == "review",
        AuditLog.resource_id == str(review_id),
    ).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(50))
    return [{"id": str(row.id), "action": row.action, "created_at": as_utc(row.created_at),
             "response_version": (row.details or {}).get("response_version")} for row in rows.scalars()]


@router.put("/{review_id}/draft", response_model=ReplyResponse)
async def save_draft(
    review_id: UUID,
    body: ReplyUpdateRequest,
    current_user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        reply = await ReplyService(db).save_draft(business.id, review_id, body.content, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not reply:
        raise HTTPException(status_code=404, detail="Review not found")
    return reply


@router.post("/{review_id}/generate-reply")
@limiter.shared_limit("5/minute", scope="ai-drafting")
async def generate_reply(
    request: Request,
    review_id: UUID,
    body: GenerateReplyRequest = GenerateReplyRequest(),
    current_user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    try:
        reply = await DraftingService(db).run(business.id, current_user.id, review_id, body)
        return SuccessResponse(message="Reply generated successfully", data={"reply_id": str(reply.id), "content": reply.content})
    except HTTPException:
        raise
    except ValueError as exc:
        raise translate_generation_error(exc) from exc
    except Exception as exc:
        logger.exception("Failed to generate reply")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate reply")


@router.post("/webhook/{platform}")
@limiter.limit("30/minute")
async def ingest_webhook(
    request: Request,
    platform: Literal["google", "yelp", "trustpilot", "facebook", "amazon", "email"],
    body: WebhookReviewRequest,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    db: AsyncSession = Depends(get_db),
):
    webhook_secret = settings.WEBHOOK_SECRET
    if not webhook_secret or (
        x_webhook_secret is None or not secrets.compare_digest(x_webhook_secret.encode(), webhook_secret.encode())
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook secret")

    try:
        service = ReviewService(db)
        active = await db.scalar(select(Business.is_active).where(Business.id == body.business_id))
        if not active:
            raise HTTPException(status_code=404, detail="Business not found")
        review = await service.ingest_review(business_id=body.business_id, platform=platform, review_data=body.model_dump())
        return SuccessResponse(message="Review ingested successfully", data={"review_id": str(review.id)})
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to ingest webhook review")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to ingest review")
