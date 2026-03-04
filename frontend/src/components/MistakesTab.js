import React, { useState, useEffect, useCallback } from 'react';
import {
  getMistakes, fixMistake, archiveMistake,
  getCorrections, updateCorrection, deleteCorrection
} from '../api/client';
import { Badge, Btn, Spinner, Card, SectionTitle, Label, Input, Textarea, Modal } from './UI';

// ─── Correction card (deduplicated active rule) ───────────────────────────────
function CorrectionCard({ c, onEdit, onDelete }) {
  return (
    <div className="fadeIn" style={{
      background: '#080818', border: '1px solid #1a1a38',
      borderRadius: 8, padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 12
    }}>
      {/* hit badge */}
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 8,
        background: '#0f0f2a', border: '1px solid #2a2a50',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#7070d0', lineHeight: 1 }}>
          {c.hit_count}
        </div>
        <div style={{ fontSize: 8, color: '#3a3a70', letterSpacing: '0.05em' }}>HITS</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#4040a0', marginBottom: 3, letterSpacing: '0.06em' }}>
          QUESTION PATTERN
        </div>
        <div style={{ fontSize: 12, color: '#7070b0', marginBottom: 8, lineHeight: 1.5 }}>
          {c.question_pattern}
        </div>
        <div style={{ fontSize: 11, color: '#2a5a2a', marginBottom: 3, letterSpacing: '0.06em' }}>
          CORRECT ANSWER
        </div>
        <div style={{ fontSize: 12, color: '#50a050', lineHeight: 1.5 }}>
          {c.correct_answer}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <Btn variant="ghost" small onClick={() => onEdit(c)}>EDIT</Btn>
        <Btn variant="danger" small onClick={() => onDelete(c.id)}>DEL</Btn>
      </div>
    </div>
  );
}

// ─── Mistake card (raw report) ────────────────────────────────────────────────
function MistakeCard({ m, onFix, onArchive, fixing }) {
  return (
    <div className="fadeIn" style={{
      background: '#0a0a1e',
      border: `1px solid ${m.fixed ? '#1a3a1a' : m.archived ? '#1a1a3a' : '#3a1a1a'}`,
      borderRadius: 10, padding: 16, marginBottom: 10
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {m.fixed
            ? <Badge color="green">✓ FIXED</Badge>
            : m.archived
              ? <Badge color="dim">ARCHIVED</Badge>
              : <Badge color="red">⚑ PENDING</Badge>
          }
          {m.correction_id && (
            <Badge color="dim">correction #{m.correction_id}</Badge>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#3a3a70', flexShrink: 0, marginLeft: 8 }}>
          {new Date(m.reported_at).toLocaleString()}
        </div>
      </div>

      <FieldRow label="QUESTION"   value={m.question}   color="#8080c0" />
      <FieldRow label="BOT ANSWER" value={m.bot_answer} color="#505080" dim />
      <FieldRow label="EXPECTED"   value={m.correction} color="#50a050" />

      {!m.archived && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="success" small onClick={() => onFix(m.id)} disabled={fixing === m.id}>
            {fixing === m.id ? <Spinner /> : '⚡ Apply Fix'}
          </Btn>
          <Btn variant="ghost" small onClick={() => onArchive(m.id)}>ARCHIVE</Btn>
        </div>
      )}

      {m.fixed && m.fixed_at && (
        <div style={{ fontSize: 10, color: '#3a6a3a', marginTop: 8 }}>
          Fixed at {new Date(m.fixed_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, color, dim }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#3a3a70', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 12, color, lineHeight: 1.6,
        background: dim ? '#07071a' : 'transparent',
        borderRadius: dim ? 6 : 0, padding: dim ? '6px 10px' : 0,
        maxHeight: 80, overflowY: 'auto'
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Edit correction modal ────────────────────────────────────────────────────
function EditCorrectionModal({ correction, onSave, onClose }) {
  const [pattern, setPattern] = useState(correction.question_pattern);
  const [answer,  setAnswer]  = useState(correction.correct_answer);
  const [saving,  setSaving]  = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(correction.id, { question_pattern: pattern, correct_answer: answer });
    setSaving(false);
  };

  return (
    <Modal title="Edit Correction" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Question Pattern</Label>
        <Input value={pattern} onChange={e => setPattern(e.target.value)} />
        <div style={{ fontSize: 11, color: '#3a3a70', marginTop: 4 }}>
          The normalised question used for deduplication matching.
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <Label>Correct Answer</Label>
        <Textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
        <Btn onClick={save} disabled={saving || !pattern || !answer}>
          {saving ? <Spinner /> : 'SAVE'}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── Main MistakesTab ─────────────────────────────────────────────────────────
export default function MistakesTab() {
  const [panel,       setPanel]       = useState('reports');   // 'reports' | 'corrections'
  const [filter,      setFilter]      = useState('pending');   // 'pending' | 'archived'
  const [mistakes,    setMistakes]    = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fixing,      setFixing]      = useState(null);
  const [editCorr,    setEditCorr]    = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, color = '#40b060') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMistakes = useCallback(async (archived) => {
    setLoading(true);
    try { setMistakes(await getMistakes(archived)); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadCorrections = useCallback(async () => {
    setLoading(true);
    try { setCorrections(await getCorrections(false)); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (panel === 'reports')     loadMistakes(filter === 'archived');
    if (panel === 'corrections') loadCorrections();
  }, [panel, filter, loadMistakes, loadCorrections]);

  const handleFix = async (id) => {
    setFixing(id);
    try {
      const result = await fixMistake(id);
      showToast(`✓ Fix applied → Correction #${result.correction_id} (deduplicated).`);
      loadMistakes(filter === 'archived');
      // Refresh corrections count in background
      if (panel === 'corrections') loadCorrections();
    } catch { showToast('Failed to apply fix.', '#e04040'); }
    setFixing(null);
  };

  const handleArchive = async (id) => {
    try {
      await archiveMistake(id);
      setMistakes(prev => prev.filter(m => m.id !== id));
      showToast('Archived.');
    } catch { showToast('Failed to archive.', '#e04040'); }
  };

  const handleDeleteCorrection = async (id) => {
    if (!window.confirm('Delete this correction? The bot will no longer use it.')) return;
    try {
      await deleteCorrection(id);
      setCorrections(prev => prev.filter(c => c.id !== id));
      showToast('Correction deleted.');
    } catch { showToast('Failed to delete.', '#e04040'); }
  };

  const handleSaveCorrection = async (id, data) => {
    try {
      const updated = await updateCorrection(id, data);
      setCorrections(prev => prev.map(c => c.id === id ? updated : c));
      setEditCorr(null);
      showToast('Correction updated.');
    } catch { showToast('Failed to update.', '#e04040'); }
  };

  const tabBtn = (id, label, count) => (
    <button
      onClick={() => setPanel(id)}
      style={{
        background: panel === id ? '#0f0f30' : 'none',
        border: `1px solid ${panel === id ? '#2e2e80' : 'transparent'}`,
        borderRadius: 6, padding: '6px 16px',
        color: panel === id ? '#9090ff' : '#4a4a90',
        cursor: 'pointer', fontSize: 12, letterSpacing: '0.08em',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: panel === id ? '#2a2a7a' : '#1a1a3a',
          color: panel === id ? '#9090ff' : '#4a4a90',
          borderRadius: 10, padding: '1px 7px', fontSize: 10
        }}>{count}</span>
      )}
    </button>
  );

  const activeCount   = corrections.filter(c => !c.compacted).length;
  const pendingCount  = mistakes.filter(m => !m.archived).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, position: 'relative' }}>

      {/* Panel switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
        {tabBtn('reports',     '⚑ Reports',     panel === 'reports'     ? pendingCount : 0)}
        {tabBtn('corrections', '✦ Corrections', panel === 'corrections' ? activeCount  : 0)}

        {panel === 'reports' && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            {['pending', 'archived'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? '#131328' : 'none',
                border: `1px solid ${filter === f ? '#252550' : 'transparent'}`,
                borderRadius: 4, padding: '4px 12px',
                color: filter === f ? '#7070c0' : '#3a3a70',
                cursor: 'pointer', fontSize: 11, letterSpacing: '0.1em'
              }}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner /></div>
      ) : (
        <>
          {/* ── Reports panel ── */}
          {panel === 'reports' && (
            mistakes.length === 0
              ? <Empty text={filter === 'pending' ? '✓ No pending reports — bot is doing great!' : 'No archived reports.'} />
              : mistakes.map(m => (
                  <MistakeCard key={m.id} m={m}
                    onFix={handleFix} onArchive={handleArchive} fixing={fixing} />
                ))
          )}

          {/* ── Corrections panel ── */}
          {panel === 'corrections' && (
            <div>
              <div style={{
                background: '#08081e', border: '1px solid #1a1a38',
                borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                fontSize: 11, color: '#3a3a70', lineHeight: 1.7
              }}>
                <span style={{ color: '#5050a0', fontWeight: 600 }}>How this works: </span>
                When you fix a mistake, the correction is stored here as a deduplicated rule.
                Similar questions are merged (hit count increases) rather than stacking.
                These rules are injected into every conversation (capped at 20 by recency + frequency).
                Use <strong style={{ color: '#5050a0' }}>Compact</strong> in the Config tab to fold them
                into the main guidelines and reset this list.
              </div>

              {corrections.length === 0
                ? <Empty text="No active corrections. Fix some mistakes and they will appear here." />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {corrections.map(c => (
                      <CorrectionCard key={c.id} c={c}
                        onEdit={setEditCorr} onDelete={handleDeleteCorrection} />
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </>
      )}

      {/* Edit correction modal */}
      {editCorr && (
        <EditCorrectionModal
          correction={editCorr}
          onSave={handleSaveCorrection}
          onClose={() => setEditCorr(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0c0c20', border: `1px solid ${toast.color}`,
          borderRadius: 8, padding: '8px 20px', color: toast.color,
          fontSize: 12, zIndex: 100, whiteSpace: 'nowrap'
        }} className="fadeIn">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', color: '#3a3a70', paddingTop: 60, fontSize: 13 }}>
      {text}
    </div>
  );
}
