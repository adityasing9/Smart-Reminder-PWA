import json
import logging
from pywebpush import webpush, WebPushException
from app.config import settings

logger = logging.getLogger(__name__)

def send_web_push(subscription: dict, payload: dict) -> bool:
    """
    Sends a web push notification using pywebpush.
    :param subscription: dict containing 'endpoint', 'keys' (with 'p256dh' and 'auth')
    :param payload: dict representing the JSON body sent to service worker
    :return: True if successful, False if the subscription has expired (status 404 or 410)
    """
    # If keys are missing, we cannot send
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys are not configured. Cannot send push notification.")
        return False

    try:
        # Convert keys/endpoint model structure to pywebpush input format
        subscription_info = {
            "endpoint": subscription["endpoint"],
            "keys": {
                "p256dh": subscription["p256dh"],
                "auth": subscription["auth"]
            }
        }
        
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL}
        )
        return True
    except WebPushException as ex:
        logger.error(f"WebPushException: {ex}")
        if ex.response is not None:
            # 404 (Not Found) or 410 (Gone) indicates the subscription has expired or is invalid
            if ex.response.status_code in [404, 410]:
                logger.info(f"Subscription expired: status {ex.response.status_code}. Deleting subscription.")
                return False
        return True # Treat other exceptions as temporary network errors or non-fatal
    except Exception as ex:
        logger.error(f"Failed to send web push: {ex}")
        return True
