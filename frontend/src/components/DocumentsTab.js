import React, { useState, useRef, useCallback } from 'react';
import { parseDocument, applyDocument } from '../api/client';
import { Btn, Spinner, Card, SectionTitle, Label, Input, Modal } from './UI';

// ── Diff viewer ───────────────────────────────────────────────────────────────
function DiffField({ label, before, after }) {
  if (!after) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, color: '#4040a0', letterSpacing: '0.12em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#3a3a70', marginBottom: 4 }}>CURRENT</div>
          <div style={{
            background: '#120808', border: '1px solid #3a1a1a', borderRadius: 6,
            padding: '8px 10px', fontSize: 11, color: '#705050',
            maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6
          }}>
            {before || <span style={{ color: '#3a2020' }}>(empty)</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#2a5a2a', marginBottom: 4 }}>PROPOSED</div>
          <div style={{
            background: '#081208', border: '1px solid #1a3a1a', borderRadius: 6,
            padding: '8px 10px', fontSize: 11, color: '#50a050',
            maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6
          }}>
            {after}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddedList({ label, items, renderItem }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, color: '#4040a0', letterSpacing: '0.12em', marginBottom: 8 }}>
        {label} <span style={{
          background: '#0a2a0a', color: '#40b060', border: '1px solid #1a4a1a',
          borderRadius: 10, padding: '1px 8px', fontSize: 10, marginLeft: 6
        }}>+{items.length} new</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            background: '#081208', border: '1px solid #1a3a1a',
            borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#50a050'
          }}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handle = (file) => {
    if (!file || disabled) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)) {
      alert(`Unsupported file type: .${ext}\nSupported: PDF, DOCX, TXT, MD`);
      return;
    }
    onFile(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? '#6060d0' : '#1e1e40'}`,
        borderRadius: 12, padding: '40px 24px',
        textAlign: 'center', cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging ? '#0a0a28' : '#07071a',
        transition: 'all 0.15s', opacity: disabled ? 0.5 : 1
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
      <div style={{ fontSize: 13, color: '#6060a0', marginBottom: 6 }}>
        Drop a document here, or click to browse
      </div>
      <div style={{ fontSize: 11, color: '#3a3a70' }}>
        PDF · DOCX · TXT · MD
      </div>
      <input
        ref={inputRef} type="file"
        accept=".pdf,.docx,.doc,.txt,.md"
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])}
      />
    </div>
  );
}

// ── Main DocumentsTab ─────────────────────────────────────────────────────────
export default function DocumentsTab({ onVersionCreated }) {
  const [parsing,      setParsing]      = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [parseResult,  setParseResult]  = useState(null);
  const [currentFile,  setCurrentFile]  = useState(null);
  const [versionName,  setVersionName]  = useState('');
  const [toast,        setToast]        = useState(null);
  const [error,        setError]        = useState(null);

  const showToast = (msg, color = '#40b060') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFile = useCallback(async (file) => {
    setCurrentFile(file);
    setParseResult(null);
    setError(null);
    setParsing(true);
    setVersionName(`Upload: ${file.name} · ${new Date().toLocaleDateString()}`);
    try {
      const result = await parseDocument(file);
      setParseResult(result);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to parse document. Please try another file.');
    }
    setParsing(false);
  }, []);

  const handleApply = async () => {
    if (!parseResult || !versionName.trim()) return;
    setApplying(true);
    try {
      const result = await applyDocument({
        version_name: versionName.trim(),
        extracted: parseResult.extracted,
        source_document: currentFile?.name || '',
      });
      showToast(`✓ Draft "${versionName}" created. Go to Versions tab to review and promote.`);
      setParseResult(null);
      setCurrentFile(null);
      setVersionName('');
      if (onVersionCreated) onVersionCreated();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to create version.', '#e04040');
    }
    setApplying(false);
  };

  const reset = () => {
    setParseResult(null);
    setCurrentFile(null);
    setVersionName('');
    setError(null);
  };

  const diff = parseResult?.diff || {};
  const hasChanges = parseResult?.has_changes;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, position: 'relative' }}>

      {/* Upload zone — hide once parsed */}
      {!parseResult && !parsing && (
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle>Upload Document</SectionTitle>
          <div style={{ fontSize: 11, color: '#3a3a70', marginBottom: 16, lineHeight: 1.7 }}>
            Upload a product manual, FAQ, policy doc, or any structured document.
            The AI will extract guidelines, workflows, corrections, and knowledge base URLs,
            then show you a diff before anything is saved.
          </div>
          <DropZone onFile={handleFile} disabled={parsing} />
        </Card>
      )}

      {/* Parsing spinner */}
      {parsing && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Spinner />
          <div style={{ fontSize: 12, color: '#5050a0', marginTop: 14 }}>
            Parsing <strong style={{ color: '#7070c0' }}>{currentFile?.name}</strong>…
          </div>
          <div style={{ fontSize: 11, color: '#3a3a70', marginTop: 6 }}>
            Extracting config from document
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card style={{ border: '1px solid #3a1a1a', marginBottom: 16 }}>
          <div style={{ color: '#e06060', fontSize: 12, marginBottom: 10 }}>⚠ {error}</div>
          <Btn variant="ghost" small onClick={reset}>Try another file</Btn>
        </Card>
      )}

      {/* Parse result */}
      {parseResult && !parsing && (
        <>
          {/* File info bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            background: '#09091e', border: '1px solid #1e1e3a', borderRadius: 8,
            padding: '10px 14px'
          }}>
            <span style={{ fontSize: 16 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#8080c0', fontWeight: 500 }}>{currentFile?.name}</div>
              {parseResult.confidence_notes && (
                <div style={{ fontSize: 11, color: '#4040a0', marginTop: 2 }}>
                  ℹ {parseResult.confidence_notes}
                </div>
              )}
            </div>
            <Btn variant="ghost" small onClick={reset}>✕ Clear</Btn>
          </div>

          {/* No changes detected */}
          {!hasChanges && (
            <Card style={{ textAlign: 'center', padding: 32, marginBottom: 16 }}>
              <div style={{ fontSize: 20, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 13, color: '#5050a0', marginBottom: 6 }}>
                No extractable config changes found in this document.
              </div>
              <div style={{ fontSize: 11, color: '#3a3a70' }}>
                The document may not contain structured bot configuration data.
              </div>
            </Card>
          )}

          {/* Diff preview */}
          {hasChanges && (
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>Proposed Changes</SectionTitle>

              <DiffField
                label="KNOWLEDGE BASE URL"
                before={diff.knowledge_base_url?.before}
                after={diff.knowledge_base_url?.after}
              />
              <DiffField
                label="GUIDELINES"
                before={diff.guidelines?.before}
                after={diff.guidelines?.after}
              />
              <AddedList
                label="WORKFLOWS"
                items={diff.workflows_to_add}
                renderItem={wf => (
                  <div>
                    <span style={{ color: '#8080d0', fontWeight: 600 }}>{wf.trigger}</span>
                    <span style={{ color: '#3a3a70' }}> → </span>
                    <span style={{ color: '#404080', fontFamily: 'monospace' }}>{wf.endpoint_url}</span>
                    {wf.description && <div style={{ color: '#3a5a3a', marginTop: 3 }}>{wf.description}</div>}
                  </div>
                )}
              />
              <AddedList
                label="CORRECTIONS"
                items={diff.corrections_to_add}
                renderItem={c => (
                  <div>
                    <div style={{ color: '#7070b0', marginBottom: 3 }}>Q: {c.question_pattern}</div>
                    <div style={{ color: '#50a050' }}>A: {c.correct_answer}</div>
                  </div>
                )}
              />
            </Card>
          )}

          {/* Version name + apply */}
          {hasChanges && (
            <Card>
              <SectionTitle>Save as Draft Version</SectionTitle>
              <div style={{ fontSize: 11, color: '#3a3a70', marginBottom: 12, lineHeight: 1.6 }}>
                This will create a new <strong style={{ color: '#5050a0' }}>draft</strong> version —
                nothing goes live until you promote it in the Versions tab.
              </div>
              <Label>Version name</Label>
              <Input
                value={versionName}
                onChange={e => setVersionName(e.target.value)}
                placeholder="e.g. v2 - Product Update March 2026"
                style={{ marginBottom: 14 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={handleApply} disabled={applying || !versionName.trim()}>
                  {applying ? <><Spinner /> &nbsp;Creating…</> : '✓ Create Draft Version'}
                </Btn>
                <Btn variant="ghost" onClick={reset}>Cancel</Btn>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0c0c20', border: `1px solid ${toast.color}`,
          borderRadius: 8, padding: '10px 22px', color: toast.color,
          fontSize: 12, zIndex: 100, maxWidth: '80vw', textAlign: 'center'
        }} className="fadeIn">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
