from datetime import datetime
from pydantic import BaseModel, Field

class ReminderBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    reminder_datetime: datetime
    priority: str = "medium"  # low, medium, high
    category: str = "general"
    repeat_type: str = "none"  # none, daily, weekly, monthly, yearly

class ReminderCreate(ReminderBase):
    pass

class ReminderUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    reminder_datetime: datetime | None = None
    priority: str | None = None
    category: str | None = None
    repeat_type: str | None = None
    status: str | None = None

class ReminderOut(ReminderBase):
    id: int
    user_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
