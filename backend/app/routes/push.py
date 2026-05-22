from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.subscription import PushSubscription
from app.schemas.subscription import PushSubscriptionCreate, PushSubscriptionOut
from app.services.auth import get_current_user
from app.models.user import User
from app.config import settings

router = APIRouter(prefix="/push", tags=["Push Notifications"])

@router.get("/vapid-public-key")
def get_vapid_public_key():
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VAPID public key is not configured on the server."
        )
    return {"publicKey": settings.VAPID_PUBLIC_KEY}

@router.post("/subscribe", response_model=PushSubscriptionOut, status_code=status.HTTP_201_CREATED)
def subscribe(
    subscription_in: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if this endpoint is already registered for this user
    existing = db.query(PushSubscription).filter(
        PushSubscription.endpoint == subscription_in.endpoint,
        PushSubscription.user_id == current_user.id
    ).first()
    
    if existing:
        # If it already exists, just return it
        return existing
        
    db_sub = PushSubscription(
        user_id=current_user.id,
        endpoint=subscription_in.endpoint,
        p256dh=subscription_in.keys.p256dh,
        auth=subscription_in.keys.auth
    )
    
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    endpoint_data: dict,  # Expect {"endpoint": "..."}
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    endpoint = endpoint_data.get("endpoint")
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Endpoint is required."
        )
        
    db_sub = db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint,
        PushSubscription.user_id == current_user.id
    ).first()
    
    if db_sub:
        db.delete(db_sub)
        db.commit()
        
    return
