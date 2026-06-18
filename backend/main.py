from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from groq import Groq
import os
import asyncio
import logging
from dotenv import load_dotenv
import json
import uuid
from datetime import datetime
import re

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Nexus BD API", version="2.0.0")

_default_allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_raw_allowed_origins = os.getenv("ALLOWED_ORIGINS")
if _raw_allowed_origins is None:
    allowed_origins = _default_allowed_origins
else:
    allowed_origins = [o.strip() for o in _raw_allowed_origins.split(",") if o.strip()]
    if not allowed_origins:
        allowed_origins = _default_allowed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError("Missing GROQ_API_KEY; set it in backend/.env")
client = Groq(api_key=api_key)

# Legacy in-memory store (kept for backward compatibility with old /api/research endpoints)
prospects_db: dict = {}

# --- helpers (used by agents via import) ---

def _sanitize(text: str) -> str:
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)


def _try_parse(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(_sanitize(text))


def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return _try_parse(part)
            except Exception:
                continue
    try:
        return _try_parse(text)
    except Exception:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return _try_parse(match.group())
        raise ValueError("No valid JSON found in response")

# --- Pydantic models ---

class ResearchRequest(BaseModel):
    company_name: str
    company_url: Optional[str] = None
    additional_context: Optional[str] = None

class OutreachRequest(BaseModel):
    prospect_id: str
    sender_name: str
    sender_company: str
    sender_offering: str
    tone: str = "professional"

class StatusUpdate(BaseModel):
    status: str

class AnalyzeRequest(BaseModel):
    company_name: str
    company_url: Optional[str] = None
    user_description: str
    sender_name: Optional[str] = None
    sender_company: Optional[str] = None
    linkedin_url: Optional[str] = None
    deal_size: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    post_lookback_months: int = 3
    post_limit: int = 10

class ContinueRequest(BaseModel):
    human_input: Optional[str] = None
    removed_people: List[str] = []
    # Indices of items to exclude per source: {"posts": [0,2], "jobs": [1], "crawl": [3]}
    excluded_items: dict = {}

class POCRequest(BaseModel):
    prospect_id: str
    sender_name: str
    sender_company: str
    user_description: str

class EmailRequest(BaseModel):
    prospect_id: str
    sender_name: str
    sender_company: str
    sender_offering: str
    tone: str = "professional"
    trigger_event: str = ""      # editable recent signal — funding, launch, etc.
    linkedin_quote: str = ""     # specific quote from prospect's LinkedIn / interview
    word_limit: int = 150        # max words for the email body

class PitchRequest(BaseModel):
    prospect_id: str
    sender_name: str
    sender_company: str
    sender_offering: str

class CompanyProfileModel(BaseModel):
    company_name: str = ""
    company_type: str = ""
    team_size: str = ""
    headquarters: str = ""
    services: List[str] = []
    industries: List[str] = []
    technologies: str = ""
    case_studies: str = ""
    usps: str = ""
    engagement_models: List[str] = []

class FeedbackRequest(BaseModel):
    pipeline_id: Optional[str] = None
    prospect_id: Optional[str] = None
    output_type: str
    output_id: Optional[str] = None
    rating: int
    note: Optional[str] = None

class EmailABRequest(BaseModel):
    prospect_id: str
    sender_name: str
    sender_company: str
    sender_offering: str
    tone_a: str = "professional"
    tone_b: str = "conversational"
    trigger_event: str = ""
    linkedin_quote: str = ""
    word_limit: int = 150

class BulkGenerateRequest(BaseModel):
    sender_name: str = ""
    sender_company: str = ""
    sender_offering: str = ""
    tone: str = "professional"
    word_limit: int = 150
    generate_poc: bool = True
    generate_email: bool = True

class LinkedInGenerateRequest(BaseModel):
    pass

class LinkedInRefineRequest(BaseModel):
    message: str
    current_content: str
    history: List[dict] = []

class EmailRefineRequest(BaseModel):
    message: str
    current_content: str
    history: List[dict] = []

# --- startup ---

from db import init_db
from agents.vector_store import VectorStoreAgent

init_db()
vector_agent = VectorStoreAgent()

# --- health ---

@app.get("/health")
async def health():
    return {"status": "ok"}

# --- stats ---

@app.get("/api/stats")
async def get_stats():
    from db import get_stats as db_stats
    return db_stats()

# --- v2 pipeline endpoints ---

def _target_context(body) -> dict:
    return {"notes": getattr(body, "notes", None), "deal_size": getattr(body, "deal_size", None),
            "priority": getattr(body, "priority", None), "linkedin_url": getattr(body, "linkedin_url", None)}

@app.post("/api/v2/analyze")
async def start_analysis(body: AnalyzeRequest):
    from db import create_pipeline, get_company_profile
    from pipeline import run_gathering_phase
    pipeline_id = str(uuid.uuid4())
    create_pipeline(
        pipeline_id, body.company_name, body.company_url,
        body.user_description, body.sender_name, body.sender_company,
        body.linkedin_url, body.deal_size, body.priority, body.notes
    )
    company_profile = get_company_profile()
    asyncio.create_task(run_gathering_phase(
        pipeline_id, body.company_name, body.company_url,
        body.user_description, client,
        company_profile=company_profile, target_context=_target_context(body),
        post_lookback_months=body.post_lookback_months, post_limit=body.post_limit,
    ))
    logger.info(f"Started gathering for pipeline {pipeline_id} ({body.company_name})")
    return {"pipeline_id": pipeline_id, "status": "pending"}

@app.post("/api/v2/pipeline/{pipeline_id}/continue")
async def continue_pipeline(pipeline_id: str, body: ContinueRequest):
    from db import get_pipeline as db_get_pipeline, get_company_profile, save_human_input, save_gathered
    from pipeline import run_synthesis_phase
    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if p.get("status") not in ("awaiting_input", "failed"):
        raise HTTPException(status_code=409, detail=f"Pipeline is '{p.get('status')}', not ready to continue")

    # Apply human edits: filter removed people and rejected items
    gathered = p.get("gathered") or {}
    changed = False
    if body.removed_people:
        people = gathered.get("people", {}).get("people", [])
        kept = [pe for pe in people if pe.get("name") not in set(body.removed_people)]
        gathered.setdefault("people", {})["people"] = kept
        changed = True
    if body.excluded_items:
        for source, indices in body.excluded_items.items():
            idx_set = set(indices)
            if source == "posts":
                items = gathered.get("posts", {}).get("posts", [])
                gathered.setdefault("posts", {})["posts"] = [it for i, it in enumerate(items) if i not in idx_set]
                changed = True
            elif source == "jobs":
                items = gathered.get("jobs", {}).get("jobs", [])
                gathered.setdefault("jobs", {})["jobs"] = [it for i, it in enumerate(items) if i not in idx_set]
                changed = True
            elif source == "crawl":
                items = gathered.get("crawl", {}).get("findings", [])
                gathered.setdefault("crawl", {})["findings"] = [it for i, it in enumerate(items) if i not in idx_set]
                changed = True
            elif source == "research":
                items = gathered.get("research", {}).get("results", [])
                gathered.setdefault("research", {})["results"] = [it for i, it in enumerate(items) if i not in idx_set]
                changed = True
    if changed:
        save_gathered(pipeline_id, gathered)

    if body.human_input:
        save_human_input(pipeline_id, body.human_input)

    from db import update_pipeline_status
    company_profile = get_company_profile()
    target_context = {"notes": p.get("notes"), "deal_size": p.get("deal_size"),
                      "priority": p.get("priority"), "linkedin_url": p.get("linkedin_url")}
    # Update status synchronously so the next poll immediately sees "insights"
    update_pipeline_status(pipeline_id, "insights")
    asyncio.create_task(run_synthesis_phase(
        pipeline_id, client, human_input=body.human_input,
        company_profile=company_profile, target_context=target_context,
    ))
    return {"pipeline_id": pipeline_id, "status": "insights"}

@app.get("/api/v2/pipeline/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    from db import get_pipeline as db_get_pipeline, get_prospects
    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if p.get("status") == "complete":
        p["prospects"] = get_prospects(pipeline_id)
    return p

@app.get("/api/v2/pipelines")
async def list_pipelines():
    from db import list_pipelines as db_list
    return db_list()

@app.get("/api/v2/pipeline/{pipeline_id}/prospects")
async def get_pipeline_prospects(pipeline_id: str):
    from db import get_pipeline as db_get_pipeline, get_prospects
    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return get_prospects(pipeline_id)

@app.post("/api/v2/pipeline/{pipeline_id}/poc-plan")
async def generate_poc_plan(pipeline_id: str, body: POCRequest):
    from db import get_pipeline as db_get_pipeline, get_prospects, update_prospect_poc
    from agents.poc_plan import POCPlanAgent
    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    intelligence = p.get("intelligence", {})
    prospects = get_prospects(pipeline_id)
    prospect = next((pr for pr in prospects if pr["id"] == body.prospect_id), None)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    try:
        poc = POCPlanAgent(client).run(prospect, intelligence, body.user_description, p["company_name"])
        update_prospect_poc(body.prospect_id, poc)
        return poc
    except Exception as e:
        logger.error(f"POC plan generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"POC plan generation failed: {e}")

@app.post("/api/v2/pipeline/{pipeline_id}/email")
async def generate_pipeline_email(pipeline_id: str, body: EmailRequest):
    from db import get_pipeline as db_get_pipeline, get_prospects, save_email
    from agents.email_gen import EmailGeneratorAgent
    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    intelligence = p.get("intelligence", {})
    prospects = get_prospects(pipeline_id)
    prospect = next((pr for pr in prospects if pr["id"] == body.prospect_id), None)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    poc_plan = prospect.get("poc_plan") or {}
    try:
        email = EmailGeneratorAgent(client).run(
            prospect, poc_plan, intelligence, p["company_name"],
            body.sender_name, body.sender_company, body.sender_offering, body.tone,
            trigger_event=body.trigger_event, linkedin_quote=body.linkedin_quote,
            word_limit=body.word_limit,
        )
        save_email(pipeline_id, body.prospect_id, email)
        return email
    except Exception as e:
        logger.error(f"Email generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Email generation failed: {e}")

@app.get("/api/v2/pipeline/{pipeline_id}/emails")
async def get_pipeline_emails(pipeline_id: str):
    from db import get_emails
    return get_emails(pipeline_id)


@app.post("/api/v2/pipeline/{pipeline_id}/email-ab")
async def generate_ab_emails(pipeline_id: str, body: EmailABRequest):
    """Generate two email variants (tone A + tone B) in parallel for comparison."""
    from db import get_pipeline as db_get_pipeline, get_prospects, save_email
    from agents.email_gen import EmailGeneratorAgent

    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    intelligence = p.get("intelligence", {})
    prospects = get_prospects(pipeline_id)
    prospect = next((pr for pr in prospects if pr["id"] == body.prospect_id), None)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    poc_plan = prospect.get("poc_plan") or {}

    loop = asyncio.get_running_loop()
    agent = EmailGeneratorAgent(client)

    async def gen(tone: str):
        return await loop.run_in_executor(None, lambda: agent.run(
            prospect, poc_plan, intelligence, p["company_name"],
            body.sender_name, body.sender_company, body.sender_offering, tone,
            trigger_event=body.trigger_event, linkedin_quote=body.linkedin_quote,
            word_limit=body.word_limit,
        ))

    try:
        email_a, email_b = await asyncio.gather(gen(body.tone_a), gen(body.tone_b))
        save_email(pipeline_id, body.prospect_id, email_a)
        save_email(pipeline_id, body.prospect_id, email_b)
        return {"variant_a": email_a, "variant_b": email_b, "tone_a": body.tone_a, "tone_b": body.tone_b}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"A/B email generation failed: {e}")


@app.post("/api/v2/pipeline/{pipeline_id}/bulk-generate")
async def bulk_generate(pipeline_id: str, body: BulkGenerateRequest):
    """Generate POC plans and/or emails for ALL prospects in a pipeline, concurrently."""
    from db import get_pipeline as db_get_pipeline, get_prospects, update_prospect_poc, save_email
    from agents.poc_plan import POCPlanAgent
    from agents.email_gen import EmailGeneratorAgent

    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if p.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Pipeline not yet complete")

    intelligence = p.get("intelligence", {})
    prospects = get_prospects(pipeline_id)
    if not prospects:
        return {"generated": 0, "results": []}

    sem = asyncio.Semaphore(3)  # cap at 3 concurrent LLM calls (Groq rate-limit safe)

    async def generate_for_prospect(prospect: dict) -> dict:
        async with sem:
            result: dict = {"prospect_id": prospect["id"], "name": prospect.get("name", ""), "poc": None, "email": None, "error": None}
            loop = asyncio.get_running_loop()
            try:
                if body.generate_poc and not prospect.get("poc_plan"):
                    poc = await loop.run_in_executor(None, lambda: POCPlanAgent(client).run(
                        prospect, intelligence, body.sender_offering or p.get("user_description", ""), p["company_name"]
                    ))
                    update_prospect_poc(prospect["id"], poc)
                    prospect["poc_plan"] = poc
                    result["poc"] = poc

                if body.generate_email:
                    poc_plan = prospect.get("poc_plan") or {}
                    email = await loop.run_in_executor(None, lambda: EmailGeneratorAgent(client).run(
                        prospect, poc_plan, intelligence, p["company_name"],
                        body.sender_name, body.sender_company,
                        body.sender_offering or p.get("user_description", ""),
                        body.tone, word_limit=body.word_limit,
                    ))
                    save_email(pipeline_id, prospect["id"], email)
                    result["email"] = email
            except Exception as e:
                result["error"] = str(e)
                logger.error(f"bulk-generate failed for {prospect['id']}: {e}")
            return result

    tasks = [generate_for_prospect(pr) for pr in prospects]
    results = await asyncio.gather(*tasks)
    succeeded = sum(1 for r in results if not r["error"])
    return {"generated": succeeded, "total": len(prospects), "results": list(results)}

@app.get("/api/v2/trends")
async def get_trends():
    from pipeline import generate_market_trends
    return generate_market_trends(client, vector_agent)

# --- company profile (your-company onboarding) ---

@app.get("/api/company-profile")
async def read_company_profile():
    from db import get_company_profile
    return get_company_profile() or {}

@app.put("/api/company-profile")
async def write_company_profile(body: CompanyProfileModel):
    from db import save_company_profile
    data = body.model_dump()
    save_company_profile(data)
    return data

# --- pitch assets (full BD bundle for a prospect) ---

@app.post("/api/v2/pipeline/{pipeline_id}/pitch-assets")
async def generate_pitch_assets(pipeline_id: str, body: PitchRequest):
    from db import get_pipeline as db_get_pipeline, get_prospects, get_company_profile
    from agents.pitch import PitchAssetAgent
    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    intelligence = p.get("intelligence", {})
    prospects = get_prospects(pipeline_id)
    prospect = next((pr for pr in prospects if pr["id"] == body.prospect_id), None)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    try:
        assets = PitchAssetAgent(client).run(
            prospect, intelligence, p["company_name"],
            body.sender_name, body.sender_company, body.sender_offering,
            company_profile=get_company_profile()
        )
        return assets
    except Exception as e:
        logger.error(f"Pitch asset generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Pitch generation failed: {e}")

# --- feedback ---

@app.post("/api/feedback")
async def submit_feedback(body: FeedbackRequest):
    from db import save_feedback
    fid = str(uuid.uuid4())
    save_feedback(fid, body.pipeline_id, body.prospect_id, body.output_type,
                  body.output_id, body.rating, body.note)
    return {"id": fid, "ok": True}

@app.get("/api/feedback/{pipeline_id}")
async def read_feedback(pipeline_id: str):
    from db import get_feedback
    return get_feedback(pipeline_id)

# --- LinkedIn Posts ---

@app.post("/api/v2/linkedin/generate")
async def generate_linkedin_posts(body: LinkedInGenerateRequest):
    from db import (get_company_profile, list_pipelines as db_list_pipelines,
                    get_pipeline as db_get_pipeline, list_linkedin_posts, save_linkedin_post)
    from agents.linkedin_post import LinkedInPostAgent
    from pipeline import generate_market_trends

    company_profile = get_company_profile()
    all_posts = list_linkedin_posts()
    past_posts = all_posts[:5]

    pipelines = db_list_pipelines()
    pipeline_summaries = []
    for pl in pipelines:
        if pl.get("status") != "complete":
            continue
        full = db_get_pipeline(pl["id"])
        if not full:
            continue
        intel = full.get("intelligence") or {}
        gathered = full.get("gathered") or {}

        raw_pain = intel.get("pain_points", [])
        pain_points = []
        for pp in raw_pain[:3]:
            if isinstance(pp, dict):
                pain_points.append(pp.get("title") or pp.get("description") or str(pp))
            else:
                pain_points.append(str(pp))

        raw_posts = (gathered.get("posts", {}).get("posts", [])
                     if isinstance(gathered.get("posts"), dict) else gathered.get("posts", []))
        gathered_posts = [
            {"title": p.get("title", ""), "text": p.get("text", p.get("content", ""))[:200]}
            for p in (raw_posts or [])[:5]
        ]
        industry = (intel.get("company_overview") or {}).get("industry", "")
        pipeline_summaries.append({
            "company_name": full.get("company_name", ""),
            "industry": industry,
            "pain_points": pain_points,
            "key_keywords": intel.get("key_keywords", [])[:5],
            "recent_developments": intel.get("recent_developments", [])[:2],
            "gathered_posts": gathered_posts,
        })

    try:
        trends_data = await generate_market_trends(client, vector_agent)
        trends_summary = trends_data.get("overall_summary", "")
    except Exception:
        trends_summary = ""

    agent = LinkedInPostAgent(client)
    posts = agent.run(
        company_profile=company_profile,
        past_posts=past_posts,
        pipeline_summaries=pipeline_summaries,
        trends_summary=trends_summary,
    )
    for p in posts:
        save_linkedin_post(p)
    return posts


@app.get("/api/v2/linkedin/posts")
async def list_linkedin_posts_endpoint():
    from db import list_linkedin_posts
    return list_linkedin_posts()


@app.patch("/api/v2/linkedin/posts/{post_id}/status")
async def update_post_status(post_id: str, body: dict):
    from db import update_linkedin_post_status
    status = body.get("status", "draft")
    update_linkedin_post_status(post_id, status)
    return {"ok": True}


@app.delete("/api/v2/linkedin/posts/{post_id}")
async def delete_post(post_id: str):
    from db import delete_linkedin_post
    delete_linkedin_post(post_id)
    return {"ok": True}


@app.post("/api/v2/linkedin/posts/{post_id}/refine")
async def refine_linkedin_post(post_id: str, body: LinkedInRefineRequest):
    from db import list_linkedin_posts, update_linkedin_post_content

    posts = list_linkedin_posts()
    post = next((p for p in posts if p["id"] == post_id), None)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    history = body.history or []
    messages = [
        {"role": "system", "content": (
            "You are a LinkedIn content editor. The user will ask you to refine a LinkedIn post. "
            "Return ONLY the revised post text — no commentary, no JSON, no markdown fences. "
            "Keep it under 1300 characters. Preserve the author's voice."
        )},
        {"role": "user", "content": f"Here is the current post:\n\n{body.current_content}"},
    ]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.message})

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=600,
            temperature=0.65,
            messages=messages,
        )
        new_content = resp.choices[0].message.content.strip()
        update_linkedin_post_content(post_id, new_content)
        new_history = history + [
            {"role": "user", "content": body.message},
            {"role": "assistant", "content": new_content},
        ]
        return {"content": new_content, "history": new_history}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Refine failed: {e}")


@app.post("/api/v2/email/{email_id}/refine")
async def refine_email_endpoint(email_id: str, body: EmailRefineRequest):
    from db import get_email_by_id, update_email_field

    email = get_email_by_id(email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    history = body.history or []
    messages = [
        {"role": "system", "content": (
            "You are a B2B email copywriter. Refine the email based on user instructions. "
            "Return ONLY the revised email text — no JSON, no markdown, no commentary."
        )},
        {"role": "user", "content": f"Current email:\n\n{body.current_content}"},
    ]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.message})

    try:
        from db import update_email_field, save_email_refinement, get_email_refinements
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=800,
            temperature=0.6,
            messages=messages,
        )
        new_content = resp.choices[0].message.content.strip()
        update_email_field(email_id, "body", new_content)
        save_email_refinement(email_id, "user", body.message)
        save_email_refinement(email_id, "assistant", new_content)
        new_history = history + [
            {"role": "user", "content": body.message},
            {"role": "assistant", "content": new_content},
        ]
        return {"content": new_content, "history": new_history, "field": "body"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Email refine failed: {e}")


@app.post("/api/v2/pipeline/{pipeline_id}/competitive-analysis")
async def run_competitive_analysis(pipeline_id: str):
    """Run competitive intelligence analysis for a completed pipeline."""
    from db import get_pipeline as db_get_pipeline, save_competitive_analysis, get_competitive_analysis
    from agents.competitive import CompetitiveIntelligenceAgent

    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if p.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Pipeline not complete")

    intelligence = p.get("intelligence", {})
    user_description = p.get("user_description", "")

    try:
        result = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: CompetitiveIntelligenceAgent(client).run(
                p["company_name"], intelligence, user_description
            )
        )
        save_competitive_analysis(pipeline_id, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Competitive analysis failed: {e}")


@app.get("/api/v2/pipeline/{pipeline_id}/competitive-analysis")
async def get_competitive_analysis_endpoint(pipeline_id: str):
    from db import get_competitive_analysis
    result = get_competitive_analysis(pipeline_id)
    if not result:
        raise HTTPException(status_code=404, detail="No competitive analysis found")
    return result


@app.post("/api/v2/pipeline/{pipeline_id}/drift-check")
async def run_drift_check(pipeline_id: str):
    """Re-check a completed pipeline company for meaningful changes since last analysis."""
    from db import get_pipeline as db_get_pipeline, save_drift_check, get_drift_checks
    from agents.drift import DriftDetectorAgent

    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if p.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Pipeline not complete — nothing to diff against")

    intelligence = p.get("intelligence", {})
    last_analyzed = p.get("created_at", "")
    company_url = p.get("company_url")

    try:
        result = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: DriftDetectorAgent(client).run(
                p["company_name"], intelligence, last_analyzed, company_url
            )
        )
        save_drift_check(pipeline_id, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Drift check failed: {e}")


@app.get("/api/v2/pipeline/{pipeline_id}/drift-checks")
async def get_drift_history(pipeline_id: str):
    from db import get_drift_checks
    return get_drift_checks(pipeline_id)


@app.get("/api/v2/email/{email_id}/refinements")
async def get_email_refinements_endpoint(email_id: str):
    from db import get_email_refinements
    return get_email_refinements(email_id)


class ProspectStatusRequest(BaseModel):
    status: str

@app.patch("/api/v2/prospects/{prospect_id}/status")
async def update_prospect_status_endpoint(prospect_id: str, body: ProspectStatusRequest):
    from db import update_prospect_status
    try:
        update_prospect_status(prospect_id, body.status)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- legacy v1 endpoints (kept for backward compatibility) ---

@app.post("/api/research")
async def research_company(request: ResearchRequest):
    prompt = f"""You are a world-class business intelligence analyst specializing in BD strategy.
Produce a comprehensive, insightful research report on the following company.

Company: {request.company_name}
{f"Website: {request.company_url}" if request.company_url else ""}
{f"Context: {request.additional_context}" if request.additional_context else ""}

Return a JSON object with this exact structure. Be specific, realistic, and actionable:
{{
  "company_overview": {{
    "description": "2-3 sentence description of what the company does and their mission",
    "industry": "Primary industry/sector",
    "size": "Estimated size (e.g. '500-1000 employees, ~$50M ARR')",
    "founded": "Year founded or estimated decade",
    "headquarters": "City, Country"
  }},
  "key_people": [
    {{"name": "Full name", "title": "Job title", "relevance": "Why ideal to reach out to for BD"}}
  ],
  "business_model": "How they generate revenue — be specific about monetization model",
  "recent_developments": ["Specific recent development with approximate timeframe"],
  "pain_points": ["Specific, concrete business challenge this company faces"],
  "bd_opportunities": ["Specific, actionable opportunity for a vendor/partner to deliver value"],
  "competitive_landscape": {{
    "main_competitors": ["Competitor 1", "Competitor 2", "Competitor 3"],
    "market_position": "Where they stand in the market — leader/challenger/niche",
    "differentiators": "What genuinely sets them apart"
  }},
  "engagement_score": {{
    "score": 78,
    "reasoning": "Concise reasoning for this score (budget signals, growth stage, strategic fit)"
  }},
  "recommended_approach": "Specific 2-3 sentence BD strategy with concrete first-step tactics"
}}

Be insightful and specific. Return ONLY the JSON object, no other text."""
    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile", max_tokens=2500,
            messages=[{"role": "user", "content": prompt}],
        )
        research_data = extract_json(message.choices[0].message.content)
        prospect_id = str(uuid.uuid4())
        prospect = {
            "id": prospect_id, "company_name": request.company_name,
            "company_url": request.company_url, "status": "researched",
            "research": research_data, "outreach_emails": [],
            "created_at": datetime.now().isoformat(),
        }
        prospects_db[prospect_id] = prospect
        return {"prospect_id": prospect_id, "research": research_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outreach/generate")
async def generate_outreach(request: OutreachRequest):
    prospect = prospects_db.get(request.prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    research = prospect.get("research", {})
    company_name = prospect["company_name"]
    tone_map = {
        "professional": "formal, polished, and executive-level — confident but respectful",
        "conversational": "warm, friendly, and human — professional but approachable",
        "bold": "direct and challenge-oriented — lead with a provocative insight or stat, be bold",
    }
    prompt = f"""You are a top-tier BD and sales strategist who writes emails that actually get responses.
SENDER:
- Name: {request.sender_name}
- Company: {request.sender_company}
- What they offer: {request.sender_offering}
TARGET:
- Company: {company_name}
- Industry: {research.get('company_overview', {}).get('industry', 'N/A')}
- Pain Points: {json.dumps(research.get('pain_points', []))}
- Key People: {json.dumps(research.get('key_people', []))}
TONE: {tone_map.get(request.tone, tone_map['professional'])}
Return ONLY this JSON:
{{
  "subject": "Subject line under 50 chars",
  "to_name": "Best person to contact",
  "to_title": "Their title",
  "body": "Full email body with sender name in sign-off.",
  "follow_up_subject": "Follow-up subject line for 7 days later",
  "follow_up_body": "Brief follow-up under 70 words."
}}"""
    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile", max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        email_data = extract_json(message.choices[0].message.content)
        entry = {
            "id": str(uuid.uuid4()), "sender_name": request.sender_name,
            "sender_company": request.sender_company, "tone": request.tone,
            "created_at": datetime.now().isoformat(), **email_data,
        }
        prospects_db[request.prospect_id]["outreach_emails"].append(entry)
        prospects_db[request.prospect_id]["status"] = "outreach_ready"
        return entry
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/prospects")
async def list_prospects():
    return sorted(list(prospects_db.values()), key=lambda x: x["created_at"], reverse=True)

@app.get("/api/prospects/{prospect_id}")
async def get_prospect(prospect_id: str):
    prospect = prospects_db.get(prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect

@app.patch("/api/prospects/{prospect_id}/status")
async def update_status(prospect_id: str, body: StatusUpdate):
    if prospect_id not in prospects_db:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospects_db[prospect_id]["status"] = body.status
    return prospects_db[prospect_id]

@app.delete("/api/prospects/{prospect_id}")
async def delete_prospect(prospect_id: str):
    if prospect_id not in prospects_db:
        raise HTTPException(status_code=404, detail="Prospect not found")
    del prospects_db[prospect_id]
    return {"deleted": True}
