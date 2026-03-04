from fastapi import APIRouter, HTTPException
from database import get_conn, get_live_version_id
from schemas import VersionOut, VersionCreate
import json, uuid

router = APIRouter()

@router.get("", response_model=list[VersionOut])
def list_versions():
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM bot_versions ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [_ver_dict(r) for r in rows]

@router.post("", response_model=VersionOut)
def create_version(body: VersionCreate):
    """Clone from a chosen source version into a new draft."""
    conn = get_conn()
    source_id = body.clone_from_version_id

    # Validate source exists
    src = conn.execute("SELECT * FROM bot_versions WHERE id=?", (source_id,)).fetchone()
    if not src:
        conn.close()
        raise HTTPException(status_code=404, detail="Source version not found")

    # Create new version row (draft, not live)
    conn.execute(
        "INSERT INTO bot_versions (name, is_live) VALUES (?, 0)",
        (body.name,)
    )
    conn.commit()
    new_version_id = conn.execute(
        "SELECT id FROM bot_versions ORDER BY id DESC LIMIT 1"
    ).fetchone()["id"]

    # Clone bot_config
    cfg = conn.execute(
        "SELECT * FROM bot_config WHERE version_id=?", (source_id,)
    ).fetchone()
    if cfg:
        conn.execute("""
            INSERT INTO bot_config (version_id, knowledge_base_url, guidelines)
            VALUES (?, ?, ?)
        """, (new_version_id, cfg["knowledge_base_url"], cfg["guidelines"]))

    # Clone workflows
    wfs = conn.execute(
        "SELECT * FROM workflows WHERE version_id=?", (source_id,)
    ).fetchall()
    for wf in wfs:
        conn.execute("""
            INSERT INTO workflows
              (id, version_id, trigger, description, endpoint_url, http_method,
               inputs, headers, response_template, enabled)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            f"w{uuid.uuid4().hex[:8]}", new_version_id,
            wf["trigger"], wf["description"], wf["endpoint_url"], wf["http_method"],
            wf["inputs"], wf["headers"], wf["response_template"], wf["enabled"],
        ))

    # Clone corrections
    corrections = conn.execute(
        "SELECT * FROM corrections WHERE version_id=? AND compacted=0", (source_id,)
    ).fetchall()
    for c in corrections:
        conn.execute("""
            INSERT INTO corrections (version_id, question_pattern, correct_answer, hit_count)
            VALUES (?,?,?,?)
        """, (new_version_id, c["question_pattern"], c["correct_answer"], c["hit_count"]))

    conn.commit()
    row = conn.execute("SELECT * FROM bot_versions WHERE id=?", (new_version_id,)).fetchone()
    conn.close()
    return _ver_dict(row)

@router.post("/{version_id}/promote", response_model=VersionOut)
def promote_version(version_id: int):
    """Promote a draft to live. Demotes the current live version to draft."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM bot_versions WHERE id=?", (version_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Version not found")

    conn.execute("UPDATE bot_versions SET is_live=0")
    conn.execute("UPDATE bot_versions SET is_live=1 WHERE id=?", (version_id,))
    conn.commit()
    row = conn.execute("SELECT * FROM bot_versions WHERE id=?", (version_id,)).fetchone()
    conn.close()
    return _ver_dict(row)

@router.delete("/{version_id}")
def delete_version(version_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM bot_versions WHERE id=?", (version_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Version not found")
    if row["is_live"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete the live version")

    # Cascade delete all version-scoped data
    for table in ["bot_config", "workflows", "corrections", "mistakes", "chat_logs"]:
        conn.execute(f"DELETE FROM {table} WHERE version_id=?", (version_id,))
    conn.execute("DELETE FROM bot_versions WHERE id=?", (version_id,))
    conn.commit()
    conn.close()
    return {"deleted": version_id}

def _ver_dict(row) -> dict:
    d = dict(row)
    d["is_live"] = bool(d["is_live"])
    return d
