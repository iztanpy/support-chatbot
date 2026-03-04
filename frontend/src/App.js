import React, { useState, useEffect, useCallback, useRef } from 'react';
import ChatTab      from './components/ChatTab';
import ConfigTab    from './components/ConfigTab';
import MistakesTab  from './components/MistakesTab';
import LogsTab      from './components/LogsTab';
import DocumentsTab from './components/DocumentsTab';
import VersionsTab  from './components/VersionsTab';
import { getMistakes, getStats, getVersions } from './api/client';

const NAV = [
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'config',    label: 'Config',    icon: '⚙️' },
  { id: 'mistakes',  label: 'Mistakes',  icon: '⚑'  },
  { id: 'logs',      label: 'Logs',      icon: '📋' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'versions',  label: 'Versions',  icon: '🔀' },
];

export default function App() {
  const [tab,             setTab]             = useState('chat');
  const [pendingMistakes, setPendingMistakes] = useState(0);
  const [stats,           setStats]           = useState(null);
  const [liveVersionName, setLiveVersionName] = useState('');
  const [logRefresh,      setLogRefresh]      = useState(0);
  const [versionRefresh,  setVersionRefresh]  = useState(0);
  const chatRef = useRef(null);

  const loadMeta = useCallback(async () => {
    try {
      const [mistakes, s, versions] = await Promise.all([
        getMistakes(false), getStats(), getVersions()
      ]);
      setPendingMistakes(mistakes.length);
      setStats(s);
      const live = versions.find(v => v.is_live);
      if (live) setLiveVersionName(live.name);
    } catch {}
  }, []);

  useEffect(() => {
    loadMeta();
    const interval = setInterval(loadMeta, 30000);
    return () => clearInterval(interval);
  }, [loadMeta]);

  const handleNewLog = () => {
    setLogRefresh(r => r + 1);
    loadMeta();
  };

  const handleVersionCreated = () => {
    setVersionRefresh(r => r + 1);
    setTab('versions');
  };

  // Called by VersionsTab after a successful promote
  const handleVersionPromoted = (newVersionName) => {
    setLiveVersionName(newVersionName);
    setVersionRefresh(r => r + 1);
    loadMeta();
    // Clear chat conversation — old context no longer matches new version
    chatRef.current?.clearConversation(newVersionName);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        padding: '0 24px', height: 56,
        borderBottom: '1px solid #1a1a38', background: '#04040e',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #3030c0 0%, #7050e0 100%)',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: '0 0 16px rgba(80,60,220,0.4)'
          }}>⬡</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: '0.08em', color: '#c0c0ff' }}>
              SUPPORT BOT
            </div>
            <div style={{ fontSize: 9, color: '#3a3a80', letterSpacing: '0.2em' }}>CUSTOMER SERVICE INTELLIGENCE</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 2, marginLeft: 20 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              background: tab === n.id ? '#0f0f30' : 'none',
              border: `1px solid ${tab === n.id ? '#2e2e80' : 'transparent'}`,
              borderRadius: 6, padding: '5px 14px',
              color: tab === n.id ? '#9090ff' : '#4a4a90',
              cursor: 'pointer', fontSize: 12, letterSpacing: '0.08em',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
            }}
              onMouseEnter={e => { if (tab !== n.id) e.currentTarget.style.color = '#7070c0'; }}
              onMouseLeave={e => { if (tab !== n.id) e.currentTarget.style.color = '#4a4a90'; }}
            >
              <span style={{ fontSize: 13 }}>{n.icon}</span>
              {n.label}
              {n.id === 'mistakes' && pendingMistakes > 0 && (
                <span style={{
                  background: '#6a1010', color: '#ff8080', borderRadius: 10,
                  padding: '0px 6px', fontSize: 10, fontWeight: 600, border: '1px solid #8a2020'
                }}>{pendingMistakes}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: '#4a4a90' }}>
          {liveVersionName && (
            <div style={{
              background: '#081808', border: '1px solid #1a3a1a', borderRadius: 6,
              padding: '3px 10px', fontSize: 10, color: '#40b060', letterSpacing: '0.06em'
            }}>
              ● {liveVersionName}
            </div>
          )}
          {stats && (
            <>
              <div><span style={{ color: '#40b060', fontWeight: 600 }}>{stats.total_interactions}</span> interactions</div>
              <div><span style={{ color: '#6060d0', fontWeight: 600 }}>{stats.correct_rate}%</span> accuracy</div>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, background: '#30b050', borderRadius: '50%' }} className="pulse" />
            <span style={{ color: '#3a3a70', fontSize: 10, letterSpacing: '0.1em' }}>LIVE</span>
          </div>
        </div>
      </header>

      {/* Content — ChatTab always mounted so ref stays alive */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <div style={{ display: tab === 'chat' ? 'flex' : 'none', flex: 1 }}>
          <ChatTab ref={chatRef} onNewLog={handleNewLog} />
        </div>
        {tab === 'config'    && <ConfigTab />}
        {tab === 'mistakes'  && <MistakesTab />}
        {tab === 'logs'      && <LogsTab refreshKey={logRefresh} />}
        {tab === 'documents' && <DocumentsTab onVersionCreated={handleVersionCreated} />}
        {tab === 'versions'  && <VersionsTab refreshKey={versionRefresh} onVersionPromoted={handleVersionPromoted} />}
      </main>
    </div>
  );
}
