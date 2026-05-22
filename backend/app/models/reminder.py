from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.database import Base

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    reminder_datetime = Column(DateTime, nullable=False, index=True)
    priority = Column(String(20), default="medium", nullable=False) # low, medium, high
    category = Column(String(50), default="general", nullable=False)
    repeat_type = Column(String(20), default="none", nullable=False) # none, daily, weekly, monthly, yearly
    status = Column(String(20), default="pending", nullable=False) # pending, completed, overdue
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="reminders")
