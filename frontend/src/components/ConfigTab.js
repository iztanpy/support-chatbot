import React, { useState, useEffect, useCallback } from 'react';
import {
  getConfig, updateConfig, compactGuidelines,
  getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow
} from '../api/client';
import { Card, SectionTitle, Label, Input, Textarea, Btn, Toggle, Spinner, Modal } from './UI';

// ─── colour tokens ───────────────────────────────────────────────────────────
const C = {
  methodGet:  { bg: '#0a2a1a', text: '#40b060', border: '#1a4a2a' },
  methodPost: { bg: '#1a1a00', text: '#c0a030', border: '#3a3a00' },
  inputBg:    '#08081a',
};

// ─── small helpers ───────────────────────────────────────────────────────────
function MethodBadge({ method }) {
  const s = method === 'POST' ? C.methodPost : C.methodGet;
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
      letterSpacing: '0.1em', background: s.bg, color: s.text, border: `1px solid ${s.border}`
    }}>{method}</span>
  );
}

function Select({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: C.inputBg, border: '1px solid #1e1e3a', borderRadius: 6,
        padding: '8px 10px', color: '#ddddf5', outline: 'none',
        cursor: 'pointer', ...style
      }}
    >
      {children}
    </select>
  );
}

// ─── Workflow row (summary card) ─────────────────────────────────────────────
function WorkflowRow({ wf, onToggle, onEdit, onDelete }) {
  const inputCount = (wf.inputs || []).length;
  return (
    <div style={{
      background: '#09091f',
      border: `1px solid ${wf.enabled ? '#22224a' : '#161630'}`,
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 14,
      opacity: wf.enabled ? 1 : 0.55, transition: 'all 0.15s',
    }}>
      {/* left: info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* trigger + method */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <MethodBadge method={wf.http_method || 'GET'} />
          <span style={{ fontSize: 13, color: wf.enabled ? '#9595e5' : '#505090', fontWeight: 600 }}>
            {wf.trigger || '(no trigger)'}
          </span>
        </div>
        {/* description */}
        {wf.description && (
          <div style={{ fontSize: 11, color: '#3a3a70', marginBottom: 5 }}>{wf.description}</div>
        )}
        {/* endpoint */}
        <div style={{
          fontSize: 11, color: '#4545a0', fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '100%', marginBottom: 5
        }}>
          {wf.endpoint_url || <span style={{ color: '#303060' }}>(no endpoint set)</span>}
        </div>
        {/* input pills */}
        {inputCount > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {(wf.inputs || []).map((inp, i) => (
              <span key={i} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 12,
                background: '#111130', color: '#5555b0', border: '1px solid #1e1e40',
                letterSpacing: '0.05em'
              }}>
                {inp.name}
                {!inp.required && <span style={{ color: '#333360' }}> (opt)</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* right: actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
        <Btn variant="ghost" small onClick={() => onEdit(wf)}>EDIT</Btn>
        <Btn variant="danger" small onClick={() => onDelete(wf.id)}>DEL</Btn>
        <Toggle checked={wf.enabled} onChange={v => onToggle(wf.id, v)} />
      </div>
    </div>
  );
}

// ─── Input field editor (inside the workflow modal) ─────────────────────────
function InputEditor({ inputs, onChange }) {
  const add = () => onChange([
    ...inputs,
    { name: '', label: '', required: true, param_type: 'query' }
  ]);

  const remove = (idx) => onChange(inputs.filter((_, i) => i !== idx));

  const set = (idx, key, val) => {
    const next = inputs.map((inp, i) => i === idx ? { ...inp, [key]: val } : inp);
    onChange(next);
  };

  return (
    <div>
      {inputs.map((inp, idx) => (
        <div key={idx} style={{
          background: '#06061a', border: '1px solid #1a1a38',
          borderRadius: 8, padding: '12px 14px', marginBottom: 8,
          position: 'relative'
        }}>
          {/* remove btn */}
          <button
            onClick={() => remove(idx)}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'none', border: 'none', color: '#4a1a1a',
              cursor: 'pointer', fontSize: 14, lineHeight: 1
            }}
            onMouseEnter={e => e.target.style.color = '#e05050'}
            onMouseLeave={e => e.target.style.color = '#4a1a1a'}
          >✕</button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <Label>Field name <span style={{ color: '#3a3a70' }}>(key in API call)</span></Label>
              <Input
                value={inp.name}
                onChange={e => set(idx, 'name', e.target.value)}
                placeholder="e.g. transaction_id"
              />
            </div>
            <div>
              <Label>Prompt label <span style={{ color: '#3a3a70' }}>(what the bot asks)</span></Label>
              <Input
                value={inp.label}
                onChange={e => set(idx, 'label', e.target.value)}
                placeholder="e.g. your Transaction ID"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <Label>Parameter type</Label>
              <Select value={inp.param_type} onChange={v => set(idx, 'param_type', v)}>
                <option value="query">Query string (?key=val)</option>
                <option value="body">Request body (JSON)</option>
              </Select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16 }}>
              <Toggle checked={inp.required} onChange={v => set(idx, 'required', v)} />
              <Label>Required</Label>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={add}
        style={{
          width: '100%', background: 'none', border: '1px dashed #1e1e40',
          borderRadius: 8, padding: '8px', color: '#3a3a80',
          cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em',
          transition: 'all 0.15s'
        }}
        onMouseEnter={e => { e.target.style.borderColor = '#4040a0'; e.target.style.color = '#6060c0'; }}
        onMouseLeave={e => { e.target.style.borderColor = '#1e1e40'; e.target.style.color = '#3a3a80'; }}
      >
        + Add input field
      </button>
    </div>
  );
}

// ─── Header editor ───────────────────────────────────────────────────────────
function HeaderEditor({ headers, onChange }) {
  const pairs = Object.entries(headers);

  const set = (oldKey, key, val) => {
    const next = { ...headers };
    if (key !== oldKey) delete next[oldKey];
    next[key] = val;
    onChange(next);
  };

  const add  = () => onChange({ ...headers, '': '' });
  const remove = (key) => {
    const next = { ...headers };
    delete next[key];
    onChange(next);
  };

  return (
    <div>
      {pairs.map(([k, v], idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
          <Input
            value={k}
            onChange={e => set(k, e.target.value, v)}
            placeholder="Header name"
            style={{ flex: 1 }}
          />
          <Input
            value={v}
            onChange={e => set(k, k, e.target.value)}
            placeholder="Value"
            style={{ flex: 2 }}
          />
          <button
            onClick={() => remove(k)}
            style={{ background: 'none', border: 'none', color: '#3a1a1a', cursor: 'pointer', fontSize: 16 }}
            onMouseEnter={e => e.target.style.color = '#e05050'}
            onMouseLeave={e => e.target.style.color = '#3a1a1a'}
          >✕</button>
        </div>
      ))}
      <button
        onClick={add}
        style={{
          width: '100%', background: 'none', border: '1px dashed #1e1e40',
          borderRadius: 8, padding: '7px', color: '#3a3a80', cursor: 'pointer',
          fontSize: 12, letterSpacing: '0.06em', transition: 'all 0.15s'
        }}
        onMouseEnter={e => { e.target.style.borderColor = '#4040a0'; e.target.style.color = '#6060c0'; }}
        onMouseLeave={e => { e.target.style.borderColor = '#1e1e40'; e.target.style.color = '#3a3a80'; }}
      >
        + Add header
      </button>
    </div>
  );
}

// ─── Workflow modal ───────────────────────────────────────────────────────────
const EMPTY_WF = {
  trigger: '', description: '',
  endpoint_url: '', http_method: 'GET',
  inputs: [], headers: {}, response_template: '', enabled: true,
};

function WorkflowModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_WF);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const isNew    = !initial?.id;
  const canSave  = form.trigger.trim() && form.endpoint_url.trim();

  const save = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const sections = ['basic', 'inputs', 'headers', 'response'];
  const sectionLabel = { basic: 'Basic', inputs: 'Inputs', headers: 'Headers', response: 'Response' };

  return (
    <Modal
      title={isNew ? '+ New Workflow' : `Edit: ${initial.trigger}`}
      onClose={onClose}
      width={640}
    >
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 20, borderBottom: '1px solid #1a1a38', paddingBottom: 10 }}>
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            background: activeSection === s ? '#131340' : 'none',
            border: `1px solid ${activeSection === s ? '#2a2a70' : 'transparent'}`,
            borderRadius: 5, padding: '4px 14px',
            color: activeSection === s ? '#8888e0' : '#404080',
            cursor: 'pointer', fontSize: 11, letterSpacing: '0.08em',
            transition: 'all 0.12s'
          }}>
            {sectionLabel[s]}
          </button>
        ))}
      </div>

      {/* ── Basic ── */}
      {activeSection === 'basic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label>Trigger phrase <span style={{ color: '#3a3a70' }}>(what the user says)</span></Label>
            <Input value={form.trigger} onChange={e => f('trigger', e.target.value)}
              placeholder="e.g. failed card transaction" />
          </div>
          <div>
            <Label>Description <span style={{ color: '#3a3a70' }}>(shown in config panel)</span></Label>
            <Input value={form.description} onChange={e => f('description', e.target.value)}
              placeholder="e.g. Look up why a card transaction was declined" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10 }}>
            <div>
              <Label>Method</Label>
              <Select value={form.http_method} onChange={v => f('http_method', v)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </Select>
            </div>
            <div>
              <Label>Endpoint URL</Label>
              <Input value={form.endpoint_url} onChange={e => f('endpoint_url', e.target.value)}
                placeholder="https://api.example.com/endpoint" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle checked={form.enabled} onChange={v => f('enabled', v)} />
            <Label>Enabled</Label>
          </div>
        </div>
      )}

      {/* ── Inputs ── */}
      {activeSection === 'inputs' && (
        <div>
          <div style={{ fontSize: 11, color: '#3a3a70', marginBottom: 14, lineHeight: 1.6 }}>
            Define what data the bot must collect from the user before calling the endpoint.
            The bot will prompt for each required field and use its name as the API parameter key.
          </div>
          <InputEditor inputs={form.inputs} onChange={v => f('inputs', v)} />
        </div>
      )}

      {/* ── Headers ── */}
      {activeSection === 'headers' && (
        <div>
          <div style={{ fontSize: 11, color: '#3a3a70', marginBottom: 14, lineHeight: 1.6 }}>
            Static HTTP headers sent with every request to this endpoint
            (e.g. <code style={{ color: '#5050a0' }}>Authorization: Bearer …</code>).
          </div>
          <HeaderEditor headers={form.headers} onChange={v => f('headers', v)} />
        </div>
      )}

      {/* ── Response ── */}
      {activeSection === 'response' && (
        <div>
          <div style={{ fontSize: 11, color: '#3a3a70', marginBottom: 10, lineHeight: 1.6 }}>
            Template for the bot's reply. Use <code style={{ color: '#6060c0' }}>{'{{key}}'}</code> or{' '}
            <code style={{ color: '#6060c0' }}>{'{{nested.key}}'}</code> to insert values from the JSON response.
            Leave blank to show the raw JSON.
          </div>
          <Textarea
            value={form.response_template}
            onChange={e => f('response_template', e.target.value)}
            rows={7}
            placeholder={`e.g.\n📋 Status: {{status}}\nReference: {{reference_number}}\n{{notes}}`}
          />
          {/* live preview if inputs have example values */}
          <div style={{ fontSize: 10, color: '#2a2a60', marginTop: 8, letterSpacing: '0.08em' }}>
            TIP: field paths are dot-separated — e.g. <code>{'{{transaction.amount}}'}</code>
          </div>
        </div>
      )}

      {/* footer */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #1a1a38' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {sections.map((s, i) => (
            <div key={s} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: activeSection === s ? '#6060d0' : '#1e1e40',
              cursor: 'pointer', transition: 'background 0.15s'
            }} onClick={() => setActiveSection(s)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
          <Btn onClick={save} disabled={!canSave || saving}>
            {saving ? <Spinner /> : isNew ? 'CREATE WORKFLOW' : 'SAVE CHANGES'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main ConfigTab ───────────────────────────────────────────────────────────
export default function ConfigTab() {
  const [config,      setConfig]      = useState(null);
  const [workflows,   setWorkflows]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [compacting,  setCompacting]  = useState(false);
  const [compactResult, setCompactResult] = useState(null);
  const [modalWf,     setModalWf]     = useState(null);
  const [showModal,   setShowModal]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, wfs] = await Promise.all([getConfig(), getWorkflows()]);
      setConfig(cfg);
      setWorkflows(wfs);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const updated = await updateConfig({
        knowledge_base_url: config.knowledge_base_url,
        guidelines:         config.guidelines,
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleCompact = async () => {
    if (!window.confirm(
      'This will merge all active corrections into the guidelines and clear the corrections list.\n\nProceed?'
    )) return;
    setCompacting(true);
    setCompactResult(null);
    try {
      const result = await compactGuidelines();
      setCompactResult(result);
      // Reload config to show updated guidelines + last_compacted_at
      const updated = await getConfig();
      setConfig(updated);
    } catch (e) { console.error(e); }
    setCompacting(false);
  };

  const toggleWorkflow = async (id, enabled) => {
    const updated = await updateWorkflow(id, { enabled });
    setWorkflows(prev => prev.map(w => w.id === id ? updated : w));
  };

  const openNew  = () => { setModalWf(null);  setShowModal(true); };
  const openEdit = (wf) => { setModalWf(wf);  setShowModal(true); };

  const handleSaveWf = async (form) => {
    if (modalWf?.id) {
      const updated = await updateWorkflow(modalWf.id, form);
      setWorkflows(prev => prev.map(w => w.id === modalWf.id ? updated : w));
    } else {
      const created = await createWorkflow(form);
      setWorkflows(prev => [...prev, created]);
    }
    setShowModal(false);
  };

  const delWorkflow = async (id) => {
    if (!window.confirm('Delete this workflow?')) return;
    await deleteWorkflow(id);
    setWorkflows(prev => prev.filter(w => w.id !== id));
  };

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Knowledge Base ── */}
      <Card>
        <SectionTitle>Knowledge Base</SectionTitle>
        <Label>URL</Label>
        <Input
          value={config?.knowledge_base_url || ''}
          onChange={e => setConfig(c => ({ ...c, knowledge_base_url: e.target.value }))}
          placeholder="https://help.example.com/..."
        />
        <div style={{ fontSize: 11, color: '#3a3a70', marginTop: 6 }}>
          The bot's primary reference for product questions.
        </div>
      </Card>

      {/* ── General Guidelines ── */}
      <Card>
        <SectionTitle>General Guidelines</SectionTitle>
        <Label>Bot behaviour instructions</Label>
        <Textarea
          value={config?.guidelines || ''}
          onChange={e => setConfig(c => ({ ...c, guidelines: e.target.value }))}
          rows={6}
          placeholder="Enter bot behaviour rules…"
        />
        <div style={{ fontSize: 11, color: '#3a3a70', marginTop: 6 }}>
          Applied to every conversation. Changes take effect immediately.
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn
          onClick={saveConfig}
          disabled={saving}
          variant={saved ? 'success' : 'primary'}
          style={{ minWidth: 140 }}
        >
          {saving ? <Spinner /> : saved ? '✓ SAVED' : 'SAVE CHANGES'}
        </Btn>

        <Btn
          onClick={handleCompact}
          disabled={compacting}
          variant="ghost"
          style={{ minWidth: 160 }}
        >
          {compacting ? <><Spinner /> &nbsp;Compacting…</> : '⚡ Compact Guidelines'}
        </Btn>

        {config?.last_compacted_at && (
          <span style={{ fontSize: 11, color: '#3a3a70' }}>
            Last compacted: {new Date(config.last_compacted_at).toLocaleString()}
          </span>
        )}
      </div>

      {compactResult && (
        <div style={{
          background: compactResult.corrections_compacted > 0 ? '#08200a' : '#0e0e1e',
          border: `1px solid ${compactResult.corrections_compacted > 0 ? '#1a5a1a' : '#2a2a4a'}`,
          borderRadius: 8, padding: '12px 16px', fontSize: 12,
          color: compactResult.corrections_compacted > 0 ? '#60c060' : '#6060a0'
        }}>
          {compactResult.message}
        </div>
      )}

      {/* ── Custom Question Workflows ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Custom Question Workflows</SectionTitle>
          <Btn small onClick={openNew}>+ NEW WORKFLOW</Btn>
        </div>
        <div style={{ fontSize: 11, color: '#3a3a70', marginBottom: 14, lineHeight: 1.6 }}>
          Each workflow defines a trigger phrase, an HTTP endpoint to call, what inputs to collect
          from the user, and how to format the response. No code changes needed.
        </div>

        {workflows.length === 0 && (
          <div style={{ color: '#303060', fontSize: 12, padding: '12px 0' }}>
            No workflows yet — click <strong style={{ color: '#5050a0' }}>+ NEW WORKFLOW</strong> to add one.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workflows.map(wf => (
            <WorkflowRow key={wf.id} wf={wf}
              onToggle={toggleWorkflow}
              onEdit={openEdit}
              onDelete={delWorkflow}
            />
          ))}
        </div>
      </Card>

      {/* ── Workflow modal ── */}
      {showModal && (
        <WorkflowModal
          initial={modalWf}
          onSave={handleSaveWf}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
