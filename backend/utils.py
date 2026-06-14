import json
import re


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


def pain_point_titles(intelligence: dict, limit: int = 3) -> list[str]:
    """Pain points may be evidence-chain objects or plain strings (legacy).
    Return a flat list of human-readable title strings for embedding / prompts."""
    out = []
    for p in (intelligence.get("pain_points") or [])[:limit]:
        if isinstance(p, dict):
            title = p.get("title") or p.get("opportunity") or ""
            if title:
                out.append(str(title))
        elif p:
            out.append(str(p))
    return out
