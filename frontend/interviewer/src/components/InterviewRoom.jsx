import React, { useState, useEffect } from 'react';
import { LogOut, Volume2, Sparkles, PenLine, AlertTriangle } from 'lucide-react';
import PanelMembers from './PanelMembers';
import InterviewTimer from './InterviewTimer';
import VoiceControls from './VoiceControls';
import Transcript from './Transcript';
import DrawingCanvas from './DrawingCanvas';
import CandidateCamera from './CandidateCamera';

export default function InterviewRoom({
  state,
  micStatus,
  isRecording,
  onToggleRecord,
  liveTranscript,
  onSubmitAnswer,
  onEndInterview,
  loadingAnswer,
  onCandidateInteracted,
  micVolume = 0,
  isMuted = false,
  onToggleMute,
  wasInterrupted = false,
  onClearTranscript,
  pauseCountdown = null,
  silenceSeconds = 0,
}) {
  const [canvasOpen, setCanvasOpen] = useState(false);

  const currentQ = state?.current_question || state?.greeting_question || 'Preparing initial interview question...';
  const currentSpeaker = state?.selected_panel_member || 'Interviewer';
  const speakerDetails = state?.panel_member_details || {};
  const isConcluding = state?.stage === 'CONCLUDING' || state?.stage === 'WAITING_FOR_CLOSING_SPEECH';
  const isInterviewerSpeaking = Boolean(state?.isSpeaking);
  // Derive a stable question identifier from the current question text
  const questionId = currentQ ? `q-${currentQ.trim().slice(0, 60).replace(/\s+/g, '-')}` : null;

  // Auto-open canvas if interviewer asks for system design drawing / canvas
  const requiresCanvas = Boolean(
    state?.requires_canvas ||
    state?.current_question_kind === 'system_design' ||
    (typeof currentQ === 'string' && (
      currentQ.toLowerCase().includes('canvas') ||
      (currentQ.toLowerCase().includes('draw') && currentQ.toLowerCase().includes('architecture'))
    ))
  );

  useEffect(() => {
    if (isConcluding) {
      setCanvasOpen(false);
    } else if (requiresCanvas) {
      setCanvasOpen(true);
    } else {
      setCanvasOpen(false);
    }
  }, [requiresCanvas, questionId, isConcluding]);



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar: Stage, Evaluation Areas, Timer, and End Interview */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: 'rgba(16, 20, 31, 0.85)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <InterviewTimer
            elapsedSeconds={state?.elapsed_time || 0}
            stage={state?.stage || 'NORMAL'}
            timerStarted={state?.timer_started}
          />

          {/* Evaluation Areas Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', maxWidth: '500px' }}>
            {(state?.areas_to_cover || []).map((area) => {
              const isCovered = state?.covered_areas?.includes(area);
              return (
                <span
                  key={area}
                  style={{
                    fontSize: '0.74rem',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: isCovered ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                    border: isCovered ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                    color: isCovered ? '#34d399' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isCovered ? `✓ ${area}` : area}
                </span>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-danger"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={onEndInterview}
        >
          <LogOut size={16} />
          <span>End Interview</span>
        </button>
      </div>

      {/* Main Grid: Left Panel | Center Live Stage | Right Transcript */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1.4fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* LEFT: Interview Panel Members & Candidate Camera */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PanelMembers
            panel={state?.panel}
            currentSpeaker={currentSpeaker}
            isSpeaking={isInterviewerSpeaking}
          />
          <CandidateCamera />
        </div>

        {/* CENTER: Live Interview Spotlight & Input Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 100-Second Prolonged Silence Inactivity Warning Banner */}
          {silenceSeconds >= 60 && !isConcluding && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: '10px',
                background: silenceSeconds >= 85 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                border: silenceSeconds >= 85 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(245, 158, 11, 0.4)',
                color: silenceSeconds >= 85 ? '#fca5a5' : '#fcd34d',
                fontSize: '0.84rem',
                fontWeight: 600,
                boxShadow: silenceSeconds >= 85 ? '0 0 16px rgba(239, 68, 68, 0.3)' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={17} color={silenceSeconds >= 85 ? '#f87171' : '#fbbf24'} />
                <span>
                  No speech detected for <strong>{silenceSeconds}s</strong>. The interview will conclude automatically in {Math.max(0, 100 - silenceSeconds)}s if silent.
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: silenceSeconds >= 85 ? '#fecaca' : '#fef3c7',
                  background: silenceSeconds >= 85 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.25)',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {Math.max(0, 100 - silenceSeconds)}s remaining
              </span>
            </div>
          )}

          {/* Speaker Spotlight Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 20, 31, 0.9) 0%, rgba(22, 28, 44, 0.8) 100%)',
              border: '1px solid var(--border-accent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: 'var(--primary-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#fff',
                  boxShadow: '0 0 16px var(--primary-glow)',
                }}
              >
                {currentSpeaker ? currentSpeaker[0] : 'AI'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{currentSpeaker}</h3>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      padding: '2px 8px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}
                  >
                    {speakerDetails.role || 'Panel Interviewer'}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {speakerDetails.persona || 'Professional and technical evaluator.'}
                </p>
              </div>

              {/* Spoken Voice Waves */}
              <div className={`voice-waves-container ${isInterviewerSpeaking ? 'speaking' : ''}`} title="Live audio speech delivery">
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
              </div>
            </div>

            {/* Current Question Box */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Current Question
                  </span>
                  {state?.selected_area && (
                    <span style={{ fontSize: '0.74rem', padding: '2px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', color: 'var(--text-dim)' }}>
                      Topic: {state.selected_area}
                    </span>
                  )}
                </div>

                {/* Live Status indicator: speaking vs interrupted vs waiting for candidate */}
                {isInterviewerSpeaking ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      color: '#34d399',
                    }}
                  >
                    <Volume2 size={14} className="pulse-fast" />
                    <span>Speaking question...</span>
                  </span>
                ) : wasInterrupted ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: '8px',
                      background: 'rgba(234, 179, 8, 0.18)',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      color: '#facc15',
                    }}
                  >
                    <Sparkles size={14} className="pulse-fast" />
                    <span>Interrupted — Listening to candidate</span>
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      color: '#93c5fd',
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Waiting for your response</span>
                  </span>
                )}
              </div>

              <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#fff', fontWeight: 500 }}>
                "{currentQ}"
              </p>

              <div style={{ marginTop: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isInterviewerSpeaking ? '#60a5fa' : wasInterrupted ? '#facc15' : '#34d399',
                    boxShadow: isInterviewerSpeaking ? '0 0 8px #60a5fa' : wasInterrupted ? '0 0 8px #facc15' : '0 0 8px #34d399',
                  }}
                />
                <span style={{ color: isInterviewerSpeaking ? '#93c5fd' : wasInterrupted ? '#facc15' : '#34d399', fontWeight: 500 }}>
                  {isInterviewerSpeaking
                    ? `${currentSpeaker} is speaking the question. You can speak anytime to interrupt.`
                    : wasInterrupted
                    ? `${currentSpeaker} was interrupted by candidate voice. Listening to your answer.`
                    : 'Question spoken. The platform is listening for your response (Microphone live with auto-submit).'}
                </span>
              </div>
            </div>
          </div>

          {/* Candidate Answering Area */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Voice controls (Voice-Only Mode) */}
            <VoiceControls
              micStatus={micStatus}
              isRecording={isRecording}
              onToggleRecord={onToggleRecord}
              isInterviewerSpeaking={isInterviewerSpeaking}
              micVolume={micVolume}
              isMuted={isMuted}
              onToggleMute={onToggleMute}
              wasInterrupted={wasInterrupted}
              liveTranscript={liveTranscript}
              onClearTranscript={onClearTranscript}
              pauseCountdown={pauseCountdown}
              onSubmitAnswer={onSubmitAnswer}
              disabled={isConcluding || loadingAnswer}
            />

            {/* Draw Diagram toggle */}
            {!isConcluding && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  id="canvas-toggle-btn"
                  type="button"
                  className={`canvas-toggle-btn ${canvasOpen ? 'active' : ''}`}
                  onClick={() => setCanvasOpen((o) => !o)}
                  title={canvasOpen ? 'Close diagram canvas' : 'Open system-design drawing canvas'}
                >
                  <PenLine size={15} />
                  <span>{canvasOpen ? 'Close Canvas' : requiresCanvas ? 'Draw Architecture (Active)' : 'Draw Diagram'}</span>
                </button>
                {canvasOpen && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Sketch your system design — submit for AI analysis & answer
                  </span>
                )}
              </div>
            )}

            {/* Sliding canvas panel */}
            <div className={`canvas-panel ${canvasOpen ? 'expanded' : 'collapsed'}`}>
              <DrawingCanvas
                interviewId={state?.interview_id}
                questionId={questionId}
                currentQuestion={currentQ}
                onSubmitToTranscript={(text) => {
                  onCandidateInteracted?.();
                  onSubmitAnswer(text, 'voice');
                }}
                loadingAnswer={loadingAnswer}
                isConcluding={isConcluding}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Live Transcript Feed - Fixed in view with auto-scrolling questions & answers */}
        <div style={{ position: 'sticky', top: '16px', height: 'calc(100vh - 120px)', minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
          <Transcript
            history={state?.history || []}
            currentQuestion={currentQ}
            currentSpeaker={currentSpeaker}
            liveTranscript={liveTranscript}
          />
        </div>
      </div>
    </div>
  );
}
