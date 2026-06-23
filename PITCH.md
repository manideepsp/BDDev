# KS Business — Pitch & Presentation Deck
### Knowledge Systems BD Intelligence
> **CRAIL Hackathon 2026**

> **How to use this file:** Each `---` divider is one slide. Paste into [Marp](https://marp.app/), [Slidev](https://sli.dev/), Reveal.js, or Deckset to auto-generate slides. Speaker notes are in the `> 🎤` callouts. The 60-second elevator pitch and demo script are at the bottom.

---

## Slide 1 — Title

# KS Business
### The BD analyst that does 3 hours of research in 30 seconds

**Knowledge Systems BD Intelligence**
A multi-agent AI pipeline for business development.

*CRAIL Hackathon 2026 · [your names]*

> 🎤 Open with energy: "Every BD rep wastes their best hours on tab-hopping. We gave them an analyst that never sleeps and never copy-pastes a generic email."

---

## Slide 2 — The Problem

## Business development doesn't scale

A typical outbound rep spends **2–3 hours per prospect** before writing one word:

- 🔍 Google the company, open 10 tabs
- 💼 Hunt LinkedIn for the right decision-makers
- 📰 Read blogs, press releases, job posts for pain signals
- 🧩 Manually stitch a narrative connecting their problems to your solution
- ✍️ Write a cold email that *still* sounds generic — because time ran out

**Result:** inconsistent output, missed signals, dismal reply rates.
Scaling the team multiplies cost — not quality.

> 🎤 Make it personal: "Raise your hand if you've ever sent an email starting with 'I hope this finds you well.' That email got ignored. We'll show you why."

---

## Slide 3 — The Insight

## The bottleneck isn't writing — it's *grounded research*

Generic AI email tools fail because they **hallucinate personalization**.

The winning email references a **real, specific, recent signal**:
> *"Saw you're hiring 4 backend engineers in Hyderabad while sunsetting your legacy billing stack..."*

That requires **evidence**, not a language model guessing.

**Our bet:** ground every claim in scraped + searched data, then let the LLM synthesize — never invent.

> 🎤 This is the intellectual core of the pitch. Specificity > fluency. Judges reward teams who understand *why* their approach works.

---

## Slide 4 — The Solution

## One company name in. A full BD playbook out.

You enter: **company name + your offering + optional URL.**

KS Business runs a **15-agent pipeline** that:

1. Scrapes website, LinkedIn, posts, jobs, people — **concurrently**
2. Runs a **People Swarm** — one enrichment agent per person, in parallel
3. Embeds everything into a **per-pipeline vector store** (RAG)
4. **Pauses for your review** — prune noise, inject context
5. Synthesizes an **evidence-first intelligence report**
6. Generates **POC plans + 5-type outreach** anchored on real signals
7. Tracks **deal outcomes** to calibrate future scoring

⏱️ **~30 seconds. Free-tier infrastructure end-to-end.**

> 🎤 Land the "human checkpoint" — it's a differentiator. We don't replace the rep's judgment, we amplify it.

---

## Slide 5 — Live Demo (the money slide)

## 🎬 Demo: Acme Corp, cold → closed-ready

| Step | What the judge sees | Time |
|------|--------------------|------|
| 1 | Enter "Stripe" + "We sell fraud-detection APIs" | 0:00 |
| 2 | Pipeline tracker animates through 8 stages | 0:05 |
| 3 | Human checkpoint — prune an irrelevant intern | 0:12 |
| 4 | Intelligence report: ICP **84/100**, 3 pain points w/ evidence | 0:18 |
| 5 | Pick a prospect → POC plan auto-generates | 0:24 |
| 6 | Generate **150-word cold email** anchored on a hiring signal | 0:30 |
| 7 | "Anchored on" badge proves it's non-generic | 0:32 |

> 🎤 **Rehearse this cold.** Have a backup recording. Pre-warm the cache so the live run is fast. Narrate the "Anchored on" badge — that's the wow moment.

---

## Slide 6 — Architecture

## Multi-agent system, not a single prompt

```
Browser (Next.js 15)
        │  JWT cookie auth
        ▼
FastAPI ── Pipeline Orchestrator (asyncio background task)
        │
   ┌────┴─────────────────────────────┐
   │  PHASE 1 — GATHER (concurrent)    │
   │  website · linkedin · posts ·     │
   │  jobs · people-swarm              │
   └────┬─────────────────────────────┘
        ▼  keywords → research → RAG index
   ⏸ HUMAN CHECKPOINT
        ▼
   ┌──────────────────────────────────┐
   │  PHASE 2 — SYNTHESIZE             │
   │  RAG retrieve → insights → embed  │
   └────┬─────────────────────────────┘
        ▼
   ON DEMAND: POC plan · 5-type outreach · pitch assets · deal outcome
        ▼
   Market Intelligence (Qdrant clustering)
```

**External:** Groq LLM · Qdrant Cloud · DuckDuckGo · public web

> 🎤 Emphasize "concurrent gather" — 25s of serial scraping cut to ~5s wall-clock via asyncio.gather.

---

## Slide 7 — The 15 Agents

## Each concern, its own focused agent

| Phase | Agents |
|-------|--------|
| **Gather** | Website Scraper · LinkedIn · Posts · Jobs · People + Swarm · Enrichment |
| **Enrich** | Keyword Extractor · Web Research · RAG Indexer |
| **Synthesize** | RAG Retriever · Insights · Vector Store |
| **Activate** | POC Plan · Outreach Generator · Pitch Assets · Market Trends |

**Why agents, not one big prompt?**
- Each agent fails gracefully — one dead source never kills the run
- Specialized prompts = higher quality per concern
- Parallelizable — the swarm enriches 8 people at once

> 🎤 "If LinkedIn rate-limits us mid-run, the pipeline shrugs and continues. No single point of failure."

---

## Slide 8 — What Makes Outreach Non-Generic

## Specificity, enforced at the prompt layer

**5 message types**, each purpose-built:
`cold_email` · `follow_up_email` · `linkedin_message` · `linkedin_connection` · `call_script`

**Configurable length:** 50 words (punchy) → 500 words (long-form)

**15 banned phrases** — never appear in output:
> ~~"I hope this finds you well"~~ · ~~"touching base"~~ · ~~"circle back"~~ · ~~"game-changer"~~ · ~~"leverage"~~ · ~~"move the needle"~~ …

**Every email shows an "Anchored on" badge** — the exact real signal that made it specific.

> 🎤 Read two banned phrases out loud. The room will laugh in recognition. That's buy-in.

---

## Slide 9 — The Feedback Loop

## It gets smarter with every deal

```
Outreach sent → Deal outcome logged
   (won · lost · no-response · meeting-booked)
        │
        ▼
ICP calibration dataset
        │
        ▼
Future scoring improves — no manual tuning
```

Plus a **cumulative Market Intelligence view**: every researched company is embedded into a shared Qdrant collection, clustered into **trend themes** + cross-portfolio BD opportunities.

> 🎤 This is the "it compounds" slide. A demo is a moment; a learning loop is a business.

---

## Slide 10 — Tech Stack

## Built to run on $0

| Layer | Choice | Why |
|-------|--------|-----|
| LLM | **Groq** `llama-3.3-70b` | ~400 tok/s, free tier |
| Embeddings | **fastembed** (ONNX, CPU) | 384-dim, no API key, sub-second |
| Vector DB | **Qdrant Cloud** | Free tier, persistent |
| Search | **DuckDuckGo** | Free, keyless |
| DB | **SQLite** (stdlib) | Zero infra |
| Auth | **JWT + bcrypt** | HttpOnly cookies, no OAuth provider |
| Frontend | **Next.js 15 · React 19 · Tailwind** | shadcn/ui design system |
| Backend | **FastAPI · Python 3.12** | async-native |

✅ **Everything free or free-tier. No paid APIs anywhere.**

> 🎤 Judges love resourcefulness. "We built a production-grade system without spending a rupee on infra."

---

## Slide 11 — Engineering Highlights

## Production-grade, not a hackathon hack

- 🔀 **True concurrency** — `asyncio.gather` + per-person swarm tasks
- 🧠 **RAG-grounded synthesis** — no context-stuffing, no hallucinated facts
- 🛡️ **Graceful degradation** — every agent wrapped in try/except; partial results always surface
- 🎨 **Design system** — CSS-token-based shadcn/ui, dark-mode-ready, white-labelable
- 🔐 **Stateless auth** — JWT cookies, middleware-protected routes
- ✅ **TypeScript strict mode, zero errors**

> 🎤 Pick the two that match your judges. Technical panel → concurrency + RAG. Business panel → design + the feedback loop.

---

## Slide 12 — Market & Impact

## Who needs this

- **Outbound BD / SDR teams** — 10× research throughput
- **Founders doing their own sales** — analyst-grade prep without an analyst
- **Agencies** — white-label the whole platform per client

**The math:** if a rep saves 2.5 hrs/prospect and researches 20 prospects/week →
**50 hours/week reclaimed per rep.**

> 🎤 Convert time saved into money or pipeline. Judges think in ROI.

---

## Slide 13 — Roadmap

## Where it goes next

- 🔌 **CRM export** (HubSpot, Salesforce) — one-click prospect push
- 📧 **Email send integration** (Gmail/Outlook OAuth)
- 🔄 **Scheduled re-research** — weekly drift detection on signal changes
- 👥 **Team workspace** — shared history, prospect assignment
- 📊 **ICP calibration dashboard** — outcomes vs. sub-scores over time
- 🎙️ **Voice briefing** — TTS report for the commute to a call

> 🎤 Keep this fast. Roadmap shows vision but don't dwell — the demo already proved you can ship.

---

## Slide 14 — Ask / Close

# KS Business
### Three hours of BD research. Thirty seconds. Zero generic emails.

**Built on free-tier infra. Grounded in real evidence. Learns from every deal.**

👉 *Try it · [repo link] · [your contact]*

> 🎤 Close with the one-liner from Slide 1. End on the same hook you opened with — it makes the pitch feel complete.

---
---

# 📋 Appendix — Speaker Prep

## 60-Second Elevator Pitch (memorize this)

> "Business development reps spend two to three hours researching a single prospect before they write one word — Googling, scrolling LinkedIn, hunting for a pain point — and the email *still* comes out generic.
>
> KS Business is a multi-agent AI pipeline that does that research in thirty seconds. You give it a company name and what you sell. Fifteen specialized agents scrape the website, LinkedIn, job posts, and people — concurrently — embed everything into a vector store, pause so you can prune the noise, then synthesize an evidence-first intelligence report: pain points with proof, an ICP fit score, and the right people to contact.
>
> Then it writes outreach anchored on a *real* signal — and shows you exactly which one, so you know it's not generic. Every deal outcome you log makes the scoring smarter.
>
> And it all runs on free-tier infrastructure — Groq, Qdrant, DuckDuckGo. Zero paid APIs. We turned three hours of work into thirty seconds, without spending a rupee on infra."

---

## Demo Script (rehearse 3×)

1. **Pre-stage:** Backend running, one cached pipeline ready as backup. Browser at `/analyze`.
2. **"Watch this."** Type a well-known company (Stripe / Notion / Razorpay). Offering: one sentence.
3. **Narrate the stages** as the tracker animates — "scraping, LinkedIn, the people swarm firing in parallel..."
4. **Hit the human checkpoint.** Remove one obviously-irrelevant person. "We keep the human in the loop."
5. **Report appears.** Point at the **ICP score**, then a **pain point's evidence chip** — "this isn't a guess, here's the source."
6. **Click a prospect.** POC plan auto-generates. 
7. **Set word count to 150. Generate the cold email.**
8. **Point at the "Anchored on" badge.** "*This* is why it's not generic — it's built on a real hiring signal we found."
9. **(If time)** Show `/trends` — "every company we research compounds into market intelligence."

**Total: under 90 seconds.** Leave time for questions.

---

## Anticipated Q&A

**Q: How is this different from Apollo / Clay / Lavender?**
> Those are point tools — a database, or an email assistant. We're an end-to-end *grounded* pipeline: research → evidence → synthesis → outreach → outcome-learning, with a human checkpoint. And we run free-tier.

**Q: Does it hallucinate?**
> That's the whole design. We RAG-ground every synthesis against scraped/searched chunks, surface evidence chips, and show the "Anchored on" signal. The LLM synthesizes from retrieved facts — it doesn't invent them.

**Q: What if LinkedIn blocks you?**
> Every agent degrades gracefully. LinkedIn 429 → empty LinkedIn data, pipeline continues from website + jobs + research. No single point of failure.

**Q: Is the data accurate / legal?**
> Public-web scraping only, no auth-walled content. The human checkpoint lets the user verify and prune before synthesis.

**Q: Why multi-agent instead of one big LLM call?**
> Specialized prompts produce higher quality per concern, agents parallelize (the swarm), and isolated failure domains mean robustness. One 15K-char prompt dilutes signal and risks context-length errors.

**Q: How does it improve over time?**
> Deal outcomes feed an ICP calibration dataset. The shared Qdrant collection clusters companies into market trends. The more you use it, the sharper the scoring and the richer the market view.

---

## One-Line Taglines (pick per audience)

- **Technical:** "A 15-agent, RAG-grounded BD pipeline that runs on free-tier infra."
- **Business:** "Three hours of prospect research in thirty seconds."
- **Punchy:** "Never send 'I hope this finds you well' again."
- **Visionary:** "The BD analyst that learns from every deal you close."
