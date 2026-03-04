import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { sendMessage, reportMistake } from '../api/client';
import { Btn, Spinner, Modal, Textarea, Label } from './UI';
import { v4 as uuidv4 } from 'uuid';

const INITIAL_MESSAGES = () => [
  { role: 'assistant', content: "Hello! I'm your support assistant. How can I help you today?", id: 'init' }
];

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '10px 14px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#4040a0',
          animation: `pulse 1.4s ${i * 0.2}s ease-in-out infinite`
        }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg, onReport }) {
  const isUser = msg.role === 'user';
  return (
    <div className="fadeIn" style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 3, marginBottom: 4
    }}>
      <div style={{ fontSize: 10, color: '#3a3a80', letterSpacing: '0.12em' }}>
        {isUser ? 'YOU' : '⬡ CUSTOMER SUPPORT BOT'}
      </div>
      <div style={{
        maxWidth: '76%', padding: '10px 14px',
        borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        background: isUser ? '#141448' : '#0f0f28',
        border: `1px solid ${isUser ? '#2a2a80' : '#1e1e40'}`,
        color: isUser ? '#c0c0ff' : '#d0d0f0',
        lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: 13
      }}>
        {msg.content}
      </div>
      {!isUser && msg.id && msg.id !== 'init' && (
        <button
          onClick={() => onReport(msg)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 10, color: '#383880', padding: '2px 2px', letterSpacing: '0.05em'
          }}
          onMouseEnter={e => e.target.style.color = '#e04040'}
          onMouseLeave={e => e.target.style.color = '#383880'}
        >
          ⚑ report incorrect answer
        </button>
      )}
    </div>
  );
}

// Exposed via ref so App.js can call clearConversation() on promote
const ChatTab = forwardRef(function ChatTab({ onNewLog }, ref) {
  const [messages,       setMessages]       = useState(INITIAL_MESSAGES());
  const [sessionId,      setSessionId]      = useState(uuidv4());
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [reportTarget,   setReportTarget]   = useState(null);
  const [reportText,     setReportText]     = useState('');
  const [reportSending,  setReportSending]  = useState(false);
  const [toast,          setToast]          = useState(null);
  const [versionBanner,  setVersionBanner]  = useState(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const msgIdRef   = useRef(0);

  // Expose clearConversation to parent
  useImperativeHandle(ref, () => ({
    clearConversation(newVersionName) {
      setMessages(INITIAL_MESSAGES());
      setSessionId(uuidv4());
      msgIdRef.current = 0;
      setVersionBanner(newVersionName || null);
      setTimeout(() => setVersionBanner(null), 5000);
    }
  }));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const showToast = (msg, color = '#40b060') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: text, id: ++msgIdRef.current };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const data = await sendMessage(sessionId, apiMessages);
      const botMsg = { role: 'assistant', content: data.reply, id: ++msgIdRef.current };
      setMessages(prev => [...prev, botMsg]);
      if (onNewLog) onNewLog();
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting to the server. Please try again.",
        id: ++msgIdRef.current
      }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const submitReport = async () => {
    if (!reportText.trim() || !reportTarget) return;
    setReportSending(true);
    try {
      const botIdx = messages.findIndex(m => m.id === reportTarget.id);
      const userMsg = messages.slice(0, botIdx).reverse().find(m => m.role === 'user');
      await reportMistake({
        question: userMsg?.content || '(unknown)',
        bot_answer: reportTarget.content,
        correction: reportText.trim()
      });
      showToast('✓ Report submitted. Thank you for the feedback!');
      setReportTarget(null);
      setReportText('');
    } catch {
      showToast('Failed to submit report.', '#e04040');
    }
    setReportSending(false);
  };

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Version switch banner */}
      {versionBanner && (
        <div className="fadeIn" style={{
          background: '#081808', borderBottom: '1px solid #1a4a1a',
          padding: '8px 20px', fontSize: 11, color: '#40b060', textAlign: 'center',
          letterSpacing: '0.06em'
        }}>
          ✓ Switched to <strong>{versionBanner}</strong> — conversation cleared
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onReport={setReportTarget} />
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 10, color: '#3a3a80' }}>⬡ CUSTOMER SUPPORT BOT</div>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '14px 20px', borderTop: '1px solid #1e1e40',
        background: '#07071a', display: 'flex', gap: 10, alignItems: 'flex-end'
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything…  (Enter to send, Shift+Enter for new line)"
          rows={1}
          style={{
            flex: 1, background: '#0c0c20', border: '1px solid #1e1e40',
            borderRadius: 8, padding: '10px 14px', color: '#ddddf5',
            resize: 'none', outline: 'none', lineHeight: 1.5,
            maxHeight: 120, overflowY: 'auto', transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = '#4040c0'}
          onBlur={e => e.target.style.borderColor = '#1e1e40'}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />
        <Btn onClick={send} disabled={loading || !input.trim()} style={{ height: 42, minWidth: 80 }}>
          {loading ? <Spinner /> : 'SEND'}
        </Btn>
      </div>

      {/* Report Modal */}
      {reportTarget && (
        <Modal title="⚑ Report Incorrect Answer" onClose={() => { setReportTarget(null); setReportText(''); }}>
          <div style={{ marginBottom: 14 }}>
            <Label>BOT'S RESPONSE</Label>
            <div style={{
              background: '#080818', border: '1px solid #1e1e3a', borderRadius: 6,
              padding: '8px 12px', fontSize: 12, color: '#6060a0',
              maxHeight: 100, overflowY: 'auto', lineHeight: 1.6
            }}>
              {reportTarget.content}
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <Label>CORRECT RESPONSE / EXPECTED BEHAVIOR</Label>
            <Textarea
              value={reportText}
              onChange={e => setReportText(e.target.value)}
              placeholder="Describe what the correct answer should be…"
              rows={4}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => { setReportTarget(null); setReportText(''); }}>CANCEL</Btn>
            <Btn variant="danger" onClick={submitReport} disabled={reportSending || !reportText.trim()}>
              {reportSending ? <Spinner /> : 'SUBMIT REPORT'}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#0c0c20', border: `1px solid ${toast.color}`,
          borderRadius: 8, padding: '8px 18px', color: toast.color,
          fontSize: 12, letterSpacing: '0.05em', zIndex: 50
        }} className="fadeIn">
          {toast.msg}
        </div>
      )}
    </div>
  );
});

export default ChatTab;
