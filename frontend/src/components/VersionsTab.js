import React, { useState, useEffect, useCallback } from 'react';
import { getVersions, createVersion, promoteVersion, deleteVersion } from '../api/client';
import { Btn, Spinner, Label, Input, Modal } from './UI';

function VersionCard({ v, versions, onPromote, onDelete, promoting, deleting }) {
  return (
    <div className="fadeIn" style={{
      background: v.is_live ? '#08180a' : '#09091e',
      border: `1px solid ${v.is_live ? '#1a4a1a' : '#1e1e3a'}`,
      borderRadius: 10, padding: '14px 18px',
      display: 'flex', alignItems: 'flex-start', gap: 14,
      transition: 'all 0.2s'
    }}>
      {/* Status indicator */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
        background: v.is_live ? '#40c060' : '#2a2a5a',
        boxShadow: v.is_live ? '0 0 8px rgba(60,200,80,0.5)' : 'none'
      }} className={v.is_live ? 'pulse' : ''} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            color: v.is_live ? '#80e090' : '#8080c0'
          }}>
            {v.name}
          </span>
          {v.is_live && (
            <span style={{
              fontSize: 10, padding: '1px 8px', borderRadius: 10, fontWeight: 600,
              background: '#0a3a0a', color: '#40c060', border: '1px solid #1a5a1a',
              letterSpacing: '0.1em'
            }}>LIVE</span>
          )}
          {!v.is_live && (
            <span style={{
              fontSize: 10, padding: '1px 8px', borderRadius: 10,
              background: '#0e0e28', color: '#4040a0', border: '1px solid #1e1e40',
              letterSpacing: '0.1em'
            }}>DRAFT</span>
          )}
        </div>

        {/* Meta */}
        <div style={{ fontSize: 11, color: '#3a3a70', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>Created {new Date(v.created_at).toLocaleString()}</span>
          {v.source_document && (
            <span style={{ color: '#404080' }}>📄 {v.source_document}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        {!v.is_live && (
          <>
            <Btn
              variant="success" small
              onClick={() => onPromote(v.id)}
              disabled={promoting === v.id}
            >
              {promoting === v.id ? <Spinner /> : '▲ Promote to Live'}
            </Btn>
            <Btn
              variant="danger" small
              onClick={() => onDelete(v.id)}
              disabled={deleting === v.id}
            >
              {deleting === v.id ? <Spinner /> : 'DEL'}
            </Btn>
          </>
        )}
        {v.is_live && (
          <span style={{ fontSize: 11, color: '#2a5a2a' }}>Active</span>
        )}
      </div>
    </div>
  );
}

function NewVersionModal({ versions, onSave, onClose }) {
  const [name,     setName]     = useState('');
  const [sourceId, setSourceId] = useState('');
  const [saving,   setSaving]   = useState(false);

  const liveVersion = versions.find(v => v.is_live);
  const defaultSource = liveVersion?.id || versions[0]?.id || '';

  useEffect(() => {
    if (!sourceId && defaultSource) setSourceId(String(defaultSource));
  }, [versions]);

  const save = async () => {
    if (!name.trim() || !sourceId) return;
    setSaving(true);
    await onSave({ name: name.trim(), clone_from_version_id: parseInt(sourceId) });
    setSaving(false);
  };

  return (
    <Modal title="Create New Agent Version" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Version name</Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. v2 - Campaign Bot, v3 - New Product Launch"
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <Label>Clone from</Label>
        <select
          value={sourceId}
          onChange={e => setSourceId(e.target.value)}
          style={{
            width: '100%', background: '#08081a', border: '1px solid #1e1e3a',
            borderRadius: 6, padding: '8px 12px', color: '#ddddf5', outline: 'none'
          }}
        >
          {versions.map(v => (
            <option key={v.id} value={v.id}>
              {v.name}{v.is_live ? ' (live)' : ' (draft)'}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: '#3a3a70', marginTop: 6 }}>
          All config, workflows, and corrections will be copied from the selected version.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
        <Btn onClick={save} disabled={saving || !name.trim() || !sourceId}>
          {saving ? <Spinner /> : 'CREATE DRAFT'}
        </Btn>
      </div>
    </Modal>
  );
}

export default function VersionsTab({ refreshKey, onVersionPromoted }) {
  const [versions,  setVersions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [promoting, setPromoting] = useState(null);
  const [deleting,  setDeleting]  = useState(null);
  const [showNew,   setShowNew]   = useState(false);
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, color = '#40b060') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setVersions(await getVersions()); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handlePromote = async (id) => {
    const v = versions.find(v => v.id === id);
    if (!window.confirm(`Promote "${v?.name}" to live?\n\nThe current live version will become a draft.`)) return;
    setPromoting(id);
    try {
      await promoteVersion(id);
      await load();
      showToast(`✓ "${v?.name}" is now live.`);
      if (onVersionPromoted) onVersionPromoted(v?.name);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to promote.', '#e04040');
    }
    setPromoting(null);
  };

  const handleDelete = async (id) => {
    const v = versions.find(v => v.id === id);
    if (!window.confirm(`Delete "${v?.name}"?\n\nThis cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteVersion(id);
      setVersions(prev => prev.filter(v => v.id !== id));
      showToast('Version deleted.');
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to delete.', '#e04040');
    }
    setDeleting(null);
  };

  const handleCreate = async (body) => {
    try {
      const created = await createVersion(body);
      setVersions(prev => [created, ...prev]);
      setShowNew(false);
      showToast(`✓ Draft "${created.name}" created.`);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to create version.', '#e04040');
    }
  };

  const liveVersion = versions.find(v => v.is_live);
  const drafts      = versions.filter(v => !v.is_live);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, position: 'relative' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: '#c0c0ff', marginBottom: 4 }}>
            Agent Versions
          </div>
          <div style={{ fontSize: 11, color: '#3a3a70' }}>
            {versions.length} version{versions.length !== 1 ? 's' : ''} · {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <Btn onClick={() => setShowNew(true)} disabled={versions.length === 0}>
          + New Version
        </Btn>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner /></div>
      ) : (
        <>
          {/* Live version */}
          {liveVersion && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#2a5a2a', letterSpacing: '0.15em', marginBottom: 8 }}>
                LIVE VERSION
              </div>
              <VersionCard
                v={liveVersion} versions={versions}
                onPromote={handlePromote} onDelete={handleDelete}
                promoting={promoting} deleting={deleting}
              />
            </div>
          )}

          {/* Drafts */}
          {drafts.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#3a3a70', letterSpacing: '0.15em', marginBottom: 8 }}>
                DRAFTS — {drafts.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {drafts.map(v => (
                  <VersionCard
                    key={v.id} v={v} versions={versions}
                    onPromote={handlePromote} onDelete={handleDelete}
                    promoting={promoting} deleting={deleting}
                  />
                ))}
              </div>
            </div>
          )}

          {drafts.length === 0 && liveVersion && (
            <div style={{ textAlign: 'center', color: '#2a2a60', paddingTop: 30, fontSize: 12 }}>
              No drafts. Create a new version or upload a document to get started.
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewVersionModal
          versions={versions}
          onSave={handleCreate}
          onClose={() => setShowNew(false)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0c0c20', border: `1px solid ${toast.color}`,
          borderRadius: 8, padding: '10px 22px', color: toast.color,
          fontSize: 12, zIndex: 100
        }} className="fadeIn">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
