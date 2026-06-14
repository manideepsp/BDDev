# Nexus BD — AI Business Development Intelligence

> **CRAIL Hackathon 2026** — AI-powered BD research and outreach platform built on a multi-agent pipeline architecture.

---

## The Problem

Business development teams waste hours on low-signal research before they can have a single meaningful conversation with a prospect. A typical BD workflow looks like this:

1. Google the company, open 10 tabs
2. Search LinkedIn for the right people
3. Read through blog posts, press releases, job listings for signals
4. Manually piece together pain points and competitive context
5. Write a cold email that sounds generic anyway

This process takes 2–3 hours per prospect, scales poorly, produces inconsistent output, and still often misses the signal that would make an email actually land.

---

## The Solution

Nexus BD automates the entire pre-outreach research process using a **chain of specialised AI agents**. You enter a company name and a short description of what you offer. In 20–30 seconds you get:

- A structured intelligence report on the company (overview, business model, pain points, competitive position, recent developments)
- An AI-scored engagement signal (1–100) with reasoning
- 2–4 identified prospects — real or inferred — with specific contact angles
- A tailored proof-of-concept engagement plan per prospect
- A personalised outreach email that weaves in live keywords, pain points, and the POC hook
- Market trend analysis across all companies you've researched, powered by a vector database

---

## Multi-Agent Architecture

The core of Nexus BD is an **8-agent sequential pipeline**. Each agent owns one concern, produces a structured output, and hands it forward. No single LLM call has to do everything — each step builds on real data from the previous one.

```
User input
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         ANALYSIS PIPELINE                           │
│                                                                     │
│  Agent 1 — Website Scraper                                          │
│  • Fetches homepage + up to 3 subpages (/about, /products, /team)  │
│  • Extracts clean text; falls back to DDG if no URL provided        │
│  • Output: structured page content                                  │
│                       │                                             │
│  Agent 2 — LinkedIn Intelligence                                    │
│  • Scrapes public company page                                      │
│  • DDG-searches for "{company} CEO OR CTO site:linkedin.com/in"    │
│  • Output: company summary + people list with titles               │
│                       │                                             │
│  Agent 3 — Keyword Extraction                (Groq LLM)            │
│  • Distils scraped text + user description into structured signals  │
│  • Output: keywords, product areas, target personas, tech signals   │
│                       │                                             │
│  Agent 4 — Web Research                                             │
│  • Runs 4 targeted searches: news, competitive, financial, market   │
│  • Uses DuckDuckGo (or Tavily for higher quality)                   │
│  • Output: up to 16 grounded results with source URLs              │
│                       │                                             │
│  Agent 5 — Insights Synthesis                (Groq LLM)            │
│  • Combines all gathered data into a full intelligence report       │
│  • Identifies 2–4 prospects with relevance + contact angles        │
│  • Scores engagement likelihood 1–100 with reasoning               │
│                       │                                             │
│  Agent 6 — POC Plan                          (Groq LLM)            │
│  • Generates a proof-of-concept engagement plan per prospect        │
│  • Output: objective, approach, timeline, talking points, risks     │
│                       │                                             │
│  Agent 7 — Email Generator                   (Groq LLM)            │
│  • Writes a personalised outreach email using all extracted signals │
│  • Tone: Professional / Conversational / Bold                       │
│  • Output: subject, body, follow-up, keywords used                 │
│                       │                                             │
│  Agent 8 — Vector Store                      (fastembed + Qdrant)  │
│  • Embeds company intelligence (BAAI/bge-small-en-v1.5, 384 dims)  │
│  • Stores in Qdrant Cloud for cumulative market analysis            │
│  • Powers the Market Trends view: cross-company cluster insights    │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design choices:**

- **Graceful degradation everywhere** — if LinkedIn scraping fails, the pipeline continues with empty LinkedIn data. If Qdrant is unreachable, embedding is skipped and the pipeline still completes. No single agent failure kills the run.
- **Non-blocking execution** — the pipeline runs in a background `asyncio` task. The frontend polls every 2.5 seconds, showing live stage progress as each agent completes.
- **Grounded intelligence** — the insights agent is explicitly told which sources it has and attaches real URLs. The UI marks reports as "Live web data" vs "AI-estimated" based on whether live search results were found.
- **Cumulative memory** — every completed pipeline embeds its intelligence into Qdrant. The Market Trends page clusters all researched companies by industry and surfaces cross-portfolio BD opportunities automatically.

### LLM

All LLM calls use **Groq** (`llama-3.3-70b-versatile`), chosen for its free tier and low latency. The pipeline makes 4 LLM calls total per company (keyword extraction, insights, POC plan, email) plus one for each market trend cluster.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS 3 |
| Backend | Python 3.12 + FastAPI + SQLite (via stdlib `sqlite3`) |
| LLM | Groq `llama-3.3-70b-versatile` (free tier) |
| Web scraping | `requests` + `BeautifulSoup4` |
| Web search | DuckDuckGo (`duckduckgo-search`) — Tavily optional |
| Embeddings | `fastembed` — `BAAI/bge-small-en-v1.5` (384-dim, ONNX, CPU, no API key) |
| Vector DB | Qdrant Cloud free tier |
| Deployment | Frontend → Vercel · Backend → Fly.io (persistent volume for SQLite) |

---

## Feature Walkthrough

1. **New Analysis** (`/analyze`) — enter a company name, optional URL, and a short description of your offering. Optional: pre-fill your name and company for email sign-offs.
2. **Pipeline View** (`/pipeline/{id}`) — watch the 6 visible stages progress in real time. On completion: full intelligence report, engagement score ring, pain points, BD opportunities, sources, and a prospect grid.
3. **Prospect Detail** (`/pipeline/{id}/prospect/{pid}`) — POC plan auto-generates on load. Choose a tone and generate a personalised email with one click. Copy subject, body, or full email + POC context.
4. **Dashboard** (`/`) — KPI cards (total pipelines, prospects identified, average engagement score) + pipeline history table.
5. **Market Trends** (`/trends`) — requires 3+ completed pipelines. Shows AI-synthesised cluster insights grouped by industry, with cross-portfolio BD opportunities.

---

## Project Structure

```
BDDev/
├── backend/
│   ├── main.py               # FastAPI app — all endpoints (v1 + v2)
│   ├── db.py                 # SQLite persistence (pipelines, prospects, emails)
│   ├── pipeline.py           # Async orchestrator + market trends generator
│   ├── utils.py              # extract_json() — shared JSON parsing helper
│   ├── agents/
│   │   ├── scraper.py        # Agent 1 — website scraper
│   │   ├── linkedin.py       # Agent 2 — LinkedIn intelligence
│   │   ├── keywords.py       # Agent 3 — keyword extraction (LLM)
│   │   ├── researcher.py     # Agent 4 — web research
│   │   ├── insights.py       # Agent 5 — insights synthesis (LLM)
│   │   ├── poc_plan.py       # Agent 6 — POC plan (LLM)
│   │   ├── email_gen.py      # Agent 7 — email generator (LLM)
│   │   └── vector_store.py   # Agent 8 — fastembed + Qdrant
│   ├── Dockerfile
│   ├── fly.toml
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                        # Dashboard
│       │   ├── analyze/page.tsx                # New analysis form
│       │   ├── pipeline/[id]/page.tsx           # Pipeline status + results
│       │   ├── pipeline/[id]/prospect/[pid]/    # Prospect + email generator
│       │   └── trends/page.tsx                 # Market trends
│       ├── components/Sidebar.tsx
│       └── lib/api.ts                          # Typed API client
├── .github/workflows/
│   ├── ci.yml                # TypeScript check + backend import smoke test
│   └── fly-deploy.yml        # Auto-deploy backend to Fly.io on push to main
└── DEPLOYMENT.md             # Full deployment + CI/CD setup guide
```

---

## API Reference

### V2 Pipeline Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/analyze` | Start an analysis pipeline (async) |
| GET | `/api/v2/pipeline/{id}` | Poll status + results |
| GET | `/api/v2/pipelines` | List all pipelines |
| GET | `/api/v2/pipeline/{id}/prospects` | Get identified prospects |
| POST | `/api/v2/pipeline/{id}/poc-plan` | Generate POC plan for a prospect |
| POST | `/api/v2/pipeline/{id}/email` | Generate outreach email |
| GET | `/api/v2/pipeline/{id}/emails` | Get generated emails |
| GET | `/api/v2/trends` | Market trend clusters from Qdrant |
| GET | `/api/stats` | Dashboard KPIs |

### V1 Prospect Endpoints (legacy, kept for compatibility)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prospects` | List all prospects |
| GET | `/api/prospects/{id}` | Get a specific prospect |
| PATCH | `/api/prospects/{id}/status` | Update pipeline status |
| DELETE | `/api/prospects/{id}` | Remove a prospect |

---

## Setup

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full CI/CD and production setup.

### Local development

**Prerequisites:** Python 3.11+, Node.js 20+, a free [Groq API key](https://console.groq.com), and optionally a free [Qdrant Cloud cluster](https://cloud.qdrant.io).

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set GROQ_API_KEY at minimum
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq free tier — [console.groq.com](https://console.groq.com) |
| `QDRANT_URL` | No | Qdrant Cloud cluster URL — embeddings + trends disabled if absent |
| `QDRANT_API_KEY` | No | Qdrant Cloud API key |
| `TAVILY_API_KEY` | No | Tavily search — falls back to DuckDuckGo if not set |
| `ALLOWED_ORIGINS` | No | CORS origins, comma-separated (default: `localhost:3000`) |
| `DB_PATH` | No | SQLite file path (default: `backend/nexus.db`, Fly sets `/data/nexus.db`) |
