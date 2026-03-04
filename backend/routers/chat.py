from fastapi import APIRouter, HTTPException
from schemas import ChatRequest, ChatResponse
from database import get_conn, get_live_version_id
from dedup import get_active_corrections
import anthropic
import httpx
import os
import re
import json

router = APIRouter()
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

def get_config_for_version(version_id: int) -> dict:
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM bot_config WHERE version_id=?", (version_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else {}

def get_workflows_for_version(version_id: int) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM workflows WHERE enabled=1 AND version_id=? ORDER BY created_at",
        (version_id,)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["inputs"]  = json.loads(d.get("inputs") or "[]")
        d["headers"] = json.loads(d.get("headers") or "{}")
        result.append(d)
    return result

def build_system_prompt(config: dict, workflows: list, corrections: list) -> str:
    wf_blocks = []
    for wf in workflows:
        if wf["inputs"]:
            parts = [
                f'      - {inp["name"]} ({"required" if inp.get("required", True) else "optional"})'
                f': ask the user for {inp["label"]}'
                for inp in wf["inputs"]
            ]
            inputs_desc = "    Inputs to collect before calling:\n" + "\n".join(parts)
        else:
            inputs_desc = "    No inputs needed — call immediately."
        wf_blocks.append(
            f'  Workflow ID: {wf["id"]}\n'
            f'  Trigger: user asks about "{wf["trigger"]}"\n'
            f'  Description: {wf["description"]}\n'
            f'{inputs_desc}\n'
            f'  When ready, emit exactly: [CALL:{wf["id"]}:{{{{json_of_collected_inputs}}}}]'
        )
    workflows_section = "\n\n---\n\n".join(wf_blocks) if wf_blocks else "  (none)"

    if corrections:
        corrections_lines = "\n".join(
            f'  - Q: "{c["question_pattern"]}" -> A: "{c["correct_answer"]}" [{c["hit_count"]}x]'
            for c in corrections
        )
        corrections_section = f"KNOWN CORRECTIONS (follow precisely):\n{corrections_lines}"
    else:
        corrections_section = ""

    return f"""You are a helpful customer service assistant.

KNOWLEDGE BASE: {config.get("knowledge_base_url", "")}
Use the above as your primary reference for product and service questions.

GUIDELINES:
{config.get("guidelines", "")}

{corrections_section}

CUSTOM WORKFLOWS:
{workflows_section}

RULES:
- Only emit [CALL:...] when you have ALL required inputs.
- Never fabricate data. Offer to escalate if you cannot help.
- Keep answers concise and professional.
"""

def _resolve_path(data: dict, dotted: str):
    cur = data
    for k in dotted.split("."):
        cur = cur.get(k, "") if isinstance(cur, dict) else ""
    return cur if cur is not None else ""

def _render_template(template: str, data: dict) -> str:
    return re.sub(
        r'\{\{([^}]+)\}\}',
        lambda m: str(_resolve_path(data, m.group(1).strip())),
        template
    )

async def _execute_workflow(wf: dict, collected_inputs: dict) -> tuple:
    query_params, body_params = {}, {}
    for inp in wf.get("inputs", []):
        val = collected_inputs.get(inp["name"], "")
        if inp.get("param_type") == "body" and wf["http_method"] == "POST":
            body_params[inp["name"]] = val
        else:
            query_params[inp["name"]] = val

    headers = {**wf.get("headers", {}), "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            if wf["http_method"].upper() == "GET":
                resp = await http.get(wf["endpoint_url"], params=query_params, headers=headers)
            else:
                resp = await http.post(wf["endpoint_url"], params=query_params, json=body_params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        return f"Service error (HTTP {e.response.status_code}). Please try again.", {}
    except Exception as e:
        return f"Could not reach service. ({type(e).__name__})", {}

    template = wf.get("response_template", "")
    return (_render_template(template, data) if template else json.dumps(data, indent=2)), data

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    version_id  = get_live_version_id()
    config      = get_config_for_version(version_id)
    workflows   = get_workflows_for_version(version_id)
    corrections = get_active_corrections(version_id)

    if not config:
        raise HTTPException(status_code=500, detail="Bot configuration not found")

    system_prompt = build_system_prompt(config, workflows, corrections)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {str(e)}")

    reply_text = response.content[0].text
    function_called, function_result = None, None

    call_match = re.search(r'\[CALL:(\w+):(\{.*?\})\]', reply_text, re.DOTALL)
    if call_match:
        wf_id = call_match.group(1)
        wf = next((w for w in workflows if w["id"] == wf_id), None)
        if wf:
            try:
                collected = json.loads(call_match.group(2))
            except json.JSONDecodeError:
                collected = {}
            function_called = wf_id
            formatted, raw = await _execute_workflow(wf, collected)
            function_result = raw
            reply_text = re.sub(r'\[CALL:[^\]]+\]', formatted, reply_text)
        else:
            reply_text = re.sub(r'\[CALL:[^\]]+\]', "(workflow not found)", reply_text)

    user_question = req.messages[-1].content if req.messages else ""
    conn = get_conn()
    conn.execute(
        "INSERT INTO chat_logs (version_id, session_id, question, answer) VALUES (?,?,?,?)",
        (version_id, req.session_id, user_question, reply_text),
    )
    conn.commit()
    conn.close()

    return ChatResponse(reply=reply_text, function_called=function_called, function_result=function_result)
