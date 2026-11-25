from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform import PlatformConnection
from app.models.reply import Reply
from app.models.review import Review
from app.models.usage import UsageMetric
from app.utils.helpers import now


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_dashboard_stats(self, business_id: UUID) -> dict[str, Any]:
        total_reviews_result = await self.db.execute(
            select(func.count()).where(Review.business_id == business_id)
        )
        total_reviews = total_reviews_result.scalar() or 0

        status_rows = await self.db.execute(select(Reply.status, func.count()).where(
            Reply.business_id == business_id,
        ).group_by(Reply.status))
        statuses = dict(status_rows.tuples().all())
        approved = statuses.get("approved", 0)
        published = statuses.get("published", 0)
        pending_replies = total_reviews - approved - published
        rating_rows = await self.db.execute(select(Review.rating, func.count()).where(
            Review.business_id == business_id,
        ).group_by(Review.rating))
        ratings = {str(rating): count for rating, count in rating_rows}
        sentiment_rows = await self.db.execute(select(Review.sentiment, func.count()).where(
            Review.business_id == business_id,
            Review.sentiment.isnot(None),
        ).group_by(Review.sentiment))
        sentiments = dict(sentiment_rows.tuples().all())

        avg_rating_result = await self.db.execute(
            select(func.avg(Review.rating)).where(Review.business_id == business_id)
        )
        avg_rating = round(float(avg_rating_result.scalar() or 0.0), 2)

        now_utc = now()
        month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        ai_usage_result = await self.db.execute(
            select(func.count()).where(
                UsageMetric.business_id == business_id,
                UsageMetric.metric_type == "ai_generation",
                UsageMetric.created_at >= month_start,
            )
        )
        ai_usage = ai_usage_result.scalar() or 0

        elapsed_seconds = (
            (func.julianday(Reply.published_at) - func.julianday(Review.created_at)) * 86400
            if self.db.bind.dialect.name == "sqlite"
            else func.extract("epoch", Reply.published_at - Review.created_at)
        )
        response_time_result = await self.db.execute(
            select(func.avg(elapsed_seconds)).select_from(
                Reply.__table__.join(
                    Review.__table__,
                    Reply.review_id == Review.id,
                )
            ).where(
                Review.business_id == business_id,
                Reply.published_at.isnot(None),
            )
        )
        avg_seconds = response_time_result.scalar()
        avg_response_time = round(avg_seconds / 3600, 2) if avg_seconds else 0.0

        platforms_result = await self.db.execute(
            select(func.count()).where(
                PlatformConnection.business_id == business_id,
                PlatformConnection.is_active == True,
            )
        )
        connected_platforms = platforms_result.scalar() or 0

        return {
            "total_reviews": total_reviews,
            "pending_replies": pending_replies,
            "auto_replied": published,
            "manual_replies": approved,
            "approved_replies": approved,
            "published_replies": published,
            "completion_rate": round(100 * (approved + published) / total_reviews, 1) if total_reviews else 0.0,
            "ratings": ratings,
            "sentiments": sentiments,
            "avg_rating": avg_rating,
            "ai_usage": ai_usage,
            "avg_response_time": avg_response_time,
            "connected_platforms": connected_platforms,
        }

    async def get_sentiment_trends(
        self, business_id: UUID, days: int = 30
    ) -> list[dict[str, Any]]:
        today = now().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff = today - timedelta(days=days - 1)
        date = func.date(Review.review_date) if self.db.bind.dialect.name == "sqlite" else func.date(func.timezone("UTC", Review.review_date))
        rows = await self.db.execute(
            select(
                date.label("date"),
                Review.sentiment,
                func.count().label("cnt"),
            )
            .where(
                Review.business_id == business_id,
                Review.review_date >= cutoff,
                Review.sentiment.isnot(None),
            )
            .group_by(date, Review.sentiment)
            .order_by(date)
        )

        trends: dict[str, dict[str, int]] = {}
        sentiments = ["positive", "neutral", "negative", "very_negative"]
        for i in range(days):
            day = (cutoff + timedelta(days=i)).strftime("%Y-%m-%d")
            trends[day] = {s: 0 for s in sentiments}

        for row in rows:
            day_str = str(row.date)
            if day_str in trends and row.sentiment in sentiments:
                trends[day_str][row.sentiment] = row.cnt

        return [
            {"date": day, **counts} for day, counts in sorted(trends.items())
        ]

    async def get_platform_performance(self, business_id: UUID) -> list[dict[str, Any]]:
        subq = (
            select(
                Review.platform,
                func.count().label("total"),
                func.avg(Review.rating).label("avg_rating"),
            )
            .where(Review.business_id == business_id)
            .group_by(Review.platform)
        ).subquery()

        replied_subq = (
            select(
                Review.platform,
                func.count().label("replied"),
            )
            .where(
                Review.business_id == business_id,
                Review.id.in_(
                    select(Reply.review_id).where(Reply.business_id == business_id)
                ),
            )
            .group_by(Review.platform)
        ).subquery()

        query = (
            select(
                subq.c.platform,
                subq.c.total,
                subq.c.avg_rating,
                func.coalesce(replied_subq.c.replied, 0).label("replied"),
            )
            .outerjoin(
                replied_subq,
                subq.c.platform == replied_subq.c.platform,
            )
        )

        rows = await self.db.execute(query)
        results = []
        for row in rows:
            results.append({
                "platform": row.platform,
                "total": row.total,
                "avg_rating": round(float(row.avg_rating or 0.0), 2),
                "replied": row.replied,
                "pending": row.total - row.replied,
            })
        return results

    async def get_monthly_activity(
        self, business_id: UUID, months: int = 12
    ) -> list[dict[str, Any]]:
        current = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last = current.year * 12 + current.month - 1
        periods = [current.replace(year=n // 12, month=n % 12 + 1) for n in range(last - months + 1, last + 1)]
        cutoff = periods[0]

        async def count_by_month(model, *filters):
            date = model.created_at
            month = (
                func.strftime("%Y-%m", date) if self.db.bind.dialect.name == "sqlite"
                else func.to_char(func.timezone("UTC", date), "YYYY-MM")
            )
            rows = await self.db.execute(select(month, func.count()).where(
                model.business_id == business_id, date >= cutoff, *filters,
            ).group_by(month))
            return dict(rows.tuples().all())

        reviews = await count_by_month(Review)
        replies = await count_by_month(Reply)
        generations = await count_by_month(UsageMetric, UsageMetric.metric_type == "ai_generation")
        return [
            {"month": month, "reviews": reviews.get(month, 0), "replies": replies.get(month, 0),
             "ai_generations": generations.get(month, 0)}
            for month in (date.strftime("%Y-%m") for date in periods)
        ]
