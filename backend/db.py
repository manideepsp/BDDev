import sqlite3, json, os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "nexus.db")

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
        """)

def create_pipeline(id, company_name, company_url, user_description, sender_name=None, sender_company=None):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO pipelines (id,company_name,company_url,user_description,sender_name,sender_company,status,created_at) VALUES (?,?,?,?,?,?,'pending',?)",
            (id, company_name, company_url, user_description, sender_name, sender_company, datetime.now().isoformat())
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
        del d["intelligence_json"]
        return d

def list_pipelines():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM pipelines ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if d.get("intelligence_json"):
                d["intelligence"] = json.loads(d["intelligence_json"])
            del d["intelligence_json"]
            result.append(d)
        return result

def save_prospects(pipeline_id, prospects):
    with get_conn() as conn:
        for p in prospects:
            conn.execute(
                "INSERT OR REPLACE INTO pipeline_prospects (id,pipeline_id,name,title,relevance,contact_angle,confidence) VALUES (?,?,?,?,?,?,?)",
                (p["id"], pipeline_id, p.get("name",""), p.get("title",""), p.get("relevance",""), p.get("contact_angle",""), p.get("confidence","medium"))
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
