from fastapi import FastAPI, HTTPException, Depends, Response, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from groq import Groq
import os
import asyncio
import logging
from dotenv import load_dotenv
import json
import uuid
from datetime import datetime, timedelta
import re

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="KS Business API", description="Knowledge Systems — BD Intelligence Platform", version="2.0.0")

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
    message_type: str = "cold_email"   # cold_email|follow_up_email|linkedin_message|linkedin_connection|call_script
    trigger_event: str = ""            # editable opening hook / recent signal
    linkedin_quote: str = ""           # prospect's LinkedIn post or interview quote
    pain_focus: str = ""               # pain point title to anchor on (optional)
    word_limit: int = 150

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

class DealOutcomeRequest(BaseModel):
    outcome: str  # "won" | "lost" | "dead"
    actual_deal_size: Optional[str] = None
    loss_reason: Optional[str] = None
    notes: Optional[str] = None

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

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
    persona: str = "auto"

class EmailTrackingUpdate(BaseModel):
    sent_at: Optional[str] = None
    replied_at: Optional[str] = None
    email_notes: Optional[str] = None

class ContactStatusUpdate(BaseModel):
    status: str

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
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, COOKIE_NAME, ACCESS_TOKEN_EXPIRE_DAYS
)

init_db()
vector_agent = VectorStoreAgent()

# --- health ---

@app.get("/health")
async def health():
    return {"status": "ok"}

# --- auth routes ---

@app.post("/api/auth/register")
async def register(body: RegisterRequest, response: Response):
    from db import get_user_by_email, create_user
    if get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user_id = str(uuid.uuid4())
    hashed = hash_password(body.password)
    create_user(user_id, body.email, body.full_name, hashed)
    token = create_access_token({"sub": user_id, "email": body.email})
    response.set_cookie(
        key=COOKIE_NAME, value=token, httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 86400, samesite="lax", secure=False,
    )
    return {"id": user_id, "email": body.email, "full_name": body.full_name}

@app.post("/api/auth/login")
async def login(body: LoginRequest, response: Response):
    from db import get_user_by_email, update_user_last_login
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    update_user_last_login(user["id"])
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    response.set_cookie(
        key=COOKIE_NAME, value=token, httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 86400, samesite="lax", secure=False,
    )
    return {"id": user["id"], "email": user["email"], "full_name": user["full_name"]}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return {"ok": True}

@app.get("/api/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    from db import get_user_by_id
    user = get_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user["id"], "email": user["email"], "full_name": user["full_name"]}

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
        import hashlib

        def _item_fp(item: dict) -> str:
            """Stable fingerprint: hash of the item's most identifying text field."""
            key = (item.get("title") or item.get("url") or item.get("text") or
                   item.get("snippet") or item.get("content") or str(item))[:120]
            return hashlib.md5(key.encode()).hexdigest()[:12]  # nosec B324

        for source, indices in body.excluded_items.items():
            idx_set = set(indices)
            if source == "posts":
                items = gathered.get("posts", {}).get("posts", [])
                kept = [it for i, it in enumerate(items) if i not in idx_set]
                gathered.setdefault("posts", {})["posts"] = kept
                changed = True
            elif source == "jobs":
                items = gathered.get("jobs", {}).get("jobs", [])
                kept = [it for i, it in enumerate(items) if i not in idx_set]
                gathered.setdefault("jobs", {})["jobs"] = kept
                changed = True
            elif source == "crawl":
                items = gathered.get("crawl", {}).get("findings", [])
                kept = [it for i, it in enumerate(items) if i not in idx_set]
                gathered.setdefault("crawl", {})["findings"] = kept
                changed = True
            elif source == "research":
                items = gathered.get("research", {}).get("results", [])
                kept = [it for i, it in enumerate(items) if i not in idx_set]
                gathered.setdefault("research", {})["results"] = kept
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
    from db import get_pipeline as db_get_pipeline, get_prospects, save_email, get_feedback_preferences, get_company_profile
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
    feedback_prefs = get_feedback_preferences()
    brand_voice = get_company_profile() or {}
    try:
        email = EmailGeneratorAgent(client).run(
            prospect, poc_plan, intelligence, p["company_name"],
            body.sender_name, body.sender_company, body.sender_offering, body.tone,
            message_type=body.message_type,
            trigger_event=body.trigger_event,
            linkedin_quote=body.linkedin_quote,
            pain_focus=getattr(body, 'pain_focus', ''),
            word_limit=body.word_limit,
            feedback_prefs=feedback_prefs,
            brand_voice=brand_voice,
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

    from db import get_feedback_preferences
    feedback_prefs = get_feedback_preferences()
    loop = asyncio.get_running_loop()
    agent = EmailGeneratorAgent(client)

    async def gen(tone: str):
        return await loop.run_in_executor(None, lambda: agent.run(
            prospect, poc_plan, intelligence, p["company_name"],
            body.sender_name, body.sender_company, body.sender_offering, tone,
            trigger_event=body.trigger_event, linkedin_quote=body.linkedin_quote,
            word_limit=body.word_limit, feedback_prefs=feedback_prefs,
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
    from db import get_pipeline as db_get_pipeline, get_prospects, update_prospect_poc, save_email, get_feedback_preferences
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
    feedback_prefs = get_feedback_preferences()

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
                        feedback_prefs=feedback_prefs,
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

# --- deal outcomes & ICP calibration ---

@app.post("/api/v2/pipeline/{pipeline_id}/outcome")
async def record_deal_outcome(pipeline_id: str, body: DealOutcomeRequest, current_user: dict = Depends(get_current_user)):
    from db import get_pipeline as db_get_pipeline, save_deal_outcome
    p = db_get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if body.outcome not in ("won", "lost", "dead"):
        raise HTTPException(status_code=422, detail="outcome must be 'won', 'lost', or 'dead'")
    icp_score = None
    if p.get("intelligence"):
        icp_score = (p["intelligence"].get("icp_score") or {}).get("overall")
    oid = str(uuid.uuid4())
    save_deal_outcome(oid, pipeline_id, body.outcome, body.actual_deal_size,
                      body.loss_reason, body.notes, icp_score)
    logger.info(f"Deal outcome recorded for {pipeline_id}: {body.outcome}")
    return {"id": oid, "ok": True}

@app.get("/api/v2/icp-calibration")
async def get_icp_calibration(current_user: dict = Depends(get_current_user)):
    from db import get_icp_calibration_stats
    stats = get_icp_calibration_stats()
    total_deals = sum(s["total"] for s in stats)
    return {"bands": stats, "total_deals": total_deals,
            "note": "Win rates become reliable after ~20 recorded outcomes per band."}

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
        persona=body.persona,
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


# --- LinkedIn Intelligence Hub ---

class LinkedInTargetRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=120)
    linkedin_url: str = Field(default="", max_length=300)
    website_url: str = Field(default="", max_length=300)

class LinkedInIdeaDraftRefineRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    current_content: str = Field(..., max_length=5000)
    history: List[dict] = []

class LinkedInScoreRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=5000)

class LinkedInThreadRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=5000)

class LinkedInFirstCommentRequest(BaseModel):
    post_content: str = Field(..., min_length=10, max_length=5000)

class LinkedInRemixRequest(BaseModel):
    original_content: str = Field(..., min_length=10, max_length=5000)
    company_name: str = Field(..., min_length=1, max_length=120)

class LinkedInFetchAnalyzeRequest(BaseModel):
    force: bool = False

class LinkedInPostUpdateRequest(BaseModel):
    planned_date: str | None = None
    post_notes: str | None = None
    status: str | None = None


@app.post("/api/v2/linkedin/targets")
async def add_linkedin_target(body: LinkedInTargetRequest):
    from db import add_linkedin_target as db_add
    id = str(uuid.uuid4())
    db_add(id, body.company_name, body.linkedin_url, body.website_url)
    return {"id": id, "ok": True}


@app.get("/api/v2/linkedin/targets")
async def get_linkedin_targets():
    from db import list_linkedin_targets
    return list_linkedin_targets()


@app.delete("/api/v2/linkedin/targets/{target_id}")
async def remove_linkedin_target(target_id: str):
    from db import delete_linkedin_target
    delete_linkedin_target(target_id)
    return {"ok": True}


@app.post("/api/v2/linkedin/fetch-analyze")
async def fetch_and_analyze(body: LinkedInFetchAnalyzeRequest = Body(default_factory=LinkedInFetchAnalyzeRequest)):
    from db import (get_company_profile, list_linkedin_targets, save_fetched_posts,
                    save_linkedin_analysis, save_linkedin_ideas, get_latest_linkedin_analysis,
                    list_fetched_posts)
    from agents.posts import LinkedInPostsAgent
    from agents.linkedin_analysis import LinkedInAnalysisAgent

    # Staleness check — skip re-fetch if last analysis is < 45 min old and force=False
    if not body.force:
        latest = get_latest_linkedin_analysis()
        if latest and latest.get("_fetched_at"):
            try:
                age = (datetime.now() - datetime.fromisoformat(latest["_fetched_at"])).total_seconds()
                if age < 2700:  # 45 minutes
                    latest["fetched_posts"] = list_fetched_posts()
                    return {
                        "analysis_id": None,
                        "fetched_count": len(latest["fetched_posts"]),
                        "analysis": latest,
                        "fetched_posts": latest["fetched_posts"],
                        "skipped": True,
                        "age_minutes": round(age / 60),
                    }
            except Exception:
                pass

    company_profile = get_company_profile() or {}
    own_company = company_profile.get("company_name", "")
    targets = list_linkedin_targets()

    # Parallel fetch: all companies at once using asyncio executor
    loop = asyncio.get_event_loop()

    async def fetch_one(company_name: str, company_url: str, source_type: str) -> list[dict]:
        agent = LinkedInPostsAgent()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: agent.run(company_name=company_name, lookback_months=3, limit=10, company_url=company_url or "")
            )
            posts = []
            for p in result.get("posts", []):
                posts.append({
                    "id": str(uuid.uuid4()),
                    "source_type": source_type,
                    "company_name": company_name,
                    "title": p.get("title", ""),
                    "content": p.get("text", ""),
                    "published_date": p.get("date", ""),
                    "post_url": p.get("url", ""),
                })
            return posts
        except Exception as e:
            logger.warning(f"Fetch failed for {company_name}: {e}")
            return []

    tasks = []
    if own_company:
        tasks.append(fetch_one(own_company, company_profile.get("website_url", ""), "own"))
    for target in targets:
        tasks.append(fetch_one(target["company_name"], target.get("website_url", ""), "target"))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    all_fetched: list[dict] = []
    for r in results:
        if isinstance(r, list):
            all_fetched.extend(r)

    save_fetched_posts(all_fetched)

    analysis = await loop.run_in_executor(
        None,
        lambda: LinkedInAnalysisAgent(client).run(own_company or "your company", all_fetched)
    )
    analysis_id = save_linkedin_analysis(analysis)

    ideas = analysis.get("post_ideas", [])
    if ideas:
        save_linkedin_ideas(ideas)

    return {
        "analysis_id": analysis_id,
        "fetched_count": len(all_fetched),
        "analysis": analysis,
        "fetched_posts": all_fetched,
        "skipped": False,
    }


@app.get("/api/v2/linkedin/analysis")
async def get_linkedin_analysis():
    from db import get_latest_linkedin_analysis, list_fetched_posts, list_linkedin_ideas
    analysis = get_latest_linkedin_analysis()
    if not analysis:
        return None
    analysis["fetched_posts"] = list_fetched_posts()
    analysis["post_ideas"] = list_linkedin_ideas()
    return analysis


@app.get("/api/v2/linkedin/ideas")
async def get_linkedin_ideas():
    from db import list_linkedin_ideas
    return list_linkedin_ideas()


@app.post("/api/v2/linkedin/ideas/{idea_id}/draft/start")
async def start_idea_draft(idea_id: str):
    from db import get_linkedin_idea, update_linkedin_idea_draft, get_company_profile
    from agents.linkedin_draft import LinkedInDraftAgent

    idea = get_linkedin_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    company_profile = get_company_profile()
    content = LinkedInDraftAgent(client).start_draft(idea, company_profile)
    update_linkedin_idea_draft(idea_id, content)
    return {"content": content}


@app.post("/api/v2/linkedin/ideas/{idea_id}/draft/refine")
async def refine_idea_draft(idea_id: str, body: LinkedInIdeaDraftRefineRequest):
    from db import get_linkedin_idea, update_linkedin_idea_draft, get_company_profile, save_idea_history
    from agents.linkedin_draft import LinkedInDraftAgent

    idea = get_linkedin_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    company_profile = get_company_profile()
    try:
        new_content = LinkedInDraftAgent(client).refine_draft(
            body.current_content, body.message, body.history, company_profile
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Refine failed: {e}")

    update_linkedin_idea_draft(idea_id, new_content)
    save_idea_history(idea_id, "user", body.message)
    save_idea_history(idea_id, "assistant", new_content)

    new_history = body.history + [
        {"role": "user", "content": body.message},
        {"role": "assistant", "content": new_content},
    ]
    return {"content": new_content, "history": new_history}


@app.post("/api/v2/linkedin/ideas/{idea_id}/publish")
async def publish_idea_as_post(idea_id: str):
    from db import get_linkedin_idea, update_linkedin_idea_status, save_linkedin_post
    idea = get_linkedin_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    draft = idea.get("draft_content", "")
    if not draft:
        raise HTTPException(status_code=400, detail="No draft content to publish")

    post_id = str(uuid.uuid4())
    save_linkedin_post({
        "id": post_id,
        "content": draft,
        "strategy": idea.get("angle", "industry_take"),
        "trend_cluster": idea.get("topic", ""),
        "strategy_note": idea.get("rationale", ""),
        "status": "draft",
        "char_count": len(draft),
        "created_at": datetime.now().isoformat(),
    })
    update_linkedin_idea_status(idea_id, "drafted")
    return {"post_id": post_id}


@app.patch("/api/v2/linkedin/posts/{post_id}")
async def update_linkedin_post(post_id: str, body: LinkedInPostUpdateRequest):
    from db import update_linkedin_post_fields
    fields: dict = {}
    if body.planned_date is not None:
        fields["planned_date"] = body.planned_date
    if body.post_notes is not None:
        fields["post_notes"] = body.post_notes
    if body.status is not None:
        fields["status"] = body.status
    if fields:
        update_linkedin_post_fields(post_id, fields)
    return {"ok": True}


@app.get("/api/v2/linkedin/analytics")
async def get_linkedin_analytics_endpoint():
    from db import get_linkedin_analytics
    return get_linkedin_analytics()


@app.get("/api/v2/linkedin/scheduled")
async def get_scheduled_posts_endpoint():
    from db import get_scheduled_posts
    return get_scheduled_posts()


@app.get("/api/v2/linkedin/export-brief")
async def export_content_brief():
    from db import get_latest_linkedin_analysis, list_linkedin_posts, list_linkedin_ideas
    import json as _json

    analysis = get_latest_linkedin_analysis()
    posts = list_linkedin_posts()
    ideas = list_linkedin_ideas()
    now_str = datetime.now().strftime("%B %d, %Y")

    lines = [
        f"# LinkedIn Content Brief — {now_str}",
        "",
    ]

    if analysis:
        lines += [
            "## Content Landscape Analysis",
            "",
            analysis.get("timeline_summary", ""),
            "",
            f"**Posting cadence:** {analysis.get('own_cadence', '—')}",
            f"**Best day to post:** {analysis.get('best_day_guess', '—')}",
            "",
        ]
        if analysis.get("content_themes"):
            lines += ["**Top themes:**"] + [f"- {t}" for t in analysis["content_themes"]] + [""]
        if analysis.get("content_gaps"):
            lines += ["**Content gaps:**"] + [f"- {g}" for g in analysis["content_gaps"]] + [""]

    drafted_ideas = [i for i in ideas if i.get("status") in ("drafting", "drafted") and i.get("draft_content")]
    if drafted_ideas:
        lines += ["## Drafted Posts", ""]
        for idea in drafted_ideas:
            lines += [
                f"### {idea['topic']} ({idea.get('angle', '')})",
                "",
                idea.get("draft_content", ""),
                "",
                f"*Format: {idea.get('suggested_format', '')}*",
                "",
                "---",
                "",
            ]

    selected_posts = [p for p in posts if p.get("status") == "selected"]
    if selected_posts:
        lines += ["## Selected Posts (Ready to Publish)", ""]
        for post in selected_posts:
            planned = post.get("planned_date", "")
            date_str = f" — Planned: {planned}" if planned else ""
            lines += [
                f"**{post.get('trend_cluster', 'Post')}{date_str}** ({post.get('strategy', '')})",
                "",
                post.get("content", ""),
                "",
                "---",
                "",
            ]

    if analysis and analysis.get("post_ideas"):
        lines += ["## Post Ideas Pipeline", ""]
        for idea in analysis["post_ideas"]:
            lines += [
                f"- **{idea.get('topic', '')}** ({idea.get('angle', '')}) — {idea.get('suggested_format', '')}",
                f"  → {idea.get('rationale', '')}",
            ]
        lines.append("")

    brief = "\n".join(lines)
    return {"brief": brief, "generated_at": datetime.now().isoformat(), "char_count": len(brief)}


@app.post("/api/v2/linkedin/score-post")
async def score_linkedin_post(body: LinkedInScoreRequest):
    prompt = f"""You are a LinkedIn content coach. Score this B2B post critically.

POST:
{body.content}

Return ONLY this JSON:
{{
  "scores": {{
    "hook_strength": <0-10>,
    "specificity": <0-10>,
    "readability": <0-10>,
    "cta_clarity": <0-10>,
    "length_fit": <0-10>
  }},
  "overall": <weighted average * 10, 0-100>,
  "suggestions": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "verdict": "ready_to_post|needs_work|strong_post"
}}

Scoring guide:
- hook_strength: does the first line compel you to read on?
- specificity: are there concrete details, numbers, named examples?
- readability: short sentences, natural flow, no jargon?
- cta_clarity: does it end with a clear invitation to engage?
- length_fit: is it the right length (sweet spot 800-1300 chars)?
- overall: weighted average (hook×25 + specificity×25 + readability×20 + cta×15 + length×15)
- verdict: strong_post ≥75, ready_to_post ≥55, needs_work <55"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=500,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        import json as _json
        return _json.loads(resp.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scoring failed: {e}")


@app.post("/api/v2/linkedin/build-thread")
async def build_linkedin_thread(body: LinkedInThreadRequest):
    prompt = f"""Convert this LinkedIn post into a compelling thread.

POST:
{body.content}

Rules:
- 5-7 parts
- Each part under 280 characters
- Part 1: the hook (most compelling line, standalone)
- Middle parts: build the argument/story
- Last part: CTA (follow / comment / question)
- Each part ends with its number: "1/N", "2/N" etc (where N = total parts)

Return ONLY this JSON:
{{
  "thread": [
    {{"part": 1, "content": "..."}}
  ],
  "total_parts": <N>
}}"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=800,
            temperature=0.65,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        import json as _json
        data = _json.loads(resp.choices[0].message.content)
        thread = data.get("thread", [])
        for part in thread:
            part["char_count"] = len(part.get("content", ""))
        return {"thread": thread, "total_parts": data.get("total_parts", len(thread))}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Thread build failed: {e}")


@app.post("/api/v2/linkedin/first-comment")
async def generate_first_comment(body: LinkedInFirstCommentRequest):
    prompt = f"""You are a LinkedIn growth expert. Write the ideal first comment to pin immediately after publishing this post.

POST:
{body.post_content}

The first comment should add value the post didn't cover: a key stat, a follow-up insight, a resource, or an engaging question. Under 200 characters.

Return ONLY this JSON:
{{
  "comment": "the comment text",
  "rationale": "one sentence — why this boosts reach"
}}"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=200,
            temperature=0.6,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        import json as _json
        return _json.loads(resp.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"First comment generation failed: {e}")


@app.post("/api/v2/linkedin/remix-post")
async def remix_competitor_post(body: LinkedInRemixRequest):
    from db import get_company_profile
    company_profile = get_company_profile() or {}
    own_company = company_profile.get("company_name", "our company")
    services = ", ".join(company_profile.get("services", [])[:3])
    usps = company_profile.get("usps", "")

    prompt = f"""You are a content strategist. A competitor posted this:

ORIGINAL (by {body.company_name}):
{body.original_content}

YOUR COMPANY: {own_company}
YOUR OFFERING: {f"{services}. " if services else ""}{usps}

Task: Rewrite this post for {own_company} — keep the SAME structure, format, and hook pattern that makes the original effective. Change only the company context and value proposition. Do not copy phrases directly.

Return ONLY this JSON:
{{
  "remixed_content": "the remixed post text",
  "format_kept": "e.g. stat-opener → problem → solution → outcome (1 sentence)",
  "what_changed": "brief explanation of what was adapted"
}}"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=600,
            temperature=0.7,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        import json as _json
        return _json.loads(resp.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Remix failed: {e}")


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


@app.get("/api/v2/pipeline/{pipeline_id}/profile-suggestions")
async def suggest_profile_updates(pipeline_id: str):
    """Infer company profile field suggestions from completed pipeline intelligence."""
    from db import get_pipeline as db_get_pipeline, get_company_profile
    p = db_get_pipeline(pipeline_id)
    if not p or p.get("status") != "complete":
        raise HTTPException(status_code=404, detail="Pipeline not found or not complete")

    intelligence = p.get("intelligence", {})
    existing_profile = get_company_profile() or {}
    bd_opps = intelligence.get("bd_opportunities", [])[:3]
    pain_titles = [
        (pp.get("title") if isinstance(pp, dict) else str(pp))
        for pp in (intelligence.get("pain_points") or [])[:3]
    ]
    tech_stack = intelligence.get("tech_stack", {})
    tech_gaps = tech_stack.get("gaps", []) if isinstance(tech_stack, dict) else []

    user = f"""Based on a completed BD intelligence report for {p['company_name']}, suggest improvements
to the seller's company profile that would strengthen future analyses.

WHAT THE SELLER CURRENTLY SAYS ABOUT THEMSELVES:
  Services: {', '.join(existing_profile.get('services', []) or ['(not set)'])}
  Industries: {', '.join(existing_profile.get('industries', []) or ['(not set)'])}
  Technologies: {existing_profile.get('technologies', '(not set)')}
  USPs: {existing_profile.get('usps', '(not set)')}

WHAT RESONATED IN THIS ANALYSIS:
  BD opportunities identified: {'; '.join(bd_opps)}
  Pain points matched: {'; '.join(pain_titles)}
  Tech gaps the seller could fill: {'; '.join(tech_gaps)}

TASK: Suggest specific, additive improvements to the seller's profile based on what mattered in this analysis.
Return ONLY this JSON:
{{
  "suggested_services": ["Service 1 to add or refine"],
  "suggested_industries": ["Industry tag to add"],
  "suggested_technologies": "Technologies or platforms to mention",
  "suggested_usps": "USP angle that would have been relevant here",
  "suggested_case_study": "Type of case study that would have been persuasive",
  "reasoning": "One sentence: why these suggestions are grounded in this specific analysis"
}}"""

    try:
        msg = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=600,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": user}],
        )
        from utils import extract_json
        return extract_json(msg.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Profile suggestion failed: {e}")


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


@app.post("/api/v2/pipeline/{pipeline_id}/case-study-posts")
async def generate_case_study_posts(pipeline_id: str):
    """Generate 3 LinkedIn post formats from a won deal — story arc, data-lead, quick insight."""
    from db import get_pipeline as db_get_pipeline, get_prospects, get_company_profile
    from utils import extract_json

    p = db_get_pipeline(pipeline_id)
    if not p or p.get("status") != "complete":
        raise HTTPException(status_code=404, detail="Pipeline not found or not complete")

    intelligence = p.get("intelligence", {})
    prospects = get_prospects(pipeline_id)
    won_prospects = [pr for pr in prospects if pr.get("prospect_status") == "won"]
    company_profile = get_company_profile() or {}

    overview = intelligence.get("company_overview") or {}
    pain_titles = [(pp.get("title") if isinstance(pp, dict) else str(pp))
                   for pp in (intelligence.get("pain_points") or [])[:2]]
    bv_forbidden = (company_profile.get("brand_voice_forbidden") or "").strip()
    bv_rules = (company_profile.get("brand_voice_rules") or "").strip()
    brand_block = ""
    if bv_rules or bv_forbidden:
        brand_block = f"\nBRAND VOICE: {bv_rules or ''} {'NEVER use: ' + bv_forbidden if bv_forbidden else ''}\n"

    contact_line = ""
    if won_prospects:
        pr = won_prospects[0]
        contact_line = f"Won through: {pr.get('name', '')} ({pr.get('title', '')})"

    user = f"""You are a B2B LinkedIn content writer. Generate 3 distinct LinkedIn post formats celebrating a client win.
{brand_block}
DEAL DETAILS:
  Client: {p['company_name']} ({overview.get('industry', '')})
  Size: {overview.get('size', 'undisclosed')}
  {contact_line}
  Problems we solved: {'; '.join(pain_titles) or 'business transformation'}
  Seller: {company_profile.get('company_name', 'our company')} — {', '.join(company_profile.get('services', []))[:120]}

Generate exactly 3 posts:
1. STORY ARC: 150–200 words. Problem → solution journey → outcome. Named or anonymised client.
2. DATA LEAD: 80–120 words. Open with a specific metric/outcome number (estimated if unknown), then the 2-sentence story.
3. QUICK INSIGHT: 60–80 words. One punchy lesson from this engagement that resonates with similar companies.

Rules:
- No exclamation marks. No buzzwords (synergy, leverage, solutions, cutting-edge).
- Write in first person as the company voice.
- Max 3 hashtags per post, at the very end.
- The story arc may include a subtle CTA (DM for details).

Return ONLY this JSON:
{{
  "posts": [
    {{"format": "story_arc", "content": "...", "char_count": 0}},
    {{"format": "data_lead", "content": "...", "char_count": 0}},
    {{"format": "quick_insight", "content": "...", "char_count": 0}}
  ]
}}"""

    try:
        msg = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1800,
            temperature=0.65,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": user}],
        )
        data = extract_json(msg.choices[0].message.content)
        posts = data.get("posts", [])
        for post in posts:
            post["char_count"] = len(post.get("content", ""))
        return {"posts": posts, "company_name": p["company_name"]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Case study post generation failed: {e}")


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


# ── Contacts DB ────────────────────────────────────────────────────────────────

@app.get("/api/v2/contacts")
async def get_all_contacts():
    from db import list_all_prospects_with_context
    return list_all_prospects_with_context()


@app.patch("/api/v2/contacts/{prospect_id}/status")
async def update_contact_status(prospect_id: str, body: ContactStatusUpdate):
    from db import update_prospect_status, _ALLOWED_PROSPECT_STATUSES
    if body.status not in _ALLOWED_PROSPECT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(_ALLOWED_PROSPECT_STATUSES)}")
    update_prospect_status(prospect_id, body.status)
    return {"ok": True}


# ── Outreach Tracker ───────────────────────────────────────────────────────────

@app.get("/api/v2/outreach")
async def get_all_outreach():
    from db import list_all_emails_with_context
    return list_all_emails_with_context()


@app.patch("/api/v2/outreach/{email_id}")
async def update_outreach_tracking(email_id: str, body: EmailTrackingUpdate):
    from db import update_email_tracking
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    update_email_tracking(email_id, fields)
    return {"ok": True}


# ── BD Playbook (AI battle cards) ─────────────────────────────────────────────

@app.get("/api/v2/playbook")
async def get_playbook():
    from db import get_all_completed_intelligence
    intelligence_list = get_all_completed_intelligence()
    if not intelligence_list:
        return {"battle_cards": [], "total_companies": 0, "generated_at": datetime.now().isoformat(),
                "message": "No completed analyses yet. Research some companies first."}

    # Group by industry
    by_industry: dict[str, list[dict]] = {}
    for intel in intelligence_list:
        industry = (intel.get("company_overview") or {}).get("industry") or "General"
        by_industry.setdefault(industry, []).append(intel)

    industry_blocks = []
    for industry, entries in list(by_industry.items())[:8]:  # cap at 8 industries
        companies = [e["_company_name"] for e in entries]
        pain_points = []
        opportunities = []
        for e in entries:
            raw_pp = e.get("pain_points", [])
            if isinstance(raw_pp, list):
                for pp in raw_pp[:2]:
                    txt = pp.get("title", pp) if isinstance(pp, dict) else pp
                    if txt:
                        pain_points.append(str(txt))
            raw_opp = e.get("bd_opportunities", [])
            if isinstance(raw_opp, list):
                opportunities += [str(o) for o in raw_opp[:2] if o]
        industry_blocks.append(
            f"INDUSTRY: {industry}\n"
            f"Companies: {', '.join(companies)}\n"
            f"Pain points: {'; '.join(pain_points[:5])}\n"
            f"Opportunities: {'; '.join(opportunities[:4])}"
        )

    prompt = f"""You are a senior BD strategist. Create objection-handling battle cards for each industry group.

{chr(10).join(industry_blocks)}

Return ONLY this JSON:
{{
  "battle_cards": [
    {{
      "industry": "Industry name",
      "companies": ["Company A"],
      "key_pain_points": ["specific pain 1", "specific pain 2", "specific pain 3"],
      "objections": [
        {{"objection": "We already have a solution", "response": "Specific, confident 2-sentence reframe"}},
        {{"objection": "Budget is tight this quarter", "response": "Specific reframe showing ROI angle"}},
        {{"objection": "We need to involve more stakeholders", "response": "Champion-building response"}}
      ],
      "talk_tracks": [
        "Track 1 (Pain-led): ...",
        "Track 2 (Opportunity-led): ...",
        "Track 3 (Competitive-led): ..."
      ],
      "winning_angle": "The single most effective pitch angle for this specific industry"
    }}
  ]
}}"""

    try:
        loop = asyncio.get_event_loop()
        def _call():
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", max_tokens=3000, temperature=0.4,
                messages=[{"role": "user", "content": prompt}],
            )
            return extract_json(resp.choices[0].message.content)
        result = await loop.run_in_executor(None, _call)
        result["total_companies"] = len(intelligence_list)
        result["generated_at"] = datetime.now().isoformat()
        return result
    except Exception as e:
        logger.error(f"Playbook generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Playbook generation failed: {e}")


# ── Morning Brief ──────────────────────────────────────────────────────────────

@app.get("/api/v2/brief")
async def get_morning_brief():
    from db import get_stats, get_all_completed_intelligence, list_all_prospects_with_context, get_company_profile
    stats = get_stats()
    profile = get_company_profile() or {}
    company_name = profile.get("company_name", "your company")
    intelligence_list = get_all_completed_intelligence()
    all_prospects = list_all_prospects_with_context()

    # Hot prospects: high confidence + new/contacted + high engagement
    hot = [
        p for p in all_prospects
        if p.get("confidence") in ("high", "medium")
        and p.get("prospect_status") in ("new", "contacted", None, "")
        and p.get("engagement_score", 0) >= 50
    ]
    hot.sort(key=lambda x: x.get("engagement_score", 0), reverse=True)
    hot = hot[:5]

    # Recent analyses
    recent = intelligence_list[:5]
    recent_block = "\n".join(
        f"- {r['_company_name']}: {(r.get('company_overview') or {}).get('industry', 'N/A')}, "
        f"engagement {(r.get('engagement_score') or {}).get('score', '?')}"
        for r in recent
    )

    hot_block = "\n".join(
        f"- {p['name']} ({p['title']}) at {p.get('company_name', '?')}, "
        f"confidence={p['confidence']}, engagement={p.get('engagement_score', '?')}"
        for p in hot
    ) or "No high-confidence prospects yet."

    today = datetime.now().strftime("%A, %B %d %Y")
    prompt = f"""You are a BD intelligence assistant. Generate a morning brief for {company_name}.

TODAY: {today}
PIPELINE: {stats['total_pipelines']} researched, {stats['active_pipelines']} in-progress, {stats['completed_pipelines']} complete
AVG ENGAGEMENT SCORE: {stats['avg_engagement_score']}
TOTAL PROSPECTS IDENTIFIED: {stats['total_prospects_identified']}

HOT PROSPECTS TO FOLLOW UP:
{hot_block}

RECENT ANALYSES:
{recent_block}

Return ONLY this JSON:
{{
  "executive_summary": "2-3 sentence strategic summary — what matters today, what momentum exists",
  "hot_prospects": [
    {{"name": "Name", "company": "Company", "score": 85, "reason": "Why they are hot right now — specific signal"}}
  ],
  "pipeline_health": [
    {{"label": "Completion Rate", "value": "75%", "status": "good"}},
    {{"label": "Avg Engagement", "value": 72, "status": "good"}},
    {{"label": "Active Pipelines", "value": {stats['active_pipelines']}, "status": "neutral"}},
    {{"label": "Prospects Ready", "value": {len(hot)}, "status": "good"}}
  ],
  "recommended_actions": [
    {{"priority": "high", "action": "Specific action to take today", "company": "company name or null"}},
    {{"priority": "medium", "action": "Another action this week", "company": null}},
    {{"priority": "low", "action": "Longer horizon action", "company": null}}
  ],
  "linkedin_tip": "One specific, tactical LinkedIn content tip based on the BD pipeline context"
}}"""

    try:
        loop = asyncio.get_event_loop()
        def _call():
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", max_tokens=1200, temperature=0.5,
                messages=[{"role": "user", "content": prompt}],
            )
            return extract_json(resp.choices[0].message.content)
        result = await loop.run_in_executor(None, _call)
        result["date"] = today
        result["generated_at"] = datetime.now().isoformat()
        return result
    except Exception as e:
        logger.error(f"Brief generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Brief generation failed: {e}")
