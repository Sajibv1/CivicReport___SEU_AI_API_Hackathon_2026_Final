# CivicReport

A civic-issue reporting platform with a public citizen reporting flow and a protected government dashboard.

## Stack

- Frontend: React, Vite, Tailwind CSS, Leaflet, Recharts
- Backend: FastAPI, Uvicorn, SQLAlchemy, Pydantic
- Storage: SQLite for local development; PostgreSQL can be configured for production
- Integrations: OpenAI, OpenStreetMap/Nominatim, WebSockets, PWA support

## Local development

### Backend

```bash
cd backend
python -m venv venv
# Windows PowerShell
venv\Scripts\activate
# Linux/macOS
# source venv/bin/activate
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env`, then set your local credentials and API key. Do not commit `.env`.

```bash
python -m app.seed
uvicorn app.main:app --reload
```

The API is served at `http://localhost:8000`, with documentation at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend is served at `http://localhost:5173` and uses `/api` by default.

## Configuration

Required production settings are kept in `backend/.env`:

```env
DATABASE_URL=sqlite:///./civic.db
OPENAI_API_KEY=your-openai-api-key
GOVERNMENT_USERNAME=official
GOVERNMENT_PASSWORD=use-a-strong-password
AUTH_SECRET=use-a-long-random-secret
```

Without an OpenAI key, report submission continues with the built-in fallback review path.

## Features

- Submit and track civic-issue reports in English or Bangla
- Photo uploads, map location selection, and optional voice transcription
- AI-assisted categorization and duplicate detection
- Protected government dashboard with report management, analytics, and live updates
- Database-backed image uploads and WebSocket dashboard updates
- Installable PWA with an offline app shell

## Deployment

Serve the Vite build with Nginx and run the FastAPI app with Uvicorn behind a systemd service. Configure Nginx to proxy `/api/`, `/uploads/`, and `/ws/` to the backend.

## Security

- Do not commit `.env`, SQLite databases, build output, virtual environments, or dependency folders.
- Use a distinct strong government password and a randomly generated `AUTH_SECRET` in production.
- Restrict production API keys and rotate any key that was ever exposed in source code, terminal output, or a public repository.
