from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


JobState = Literal["processing", "completed", "failed"]
DraftLanguage = Literal["en", "ur", "hi", "ar", "de"]


class AutomationRule(BaseModel):
    enabled: bool = False
    min_rating: int = Field(default=1, ge=1, le=5)
    max_rating: int = Field(default=5, ge=1, le=5)
    language: DraftLanguage | None = None

    @model_validator(mode="after")
    def validate_range(self):
        if self.min_rating > self.max_rating:
            raise ValueError("Minimum rating must not exceed maximum rating")
        return self


class DraftJobView(BaseModel):
    id: UUID
    review_id: UUID
    state: JobState
    trigger: str
    created_at: datetime
    finished_at: datetime | None
    error: str | None
