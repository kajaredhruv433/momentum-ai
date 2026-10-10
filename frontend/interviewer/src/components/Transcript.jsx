import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Mic, Keyboard, ArrowDown, Sparkles, Volume2 } from 'lucide-react';

export default function Transcript({ history = [], currentQuestion, currentSpeaker, liveTranscript }) {
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Smooth scroll down to bottom
  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Detect whether the candidate has manually scrolled up to review previous turns
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 70;
    setUserScrolledUp(!isNearBottom);
  };

  // Auto-scroll when history, candidate speech, or question updates
  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom(true);
    }
  }, [history, liveTranscript, currentQuestion, userScrolledUp]);

  // When a brand new question arrives, always scroll to the latest question
  useEffect(() => {
    setUserScrolledUp(false);
    // Small timeout to allow DOM to measure new elements
    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [currentQuestion]);

  // Determine if currentQuestion is already recorded in the last history entry
  const lastHistoryQuestion = history.length > 0 ? history[history.length - 1]?.question : null;
  const isQuestionAlreadyInHistory = currentQuestion && lastHistoryQuestion && currentQuestion.trim() === lastHistoryQuestion.trim();
  const showActiveQuestion = Boolean(currentQuestion && !isQuestionAlreadyInHistory);

  return (
    <div
      className="card transcript-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        position: 'relative',
        overflow: 'hidden',
        padding: '16px 18px',
      }}
    >
      {/* Pinned Card Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
          marginBottom: '12px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="#60a5fa" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Interview Transcript
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '9999px',
              color: '#93c5fd',
              fontWeight: 600,
            }}
          >
            {history.length} {history.length === 1 ? 'turn' : 'turns'}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#34d399',
            }}
            title="Auto-scroll is active"
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
            Auto-scroll
          </span>
        </div>
      </div>

      {/* Auto-scrolling question & answer thread */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          paddingRight: '6px',
        }}
      >
        {history.length === 0 && !showActiveQuestion && (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', margin: 'auto', fontSize: '0.88rem' }}>
            Questions and answers will be documented here in real time.
          </div>
        )}

        {/* Historical Q&A turns */}
        {history.map((turn, i) => (
          <React.Fragment key={turn.question_id || i}>
            {/* Interviewer Question */}
            {turn.question && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '92%', alignSelf: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#93c5fd' }}>
                  <span style={{ fontWeight: 700 }}>{turn.panel_member || 'Interviewer'}</span>
                  {turn.selected_area && (
                    <span style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                      {turn.selected_area}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                    lineHeight: '1.5',
                  }}
                >
                  {turn.question}
                </div>
              </div>
            )}

            {/* Candidate Answer */}
            {turn.candidate_answer && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '92%', alignSelf: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#a7f3d0', justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 700 }}>Candidate</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                    {turn.input_method === 'voice' ? <Mic size={10} /> : <Keyboard size={10} />}
                    {turn.input_method === 'voice' ? 'Voice' : 'Typed'}
                  </span>
                </div>
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                    lineHeight: '1.5',
                  }}
                >
                  {turn.candidate_answer}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Current Active Interviewer Question */}
        {showActiveQuestion && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '92%', alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#93c5fd' }}>
              <span style={{ fontWeight: 700 }}>{currentSpeaker || 'Interviewer'}</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(59, 130, 246, 0.25)',
                  color: '#60a5fa',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              >
                <Sparkles size={11} /> Current Question
              </span>
            </div>
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.14)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.88rem',
                color: '#fff',
                lineHeight: '1.5',
                boxShadow: '0 0 16px rgba(59, 130, 246, 0.15)',
              }}
            >
              {currentQuestion}
            </div>
          </div>
        )}

        {/* Live Interim Transcript when Candidate is speaking */}
        {liveTranscript && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '92%', alignSelf: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#6ee7b7', justifyContent: 'flex-end' }}>
              <span style={{ fontWeight: 700 }}>Candidate (Speaking...)</span>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
            </div>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px dashed #34d399',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.88rem',
                color: '#f0fdf4',
                lineHeight: '1.5',
              }}
            >
              {liveTranscript}
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} style={{ height: '1px', flexShrink: 0 }} />
      </div>

      {/* Floating Jump to Latest Button (Visible when scrolled up) */}
      {userScrolledUp && (
        <button
          type="button"
          onClick={() => {
            setUserScrolledUp(false);
            scrollToBottom(true);
          }}
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(59, 130, 246, 0.5)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ArrowDown size={13} />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}
