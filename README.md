# Smart Reminder PWA

A full-stack Progressive Web App for managing reminders with push notifications, offline support, and recurring schedules.

## Tech Stack

- **Frontend**: Next.js 16 + TypeScript + TailwindCSS
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Database**: Supabase (PostgreSQL)
- **Push Notifications**: Web Push (VAPID)
- **Offline**: IndexedDB + Service Worker + Background Sync

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Next.js PWA    │────▶│   FastAPI API     │────▶│    Supabase      │
│   (Vercel)       │     │   (Render)        │     │   (PostgreSQL)   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Setup Environment Variables

Copy and edit the `.env` file in the project root:

```env
# Supabase PostgreSQL Connection
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

# Backend Config
JWT_SECRET=your_jwt_secret_here
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_CLAIM_EMAIL=mailto:your@email.com

# Frontend
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Tables are auto-created in Supabase on first startup.

### 3. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

### Backend → Render

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Set:
   - **Root Directory**: `backend`
   - **Runtime**: Docker
5. Add environment variables:
   - `DATABASE_URL` = your Supabase connection string
   - `JWT_SECRET` = a strong secret key
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIM_EMAIL`
   - `FRONTEND_URL` = your Vercel URL (after deploying frontend)
6. Deploy

### Frontend → Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**
2. Import your GitHub repo
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL (e.g. `https://smart-reminder-api.onrender.com`)
5. Deploy

### Post-Deployment

After both are deployed, update:
- **Render**: Set `FRONTEND_URL` = your Vercel URL (e.g. `https://smart-reminder-pwa.vercel.app`)
- Redeploy the backend on Render to apply the CORS update

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | Login and get JWT token |
| GET | `/reminders` | Get all reminders (auth required) |
| POST | `/reminders` | Create a reminder |
| PUT | `/reminders/{id}` | Update a reminder |
| DELETE | `/reminders/{id}` | Delete a reminder |
| POST | `/complete/{id}` | Complete/rollover a reminder |
| POST | `/restore/{id}` | Restore a completed reminder |
| GET | `/push/vapid-public-key` | Get VAPID public key |
| POST | `/push/subscribe` | Subscribe to push notifications |
| POST | `/push/unsubscribe` | Unsubscribe from push |
