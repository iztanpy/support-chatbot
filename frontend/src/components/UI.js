import React from 'react';

export function Badge({ children, color = 'accent' }) {
  const colors = {
    accent: { bg: '#1a1a4a', text: '#8080ff', border: '#2a2a6a' },
    green:  { bg: '#0a2a1a', text: '#40b060', border: '#1a4a2a' },
    red:    { bg: '#2a0a0a', text: '#e06060', border: '#4a1a1a' },
    amber:  { bg: '#2a1a00', text: '#d09030', border: '#4a3000' },
    dim:    { bg: '#111128', text: '#5050a0', border: '#1e1e3a' },
  };
  const c = colors[color] || colors.accent;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontSize: 11, letterSpacing: '0.08em', fontWeight: 500
    }}>
      {children}
    </span>
  );
}

export function Btn({ children, onClick, variant = 'primary', disabled, small, style = {} }) {
  const styles = {
    primary:   { bg: '#1a1a5a', text: '#9090ff', border: '#3030a0', hover: '#2020a0' },
    success:   { bg: '#0a2a0a', text: '#40b060', border: '#1a5a2a', hover: '#1a4a1a' },
    danger:    { bg: '#2a0a0a', text: '#e06060', border: '#5a1a1a', hover: '#3a1010' },
    ghost:     { bg: 'transparent', text: '#5050a0', border: '#1e1e3a', hover: '#0c0c1a' },
  };
  const s = styles[variant] || styles.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: s.bg, color: s.text, border: `1px solid ${s.border}`,
        borderRadius: 6, padding: small ? '5px 12px' : '8px 18px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        letterSpacing: '0.06em',
        fontWeight: 500,
        ...style
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = s.hover; }}
      onMouseLeave={e => { e.currentTarget.style.background = s.bg; }}
    >
      {children}
    </button>
  );
}

export function Input({ value, onChange, placeholder, style = {} }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        background: '#08081a', border: '1px solid #1e1e3a', borderRadius: 6,
        padding: '8px 12px', color: '#ddddf5', width: '100%',
        outline: 'none', transition: 'border-color 0.15s',
        ...style
      }}
      onFocus={e => e.target.style.borderColor = '#4040c0'}
      onBlur={e => e.target.style.borderColor = '#1e1e3a'}
    />
  );
}

export function Textarea({ value, onChange, placeholder, rows = 5, style = {} }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      style={{
        background: '#08081a', border: '1px solid #1e1e3a', borderRadius: 6,
        padding: '10px 12px', color: '#ddddf5', width: '100%',
        outline: 'none', resize: 'vertical', transition: 'border-color 0.15s',
        lineHeight: 1.7,
        ...style
      }}
      onFocus={e => e.target.style.borderColor = '#4040c0'}
      onBlur={e => e.target.style.borderColor = '#1e1e3a'}
    />
  );
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#0c0c1a', border: '1px solid #1e1e3a',
      borderRadius: 10, padding: '18px 20px', ...style
    }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '0.2em', color: '#4444a0',
      fontWeight: 600, marginBottom: 14, textTransform: 'uppercase'
    }}>
      {children}
    </div>
  );
}

export function Label({ children }) {
  return (
    <div style={{ fontSize: 11, color: '#5555a0', letterSpacing: '0.1em', marginBottom: 6 }}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{
      width: 14, height: 14,
      border: '2px solid #1e1e3a',
      borderTopColor: '#6060d0',
      borderRadius: '50%',
      display: 'inline-block'
    }} className="spin" />
  );
}

export function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 38, height: 21, borderRadius: 11, cursor: 'pointer',
        background: checked ? '#2020c0' : '#1a1a3a',
        position: 'relative', transition: 'background 0.2s',
        border: `1px solid ${checked ? '#4040e0' : '#2a2a5a'}`
      }}
    >
      <div style={{
        width: 15, height: 15, borderRadius: '50%',
        background: checked ? '#8080ff' : '#404080',
        position: 'absolute', top: 2,
        left: checked ? 18 : 3,
        transition: 'left 0.2s, background 0.2s'
      }} />
    </div>
  );
}

export function Modal({ title, children, onClose, width = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fadeIn" style={{
        background: '#0e0e22', border: '1px solid #3030a0',
        borderRadius: 12, padding: 24, width, maxWidth: '92vw',
        boxShadow: '0 0 40px rgba(60,60,200,0.2)'
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 15, marginBottom: 18, color: '#c0c0ff'
        }}>
          {title}
        </div>
        {children}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
      </div>
    </div>
  );
}
