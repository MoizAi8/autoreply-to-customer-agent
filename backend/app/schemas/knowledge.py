from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category: str = Field(default="general", min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=5000)
    metadata: dict[str, Any] | None = None


class KnowledgeUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category: str | None = Field(None, min_length=1, max_length=50)
    title: str | None = Field(None, min_length=1, max_length=500)
    content: str | None = Field(None, min_length=1, max_length=5000)
    metadata: dict[str, Any] | None = None
