import sqlite3, json, os, uuid
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "nexus.db"))

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS pipelines (
            id TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            company_url TEXT,
            user_description TEXT,
            sender_name TEXT,
            sender_company TEXT,
            status TEXT DEFAULT 'pending',
            intelligence_json TEXT,
            error_message TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS pipeline_prospects (
            id TEXT PRIMARY KEY,
            pipeline_id TEXT NOT NULL,
            name TEXT,
            title TEXT,
            relevance TEXT,
            contact_angle TEXT,
            confidence TEXT DEFAULT 'medium',
            poc_plan_json TEXT,
            FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
        );
        CREATE TABLE IF NOT EXISTS pipeline_emails (
            id TEXT PRIMARY KEY,
            pipeline_id TEXT NOT NULL,
            prospect_id TEXT NOT NULL,
            sender_name TEXT,
            sender_company TEXT,
            tone TEXT,
            subject TEXT,
            to_name TEXT,
            to_title TEXT,
            body TEXT,
            follow_up_subject TEXT,
            follow_up_body TEXT,
            poc_summary TEXT,
            keywords_used TEXT,
            created_at TEXT,
            FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
        );
        CREATE TABLE IF NOT EXISTS company_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data_json TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            pipeline_id TEXT,
            prospect_id TEXT,
            output_type TEXT,
            output_id TEXT,
            rating INTEGER,
            note TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS email_refinements (
            id TEXT PRIMARY KEY,
            email_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT,
            FOREIGN KEY (email_id) REFERENCES pipeline_emails(id)
        );

        CREATE TABLE IF NOT EXISTS linkedin_posts (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            strategy TEXT,
            trend_cluster TEXT,
            strategy_note TEXT,
            status TEXT DEFAULT 'draft',
            pipeline_ids TEXT,
            char_count INTEGER,
            created_at TEXT
        );
        """)
        _ensure_columns(conn)


# Lightweight migration: add target-context columns to existing pipelines tables.
# Both identifiers and types are fixed, trusted constants (never user input).
_PIPELINE_EXTRA_COLUMNS = {
    "linkedin_url": "TEXT",
    "deal_size": "TEXT",
    "priority": "TEXT",
    "notes": "TEXT",
    "gathered_json": "TEXT",
    "human_input": "TEXT",
}
_PROSPECT_EXTRA_COLUMNS = {
    "prospect_status": "TEXT",
    "seniority": "TEXT",
    "role_category": "TEXT",
    "location": "TEXT",
}
_ALLOWED_COL_TYPES = {"TEXT", "INTEGER", "REAL"}

def _ensure_columns(conn):
    existing_pipeline = {r[1] for r in conn.execute("PRAGMA table_info(pipelines)").fetchall()}
    for col, coltype in _PIPELINE_EXTRA_COLUMNS.items():
        if col in existing_pipeline:
            continue
        if not col.isidentifier() or coltype not in _ALLOWED_COL_TYPES:
            raise ValueError(f"Unsafe column definition: {col} {coltype}")
        conn.execute(f"ALTER TABLE pipelines ADD COLUMN {col} {coltype}")  # nosec B608

    existing_prospect = {r[1] for r in conn.execute("PRAGMA table_info(pipeline_prospects)").fetchall()}
    for col, coltype in _PROSPECT_EXTRA_COLUMNS.items():
        if col in existing_prospect:
            continue
        if not col.isidentifier() or coltype not in _ALLOWED_COL_TYPES:
            raise ValueError(f"Unsafe column definition: {col} {coltype}")
        conn.execute(f"ALTER TABLE pipeline_prospects ADD COLUMN {col} {coltype}")  # nosec B608

def create_pipeline(id, company_name, company_url, user_description, sender_name=None, sender_company=None,
                    linkedin_url=None, deal_size=None, priority=None, notes=None):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO pipelines (id,company_name,company_url,user_description,sender_name,sender_company,linkedin_url,deal_size,priority,notes,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?)",
            (id, company_name, company_url, user_description, sender_name, sender_company,
             linkedin_url, deal_size, priority, notes, datetime.now().isoformat())
        )

def update_pipeline_status(id, status, intelligence_json=None, error=None):
    with get_conn() as conn:
        if intelligence_json is not None:
            conn.execute("UPDATE pipelines SET status=?, intelligence_json=? WHERE id=?",
                        (status, json.dumps(intelligence_json), id))
        elif error is not None:
            conn.execute("UPDATE pipelines SET status=?, error_message=? WHERE id=?",
                        (status, error, id))
        else:
            conn.execute("UPDATE pipelines SET status=? WHERE id=?", (status, id))

def get_pipeline(id):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM pipelines WHERE id=?", (id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        if d.get("intelligence_json"):
            d["intelligence"] = json.loads(d["intelligence_json"])
        d.pop("intelligence_json", None)
        if d.get("gathered_json"):
            try:
                d["gathered"] = json.loads(d["gathered_json"])
            except Exception:
                d["gathered"] = None
        d.pop("gathered_json", None)
        return d

def list_pipelines():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id,company_name,company_url,status,intelligence_json,error_message,created_at,"
            "deal_size,priority FROM pipelines ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if d.get("intelligence_json"):
                d["intelligence"] = json.loads(d["intelligence_json"])
            d.pop("intelligence_json", None)
            result.append(d)
        return result

def save_gathered(id, gathered: dict):
    with get_conn() as conn:
        conn.execute("UPDATE pipelines SET gathered_json=? WHERE id=?",
                     (json.dumps(gathered), id))

def get_gathered(id):
    with get_conn() as conn:
        row = conn.execute("SELECT gathered_json FROM pipelines WHERE id=?", (id,)).fetchone()
        if not row or not row[0]:
            return None
        try:
            return json.loads(row[0])
        except Exception:
            return None

def save_human_input(id, text):
    with get_conn() as conn:
        conn.execute("UPDATE pipelines SET human_input=? WHERE id=?", (text, id))

def save_prospects(pipeline_id, prospects):
    with get_conn() as conn:
        for p in prospects:
            conn.execute(
                "INSERT OR REPLACE INTO pipeline_prospects "
                "(id,pipeline_id,name,title,relevance,contact_angle,confidence,seniority,role_category,location,prospect_status) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (
                    p["id"], pipeline_id,
                    p.get("name", ""), p.get("title", ""),
                    p.get("relevance", ""), p.get("contact_angle", ""),
                    p.get("confidence", "medium"),
                    p.get("seniority", ""), p.get("role_category", ""),
                    p.get("location", ""), p.get("prospect_status", "new"),
                )
            )

def get_prospects(pipeline_id):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM pipeline_prospects WHERE pipeline_id=?", (pipeline_id,)).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if d.get("poc_plan_json"):
                d["poc_plan"] = json.loads(d["poc_plan_json"])
            del d["poc_plan_json"]
            result.append(d)
        return result

def update_prospect_poc(prospect_id, poc_plan):
    with get_conn() as conn:
        conn.execute("UPDATE pipeline_prospects SET poc_plan_json=? WHERE id=?",
                    (json.dumps(poc_plan), prospect_id))

def save_email(pipeline_id, prospect_id, email_data):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO pipeline_emails (id,pipeline_id,prospect_id,sender_name,sender_company,tone,subject,to_name,to_title,body,follow_up_subject,follow_up_body,poc_summary,keywords_used,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (email_data["id"], pipeline_id, prospect_id,
             email_data.get("sender_name",""), email_data.get("sender_company",""),
             email_data.get("tone","professional"), email_data.get("subject",""),
             email_data.get("to_name",""), email_data.get("to_title",""),
             email_data.get("body",""), email_data.get("follow_up_subject",""),
             email_data.get("follow_up_body",""), email_data.get("poc_summary",""),
             json.dumps(email_data.get("keywords_used",[])), email_data.get("created_at",""))
        )

def get_emails(pipeline_id):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM pipeline_emails WHERE pipeline_id=?", (pipeline_id,)).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if d.get("keywords_used"):
                try:
                    d["keywords_used"] = json.loads(d["keywords_used"])
                except Exception:
                    d["keywords_used"] = []
            result.append(d)
        return result

def save_company_profile(data: dict):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO company_profile (id,data_json,updated_at) VALUES (1,?,?) "
            "ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at",
            (json.dumps(data), datetime.now().isoformat())
        )

def get_company_profile():
    with get_conn() as conn:
        row = conn.execute("SELECT data_json FROM company_profile WHERE id=1").fetchone()
        if not row or not row[0]:
            return None
        try:
            return json.loads(row[0])
        except Exception:
            return None

def save_feedback(id, pipeline_id, prospect_id, output_type, output_id, rating, note):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO feedback (id,pipeline_id,prospect_id,output_type,output_id,rating,note,created_at) VALUES (?,?,?,?,?,?,?,?)",
            (id, pipeline_id, prospect_id, output_type, output_id, rating, note, datetime.now().isoformat())
        )

def get_feedback(pipeline_id):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM feedback WHERE pipeline_id=? ORDER BY created_at DESC", (pipeline_id,)).fetchall()
        return [dict(r) for r in rows]

# ── LinkedIn Posts CRUD ────────────────────────────────────────────────────────

def save_linkedin_post(post: dict):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO linkedin_posts "
            "(id, content, strategy, trend_cluster, strategy_note, status, pipeline_ids, char_count, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                post["id"],
                post.get("content", ""),
                post.get("strategy", ""),
                post.get("trend_cluster", ""),
                post.get("strategy_note", ""),
                post.get("status", "draft"),
                json.dumps(post.get("pipeline_ids", [])),
                post.get("char_count", len(post.get("content", ""))),
                post.get("created_at", datetime.now().isoformat()),
            )
        )


def list_linkedin_posts():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM linkedin_posts ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            try:
                d["pipeline_ids"] = json.loads(d["pipeline_ids"]) if d.get("pipeline_ids") else []
            except Exception:
                d["pipeline_ids"] = []
            result.append(d)
        return result


def update_linkedin_post_status(post_id: str, status: str):
    with get_conn() as conn:
        conn.execute("UPDATE linkedin_posts SET status=? WHERE id=?", (status, post_id))


def update_linkedin_post_content(post_id: str, content: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE linkedin_posts SET content=?, char_count=? WHERE id=?",
            (content, len(content), post_id)
        )


def delete_linkedin_post(post_id: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM linkedin_posts WHERE id=?", (post_id,))


def get_email_by_id(email_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM pipeline_emails WHERE id=?", (email_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        if d.get("keywords_used"):
            try:
                d["keywords_used"] = json.loads(d["keywords_used"])
            except Exception:
                d["keywords_used"] = []
        return d


_ALLOWED_EMAIL_FIELDS = {"body", "follow_up_body", "subject", "follow_up_subject"}

def update_email_field(email_id: str, field: str, value: str):
    if field not in _ALLOWED_EMAIL_FIELDS:
        raise ValueError(f"Field '{field}' is not allowed")
    with get_conn() as conn:
        conn.execute(f"UPDATE pipeline_emails SET {field}=? WHERE id=?", (value, email_id))


# ── Email Refinement History ───────────────────────────────────────────────────

def save_email_refinement(email_id: str, role: str, content: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO email_refinements (id, email_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), email_id, role, content, datetime.now().isoformat())
        )


def get_email_refinements(email_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT role, content, created_at FROM email_refinements WHERE email_id=? ORDER BY created_at",
            (email_id,)
        ).fetchall()
        return [dict(r) for r in rows]


# ── Prospect Status ────────────────────────────────────────────────────────────

_ALLOWED_PROSPECT_STATUSES = {"new", "contacted", "in_conversation", "won", "lost", "deprioritized"}

def update_prospect_status(prospect_id: str, status: str):
    if status not in _ALLOWED_PROSPECT_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    with get_conn() as conn:
        conn.execute("UPDATE pipeline_prospects SET prospect_status=? WHERE id=?", (status, prospect_id))


def get_stats():
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM pipelines").fetchone()[0]
        active = conn.execute("SELECT COUNT(*) FROM pipelines WHERE status NOT IN ('complete','failed')").fetchone()[0]
        completed = conn.execute("SELECT COUNT(*) FROM pipelines WHERE status='complete'").fetchone()[0]
        total_prospects = conn.execute("SELECT COUNT(*) FROM pipeline_prospects").fetchone()[0]
        scores_row = conn.execute("SELECT intelligence_json FROM pipelines WHERE status='complete' AND intelligence_json IS NOT NULL").fetchall()
        scores = []
        for r in scores_row:
            try:
                intel = json.loads(r[0])
                score = intel.get("engagement_score", {}).get("score")
                if score:
                    scores.append(int(score))
            except Exception:
                pass
        avg_score = round(sum(scores)/len(scores)) if scores else 0
        return {"total_pipelines": total, "active_pipelines": active, "completed_pipelines": completed,
                "total_prospects_identified": total_prospects, "avg_engagement_score": avg_score}
