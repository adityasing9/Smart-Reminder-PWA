from contextlib import asynccontextmanager
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import engine, Base, SessionLocal
from app.routes import auth, reminders, push
from app.scheduler.jobs import check_and_trigger_reminders
from app.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize background scheduler
scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks:
    # 1. Create tables if they do not exist (fallback/local development)
    try:
        logger.info("Initializing database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to connect to database or create tables: {e}")
        logger.error("Please check your DATABASE_URL, password, and ensure the database is running and accessible.")
    
    # 2. Start the background scheduler
    logger.info("Starting background scheduler...")
    scheduler.add_job(
        check_and_trigger_reminders, 
        "interval", 
        seconds=30, # Check every 30 seconds for quick local responsiveness
        id="check_reminders"
    )
    scheduler.start()
    
    yield
    
    # Shutdown tasks:
    logger.info("Stopping background scheduler...")
    scheduler.shutdown()

app = FastAPI(
    title="Smart Reminder API",
    description="Backend API for Smart Reminder PWA",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS dynamically from settings
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://smart-reminder-pwa.vercel.app"
]

# Add the production frontend URL if configured
if settings.FRONTEND_URL and settings.FRONTEND_URL not in origins:
    origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler to ensure CORS headers are present on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check server logs for details."},
    )

# Include Routers
app.include_router(auth.router)
app.include_router(reminders.router)
app.include_router(push.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Smart Reminder API",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    """Check database connectivity and return diagnostic info."""
    db_status = "unknown"
    db_error = None
    try:
        db = SessionLocal()
        db.execute(db.bind.dialect.do_ping if hasattr(db.bind.dialect, 'do_ping') else __import__('sqlalchemy').text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = "error"
        db_error = str(e)
    
    return {
        "status": "online",
        "database": db_status,
        "database_error": db_error,
        "frontend_url": settings.FRONTEND_URL,
        "cors_origins": origins,
    }

