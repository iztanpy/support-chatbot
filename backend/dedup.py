"""
Deduplication utilities for the corrections table.
All queries are scoped to a specific version_id.
"""
import re
from database import get_conn

THRESHOLD = 0.35
MAX_CORRECTIONS = 20

STOPWORDS = {
    "i", "my", "me", "the", "a", "an", "is", "are", "was", "were",
    "do", "does", "did", "can", "could", "would", "should", "will",
    "how", "what", "why", "when", "where", "which", "who",
    "to", "of", "in", "on", "for", "with", "about", "and", "or",
    "it", "its", "this", "that", "have", "has", "had", "be", "been",
    "please", "help", "need", "want", "know",
}

def _normalise(text: str) -> set:
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return {w for w in text.split() if w not in STOPWORDS and len(w) > 1}

def _similarity(a: str, b: str) -> float:
    sa, sb = _normalise(a), _normalise(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)

def upsert_correction(question: str, correct_answer: str, version_id: int) -> int:
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, question_pattern, correct_answer FROM corrections WHERE compacted=0 AND version_id=?",
        (version_id,)
    ).fetchall()

    best_id, best_sim = None, 0.0
    for row in rows:
        sim = _similarity(question, row["question_pattern"])
        if sim > best_sim:
            best_sim, best_id = sim, row["id"]

    if best_sim >= THRESHOLD and best_id is not None:
        conn.execute("""
            UPDATE corrections
            SET hit_count=hit_count+1, correct_answer=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        """, (correct_answer, best_id))
        conn.commit()
        correction_id = best_id
    else:
        conn.execute("""
            INSERT INTO corrections (version_id, question_pattern, correct_answer)
            VALUES (?, ?, ?)
        """, (version_id, question, correct_answer))
        conn.commit()
        correction_id = conn.execute(
            "SELECT id FROM corrections ORDER BY id DESC LIMIT 1"
        ).fetchone()["id"]

    conn.close()
    return correction_id

def get_active_corrections(version_id: int, limit: int = MAX_CORRECTIONS) -> list:
    conn = get_conn()
    rows = conn.execute("""
        SELECT * FROM corrections
        WHERE compacted=0 AND version_id=?
        ORDER BY hit_count DESC, updated_at DESC
        LIMIT ?
    """, (version_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
