from pydantic import BaseModel
from typing import Optional

class ConfigUpdate(BaseModel):
    knowledge_base_url: str
    guidelines: str

class ConfigOut(BaseModel):
    id: int
    knowledge_base_url: str
    guidelines: str
    updated_at: str
    last_compacted_at: Optional[str] = None

class CompactResult(BaseModel):
    message: str
    corrections_compacted: int
    new_guidelines: str

# ── Workflows ─────────────────────────────────────────────────────────────────

class WorkflowInput(BaseModel):
    name: str
    label: str
    required: bool = True
    param_type: str = "query"

class WorkflowCreate(BaseModel):
    trigger: str
    description: str = ""
    endpoint_url: str
    http_method: str = "GET"
    inputs: list[WorkflowInput] = []
    headers: dict = {}
    response_template: str = ""
    enabled: bool = True

class WorkflowUpdate(BaseModel):
    trigger: Optional[str] = None
    description: Optional[str] = None
    endpoint_url: Optional[str] = None
    http_method: Optional[str] = None
    inputs: Optional[list[WorkflowInput]] = None
    headers: Optional[dict] = None
    response_template: Optional[str] = None
    enabled: Optional[bool] = None

class WorkflowOut(BaseModel):
    id: str
    trigger: str
    description: str
    endpoint_url: str
    http_method: str
    inputs: list[WorkflowInput]
    headers: dict
    response_template: str
    enabled: bool
    created_at: str

# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessage]

class ChatResponse(BaseModel):
    reply: str
    function_called: Optional[str] = None
    function_result: Optional[dict] = None

# ── Mistakes (raw reports) ────────────────────────────────────────────────────

class MistakeCreate(BaseModel):
    question: str
    bot_answer: str
    correction: str

class MistakeOut(BaseModel):
    id: int
    question: str
    bot_answer: str
    correction: str
    fixed: bool
    archived: bool
    correction_id: Optional[int] = None
    reported_at: str
    fixed_at: Optional[str] = None

# ── Corrections (deduplicated active rules) ───────────────────────────────────

class CorrectionOut(BaseModel):
    id: int
    question_pattern: str
    correct_answer: str
    hit_count: int
    compacted: bool
    created_at: str
    updated_at: str

# ── Logs ──────────────────────────────────────────────────────────────────────

class LogOut(BaseModel):
    id: int
    session_id: Optional[str]
    question: str
    answer: str
    timestamp: str

# ── Versions ──────────────────────────────────────────────────────────────────

class VersionCreate(BaseModel):
    name: str
    clone_from_version_id: int

class VersionOut(BaseModel):
    id: int
    name: str
    is_live: bool
    source_document: Optional[str] = None
    created_at: str
