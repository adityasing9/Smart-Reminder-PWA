<h1 align="center">
  <br>
  Smart Reminder PWA
  <br>
</h1>

<h4 align="center">A full-stack Progressive Web App for managing intelligent, recurring reminders with push notifications and seamless offline support.</h4>

<p align="center">
  <a href="https://smart-reminder-pwa.vercel.app/"><img src="https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel"></a>
  <a href="https://smart-reminder-pwa.onrender.com/"><img src="https://img.shields.io/badge/Backend%20API-Render-46E3B7?style=for-the-badge&logo=render"></a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#live-urls">Live URLs</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#local-development">Local Development</a> •
  <a href="#api-endpoints">API Endpoints</a>
</p>

---

## ✨ Features

- **📱 Native Android App (APK)**: Converted into a native Android app powered by Capacitor.
- **🔔 Proper High-Priority Notifications**: Native device alarms, heads-up notifications, vibration, sound, and Android Doze-mode bypass for guaranteed reminder delivery.
- **🔄 In-App Updates**: Built-in update detector that checks GitHub Releases for new APK versions and lets users update with a single tap.
- **🚀 Automated CI/CD Releases**: GitHub Actions automatically compiles, signs, and attaches the APK to GitHub Releases on tag push or manual click.
- **📴 Offline Support**: Fully functional without internet connection. Data syncs automatically in the background when reconnected using IndexedDB and Service Workers.
- **🔄 Recurring Reminders**: Flexible scheduling for daily, weekly, or custom interval reminders.
- **🔒 Secure Authentication**: JWT-based secure user authentication.

---

## 🌐 Live URLs

- **Frontend Application**: [https://smart-reminder-pwa.vercel.app/](https://smart-reminder-pwa.vercel.app/)
- **Backend API**: [https://smart-reminder-pwa.onrender.com/](https://smart-reminder-pwa.onrender.com/)

---

## 🛠 Tech Stack

| Layer | Technology | Description |
|-------|------------|-------------|
| **Frontend** | Next.js 16 (React) | UI Framework with App Router |
| | TypeScript | Type safety and autocompletion |
| | Tailwind CSS | Utility-first styling |
| | Service Workers | Offline caching and push notifications |
| **Backend** | FastAPI (Python) | High-performance asynchronous API |
| | SQLAlchemy 2.0 | Advanced ORM for database interactions |
| | APScheduler | Background job scheduling for reminders |
| **Database** | PostgreSQL | Robust relational database |
| | Supabase | Managed DB hosting |

---

## 🏗 Architecture

```mermaid
graph LR
    subgraph Frontend [Next.js PWA - Vercel]
        UI[User Interface]
        SW[Service Worker]
        IDB[(IndexedDB)]
        UI <--> SW
        SW <--> IDB
    end

    subgraph Backend [FastAPI API - Render]
        API[REST API]
        Cron[APScheduler]
    end

    subgraph Data [Supabase]
        DB[(PostgreSQL)]
    end

    UI -- HTTP/REST --> API
    SW -- Background Sync --> API
    API <--> DB
    Cron <--> DB
    Cron -- Web Push --> SW
```

---

## 💻 Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- A free [Supabase](https://supabase.com) project

### 1. Setup Environment Variables

Copy the `.env.example` or create a `.env` file in the project root:

```env
# Supabase PostgreSQL Connection
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

# Backend Security
JWT_SECRET=your_super_secret_jwt_key_here

# Web Push Keys (Generate using: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_CLAIM_EMAIL=mailto:your@email.com

# Frontend Config
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Run Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
*Note: Database tables are automatically created on first startup.*

### 3. Run Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🚀 Deployment

1. **Database**: Host a PostgreSQL instance on Supabase.
2. **Backend**: Deploy the `backend` folder to [Render](https://render.com) using a Python environment or the provided Dockerfile. Set the environment variables, including `FRONTEND_URL` for CORS.
3. **Frontend**: Deploy the `frontend` folder to [Vercel](https://vercel.com). Set `NEXT_PUBLIC_API_URL` to your live backend URL.

---

## 📡 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/register` | Register a new user | ❌ |
| `POST` | `/login` | Login and get access token | ❌ |
| `GET` | `/reminders` | Fetch all user reminders | ✅ |
| `POST` | `/reminders` | Create a new reminder | ✅ |
| `PUT` | `/reminders/{id}` | Update an existing reminder | ✅ |
| `DELETE`| `/reminders/{id}` | Delete a reminder | ✅ |
| `POST` | `/complete/{id}` | Mark complete / trigger rollover | ✅ |
| `POST` | `/push/subscribe` | Register a device for push | ✅ |

---

## 📱 Android App & GitHub Releases CI/CD

### 🔨 Building the Android APK Locally
```bash
cd frontend
npm run build:export
npx cap sync android
cd android
./gradlew assembleRelease
# Output APK is in: android/app/build/outputs/apk/release/
```

### 🚀 Triggering Automated GitHub Releases with APK
Every time you want to release a new version of the APK:
1. **Push a Git tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. **Or Use One-Click GitHub Actions**:
   - Go to your GitHub repository -> **Actions** tab.
   - Select **Build & Release Android APK**.
   - Click **Run workflow**, enter the version (e.g. `1.0.0`), and click **Run**.
   - GitHub Actions will build the signed APK and publish a new GitHub Release with the APK attached automatically.

### 🔄 In-App Updates
The app automatically checks `https://api.github.com/repos/adityasing9/Smart-Reminder-PWA/releases/latest`. When a newer APK is available, users see an in-app update prompt with release notes and can update with one tap. Users can also manually check under **Settings > App Version & Updates**.


<p align="center">Made with ❤️ for smarter productivity.</p>
