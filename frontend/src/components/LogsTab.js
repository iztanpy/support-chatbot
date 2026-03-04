import React, { useState, useEffect } from 'react';
import { getLogs, getStats } from '../api/client';
import { Badge, Spinner, Card, SectionTitle } from './UI';

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#0a0a1e', border: '1px solid #1e1e3a', borderRadius: 10,
      padding: '16px 20px', flex: 1, minWidth: 120
    }}>
      <div style={{ fontSize: 10, color: '#3a3a70', letterSpacing: '0.15em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: color || '#6060d0' }}>
        {value}
      </div>
    </div>
  );
}

export default function LogsTab({ refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([getLogs(100), getStats()]);
      setLogs(l);
      setStats(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="TOTAL INTERACTIONS" value={stats.total_interactions} />
          <StatCard label="CORRECT RATE" value={`${stats.correct_rate}%`} color="#40b060" />
          <StatCard label="PENDING MISTAKES" value={stats.pending_mistakes} color={stats.pending_mistakes > 0 ? '#e06060' : '#40b060'} />
          <StatCard label="AUTO-FIXED" value={stats.fixed_mistakes} color="#9090ff" />
        </div>
      )}

      {/* Log List */}
      <div style={{ fontSize: 10, color: '#3a3a70', letterSpacing: '0.15em', marginBottom: 12 }}>
        INTERACTION LOG — {logs.length} ENTRIES
      </div>

      {logs.length === 0 && (
        <div style={{ textAlign: 'center', color: '#3a3a70', paddingTop: 40, fontSize: 13 }}>
          No interactions logged yet. Start chatting!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logs.map(log => (
          <div
            key={log.id}
            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
            style={{
              background: '#0a0a1e', border: '1px solid #1a1a38', borderRadius: 8,
              padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a60'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a38'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, color: '#7070b0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#3a3a70', marginRight: 8 }}>#{log.id}</span>
                {log.question}
              </div>
              <div style={{ fontSize: 10, color: '#3a3a60', flexShrink: 0 }}>
                {new Date(log.timestamp).toLocaleString()}
              </div>
              <div style={{ color: '#3a3a70', fontSize: 11, flexShrink: 0 }}>
                {expanded === log.id ? '▲' : '▼'}
              </div>
            </div>

            {expanded === log.id && (
              <div className="fadeIn" style={{ marginTop: 12, borderTop: '1px solid #1a1a38', paddingTop: 12 }}>
                <div style={{ fontSize: 10, color: '#3a3a70', marginBottom: 4, letterSpacing: '0.1em' }}>QUESTION</div>
                <div style={{ fontSize: 12, color: '#7070c0', marginBottom: 10, lineHeight: 1.6 }}>{log.question}</div>
                <div style={{ fontSize: 10, color: '#3a3a70', marginBottom: 4, letterSpacing: '0.1em' }}>ANSWER</div>
                <div style={{ fontSize: 12, color: '#505090', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{log.answer}</div>
                {log.session_id && (
                  <div style={{ fontSize: 10, color: '#2a2a60', marginTop: 8 }}>Session: {log.session_id}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
