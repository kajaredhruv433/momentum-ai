import React from 'react';
import { Mic, MicOff, Radio, CheckCircle2, AlertCircle, RotateCcw, Send, Zap, Clock } from 'lucide-react';

export default function VoiceControls({
  micStatus, // 'Connected' | 'Microphone unavailable' | 'Prompting...'
  isRecording,
  onToggleRecord,
  isInterviewerSpeaking,
  micVolume = 0,
  isMuted = false,
  onToggleMute,
  wasInterrupted = false,
  liveTranscript = '',
  onClearTranscript,
  pauseCountdown = null,
  onSubmitAnswer,
  disabled,
}) {
  const isMicConnected = micStatus === 'Connected';
  const hasSpokenText = Boolean(liveTranscript && liveTranscript.trim());
  const isPausing = Boolean(pauseCountdown?.isPaused && hasSpokenText);

  // Dynamic bar height calculation based on candidate's real-time mic volume (0-100)
  const getBarHeight = (multiplier) => {
    if (isMuted) return '6px';
    if (!isRecording && micVolume < 5) return '6px';
    const dynamic = Math.max(6, Math.min(26, Math.round((micVolume / 100) * 26 * multiplier)));
    return `${dynamic}px`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Mic Status Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isMicConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: isMicConnected ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '0.84rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isMicConnected ? (
            <CheckCircle2 size={16} color="#34d399" />
          ) : (
            <AlertCircle size={16} color="#f87171" />
          )}
          <span style={{ color: isMicConnected ? '#34d399' : '#f87171', fontWeight: 600 }}>
            Voice Input: {micStatus}
          </span>
          {isMicConnected && isMuted && (
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                fontWeight: 600,
              }}
            >
              MUTED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isMicConnected && onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.74rem',
                color: isMuted ? '#f87171' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          )}

          <span style={{ fontSize: '0.76rem', color: isMicConnected ? '#6ee7b7' : '#fca5a5' }}>
            Barge-in: {isMicConnected ? (isMuted ? 'Paused (Muted)' : '⚡ Active (Speak word to interrupt)') : 'Unavailable'}
          </span>
        </div>
      </div>

      {/* Voice Answering Card (Permanent Voice-Only Mode) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'rgba(0,0,0,0.3)',
          border: wasInterrupted
            ? '1px solid rgba(234, 179, 8, 0.4)'
            : isPausing
            ? '1px solid rgba(59, 130, 246, 0.45)'
            : '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '14px 16px',
          transition: 'border-color 0.2s ease',
        }}
      >
        {/* Barge-In Banner if Interrupted */}
        {wasInterrupted && !isInterviewerSpeaking && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#facc15',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <Zap size={14} className="pulse-fast" />
            <span>Interviewer interrupted! Microphone switched to capture your answer.</span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            {/* Dynamic Live Audio Wave Visualizer */}
            <div
              className={`voice-waves-container ${isRecording || micVolume > 8 ? 'speaking' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '26px' }}
              title={`Live Mic Volume: ${micVolume}%`}
            >
              <span className="wave-bar" style={{ height: getBarHeight(0.7), background: isMuted ? '#6b7280' : micVolume > 15 ? '#34d399' : '#60a5fa' }} />
              <span className="wave-bar" style={{ height: getBarHeight(1.2), background: isMuted ? '#6b7280' : micVolume > 15 ? '#34d399' : '#60a5fa' }} />
              <span className="wave-bar" style={{ height: getBarHeight(1.5), background: isMuted ? '#6b7280' : micVolume > 15 ? '#34d399' : '#60a5fa' }} />
              <span className="wave-bar" style={{ height: getBarHeight(1.1), background: isMuted ? '#6b7280' : micVolume > 15 ? '#34d399' : '#60a5fa' }} />
              <span className="wave-bar" style={{ height: getBarHeight(0.8), background: isMuted ? '#6b7280' : micVolume > 15 ? '#34d399' : '#60a5fa' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span
                style={{
                  fontSize: '0.86rem',
                  color: isMuted
                    ? '#9ca3af'
                    : isPausing
                    ? '#93c5fd'
                    : hasSpokenText
                    ? '#60a5fa'
                    : isInterviewerSpeaking
                    ? '#93c5fd'
                    : '#34d399',
                  fontWeight: 600,
                }}
              >
                {isMuted
                  ? 'Microphone muted (Click unmute to speak)'
                  : isPausing
                  ? `Natural pause detected • Auto-submitting in ${pauseCountdown.remainingSeconds}s...`
                  : hasSpokenText
                  ? 'Listening & transcribing your voice...'
                  : isInterviewerSpeaking
                  ? 'Interviewer speaking — Speak a word to interrupt'
                  : 'Microphone is on — Speak naturally to answer'}
              </span>

              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                {isMuted
                  ? 'Interruption and STT are paused while muted.'
                  : isInterviewerSpeaking
                  ? '⚡ Interrupts instantly when you speak words (immune to wind/noise/echo).'
                  : 'Hands-free turn-taking: pause briefly to auto-submit.'}
              </span>
            </div>
          </div>

          {/* Action Area: Clear & Submit Now buttons appear only when words are spoken */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasSpokenText ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClearTranscript}
                  disabled={disabled}
                  style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                  title="Clear spoken answer and re-speak"
                >
                  <RotateCcw size={14} />
                  <span>Clear</span>
                </button>

                <button
                  id="voice-submit-now-btn"
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const text = liveTranscript.trim();
                    if (onSubmitAnswer && text) {
                      onSubmitAnswer(text, 'voice');
                    }
                  }}
                  disabled={disabled || isMuted}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  title="Submit your spoken answer immediately"
                >
                  <Send size={15} />
                  <span>Submit Now</span>
                </button>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  background: isMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.12)',
                  border: isMuted ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: isMuted ? '#f87171' : '#34d399',
                }}
                title={isMuted ? 'Mic is currently muted' : 'Microphone is constantly on and listening'}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isMuted ? '#ef4444' : '#10b981',
                    boxShadow: isMuted ? 'none' : '0 0 8px #10b981',
                  }}
                  className={!isMuted ? 'pulse-fast' : ''}
                />
                <span>{isMuted ? 'Mic Muted' : 'Mic Always On'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Transcript Preview Box if Candidate Has Spoken Words */}
        {hasSpokenText && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: isPausing ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.88rem',
              color: '#e2e8f0',
              lineHeight: '1.5',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'border-color 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>
                Live Voice Transcript
              </span>

              {isPausing ? (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.74rem',
                    color: '#93c5fd',
                    fontWeight: 600,
                    background: 'rgba(59, 130, 246, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  <Clock size={12} className="pulse-fast" />
                  <span>Auto-submitting in {pauseCountdown.remainingSeconds}s...</span>
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                  ✓ Listening... (Pause briefly to submit)
                </span>
              )}
            </div>

            <p style={{ margin: 0, fontStyle: 'italic', color: '#f8fafc' }}>
              "{liveTranscript}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
