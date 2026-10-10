import React from 'react';
import { UserCheck, Volume2 } from 'lucide-react';

export default function PanelMembers({ panel, currentSpeaker, isSpeaking }) {
  const members = panel ? Object.values(panel).filter(Boolean) : [];

  return (
    <div className="card panel-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={18} color="#60a5fa" /> AI Interview Panel
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{members.length} members</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {members.map((member, idx) => {
          const isActive = member.name === currentSpeaker;
          const voiceDetails = member.voiceName || member.voice || 'Natural Voice';

          return (
            <div
              key={member.name || idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: isActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: '#fff',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {member.name ? member.name[0] : 'AI'}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--success)',
                      border: '2px solid var(--bg-dark)',
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isActive ? '#93c5fd' : 'var(--text-primary)' }}>
                    {member.name}
                  </span>
                  {isActive && isSpeaking && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 600 }}>
                      <Volume2 size={13} className="pulse-icon" /> Speaking
                    </span>
                  )}
                </div>

                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {member.role} <small style={{ color: 'var(--text-muted)' }}>({member.seniority || 'Panel'})</small>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', color: 'var(--text-dim)' }}>
                    Voice: {voiceDetails}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
