from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.reply import ReplyResponse, UtcDatetime
from app.schemas.drafting import DraftLanguage
from app.utils.helpers import as_utc


class ReviewResponse(BaseModel):
    id: UUID
    business_id: UUID
    platform: str
    platform_review_id: Optional[str] = None
    customer_name: str
    title: Optional[str] = None
    rating: int
    review_text: str
    review_date: Optional[UtcDatetime] = None
    reply_text: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    intent: Optional[str] = None
    risk_level: Optional[str] = None
    needs_human_review: bool = False
    is_auto_replied: bool = False
    is_flagged: bool = False
    flag_reason: Optional[str] = None
    language: Optional[str] = None
    metadata: Optional[dict[str, Any]] = Field(None, validation_alias="platform_metadata")
    created_at: UtcDatetime
    updated_at: UtcDatetime
    replied_at: Optional[UtcDatetime] = None
    reply: Optional[ReplyResponse] = None
    is_processed: bool

    model_config = {"from_attributes": True}


class ReviewListResponse(BaseModel):
    items: list[ReviewResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ReviewFilterParams(BaseModel):
    sentiment: Optional[str] = None
    platform: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    risk_level: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None
    response_status: Optional[Literal["unanswered", "pending", "approved", "rejected", "published"]] = None
    sort_by: Literal["created_at", "rating", "sentiment"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class FlagReviewRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class GenerateReplyRequest(BaseModel):
    custom_instructions: Optional[str] = Field(None, max_length=2000)
    tone: Optional[Literal["professional", "friendly", "formal", "empathetic", "concise"]] = None
    length: Optional[Literal["short", "medium", "long"]] = None
    language: DraftLanguage | None = None

    def instructions(self) -> str:
        return "\n".join(filter(None, (
            f"Response tone: {self.tone}." if self.tone else "",
            f"Response length: {self.length}." if self.length else "",
            f"Write the entire customer-facing response in language {self.language}." if self.language else "",
            self.custom_instructions,
        )))


class ManualReviewRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    customer_name: str = Field(default="Anonymous", min_length=1, max_length=255)
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = Field(None, max_length=500)
    content: str = Field(min_length=3, max_length=4000)
    review_date: Optional[datetime] = None

    @field_validator("review_date")
    @classmethod
    def normalize_date(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is None:
            return None
        return as_utc(value)


class WebhookReviewRequest(ManualReviewRequest):
    business_id: UUID
    platform_review_id: str = Field(min_length=1, max_length=255)


class CSVImportRequest(BaseModel):
    csv: str = Field(min_length=1, max_length=256_000)
