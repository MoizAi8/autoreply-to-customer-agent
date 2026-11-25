from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.utils.helpers import now


class DraftBudget(Base):
    __tablename__ = "draft_budgets"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    scope: Mapped[str] = mapped_column(String(72), primary_key=True)
    used: Mapped[int] = mapped_column(Integer, nullable=False)


class DraftJob(Base):
    __tablename__ = "draft_jobs"
    __table_args__ = (Index("ix_draft_jobs_business_created", "business_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    business_id: Mapped[UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    review_id: Mapped[UUID] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    state: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    trigger: Mapped[str] = mapped_column(String(24), nullable=False)
    options: Mapped[dict] = mapped_column(JSON, nullable=False)
    error: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
