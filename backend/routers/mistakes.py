from fastapi import APIRouter, HTTPException
from schemas import MistakeCreate, MistakeOut, CorrectionOut
from database import get_conn, get_live_version_id
from dedup import upsert_correction

router = APIRouter()

@router.get("", response_model=list[MistakeOut])
def list_mistakes(archived: bool = False):
    version_id = get_live_version_id()
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM mistakes WHERE archived=? AND version_id=? ORDER BY reported_at DESC",
        (int(archived), version_id)
    ).fetchall()
    conn.close()
    return [_mistake_dict(r) for r in rows]

@router.post("", response_model=MistakeOut)
def report_mistake(body: MistakeCreate):
    version_id = get_live_version_id()
    conn = get_conn()
    conn.execute(
        "INSERT INTO mistakes (version_id, question, bot_answer, correction) VALUES (?,?,?,?)",
        (version_id, body.question, body.bot_answer, body.correction)
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM mistakes WHERE version_id=? ORDER BY id DESC LIMIT 1", (version_id,)
    ).fetchone()
    conn.close()
    return _mistake_dict(row)

@router.post("/{mistake_id}/fix")
def fix_mistake(mistake_id: int):
    version_id = get_live_version_id()
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM mistakes WHERE id=? AND version_id=?", (mistake_id, version_id)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Mistake not found")
    mistake = dict(row)
    correction_id = upsert_correction(mistake["question"], mistake["correction"], version_id)
    conn.execute("""
        UPDATE mistakes SET fixed=1, archived=1, fixed_at=CURRENT_TIMESTAMP, correction_id=?
        WHERE id=?
    """, (correction_id, mistake_id))
    conn.commit()
    updated = conn.execute("SELECT * FROM mistakes WHERE id=?", (mistake_id,)).fetchone()
    conn.close()
    return {"message": "Fix applied.", "correction_id": correction_id, "mistake": _mistake_dict(updated)}

@router.delete("/{mistake_id}/archive")
def archive_mistake(mistake_id: int):
    conn = get_conn()
    result = conn.execute("UPDATE mistakes SET archived=1 WHERE id=?", (mistake_id,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Mistake not found")
    return {"archived": mistake_id}

@router.get("/corrections", response_model=list[CorrectionOut])
def list_corrections(include_compacted: bool = False):
    version_id = get_live_version_id()
    conn = get_conn()
    query = "SELECT * FROM corrections WHERE version_id=?"
    params = [version_id]
    if not include_compacted:
        query += " AND compacted=0"
    query += " ORDER BY hit_count DESC, updated_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [_correction_dict(r) for r in rows]

@router.patch("/corrections/{correction_id}", response_model=CorrectionOut)
def update_correction(correction_id: int, body: dict):
    conn = get_conn()
    row = conn.execute("SELECT * FROM corrections WHERE id=?", (correction_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Correction not found")
    cur = dict(row)
    conn.execute("""
        UPDATE corrections SET question_pattern=?, correct_answer=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    """, (body.get("question_pattern", cur["question_pattern"]),
          body.get("correct_answer", cur["correct_answer"]), correction_id))
    conn.commit()
    row = conn.execute("SELECT * FROM corrections WHERE id=?", (correction_id,)).fetchone()
    conn.close()
    return _correction_dict(row)

@router.delete("/corrections/{correction_id}")
def delete_correction(correction_id: int):
    conn = get_conn()
    result = conn.execute("DELETE FROM corrections WHERE id=?", (correction_id,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Correction not found")
    return {"deleted": correction_id}

def _mistake_dict(row) -> dict:
    d = dict(row)
    d["fixed"] = bool(d["fixed"])
    d["archived"] = bool(d["archived"])
    return d

def _correction_dict(row) -> dict:
    d = dict(row)
    d["compacted"] = bool(d["compacted"])
    return d
