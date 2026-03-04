from fastapi import APIRouter, HTTPException
from schemas import WorkflowCreate, WorkflowUpdate, WorkflowOut
from database import get_conn, get_live_version_id
import uuid, json

router = APIRouter()

def _row_to_wf(row) -> dict:
    d = dict(row)
    d["inputs"]  = json.loads(d.get("inputs") or "[]")
    d["headers"] = json.loads(d.get("headers") or "{}")
    d["enabled"] = bool(d["enabled"])
    return d

@router.get("", response_model=list[WorkflowOut])
def list_workflows():
    version_id = get_live_version_id()
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM workflows WHERE version_id=? ORDER BY created_at", (version_id,)
    ).fetchall()
    conn.close()
    return [_row_to_wf(r) for r in rows]

@router.post("", response_model=WorkflowOut)
def create_workflow(body: WorkflowCreate):
    version_id = get_live_version_id()
    wf_id = f"w{uuid.uuid4().hex[:8]}"
    conn = get_conn()
    conn.execute("""
        INSERT INTO workflows
          (id, version_id, trigger, description, endpoint_url, http_method,
           inputs, headers, response_template, enabled)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (
        wf_id, version_id, body.trigger, body.description, body.endpoint_url,
        body.http_method.upper(),
        json.dumps([i.model_dump() for i in body.inputs]),
        json.dumps(body.headers), body.response_template, int(body.enabled),
    ))
    conn.commit()
    row = conn.execute(
        "SELECT * FROM workflows WHERE id=? AND version_id=?", (wf_id, version_id)
    ).fetchone()
    conn.close()
    return _row_to_wf(row)

@router.patch("/{wf_id}", response_model=WorkflowOut)
def update_workflow(wf_id: str, body: WorkflowUpdate):
    version_id = get_live_version_id()
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM workflows WHERE id=? AND version_id=?", (wf_id, version_id)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Workflow not found")
    cur = _row_to_wf(row)
    conn.execute("""
        UPDATE workflows
        SET trigger=?, description=?, endpoint_url=?, http_method=?,
            inputs=?, headers=?, response_template=?, enabled=?
        WHERE id=? AND version_id=?
    """, (
        body.trigger              if body.trigger           is not None else cur["trigger"],
        body.description          if body.description       is not None else cur["description"],
        body.endpoint_url         if body.endpoint_url      is not None else cur["endpoint_url"],
        body.http_method.upper()  if body.http_method       is not None else cur["http_method"],
        json.dumps([i.model_dump() for i in body.inputs]) if body.inputs is not None else json.dumps(cur["inputs"]),
        json.dumps(body.headers)  if body.headers           is not None else json.dumps(cur["headers"]),
        body.response_template    if body.response_template is not None else cur["response_template"],
        int(body.enabled)         if body.enabled           is not None else int(cur["enabled"]),
        wf_id, version_id,
    ))
    conn.commit()
    row = conn.execute(
        "SELECT * FROM workflows WHERE id=? AND version_id=?", (wf_id, version_id)
    ).fetchone()
    conn.close()
    return _row_to_wf(row)

@router.delete("/{wf_id}")
def delete_workflow(wf_id: str):
    version_id = get_live_version_id()
    conn = get_conn()
    result = conn.execute(
        "DELETE FROM workflows WHERE id=? AND version_id=?", (wf_id, version_id)
    )
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"deleted": wf_id}
