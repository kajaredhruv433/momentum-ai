import React, { useEffect, useRef } from 'react';
import { MessageSquare, Mic, Keyboard } from 'lucide-react';

export default function Transcript({ history, currentQuestion, currentSpeaker, liveTranscript }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, liveTranscript, currentQuestion]);

  return (
    <div className="card transcript-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '450px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="#60a5fa" /> Interview Transcript
        </h3>
        <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', color: 'var(--text-muted)' }}>
          {history.length} turns
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
        {history.length === 0 && !currentQuestion && (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', margin: 'auto', fontSize: '0.88rem' }}>
            Questions and answers will be documented here in real time.
          </div>
        )}

        {/* Prior QA turns */}
        {history.map((turn, i) => (
          <React.Fragment key={turn.question_id || i}>
            {/* Panel Question */}
            {turn.question && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '90%', alignSelf: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#93c5fd' }}>
                  <span style={{ fontWeight: 700 }}>{turn.panel_member || 'Interviewer'}</span>
                  {turn.selected_area && (
                    <span style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                      {turn.selected_area}
                    </span>
                  )}
                </div>
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 14px', borderRadius: '12px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {turn.question}
                </div>
              </div>
            )}

            {/* Candidate Answer */}
            {turn.candidate_answer && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '90%', alignSelf: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#a7f3d0', justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 700 }}>Candidate</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                    {turn.input_method === 'voice' ? <Mic size={10} /> : <Keyboard size={10} />}
                    {turn.input_method === 'voice' ? 'Voice' : 'Typed'}
                  </span>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: '12px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {turn.candidate_answer}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Live Interim Transcript if speaking */}
        {liveTranscript && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '90%', alignSelf: 'flex-end' }}>
            <div style={{ fontSize: '0.76rem', color: '#60a5fa', textAlign: 'right', fontStyle: 'italic' }}>
              Speaking...
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px dashed #60a5fa', padding: '10px 14px', borderRadius: '12px', fontSize: '0.88rem', color: '#e2e8f0' }}>
              {liveTranscript}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
