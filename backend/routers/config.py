from fastapi import APIRouter, HTTPException
from schemas import ConfigUpdate, ConfigOut, CompactResult
from database import get_conn, get_live_version_id
from dedup import get_active_corrections
import anthropic
import os

router = APIRouter()
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

@router.get("", response_model=ConfigOut)
def get_config():
    version_id = get_live_version_id()
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM bot_config WHERE version_id=?", (version_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Config not found")
    return dict(row)

@router.put("", response_model=ConfigOut)
def update_config(body: ConfigUpdate):
    # Quick edit: updates the live version in place, no snapshot created
    version_id = get_live_version_id()
    conn = get_conn()
    conn.execute("""
        UPDATE bot_config
        SET knowledge_base_url=?, guidelines=?, updated_at=CURRENT_TIMESTAMP
        WHERE version_id=?
    """, (body.knowledge_base_url, body.guidelines, version_id))
    conn.commit()
    row = conn.execute(
        "SELECT * FROM bot_config WHERE version_id=?", (version_id,)
    ).fetchone()
    conn.close()
    return dict(row)

@router.post("/compact", response_model=CompactResult)
async def compact_guidelines():
    version_id = get_live_version_id()
    conn = get_conn()
    config_row = conn.execute(
        "SELECT * FROM bot_config WHERE version_id=?", (version_id,)
    ).fetchone()
    conn.close()

    if not config_row:
        raise HTTPException(status_code=500, detail="Config not found")

    config = dict(config_row)
    active_corrections = get_active_corrections(version_id, limit=200)

    if not active_corrections:
        return CompactResult(
            message="No active corrections to compact — guidelines unchanged.",
            corrections_compacted=0,
            new_guidelines=config["guidelines"],
        )

    corrections_text = "\n".join(
        f'  [{i+1}] Q: "{c["question_pattern"]}" ({c["hit_count"]}x) -> A: "{c["correct_answer"]}"'
        for i, c in enumerate(active_corrections)
    )

    prompt = f"""You are maintaining a customer service bot's behaviour guidelines.
{config["guidelines"]}

CORRECTIONS TO INTEGRATE:
{corrections_text}

Rewrite the guidelines as a single clean, non-redundant block integrating all corrections.
Output ONLY the new guidelines text — no commentary, no preamble."""

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        new_guidelines = response.content[0].text.strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI compaction failed: {str(e)}")

    ids = [c["id"] for c in active_corrections]
    placeholders = ",".join("?" * len(ids))
    conn = get_conn()
    conn.execute("""
        UPDATE bot_config SET guidelines=?, last_compacted_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP WHERE version_id=?
    """, (new_guidelines, version_id))
    conn.execute(
        f"UPDATE corrections SET compacted=1 WHERE id IN ({placeholders})", ids
    )
    conn.commit()
    conn.close()

    return CompactResult(
        message=f"Compacted {len(active_corrections)} correction(s) into guidelines.",
        corrections_compacted=len(active_corrections),
        new_guidelines=new_guidelines,
    )
