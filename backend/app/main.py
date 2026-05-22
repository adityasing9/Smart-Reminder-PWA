from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import engine, Base
from app.routes import auth, reminders, push
from app.scheduler.jobs import check_and_trigger_reminders

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize background scheduler
scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks:
    # 1. Create tables if they do not exist (fallback/local development)
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
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

# Configure CORS
# For safety in local testing and hosting targets
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://smart-reminder-pwa.vercel.app",  # Production NextJS UI
    "*", # Allow all temporarily for easy development/Docker orchestration
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
