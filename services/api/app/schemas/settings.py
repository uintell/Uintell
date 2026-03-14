from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SettingsResponse(BaseModel):
    values: dict[str, Any]


class UpdateSettingsRequest(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)
