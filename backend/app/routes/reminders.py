from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.reminder import Reminder
from app.schemas.reminder import ReminderCreate, ReminderUpdate, ReminderOut
from app.services.auth import get_current_user
from app.models.user import User
from app.scheduler.jobs import calculate_next_occurrence

router = APIRouter(prefix="", tags=["Reminders"])

@router.get("/reminders", response_model=list[ReminderOut])
def get_reminders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Returns all reminders for the user sorted by reminder_datetime
    return db.query(Reminder).filter(
        Reminder.user_id == current_user.id
    ).order_by(Reminder.reminder_datetime.asc()).all()

@router.post("/reminders", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    reminder_in: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_reminder = Reminder(
        user_id=current_user.id,
        title=reminder_in.title,
        description=reminder_in.description,
        reminder_datetime=reminder_in.reminder_datetime,
        priority=reminder_in.priority,
        category=reminder_in.category,
        repeat_type=reminder_in.repeat_type,
        status="pending"
    )
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@router.put("/reminders/{id}", response_model=ReminderOut)
def update_reminder(
    id: int,
    reminder_in: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_reminder = db.query(Reminder).filter(
        Reminder.id == id,
        Reminder.user_id == current_user.id
    ).first()
    
    if not db_reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found."
        )
    
    # Update only provided fields
    update_data = reminder_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_reminder, field, value)
        
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@router.delete("/reminders/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_reminder = db.query(Reminder).filter(
        Reminder.id == id,
        Reminder.user_id == current_user.id
    ).first()
    
    if not db_reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found."
        )
        
    db.delete(db_reminder)
    db.commit()
    return

@router.post("/complete/{id}", response_model=ReminderOut)
def complete_reminder(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_reminder = db.query(Reminder).filter(
        Reminder.id == id,
        Reminder.user_id == current_user.id
    ).first()
    
    if not db_reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found."
        )

    # If it is recurring, roll it to the next occurrence, otherwise mark as completed
    if db_reminder.repeat_type and db_reminder.repeat_type != "none":
        next_date = calculate_next_occurrence(db_reminder.reminder_datetime, db_reminder.repeat_type)
        db_reminder.reminder_datetime = next_date
        db_reminder.status = "pending"
    else:
        db_reminder.status = "completed"
        
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@router.post("/restore/{id}", response_model=ReminderOut)
def restore_reminder(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_reminder = db.query(Reminder).filter(
        Reminder.id == id,
        Reminder.user_id == current_user.id
    ).first()
    
    if not db_reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found."
        )
        
    db_reminder.status = "pending"
    db.commit()
    db.refresh(db_reminder)
    return db_reminder
