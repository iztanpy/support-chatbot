import sqlite3
import json
from pathlib import Path

DB_PATH = Path("/data/bot.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    c = conn.cursor()

    # ── bot_versions ─────────────────────────────────────────────────────────
    # Each row is a named agent configuration snapshot.
    # Only one row has is_live=1 at a time.
    c.execute("""
        CREATE TABLE IF NOT EXISTS bot_versions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            is_live         INTEGER DEFAULT 0,
            source_document TEXT,           -- filename if created from upload
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── bot_config ────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS bot_config (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id         INTEGER NOT NULL REFERENCES bot_versions(id),
            knowledge_base_url TEXT NOT NULL,
            guidelines         TEXT NOT NULL,
            last_compacted_at  TIMESTAMP,
            updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── workflows ─────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS workflows (
            id                TEXT NOT NULL,
            version_id        INTEGER NOT NULL REFERENCES bot_versions(id),
            trigger           TEXT NOT NULL,
            description       TEXT NOT NULL DEFAULT '',
            endpoint_url      TEXT NOT NULL DEFAULT '',
            http_method       TEXT NOT NULL DEFAULT 'GET',
            inputs            TEXT NOT NULL DEFAULT '[]',
            headers           TEXT NOT NULL DEFAULT '{}',
            response_template TEXT NOT NULL DEFAULT '',
            enabled           INTEGER DEFAULT 1,
            created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id, version_id)
        )
    """)

    # ── chat_logs ─────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER REFERENCES bot_versions(id),
            session_id TEXT,
            question   TEXT NOT NULL,
            answer     TEXT NOT NULL,
            timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── mistakes ──────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS mistakes (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id    INTEGER NOT NULL REFERENCES bot_versions(id),
            question      TEXT NOT NULL,
            bot_answer    TEXT NOT NULL,
            correction    TEXT NOT NULL,
            fixed         INTEGER DEFAULT 0,
            archived      INTEGER DEFAULT 0,
            correction_id INTEGER,
            reported_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fixed_at      TIMESTAMP
        )
    """)

    # ── corrections ───────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS corrections (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id       INTEGER NOT NULL REFERENCES bot_versions(id),
            question_pattern TEXT NOT NULL,
            correct_answer   TEXT NOT NULL,
            hit_count        INTEGER DEFAULT 1,
            compacted        INTEGER DEFAULT 0,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── seed if fresh DB ──────────────────────────────────────────────────────
    c.execute("SELECT COUNT(*) FROM bot_versions")
    if c.fetchone()[0] == 0:
        _seed(c)

    conn.commit()
    conn.close()


def _seed(c):
    """Seed a fresh database with a default live version."""
    c.execute("""
        INSERT INTO bot_versions (name, is_live) VALUES ('v1 - Default', 1)
    """)
    version_id = c.lastrowid

    c.execute("""
        INSERT INTO bot_config (version_id, knowledge_base_url, guidelines)
        VALUES (?, ?, ?)
    """, (
        version_id,
        "https://help.atome.ph/hc/en-gb/categories/4439682039065-Atome-Card",  # blank by default — set via Config tab or document upload
        """You are a helpful and professional customer service assistant.
- Always be polite and empathetic.
- If you don't know the answer, say so clearly and offer to escalate to a human agent.
- Keep responses concise and clear."""
    ))

    seed_workflows = [
        (
            "w1", version_id,
            "card application status",
            "Retrieve card application status for a customer",
            "/mock/application_status",
            "GET",
            json.dumps([]),
            "{}",
            "Application Status\nReference: {{reference_number}}\nStatus: {{status}}\nApplication Date: {{application_date}}\nEst. Completion: {{estimated_completion}}",
            1,
        ),
        (
            "w2", version_id,
            "failed card transaction",
            "Look up the reason a card transaction was declined",
            "/mock/failed_status",
            "GET",
            json.dumps([
                {"name": "transaction_id", "label": "your Transaction ID (visible in the app under Transaction History)", "required": True, "param_type": "query"}
            ]),
            "{}",
            "Transaction Details\nTransaction ID: {{transaction_id}}\nStatus: {{status}}\nAmount: {{amount}}\nMerchant: {{merchant}}\nTime: {{timestamp}}\n\nResolution: {{resolution}}",
            1,
        ),
    ]
    c.executemany("""
        INSERT INTO workflows
          (id, version_id, trigger, description, endpoint_url, http_method,
           inputs, headers, response_template, enabled)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, seed_workflows)


def get_live_version_id(conn=None) -> int:
    """Return the id of the currently live version. Raises if none found."""
    close = conn is None
    if conn is None:
        conn = get_conn()
    row = conn.execute(
        "SELECT id FROM bot_versions WHERE is_live=1 LIMIT 1"
    ).fetchone()
    if close:
        conn.close()
    if not row:
        raise RuntimeError("No live version found")
    return row["id"]
