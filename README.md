# Smart Reminder PWA

A mobile-first, production-ready Progressive Web Application (PWA) built using Next.js (App Router), TypeScript, Tailwind CSS, FastAPI, and MySQL. It features offline task viewing/creation, background synchronization, and Web Push notifications.

## Features
- 🚀 **Progressive Web App**: Installable on iOS & Android ("Add to Home Screen"), custom splash screens, standalone display, and responsive layouts.
- 📶 **Offline-First Mechanics**: Browse, create, toggle, and delete reminders offline. Backed by **IndexedDB** which automatically queues mutations and synchronizes with the server once connection returns.
- 🔔 **Web Push Alerts**: Integrates **VAPID Web Push notifications** via a minute-based scheduler, alerting you on your device even if the PWA window is minimized or closed.
- 🔑 **Secure Authentication**: JWT-based credentials registration and logins, cryptographically hashed passwords.
- 🐳 **Dockerized Stack**: Launch the entire environment (MySQL, API, Frontend) using a single command.

---

## Directory Structure
```
Reminder/
├── docker-compose.yml
├── .env
├── README.md
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy tables (User, Reminder, PushSubscription)
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── routes/        # Router files (auth, reminders, push)
│   │   ├── services/      # Passwords (bcrypt), JWT tokens, PyWebPush sender
│   │   ├── scheduler/     # APScheduler checks (runs check/trigger tasks)
│   │   └── main.py        # FastAPI initialization and lifespan handlers
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
└── frontend/
    ├── public/
    │   ├── manifest.json  # PWA configuration
    │   ├── service-worker.js # Custom caching policies (Cache First, Network First)
    │   └── offline.html   # Custom offline warning page
    ├── src/
    │   ├── app/           # App router views (Dashboard, Login, Register, Settings)
    │   ├── components/    # Reusable UI (BottomNavigation, OfflineIndicator, forms)
    │   └── lib/
    │       ├── api.ts     # API wrapper with online check & DB queue fallbacks
    │       ├── db.ts      # IndexedDB configuration via idb library
    │       └── swRegister.ts # Service worker & Push Notification triggers
    └── Dockerfile
```

---

## Getting Started

### 1. Prerequisites
- Docker & Docker Compose installed.
- Or locally: Node.js (v18+) and Python (v3.10+).

### 2. Configuration (`.env`)
A root-level `.env` file has already been populated with pre-generated VAPID keys for direct out-of-the-box local runs.

If you ever wish to re-generate VAPID keys:
```bash
node -e "const crypto = require('crypto'); const ec = crypto.createECDH('prime256v1'); ec.generateKeys(); console.log('PUB:', ec.getPublicKey('base64url')); console.log('PRIV:', ec.getPrivateKey('base64url'));"
```
Place the resulting keys into `.env`:
- `VAPID_PUBLIC_KEY`: Use generated `PUB`
- `VAPID_PRIVATE_KEY`: Use generated `PRIV`

### 3. Launching via Docker Compose
Build and run the entire stack:
```bash
docker compose up --build
```
Once initialized:
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **FastAPI API**: [http://localhost:8000](http://localhost:8000)
- **API Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Deployment Instructions

### Backend (Google Cloud Run)
1. **Containerize & Push**:
   Build the Docker container and push it to Google Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/reminder-backend ./backend
   ```
2. **Deploy to Cloud Run**:
   Run the deployment command:
   ```bash
   gcloud run deploy reminder-backend \
     --image gcr.io/[PROJECT_ID]/reminder-backend \
     --platform managed \
     --allow-unauthenticated \
     --add-cloudsql-instances [SQL_INSTANCE_CONNECTION_NAME] \
     --update-env-vars DATABASE_URL=mysql+pymysql://[DB_USER]:[DB_PASS]@localhost/[DB_NAME]?unix_socket=/cloudsql/[SQL_INSTANCE_CONNECTION_NAME],JWT_SECRET=[SECRET],VAPID_PUBLIC_KEY=[PUB],VAPID_PRIVATE_KEY=[PRIV]
   ```

### Frontend (Vercel)
1. Install Vercel CLI or log in to the Vercel Dashboard.
2. Link the repository. Select `frontend` as the root directory of the application.
3. Configure the environment variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: Your live Google Cloud Run Backend URL (e.g. `https://reminder-backend-xyz.run.app`).
4. Trigger the deployment.

---

## Offline Caching Strategy
- **App Shell (JS, CSS, static images)**: Cache-First. Loads instantly from local service worker cache.
- **Data (API `/reminders`)**: Network-First. Fetches live database items when connected, falling back to local IndexedDB when offline.
- **Mutations (Creation/Toggle/Delete)**: Executes instantly in local IndexedDB. Places operation in a queue. When the connection returns, the browser registers background sync and sequentially updates the server.
