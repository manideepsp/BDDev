# Nexus BD — AI Business Development Intelligence

AI-powered research and outreach platform for business development. Built for CRAIL Hackathon.

## What It Does

1. **Company Intelligence** — Enter any company name and get a full AI-generated BD report: overview, pain points, key stakeholders, competitive landscape, and an engagement score.
2. **Personalized Outreach** — Generate a tailored cold email + follow-up based on the research, in your choice of tone (Professional / Conversational / Bold).
3. **Prospect Pipeline** — Track all researched companies through your BD funnel from researched → contacted → qualified → closed.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Python FastAPI
- **AI**: Claude Opus (Anthropic) — research synthesis + email generation

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
BDDev/
├── backend/
│   ├── main.py          # FastAPI app with research + outreach endpoints
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx              # Dashboard
        │   ├── research/page.tsx     # Research a new company
        │   └── prospects/[id]/page.tsx # Prospect detail + outreach
        ├── components/Sidebar.tsx
        └── lib/api.ts               # API client
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/research` | Research a company, returns intelligence report |
| POST | `/api/outreach/generate` | Generate personalized outreach email |
| GET | `/api/prospects` | List all prospects |
| GET | `/api/prospects/:id` | Get a specific prospect |
| PATCH | `/api/prospects/:id/status` | Update prospect pipeline status |
| DELETE | `/api/prospects/:id` | Remove a prospect |
