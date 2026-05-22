import calendar
from datetime import datetime, timedelta
import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.reminder import Reminder
from app.models.subscription import PushSubscription
from app.services.push_notification import send_web_push

logger = logging.getLogger(__name__)

def add_months(sourcedate: datetime, months: int) -> datetime:
    month = sourcedate.month - 1 + months
    year = sourcedate.year + month // 12
    month = month % 12 + 1
    day = min(sourcedate.day, calendar.monthrange(year, month)[1])
    return sourcedate.replace(year=year, month=month, day=day)

def add_years(sourcedate: datetime, years: int) -> datetime:
    try:
        return sourcedate.replace(year=sourcedate.year + years)
    except ValueError:
        # Handle Feb 29 on leap years falling on non-leap years
        return sourcedate.replace(year=sourcedate.year + years, day=28)

def calculate_next_occurrence(current_time: datetime, repeat_type: str) -> datetime:
    if repeat_type == "daily":
        return current_time + timedelta(days=1)
    elif repeat_type == "weekly":
        return current_time + timedelta(weeks=1)
    elif repeat_type == "monthly":
        return add_months(current_time, 1)
    elif repeat_type == "yearly":
        return add_years(current_time, 1)
    return current_time

def check_and_trigger_reminders():
    """
    Scans the database for due reminders, sends Web Push notifications, 
    and handles recurring or overdue status updates.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now()
        # Find all pending reminders that are due
        due_reminders = db.query(Reminder).filter(
            Reminder.status == "pending",
            Reminder.reminder_datetime <= now
        ).all()

        if not due_reminders:
            return

        logger.info(f"Found {len(due_reminders)} due reminders to process.")

        for reminder in due_reminders:
            # 1. Fetch subscriptions for the user
            subscriptions = db.query(PushSubscription).filter(
                PushSubscription.user_id == reminder.user_id
            ).all()

            # 2. Build payload
            payload = {
                "title": "Reminder Time",
                "body": reminder.title,
                "url": f"/reminder/{reminder.id}",
                "tag": f"reminder-{reminder.id}",
                "priority": reminder.priority,
                "category": reminder.category
            }

            # 3. Send Web Push to all user's registered devices
            dead_subscriptions = []
            for sub in subscriptions:
                sub_dict = {
                    "endpoint": sub.endpoint,
                    "p256dh": sub.p256dh,
                    "auth": sub.auth
                }
                success = send_web_push(sub_dict, payload)
                if not success:
                    # Mark subscription for deletion if it has expired
                    dead_subscriptions.append(sub)

            # Delete any expired subscriptions
            for old_sub in dead_subscriptions:
                db.delete(old_sub)

            # 4. Update reminder status / handle recurrence
            if reminder.repeat_type and reminder.repeat_type != "none":
                # Calculate next occurrence
                next_datetime = calculate_next_occurrence(reminder.reminder_datetime, reminder.repeat_type)
                # Keep pending, but move time forward
                reminder.reminder_datetime = next_datetime
                logger.info(f"Reminder '{reminder.title}' rescheduled to {next_datetime} (repeat: {reminder.repeat_type})")
            else:
                # Non-recurring: mark as overdue since the alert was fired
                reminder.status = "overdue"
                logger.info(f"Reminder '{reminder.title}' marked as overdue")

        # Commit all updates and deletes
        db.commit()

    except Exception as ex:
        logger.error(f"Error in scheduler job check_and_trigger_reminders: {ex}")
        db.rollback()
    finally:
        db.close()
