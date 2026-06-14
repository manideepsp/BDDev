# Nexus BD — AI Business Development Intelligence

> **CRAIL Hackathon 2026 submission** — A multi-agent pipeline that researches companies, scores engagement fit, identifies prospects, and generates hyper-personalised outreach — in under 30 seconds.

---

## The Problem

Business development is a research-heavy discipline that scales badly. A typical outbound BD rep spends **2–3 hours per prospect** before writing a single word of outreach:

1. Google the company, open 10 tabs
2. Browse LinkedIn for the right decision-makers
3. Read through blog posts, press releases, and job listings hunting for pain-point signals
4. Manually piece together a narrative that connects their problems to your solution
5. Write a cold email that still sounds generic — because there wasn't time to go deeper

The result is inconsistent output, missed signals, and response rates that make the whole effort feel futile. Scaling the team multiplies the cost without multiplying the quality.

---

## The Solution

Nexus BD collapses that 2–3 hour research cycle into **a 30-second multi-agent pipeline**. You enter a company name, your offering, and — optionally — a website URL. The system then:

- Scrapes the company website, LinkedIn org profile, recent posts, open job listings, and key personnel — **concurrently**
- Runs a **People Swarm**: one enrichment agent per discovered person fires in parallel to assess seniority, role category, and BD relevance
- Embeds every gathered fact into a **per-pipeline Qdrant vector namespace** for retrieval-augmented synthesis
- **Pauses for your review** — you prune irrelevant people, exclude noisy posts, and inject context the agents couldn't find
- Then synthesises an **evidence-first intelligence report**: pain points with severity, ICP fit score (1–100 across six dimensions), identified prospects with contact angles, competitive landscape, recommended approach, and traceable sources
- Generates per-prospect **POC engagement plans** and **personalised outreach emails** on demand
- Embeds completed pipelines into a shared Qdrant collection that powers a **cumulative Market Intelligence view** — AI-clustered trend analysis across every company you've ever researched

---

## Architecture

The entire research pipeline is split into two phases with a human checkpoint between them. Every stage writes its output to SQLite before proceeding, so no work is ever lost if a stage fails or the user pauses.

```
Input: company name, URL, offering description, post config
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  PHASE 1 — GATHER  (asyncio.gather → agents run in parallel) │
│                                                              │
│  WebsiteScraperAgent  homepage + /about /products /team      │
│  LinkedInAgent        JSON-LD org schema → size, HQ,         │
│                       founded, followers, description        │
│  PostsAgent           blog/news scrape + DDG strict filter   │
│                       configurable lookback months + limit   │
│  JobsAgent            open roles → hiring + tech signals     │
│  PeopleAgent          discovers names →                      │
│   └─ PeopleSwarm 🐝   one enrichment agent per person,       │
│      asyncio.gather   role category, seniority, relevance    │
│                                                              │
│  KeywordAgent (LLM)   distils gathered text → keywords,      │
│                       product areas, personas, tech signals  │
│  ResearchAgent        4 targeted DDG/Tavily searches:        │
│                       news · competitive · financial · market│
│                                                              │
│  RAGIndexer           chunks + embeds ALL gathered data into │
│   (fastembed)         per-pipeline Qdrant namespace          │
└──────────────────────────────────────────────────────────────┘
    │
    ▼  ⏸  status = awaiting_input
┌──────────────────────────────────────────────────────────────┐
│  HUMAN CHECKPOINT                                            │
│  Reviewer sees gathered posts, jobs, people, website data.   │
│  Remove irrelevant people · exclude noisy items ·           │
│  inject free-text context → POST /continue                   │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  PHASE 2 — SYNTHESIZE                                        │
│                                                              │
│  RAGRetriever         LLM builds retrieval queries →         │
│                       fetches top-k chunks per query         │
│  InsightsAgent (LLM)  evidence-first report: pain points,    │
│                       ICP score, prospects, competitive,     │
│                       tech stack, recommended approach       │
│  VectorStoreAgent     embeds the company into the shared     │
│                       market-trends Qdrant collection        │
└──────────────────────────────────────────────────────────────┘
    │
    ▼  per-prospect, on demand:
    POCPlanAgent · EmailGeneratorAgent · PitchAgent
```

### Design decisions

| Decision | Why |
|----------|-----|
| **Groq `llama-3.3-70b-versatile`** | Free tier, ~400 tok/s — fast enough for real-time user feedback on a pipeline that makes 5–15 LLM calls per company |
| **fastembed `BAAI/bge-small-en-v1.5`** | 384-dim ONNX model, runs on CPU, zero API key, ships with the binary — embeddings are free and instant |
| **Qdrant Cloud free tier** | Persistent vector storage with real ANN search, hosted so the backend stays stateless. Gracefully skipped if `QDRANT_URL` is not set |
| **SQLite via stdlib `sqlite3`** | Zero-dependency persistence — no Docker Compose, no Postgres, one file. Fly.io mounts a persistent volume at `/data/nexus.db` |
| **Concurrent gather phase** | `asyncio.gather` across website, LinkedIn, posts, jobs agents means a 5-agent scrape takes ~5 s total instead of 25 s serial |
| **People Swarm** | Discovering 8 people and enriching them one-at-a-time takes 8× the time. One `asyncio.create_task` per person, capped at 8, cuts this to the slowest single call |
| **Human checkpoint** | The gather phase surfaces raw data. The human review step is not a UX nicety — it is a quality gate. Pruning irrelevant people before synthesis directly improves the evidence the LLM reasons over |
| **RAG-grounded synthesis** | Instead of stuffing 15,000 characters of raw scraped text into one prompt (which dilutes signal and risks context-length errors), every gathered fact is embedded. The synthesis step asks the LLM what to retrieve, fetches the top-k chunks, and reasons over a compact, high-signal context |
| **DuckDuckGo default, Tavily optional** | DDG is free, requires no key, and works well for company-level searches. Tavily gives higher-quality results and can be dropped in by setting `TAVILY_API_KEY` — zero code changes needed |
| **Next.js App Router + Tailwind** | App Router enables streaming and per-route metadata with zero config. Tailwind keeps the CSS bundle tiny and the design consistent without a component library dependency |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 · React 19 |
| Backend | Python 3.12 · FastAPI · SQLite (stdlib `sqlite3`) |
| LLM | Groq `llama-3.3-70b-versatile` |
| Scraping | `requests` · `BeautifulSoup4` |
| Web search | DuckDuckGo (`duckduckgo-search`) — Tavily optional |
| Embeddings | `fastembed` — `BAAI/bge-small-en-v1.5` (384-dim, ONNX, CPU) |
| Vector DB | Qdrant Cloud free tier |
| Deployment | Frontend → Vercel · Backend → Fly.io (persistent `/data` volume) |

---

## Project Structure

```
BDDev/
├── backend/
│   ├── main.py               # FastAPI app — all v1 + v2 endpoints, CORS, Groq init
│   ├── db.py                 # SQLite CRUD — pipelines, prospects, emails
│   ├── pipeline.py           # Async orchestrator + market trends generator
│   ├── utils.py              # extract_json() — JSON parsing with fence stripping + fallback
│   └── agents/
│       ├── scraper.py        # Website scraper (homepage + priority sub-pages)
│       ├── linkedin.py       # LinkedIn JSON-LD org schema extractor
│       ├── posts.py          # Recent posts — site blog → LinkedIn → DDG strict filter
│       ├── jobs.py           # Open roles scraper → hiring + tech signals
│       ├── people.py         # People discovery + parallel swarm enrichment
│       ├── keywords.py       # LLM keyword extraction from gathered context
│       ├── researcher.py     # Multi-angle web research (DDG/Tavily)
│       ├── rag.py            # Chunk, embed, index + LLM-query retrieval
│       ├── embedder.py       # Shared fastembed + Qdrant client singletons
│       ├── crawler.py        # Deep crawl for companies with thin public footprints
│       ├── insights.py       # RAG-grounded synthesis — pain points, ICP, prospects
│       ├── poc_plan.py       # POC engagement plan per prospect
│       ├── email_gen.py      # Personalised outreach email generator
│       ├── pitch.py          # Full pitch-asset bundle (exec summary, LinkedIn DM, talking points)
│       └── vector_store.py   # Cumulative market-trends embedding store
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                       # Dashboard — KPIs + pipeline history
│       │   ├── analyze/page.tsx               # New analysis form with agent stage preview
│       │   ├── pipeline/[id]/page.tsx          # Live pipeline progress + results + review
│       │   ├── pipeline/[id]/prospect/[pid]/   # Prospect detail, POC plan, email generator
│       │   └── trends/page.tsx                # Market Intelligence — clustered BD trends
│       ├── components/Sidebar.tsx             # Nav, brand, pipeline stage legend
│       └── lib/api.ts                         # Typed API client — all endpoints + interfaces
├── .github/workflows/
│   ├── ci.yml                # TypeScript check + backend import smoke test
│   └── fly-deploy.yml        # Auto-deploy backend to Fly.io on push to main
└── DEPLOYMENT.md             # Full CI/CD, Fly.io, Vercel, environment setup
```

---

## Feature Walkthrough

### 1. New Analysis (`/analyze`)
Enter a company name, optional URL, and a description of your offering. Deal size and priority segment the pipeline for the dashboard. Advanced settings let you tune post lookback months and max posts — useful for surfacing recency signals in fast-moving sectors.

The right panel shows what each agent does and how long it takes, so the user understands they're watching a real pipeline, not a spinner.

### 2. Pipeline View (`/pipeline/{id}`)
Polls every 2.5 seconds. The stage tracker shows all 8 stages; the active one pulses. On `awaiting_input`, the review panel appears — a cluster-based card layout that groups gathered content (website pages, posts, jobs, crawl findings) and lets the reviewer exclude items by index before continuing to synthesis.

Once complete, the page renders the full intelligence report: company overview, 88 px SVG engagement score ring with fill calculated from the 1–100 score, a 6-axis ICP score breakdown, pain points with severity and evidence chips, BD opportunities, prospects grid, competitive landscape, tech stack, sources.

### 3. Prospect Detail (`/pipeline/{id}/prospect/{pid}`)
Opens a three-panel layout. The POC plan auto-generates on first load (single LLM call, ~3 s). Choose email tone (professional / conversational / bold) and generate a personalised email that references the specific pain point, POC value proposition, and woven-in keywords.

Copy buttons for subject, body, and full email + POC summary make it paste-ready into any outreach tool.

### 4. Dashboard (`/`)
Four KPI stat cards (total pipelines, active pipelines, prospects identified, average engagement score) with staggered entrance animations. The pipeline table shows every company with a live-pulse indicator for active runs, an 18 px mini engagement score ring, status pill, and a direct "View →" link.

### 5. Market Intelligence (`/trends`)
Reads from the shared Qdrant collection that accumulates completed pipeline embeddings. Requires 3+ companies to unlock. AI clusters companies by embedding similarity, then generates a theme, market signal, and BD opportunity per cluster. Each cluster card links to a new analysis — the market map becomes a prospecting tool.

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- [Groq API key](https://console.groq.com) (free tier is sufficient)
- [Qdrant Cloud cluster](https://cloud.qdrant.io) (free tier, optional but recommended for Market Intelligence)

### Local development

```bash
# 1. Clone
git clone https://github.com/manideepsp/BDDev.git
cd BDDev

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set GROQ_API_KEY (required) and QDRANT_URL + QDRANT_API_KEY (optional)
uvicorn main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | **Yes** | [console.groq.com](https://console.groq.com) — free tier works |
| `QDRANT_URL` | No | Qdrant Cloud cluster URL — Market Intelligence disabled without it |
| `QDRANT_API_KEY` | No | Qdrant Cloud API key |
| `TAVILY_API_KEY` | No | [tavily.com](https://tavily.com) — higher-quality search; DDG is the default |
| `ALLOWED_ORIGINS` | No | CORS origins, comma-separated (default: `localhost:3000`) |
| `DB_PATH` | No | SQLite path (default: `nexus.db`; Fly.io sets `/data/nexus.db`) |

### Production deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full Fly.io + Vercel + GitHub Actions CI/CD setup.

---

## API Reference

### V2 Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v2/analyze` | Start a pipeline (async — runs gather phase in background) |
| `GET` | `/api/v2/pipeline/{id}` | Poll status + gathered data + intelligence |
| `POST` | `/api/v2/pipeline/{id}/continue` | Resume after human checkpoint (human input + removed people + excluded items) |
| `GET` | `/api/v2/pipelines` | List all pipelines |
| `GET` | `/api/v2/pipeline/{id}/prospects` | Get identified prospects |
| `POST` | `/api/v2/pipeline/{id}/poc-plan` | Generate POC plan for a prospect |
| `POST` | `/api/v2/pipeline/{id}/email` | Generate personalised outreach email |
| `GET` | `/api/v2/pipeline/{id}/emails` | Retrieve generated emails |
| `POST` | `/api/v2/pipeline/{id}/pitch-assets` | Generate full pitch bundle (exec summary, LinkedIn DM, talking points) |
| `GET` | `/api/v2/trends` | Market intelligence clusters from Qdrant |
| `GET` | `/api/stats` | Dashboard KPIs |
| `GET/PUT` | `/api/company-profile` | Sender profile for email sign-offs |
| `POST` | `/api/feedback` | Thumbs up/down on generated outputs |

### V1 (legacy, kept for compatibility)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prospects` | List v1 prospects |
| `GET` | `/api/prospects/{id}` | Get a v1 prospect |
| `PATCH` | `/api/prospects/{id}/status` | Update status |
| `DELETE` | `/api/prospects/{id}` | Remove |

---

## Graceful degradation

Every agent is wrapped in try/except. The pipeline never crashes because one source is unavailable:

- LinkedIn returns 429 or blocks the scrape → `linkedin_data = {"people": [], "error": "..."}`
- Qdrant is unreachable → embedding is skipped; synthesis falls back to direct context; Market Intelligence shows a "not enough data" state
- Website returns 403 → `website_data = {"pages": [], "error": "..."}`
- DuckDuckGo rate-limits → research results are partial; insights still synthesise from LinkedIn + website data
- Groq returns 429 → 502 with a user-visible error message; the pipeline status is set to `failed` and the error is stored in SQLite

The frontend surfaces partial results at every stage — posts and people appear as soon as gathering completes, not after synthesis.

---

## Roadmap

- [ ] WebSocket push instead of polling — eliminate the 2.5 s latency on stage transitions
- [ ] CRM export (HubSpot, Salesforce) — one-click prospect push with all intelligence fields mapped
- [ ] Email send integration (Gmail, Outlook OAuth) — send directly from the email generator panel
- [ ] Scheduled re-research — weekly drift detection alerts when a company's signal profile changes
- [ ] Team mode — shared pipeline history, prospect assignment, deal tracking
- [ ] Voice briefing — TTS summary of the intelligence report for listening on the way to a call
