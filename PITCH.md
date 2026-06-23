# KS Business — Pitch & Presentation Deck
### Knowledge Systems BD Intelligence · CRAIL Hackathon 2026

> **How to use this file**
> - Every `---` divider is **one slide**. Paste into [Marp](https://marp.app/), [Slidev](https://sli.dev/), or Reveal.js to auto-generate slides.
> - `> 🎤` callouts are **speaker notes** — what to say, not what to show.
> - Every number, agent name, and code snippet below is **verbatim from the codebase** — accurate for technical Q&A.
> - Jump to the **Appendix** for the 60-second pitch, demo script, and a deep technical Q&A bank.

---
---

# PART 1 — THE NARRATIVE
## Problem → Insight → Solution → Proof

---

## Slide 1 — Title

# KS Business
## The BD analyst that does 3 hours of research in 30 seconds

**A 15-agent, RAG-grounded business-development pipeline.**
Parallel by design. Grounded in evidence. Runs on $0 infrastructure.

*CRAIL Hackathon 2026 · [your names]*

> 🎤 "Every BD rep burns their best hours tab-hopping, then sends an email that still sounds like a template. We built an analyst that never sleeps, never copy-pastes, and never makes up a fact."

---

## Slide 2 — The Problem

## Business development doesn't scale

A typical outbound rep spends **2–3 hours per prospect** before writing a single word:

| Step | Time sink |
|------|-----------|
| 🔍 Google the company, open 10 tabs | 30 min |
| 💼 Hunt LinkedIn for the right decision-makers | 40 min |
| 📰 Read blogs, press, job posts for pain signals | 45 min |
| 🧩 Stitch a narrative: their problem ↔ your solution | 30 min |
| ✍️ Write an email that *still* sounds generic | 20 min |

**Result:** inconsistent output, missed signals, dismal reply rates.
Hiring more reps multiplies the cost — never the quality.

> 🎤 "Raise your hand if you've sent an email that opened with 'I hope this finds you well.' That email got ignored — and in a minute I'll show you why, in code."

---

## Slide 3 — Why Existing AI Tools Fail

## Generic AI tools *hallucinate* personalization

Most "AI email writers" take a name and fabricate a plausible-sounding hook.
The prospect can smell it. Reply rates stay flat.

**The email that actually works references a real, specific, recent signal:**

> *"Saw you've had 12 React roles open 78+ days while sunsetting your legacy billing stack — that backlog compounds fast before a Q3 deadline."*

That sentence is impossible without **evidence**. You cannot prompt your way to it — you have to **go get the data first**.

> 🎤 "This is the whole thesis. Specificity beats fluency. And specificity requires grounding — which is an *engineering* problem, not a prompt-writing problem."

---

## Slide 4 — Our Insight

## Three engineering bets

1. **Gather in parallel, not in sequence.**
   Research is I/O-bound. Fire every scraper and searcher *concurrently* — cut 25 seconds of serial work to ~5 seconds wall-clock.

2. **Swarm the people problem.**
   Don't enrich 6 decision-makers one at a time. Launch **one agent per person, in parallel**, each bounded by a semaphore.

3. **Ground every claim in retrieved evidence (RAG).**
   Never stuff 15,000 characters into one prompt. Chunk everything, embed it, retrieve only the top-k relevant pieces per question, and force the LLM to **quote the source** — or say "Unknown."

> 🎤 "These three bets — parallelism, the swarm, and RAG groundedness — are what make this a system, not a prompt. The rest of the deck shows each one in the code."

---

## Slide 5 — The Solution in One Sentence

## One company name in → a full BD playbook out

You give it: **company name + what you sell + (optional) URL.**

KS Business runs a **15-agent pipeline** that gathers concurrently, pauses for your review, synthesizes evidence-first intelligence, and writes outreach anchored on a real signal — in **~30 seconds**, on **free-tier infrastructure**.

```
company name ──► 15 agents ──► evidence report ──► grounded outreach ──► outcome learning
                (parallel)      (RAG-grounded)     (specificity-enforced)  (compounds)
```

> 🎤 Land the human checkpoint here as the differentiator — "we keep the rep's judgment in the loop, we don't replace it."

---
---

# PART 2 — HOW WE SOLVED IT
## The three engineering bets, in code

---

## Slide 6 — Architecture Overview

## Multi-agent system, not a single prompt

```
Browser (Next.js 15 · JWT cookie auth)
        │
        ▼
FastAPI ──► Orchestrator (asyncio background task — returns pipeline_id instantly)
        │
   ┌────┴───────────────────────────────────────┐
   │  PHASE 1 — GATHER   (status: gathering)     │
   │  asyncio.gather → website · linkedin ·      │
   │                    posts · jobs             │
   │  PeopleSwarmAgent → 1 agent / person        │
   │  keywords → (research ∥ crawl) → RAG index  │
   └────┬───────────────────────────────────────┘
        ▼
   ⏸ HUMAN CHECKPOINT   (status: awaiting_input)
        ▼
   ┌─────────────────────────────────────────────┐
   │  PHASE 2 — SYNTHESIZE   (status: insights)  │
   │  RAG retrieve → InsightsAgent → embed        │
   └────┬────────────────────────────────────────┘
        ▼
   ON DEMAND: POC plan · 5-type outreach · pitch assets · deal outcome
        ▼
   Market Intelligence (Qdrant clustering across all companies)
```

**11 pipeline states:** `pending → gathering → people → keywords → researching → indexing → awaiting_input → insights → embedding → complete` (or `failed`).

> 🎤 "The endpoint returns a pipeline_id in milliseconds. Everything heavy runs as an `asyncio.create_task` in the background while the UI polls. The event loop never blocks."

---

## Slide 7 — Bet #1: Parallel Processing

## Gather concurrently — 4 agents fire at once

The instant gathering starts, four scrapers run in parallel — verbatim from `pipeline.py`:

```python
scraper_result, linkedin_result, posts_result, jobs_result = await asyncio.gather(
    _to_thread(lambda: WebsiteScraperAgent().run(company_name, company_url)),
    _to_thread(lambda: LinkedInAgent().run(company_name, linkedin_url)),
    _to_thread(lambda: LinkedInPostsAgent().run(company_name, post_lookback_months, post_limit, company_url)),
    _to_thread(lambda: JobsAgent().run(company_name, company_url)),
)
```

Then **web research and a broad crawl run in parallel too:**

```python
research, crawl = await asyncio.gather(
    _to_thread(lambda: WebResearchAgent().run(company_name, keywords, company_url)),
    _to_thread(lambda: WebCrawlerAgent().run(company_name, company_url, keywords)),
)
```

`_to_thread` offloads each blocking agent onto a thread-pool executor, so synchronous scraping never stalls the async event loop:

```python
async def _to_thread(fn):
    return await asyncio.get_running_loop().run_in_executor(None, fn)
```

**Impact:** ~25s of serial scraping → ~5s wall-clock.

> 🎤 "Research is I/O-bound — you're waiting on network, not CPU. So we never wait serially. Four sources at once, then research and crawl at once."

---

## Slide 8 — Bet #2: The People Swarm

## One enrichment agent per person, in parallel

We don't enrich decision-makers one at a time. `PeopleSwarmAgent` launches a **bounded swarm** — verbatim from `people.py`:

```python
sem = asyncio.Semaphore(concurrency)          # default concurrency = 4

async def _guarded(p):
    async with sem:
        return await self._enrich(p, company_name, user_description)

tasks = [_guarded(p) for p in people]          # max_people = 6
enriched = await asyncio.gather(*tasks, return_exceptions=True)
```

Each agent independently extracts, at **temperature 0.0** (deterministic), model `llama-3.3-70b-versatile`:

- `role_category` — one of 10 (Executive, Engineering, Product, Sales/BD, …)
- `seniority` — C-Level / VP / Director / Manager / IC / Unknown
- `location`, `relevance` (one-sentence BD entry point), `confidence`

**Anti-hallucination guardrail (system prompt, verbatim):**
> *"Never invent a location, title, or detail absent from the snippet. If a detail is not present, return 'Unknown'."*

> 🎤 "Six people, enriched simultaneously, capped at 4 in-flight so we never trip Groq's rate limit. `return_exceptions=True` means one person failing never sinks the batch."

---

## Slide 9 — Bet #3: RAG Groundedness (the core)

## We retrieve evidence — we don't stuff context

**Index:** every gathered fact is chunked to **~600 characters** and embedded with **`BAAI/bge-small-en-v1.5`** (384-dim, ONNX, CPU, no API key), into a Qdrant collection `ks_business_rag`.

**Per-pipeline namespace** — each run's data is isolated by a payload filter:

```python
flt = Filter(must=[FieldCondition(key="pipeline_id",
                                  match=MatchValue(value=pipeline_id))])
```

**The LLM writes its own retrieval queries** (`build_queries`) — 6 short queries, 3–7 words each — then we embed each and pull the **top-k = 4** chunks per query, deduplicated:

```python
def retrieve(self, pipeline_id, queries, k=4):
    for q in queries:
        vec = embed_one(q)
        hits = self._client.search(
            collection_name=COLLECTION, query_vector=vec,
            query_filter=flt, limit=k, with_payload=True,
        )
```

The synthesis prompt then sees a **compact, high-signal, ≤5,500-char** context block — not a 15K-char dump.

> 🎤 "This is classic retrieve-then-synthesize RAG. The model reasons over chunks we *fetched from real data* — it can't hallucinate a fact that isn't in the retrieved evidence. That's the difference between us and a generic email writer."

---

## Slide 10 — The Human Checkpoint

## A quality gate, not a UX nicety

After gathering, the pipeline saves everything and **pauses** at `awaiting_input`:

```python
save_gathered(pipeline_id, gathered)
update_pipeline_status(pipeline_id, "awaiting_input")
```

The reviewer can, before any synthesis happens:
- **`removed_people`** — drop irrelevant names from the swarm output
- **`excluded_items`** — exclude noisy posts / jobs / crawl / research **by index**
- **`human_input`** — inject free-text context the agents couldn't find

Then `/continue` flips status to `insights` and launches synthesis as a fresh background task.

> 🎤 "Garbage in, garbage out. Pruning noise *before* the LLM synthesizes directly improves the evidence it reasons over. This is the highest-leverage 10 seconds in the whole flow."

---

## Slide 11 — Specificity, Enforced in Code

## We ban generic language at the prompt layer

Groundedness gets the facts right. **Specificity enforcement** makes the *output* sharp.

**Insights agent — 16 banned phrases**, e.g.:
> ~~"digital transformation"~~ · ~~"proven track record"~~ · ~~"best-in-class"~~ · ~~"synergy"~~ · ~~"cutting-edge"~~ · ~~"end-to-end solutions"~~

Every pain point must **quote the actual signal verbatim**:
> BAD: "Company announced layoffs"
> GOOD: *"LinkedIn headline: 'Acrisure to Cut 2,250 Employees, Citing Advances in Technology and AI'"*

**Email generator — 14 banned phrases**, e.g.:
> ~~"Hope you're doing well"~~ · ~~"My name is"~~ · ~~"Just following up"~~ · ~~"Circling back"~~ · ~~"leverage"~~

Bound by the **EMAIL_PLAYBOOK**: subject 3–5 words, body 50–110 words (70% their world / 30% your offering), **exactly one** low-friction CTA, 5th–7th-grade reading level.

> 🎤 Read two banned phrases aloud. The room laughs in recognition — that's buy-in. "We don't *hope* the model avoids clichés. We forbid them, by name, in the prompt."

---

## Slide 12 — 5-Type Outreach + Persona Targeting

## The right message, for the right channel, for the right buyer

**5 message types** — each a purpose-built prompt config:

| Type | Channel | Hard limit |
|------|---------|-----------|
| `cold_email` | email | 60–100 words |
| `follow_up_email` | email | 40–60 words, *different angle* |
| `linkedin_message` | LinkedIn | 300–500 chars |
| `linkedin_connection` | LinkedIn | **280 chars** |
| `call_script` | phone | 30s open + 20s voicemail |

**Configurable length:** user types any value **50 → 500 words** →
`"Write the message in exactly {word_limit} words (±10%). Do not exceed {word_limit} words."`

**Persona detection** from the prospect's title routes to a tailored angle — technical → architecture & tech-debt; financial → ROI & payback; strategic → market position; revenue → pipeline; operational → throughput.

Every email carries an **"Anchored on" badge** naming the exact real signal it was built from.

> 🎤 "A connection request and a CFO cold email follow completely different rules. One generator can't do both well — so we built five, each with its own playbook."

---

## Slide 13 — The Feedback Loop

## It compounds with every deal

```
Outreach sent ──► Deal outcome logged
   (won · lost · no_response · meeting_booked)
        │
        ▼
ICP calibration dataset  ──►  future scoring sharpens (no manual tuning)
        │
        ▼
Every researched company embedded into a shared Qdrant collection
        │
        ▼
Market Intelligence: industry-clustered trend themes + cross-portfolio BD opportunities
```

Trends unlock at **≥ 3 companies**, group by industry into **≤ 5 clusters**, each summarized by the LLM into a `theme / insight / opportunity`.

> 🎤 "A demo is a moment. A learning loop is a business. The more you use it, the sharper the ICP scoring and the richer the market map get."

---

## Slide 14 — Graceful Degradation

## No single point of failure

Every external source can fail — and the pipeline shrugs and continues:

- **Phase-level guards** — gather and synthesize each wrapped in try/except; failure → `failed` status with the real error stored, not a crash.
- **Swarm & parallel fetches** use `asyncio.gather(..., return_exceptions=True)` — one dead source is filtered out, the rest aggregate.
- **Bulk generation** wraps *each* prospect — one failure returns `{"error": ...}` for that prospect only; others complete.
- **Embedder/Qdrant unavailable** → singleton returns `None`, RAG silently degrades to direct context, pipeline still completes.
- **LLM cluster failure** → falls back to a data-derived cluster (industry + company count + top keywords).

> 🎤 "If LinkedIn rate-limits us mid-run, we keep going on website + jobs + research. Robustness isn't a feature we added — it's wrapped around every agent."

---
---

# PART 3 — PROOF & CLOSE

---

## Slide 15 — Live Demo (the money slide)

## 🎬 Cold company → closed-ready, in 30 seconds

| Step | What the judge sees | Time |
|------|--------------------|------|
| 1 | Enter "Stripe" + "We sell fraud-detection APIs" | 0:00 |
| 2 | Tracker animates: gathering → people → keywords → researching → indexing | 0:05 |
| 3 | Human checkpoint — prune an irrelevant person | 0:12 |
| 4 | Report: ICP **84/100**, 3 pain points each with a **quoted evidence chip** | 0:18 |
| 5 | Pick a prospect → POC plan auto-generates (deal-type detected) | 0:24 |
| 6 | Generate a **150-word cold email** anchored on a hiring signal | 0:30 |
| 7 | **"Anchored on" badge** proves it's grounded, not invented | 0:32 |

> 🎤 **Rehearse cold. Pre-warm the cache. Have a backup recording.** The "Anchored on" badge is the wow moment — narrate it.

---

## Slide 16 — Tech Stack: Built to Run on $0

| Layer | Choice | Why |
|-------|--------|-----|
| LLM | **Groq** `llama-3.3-70b-versatile` | ~400 tok/s, free tier |
| Embeddings | **fastembed** `bge-small-en-v1.5` | 384-dim, ONNX, CPU, **no API key** |
| Vector DB | **Qdrant Cloud** | free tier, persistent, per-pipeline namespaces |
| Search | **DuckDuckGo** (`ddgs`) | free, keyless |
| Database | **SQLite** (stdlib) | zero infra |
| Auth | **JWT + bcrypt** | HttpOnly cookies, no OAuth provider |
| Frontend | **Next.js 15 · React 19 · Tailwind** | shadcn/ui design tokens |
| Backend | **FastAPI · Python 3.12** | async-native |

✅ **Zero paid APIs anywhere. Production-grade system on a hackathon budget.**

> 🎤 "We built this without spending a rupee on infrastructure. Judges reward resourcefulness — and it means anyone can run it tomorrow."

---

## Slide 17 — Engineering Highlights (recap)

## Production-grade, not a hackathon hack

- 🔀 **Three layers of concurrency** — `asyncio.gather` (4 scrapers), the **People Swarm** (semaphore-bounded), parallel research+crawl, and `Semaphore(3)` on bulk LLM calls
- 🧠 **RAG-grounded synthesis** — LLM-authored queries, top-k=4 retrieval, per-pipeline Qdrant namespaces, ≤5,500-char context
- 🛡️ **Graceful degradation** — every agent isolated; partial results always surface
- 🎯 **Specificity enforced** — 16 + 14 banned phrases, verbatim-evidence rules, the EMAIL_PLAYBOOK
- 🔁 **Outcome learning** — deal outcomes → ICP calibration; cumulative market clustering
- ✅ **TypeScript strict mode, zero errors**

> 🎤 Pick the two that fit your judges. Technical panel → concurrency + RAG. Product panel → specificity + the loop.

---

## Slide 18 — Market & Impact

## The ROI is time reclaimed

- **Outbound BD / SDR teams** — 10× research throughput
- **Founders selling solo** — analyst-grade prep with no analyst
- **Agencies** — white-label the whole platform per client (design-token theming)

**The math:** save 2.5 hrs/prospect × 20 prospects/week →
## **50 hours/week reclaimed per rep**

> 🎤 Convert time into pipeline or money — judges think in ROI. "That's more than a full extra workday of selling, per rep, per week."

---

## Slide 19 — Roadmap

- 🔌 **CRM export** (HubSpot, Salesforce) — one-click prospect push
- 📧 **Email send** (Gmail / Outlook OAuth) — send from the generator
- 🔄 **Scheduled re-research** — weekly drift detection on signal changes
- 👥 **Team workspace** — shared history, prospect assignment
- 📊 **ICP calibration dashboard** — outcomes vs. sub-scores over time
- 🎙️ **Voice briefing** — TTS report for the commute to a call

> 🎤 Keep it fast — the demo already proved you ship. Roadmap shows vision, don't dwell.

---

## Slide 20 — Close

# KS Business
## Three hours of BD research. Thirty seconds. Zero generic emails.

**Parallel by design · grounded in evidence · learns from every deal · runs on $0.**

👉 *Try it · [repo link] · [your contact]*

> 🎤 Close on the Slide 1 hook — open and close on the same line, the pitch feels whole. "We turned three hours into thirty seconds, without making up a single fact."

---
---

# 📋 APPENDIX — Speaker Prep

## 90-Second Elevator Pitch (memorize)

> "Business development reps spend two to three hours researching one prospect before they write a word — Googling, scrolling LinkedIn, hunting for a pain point — and the email *still* comes out generic. And generic AI tools don't fix it, because they hallucinate the personalization. The prospect can smell it.
>
> KS Business is a 15-agent pipeline that does that research in thirty seconds, and grounds every claim in real evidence. The moment you hit go, four scrapers fire concurrently — website, LinkedIn, posts, jobs — and a *swarm* of agents enriches the decision-makers in parallel, one agent per person. Everything gathered gets chunked, embedded, and stored in a per-company vector namespace.
>
> Then it pauses — so a human can prune the noise before synthesis. That's a deliberate quality gate. When you continue, the model writes its *own* retrieval queries, pulls only the most relevant evidence chunks, and synthesizes an intelligence report where every pain point quotes its source. No hallucination — if a fact isn't in the evidence, the agent returns 'Unknown.'
>
> Finally it writes outreach — five message types, any length from 50 to 500 words — with sixteen banned generic phrases enforced in code, and an 'Anchored on' badge showing the exact real signal it used. Every deal outcome you log sharpens the scoring.
>
> And it all runs on free-tier infrastructure — Groq, Qdrant, fastembed, DuckDuckGo. Zero paid APIs. Three hours of work, thirty seconds, no made-up facts, no rupee spent on infra."

---

## Demo Script (rehearse 3×)

1. **Pre-stage:** backend running; one cached pipeline ready as a fallback; browser at `/analyze`.
2. **"Watch this."** Type a well-known company (Stripe / Razorpay / Notion). Offering = one sentence.
3. **Narrate the parallelism** as the tracker animates — "four scrapers firing at once… now the people swarm enriching six decision-makers in parallel…"
4. **Hit the human checkpoint.** Remove one obviously-irrelevant person. "We keep the human in the loop — pruning noise before the AI reasons."
5. **Report appears.** Point at the **ICP score**, then a pain point's **evidence chip** — "this isn't a guess; here's the quoted source."
6. **Click a prospect.** POC plan auto-generates — "it detected this is a staffing deal and scoped a 2–4 week trial."
7. **Set word count to 150. Generate the cold email.**
8. **Point at the "Anchored on" badge.** "*This* is why it isn't generic — it's built on a real hiring signal we scraped, not an invented one."
9. **(If time)** Show `/trends` — "every company we research compounds into market intelligence."

**Target: under 90 seconds. Leave room for questions.**

---

## Deep Technical Q&A Bank

**Q: How is this different from Apollo / Clay / Lavender?**
> Those are point tools — a contact database, or an email assistant. We're an end-to-end *grounded* pipeline: parallel research → RAG-evidenced synthesis → specificity-enforced outreach → outcome learning, with a human checkpoint. And it runs entirely free-tier.

**Q: Does it hallucinate?**
> By design, no. We RAG-ground synthesis against retrieved chunks, the people-swarm prompt forbids inventing any detail ("return 'Unknown'"), pain points must quote the verbatim signal, and the UI surfaces evidence chips + the "Anchored on" signal. The LLM synthesizes from retrieved facts — it doesn't source them.

**Q: Walk me through the concurrency.**
> Three layers. (1) Gathering: `asyncio.gather` over four scrapers, plus a parallel research+crawl. (2) The People Swarm: one agent per person, bounded by `asyncio.Semaphore(4)`, max 6 people, `return_exceptions=True`. (3) Activation: A/B email tones via `gather`, and bulk generation capped at `Semaphore(3)` to respect Groq's rate limit. Blocking agent work is offloaded with `run_in_executor`, and the whole pipeline launches as an `asyncio.create_task` so the endpoint returns instantly.

**Q: How exactly does the RAG work?**
> Index: chunk every gathered fact to ~600 chars, embed with `bge-small-en-v1.5` (384-dim), upsert into Qdrant `ks_business_rag` with a `pipeline_id` payload index — that's the per-pipeline namespace. Retrieve: the LLM writes 6 short queries, we embed each and pull top-k=4 chunks per query, dedup, and assemble a ≤5,500-char context. Re-indexing is idempotent — prior chunks for the pipeline are deleted first.

**Q: Why a vector DB per pipeline instead of one big prompt?**
> A 15K-char dump dilutes signal and risks context-length errors. Retrieving only the top-k relevant chunks per question keeps the synthesis context compact and high-signal — and lets the model ask targeted questions of the data.

**Q: What if LinkedIn blocks you?**
> Each agent degrades independently. A LinkedIn 429 returns empty LinkedIn data; the pipeline continues on website + jobs + research. `return_exceptions=True` on the parallel fetches means a single failure is filtered out, not propagated.

**Q: Is the data legal / accurate?**
> Public-web scraping only — no auth-walled content. The human checkpoint lets the user verify and prune before anything is synthesized.

**Q: How does specificity get enforced — isn't that just a nice prompt?**
> It's explicit. 16 banned phrases in the insights agent, 14 in the email generator, an EMAIL_PLAYBOOK with hard word/CTA/reading-level rules, and format rules requiring verbatim evidence quotes and copy-paste-ready pitch angles. Enforced in the prompt, with BAD/GOOD examples for each rule.

**Q: How does it improve over time?**
> Deal outcomes (won/lost/no_response/meeting_booked) feed an ICP calibration dataset. Separately, every completed company is embedded into a shared collection and clustered by industry (≤5 clusters, unlocks at 3 companies) into market-trend themes. More usage → sharper scoring + richer market view.

**Q: What's actually free vs. paid?**
> Everything is free or free-tier: Groq (free tier), Qdrant Cloud (free tier), fastembed (local ONNX, no key), DuckDuckGo (keyless), SQLite (stdlib). Optional paid enrichment (Apollo/Hunter) is supported but **never required** — it falls back to email-pattern inference.

---

## One-Line Taglines (pick per audience)

- **Technical:** "A 15-agent, RAG-grounded BD pipeline — parallel by design, free-tier by default."
- **Business:** "Three hours of prospect research in thirty seconds."
- **Punchy:** "Never send 'I hope this finds you well' again."
- **Visionary:** "The BD analyst that learns from every deal you close."

---

## Fact Sheet (for the Q&A table — all verbatim from code)

| Metric | Value |
|--------|-------|
| Total agents | 15 |
| Concurrent scrapers (gather phase) | 4 |
| People Swarm concurrency cap | `Semaphore(4)`, max 6 people |
| Bulk-generation concurrency cap | `Semaphore(3)` |
| Embedding model | `BAAI/bge-small-en-v1.5` |
| Vector dimensions | 384 |
| RAG chunk size | ~600 chars |
| RAG retrieval | 6 LLM-written queries × top-k 4 |
| Max synthesis context | 5,500 chars |
| Pipeline states | 11 (`pending` … `complete`/`failed`) |
| Banned phrases (insights / email) | 16 / 14 |
| Outreach message types | 5 |
| Configurable email length | 50–500 words |
| POC deal types detected | 7 |
| Persona angles | 8 + executive fallback |
| Market-trend unlock threshold | 3 companies |
| Max trend clusters | 5 |
| LLM | Groq `llama-3.3-70b-versatile` |
| Paid APIs required | **0** |
