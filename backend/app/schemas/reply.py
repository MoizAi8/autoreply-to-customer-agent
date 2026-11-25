from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.utils.helpers import as_utc

UtcDatetime = Annotated[datetime, AfterValidator(as_utc)]


class ReplyGenerateRequest(BaseModel):
    review_id: UUID
    custom_instructions: Optional[str] = Field(None, max_length=2000)


class ReplyGenerateResponse(BaseModel):
    reply: str
    sentiment: str
    confidence: float
    risk_level: str
    needs_human_review: bool
    language: str
    quality_score: float
    safety_score: float
    reasoning_summary: str


class ReplyUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    content: str = Field(..., min_length=1, max_length=4000)


class ReplyRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class ReplyRegenerateRequest(BaseModel):
    custom_instructions: Optional[str] = Field(None, max_length=2000)


class ReplyPublishRequest(BaseModel):
    reply_id: UUID
    schedule_at: Optional[datetime] = None


class WorkflowStep(BaseModel):
    step: str
    status: str
    duration_ms: int


class ReplyResponse(BaseModel):
    id: UUID
    review_id: UUID
    business_id: UUID
    content: str
    status: str
    risk_level: Optional[str] = None
    quality_score: Optional[float] = None
    safety_score: Optional[float] = None
    confidence_score: Optional[float] = None
    is_ai_generated: bool = False
    ai_model_version: Optional[str] = None
    prompt_version: Optional[str] = None
    human_edited: bool = False
    workflow_steps: list[WorkflowStep] = Field(default_factory=list)
    edited_by: Optional[UUID] = None
    published_at: Optional[UtcDatetime] = None
    created_at: UtcDatetime
    updated_at: UtcDatetime

    model_config = {"from_attributes": True}
