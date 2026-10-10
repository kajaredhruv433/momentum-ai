import React from 'react';
import { Clock } from 'lucide-react';

export default function InterviewTimer({ elapsedSeconds, stage, timerStarted }) {
  const formatTime = (totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = String(Math.floor(s / 60)).padStart(2, '0');
    const secs = String(s % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const getStageBadgeStyle = (currentStage) => {
    const st = (currentStage || 'NORMAL').toUpperCase();
    if (st.includes('EXTENDED')) {
      return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' };
    }
    if (st.includes('FINAL')) {
      return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', color: '#f87171' };
    }
    return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399' };
  };

  const badge = getStageBadgeStyle(stage);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '9999px',
          background: badge.bg,
          border: `1px solid ${badge.border}`,
          color: badge.color,
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        <span>{stage || 'NORMAL'}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '6px 12px',
        }}
      >
        <Clock size={16} color={timerStarted ? '#60a5fa' : '#94a3b8'} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            fontWeight: 700,
            color: timerStarted ? '#fff' : '#94a3b8',
            letterSpacing: '0.05em',
          }}
        >
          {formatTime(elapsedSeconds)}
        </span>
      </div>
    </div>
  );
}
