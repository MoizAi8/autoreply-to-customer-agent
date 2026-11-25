from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.review import Review
from app.models.reply import Reply
from app.schemas.review import ManualReviewRequest, ReviewFilterParams
from app.services.audit_service import AuditService
from app.utils.helpers import now

class ReviewService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def ingest_review(self, business_id: UUID, platform: str, review_data: dict) -> Review:
        platform_review_id = review_data.get("platform_review_id") or review_data.get("id")
        if platform_review_id:
            existing = await self.db.execute(
                select(Review).where(
                    Review.business_id == business_id,
                    Review.platform == platform,
                    Review.platform_review_id == platform_review_id,
                )
            )
            if existing.scalars().first():
                raise ValueError("Duplicate review: already ingested")

        review = Review(
            id=uuid4(),
            business_id=business_id,
            platform=platform,
            platform_review_id=platform_review_id or "",
            customer_name=review_data.get("customer_name", "Anonymous"),
            customer_email=review_data.get("customer_email"),
            rating=review_data.get("rating", 3),
            title=review_data.get("title"),
            content=review_data.get("content") or review_data.get("review_text", ""),
            language=review_data.get("language"),
            platform_metadata=review_data.get("metadata", review_data.get("platform_metadata", {})),
            review_date=review_data.get("review_date") or now(),
            is_processed=False,
        )
        try:
            async with self.db.begin_nested():
                self.db.add(review)
                await self.db.flush()
        except IntegrityError:
            if platform_review_id:
                duplicate = await self.db.scalar(select(Review.id).where(
                    Review.business_id == business_id,
                    Review.platform == platform,
                    Review.platform_review_id == platform_review_id,
                ))
                if duplicate:
                    raise ValueError("Duplicate review: already ingested") from None
            raise
        return review

    async def create_manual_review(self, business_id: UUID, entry: ManualReviewRequest) -> Review:
        data = entry.model_dump()
        normalized = json.dumps(entry.model_dump(mode="json"), sort_keys=True, ensure_ascii=False)
        data["platform_review_id"] = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return await self.ingest_review(business_id, "manual", data)

    async def import_csv(self, business_id: UUID, content: str, user_id: UUID) -> dict[str, Any]:
        entries = []
        errors = []
        reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff"), newline=""), strict=True)
        try:
            headers = reader.fieldnames or []
            required = {"rating", "content"}
            optional = {"customer_name", "title", "review_date"}
            if len(headers) != len(set(headers)) or not required <= set(headers) <= required | optional:
                raise ValueError("CSV requires rating and content. Optional columns are customer_name, title and review_date.")
            for index, row in enumerate(reader, start=1):
                if index > 200:
                    raise ValueError("CSV imports are limited to 200 reviews.")
                row_number = reader.line_num
                if None in row or any(value is None for value in row.values()):
                    errors.append({"row": row_number, "message": "Column count does not match the header."})
                    continue
                try:
                    entries.append(ManualReviewRequest.model_validate({
                        key: value for key, value in row.items() if value or key in required
                    }))
                except ValidationError as exc:
                    fields = ", ".join(str(item["loc"][0]) for item in exc.errors())
                    errors.append({"row": row_number, "message": f"Invalid fields: {fields}."})
        except csv.Error as exc:
            raise ValueError(f"Malformed CSV near line {reader.line_num}.") from exc
        if not entries and not errors:
            raise ValueError("The CSV contains no reviews.")
        imported = duplicates = 0
        audit = AuditService(self.db)
        for entry in entries:
            try:
                review = await self.create_manual_review(business_id, entry)
            except ValueError:
                duplicates += 1
                continue
            await audit.log(business_id, user_id, "review_added", "review", str(review.id), details={"source": "csv"})
            imported += 1
        return {"imported": imported, "duplicates": duplicates, "errors": errors}

    async def get_reviews(
        self, business_id: UUID, filters: ReviewFilterParams
    ) -> dict[str, Any]:
        query = (
            select(Review)
            .where(Review.business_id == business_id)
            .options(selectinload(Review.reply))
        )

        if filters.sentiment:
            query = query.where(Review.sentiment == filters.sentiment)
        if filters.platform:
            query = query.where(Review.platform == filters.platform)
        if filters.rating:
            query = query.where(Review.rating == filters.rating)
        if filters.risk_level:
            query = query.where(Review.risk_level == filters.risk_level)
        if filters.date_from:
            query = query.where(Review.review_date >= filters.date_from)
        if filters.date_to:
            query = query.where(Review.review_date <= filters.date_to)
        if filters.response_status == "unanswered":
            query = query.where(~Review.reply.has(Reply.business_id == business_id))
        elif filters.response_status:
            statuses = ["pending", "pending_approval"] if filters.response_status == "pending" else [filters.response_status]
            query = query.where(Review.reply.has((Reply.business_id == business_id) & Reply.status.in_(statuses)))
        if filters.search:
            query = query.where(
                or_(
                    Review.content.icontains(filters.search, autoescape=True),
                    Review.customer_name.icontains(filters.search, autoescape=True),
                    Review.title.icontains(filters.search, autoescape=True),
                )
            )

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        offset = (filters.page - 1) * filters.page_size
        column = getattr(Review, filters.sort_by)
        order = column.asc() if filters.sort_order == "asc" else column.desc()
        query = query.order_by(order, Review.id.desc()).offset(offset).limit(filters.page_size)
        result = await self.db.execute(query)
        reviews = result.scalars().all()

        return {
            "items": reviews,
            "total": total,
            "page": filters.page,
            "page_size": filters.page_size,
            "total_pages": max(1, (total + filters.page_size - 1) // filters.page_size),
        }

    async def get_review(self, business_id: UUID, review_id: UUID) -> Optional[Review]:
        result = await self.db.execute(
            select(Review)
            .where(Review.business_id == business_id, Review.id == review_id)
            .options(selectinload(Review.reply))
        )
        return result.scalar_one_or_none()

    async def flag_review(self, business_id: UUID, review_id: UUID, reason: str) -> Optional[Review]:
        result = await self.db.execute(
            select(Review).where(Review.business_id == business_id, Review.id == review_id)
        )
        review = result.scalar_one_or_none()
        if not review:
            return None
        review.is_flagged = True
        review.flag_reason = reason
        await self.db.flush()
        await self.db.refresh(review)
        return review

    async def get_review_stats(self, business_id: UUID) -> dict[str, Any]:
        total_result = await self.db.execute(
            select(func.count()).where(
                Review.business_id == business_id
            )
        )
        total = total_result.scalar() or 0

        pending_result = await self.db.execute(
            select(func.count()).where(
                Review.business_id == business_id,
                Review.is_processed == True,
                ~Review.id.in_(
                    select(Reply.review_id).where(Reply.business_id == business_id)
                ),
            )
        )
        pending = pending_result.scalar() or 0

        auto_replied_result = await self.db.execute(
            select(func.count()).where(
                Review.business_id == business_id,
                Review.id.in_(
                    select(Reply.review_id).where(
                        Reply.business_id == business_id, Reply.status == "published"
                    )
                ),
            )
        )
        auto_replied = auto_replied_result.scalar() or 0

        avg_result = await self.db.execute(
            select(func.avg(Review.rating)).where(Review.business_id == business_id)
        )
        avg_rating = float(avg_result.scalar() or 0.0)

        platform_rows = await self.db.execute(
            select(Review.platform, func.count().label("cnt"))
            .where(Review.business_id == business_id)
            .group_by(Review.platform)
        )
        platform_counts = {row[0]: row[1] for row in platform_rows}

        sentiment_rows = await self.db.execute(
            select(Review.sentiment, func.count().label("cnt"))
            .where(
                Review.business_id == business_id,
                Review.sentiment.isnot(None),
            )
            .group_by(Review.sentiment)
        )
        sentiment_breakdown = {row[0]: row[1] for row in sentiment_rows}

        return {
            "total": total,
            "pending": pending,
            "auto_replied": auto_replied,
            "manual_replied": total - pending - auto_replied,
            "avg_rating": round(avg_rating, 2),
            "platform_counts": platform_counts,
            "sentiment_breakdown": sentiment_breakdown,
        }
