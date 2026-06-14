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

The core of Nexus BD is a **multi-phase agent pipeline** with a human-in-the-loop checkpoint and RAG-grounded synthesis. Gathering agents run **concurrently**, every signal is **embedded into a per-pipeline vector index**, the run **pauses for human review**, and only then does the system synthesize intelligence by **retrieving** the most relevant evidence (classic retrieve-then-synthesize RAG).

```
User input (+ post lookback config)
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1 — GATHER  (agents run concurrently)                        │
│                                                                     │
│  Website Scraper      • homepage + /about, /products, /team         │
│  LinkedIn Intel       • JSON-LD org schema → industry, size,        │
│                         founded, HQ, followers, overview, founders   │
│  Posts Agent          • recent activity/announcements (configurable  │
│                         lookback months / max posts)                 │
│  Jobs Agent           • open roles as hiring/tech signals            │
│                       │                                             │
│  People Swarm 🐝  • discovers people, then fans out ONE enrichment   │
│   (asyncio.gather)   agent PER PERSON in parallel → role category,   │
│                      seniority, location, BD relevance (capped)      │
│                       │                                             │
│  Keyword Extraction (LLM) → Web Research (DDG/Tavily)               │
│                       │                                             │
│  RAG Indexer       • chunks + embeds ALL gathered data into a        │
│   (fastembed)        per-pipeline Qdrant namespace                   │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼  ⏸  AWAITING_INPUT — pipeline pauses
┌─────────────────────────────────────────────────────────────────────┐
│  HUMAN CHECKPOINT — reviewer sees posts/jobs/people, removes         │
│  irrelevant people, adds free-text context, then clicks Continue     │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼  (resume)
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2 — SYNTHESIZE                                               │
│                                                                     │
│  RAG Retrieval (LLM-built queries) → retrieve top chunks per query  │
│  Insights Synthesis (LLM)  • evidence-first pain points, tech-stack  │
│                              signals, ICP match score, prospects     │
│  Vector Store (fastembed + Qdrant) • embeds the company into the     │
│                              cumulative market-trends collection     │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼  per-prospect, on demand:  POC Plan · Email Generator · Pitch Bundle
```

**Key design choices:**

- **Concurrent gathering** — website, LinkedIn, posts, and jobs agents run together via `asyncio.gather`; the People stage is a true **agent swarm**, one enrichment agent per person running in parallel.
- **Human-in-the-loop** — the pipeline persists everything it gathered and enters `awaiting_input`. The reviewer prunes people and injects context that is fed into synthesis with high priority. Resumed via `POST /api/v2/pipeline/{id}/continue`.
- **RAG-grounded synthesis** — instead of stuffing truncated raw blobs into one prompt, all evidence is embedded into a per-pipeline namespace; the synthesis step asks the LLM what to look for, embeds those queries, and retrieves the best-matching chunks.
- **Graceful degradation everywhere** — any walled/empty source (LinkedIn, posts, jobs, Qdrant) is skipped without killing the run. If vectors are unavailable, synthesis falls back to direct context.
- **Cumulative memory** — every completed pipeline also embeds into the shared `nexus_bd_intelligence` collection that powers the Market Trends view.

### LLM

All LLM calls use **Groq** (`llama-3.3-70b-versatile`), chosen for its free tier and low latency. Per company the pipeline makes: keyword extraction, one enrichment call per person (parallel), RAG query planning, insights synthesis — plus POC plan / email / pitch on demand, and one call per market-trend cluster.

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
│   │   ├── scraper.py        # website scraper
│   │   ├── linkedin.py       # LinkedIn intelligence (JSON-LD org schema)
│   │   ├── posts.py          # recent posts / activity (configurable range)
│   │   ├── jobs.py           # open roles → hiring signals
│   │   ├── people.py         # people swarm — parallel per-person enrichment
│   │   ├── keywords.py       # keyword extraction (LLM)
│   │   ├── researcher.py     # web research
│   │   ├── rag.py            # RAG indexer + retriever (LLM-built queries)
│   │   ├── embedder.py       # shared fastembed + Qdrant singletons
│   │   ├── insights.py       # RAG-grounded insights synthesis (LLM)
│   │   ├── poc_plan.py       # POC plan (LLM)
│   │   ├── email_gen.py      # email generator (LLM)
│   │   ├── pitch.py          # full pitch-asset bundle (LLM)
│   │   └── vector_store.py   # cumulative market-trends store (fastembed + Qdrant)
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
| POST | `/api/v2/analyze` | Start an analysis pipeline (async, runs gather phase) |
| GET | `/api/v2/pipeline/{id}` | Poll status + gathered data + results |
| POST | `/api/v2/pipeline/{id}/continue` | Resume after the human checkpoint (human input + removed people) |
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
