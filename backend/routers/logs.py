from fastapi import APIRouter
from schemas import LogOut
from database import get_conn, get_live_version_id

router = APIRouter()

@router.get("", response_model=list[LogOut])
def list_logs(limit: int = 100, offset: int = 0):
    version_id = get_live_version_id()
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM chat_logs WHERE version_id=? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
        (version_id, limit, offset)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/stats")
def get_stats():
    version_id = get_live_version_id()
    conn = get_conn()
    total         = conn.execute("SELECT COUNT(*) FROM chat_logs WHERE version_id=?", (version_id,)).fetchone()[0]
    mistakes      = conn.execute("SELECT COUNT(*) FROM mistakes WHERE archived=0 AND version_id=?", (version_id,)).fetchone()[0]
    fixed         = conn.execute("SELECT COUNT(*) FROM mistakes WHERE fixed=1 AND version_id=?", (version_id,)).fetchone()[0]
    total_mistakes= conn.execute("SELECT COUNT(*) FROM mistakes WHERE version_id=?", (version_id,)).fetchone()[0]
    conn.close()
    return {
        "total_interactions": total,
        "pending_mistakes": mistakes,
        "fixed_mistakes": fixed,
        "total_reported": total_mistakes,
        "correct_rate": round((total - total_mistakes) / max(total, 1) * 100, 1),
    }
