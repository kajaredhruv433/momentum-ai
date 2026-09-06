/**
 * DrawingCanvas.jsx
 *
 * Self-contained system-design drawing canvas for EchoSphere interview sessions.
 * Supports: pen, eraser, rectangle, circle, arrow, text, undo, redo, clear, submit.
 * On submit: converts canvas to PNG, POSTs to /api/interview/{id}/canvas,
 * and displays structured AI diagram analysis inline.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

// ─── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'pen',       label: 'Pen',       icon: '✏️' },
  { id: 'eraser',    label: 'Eraser',    icon: '🧹' },
  { id: 'rect',      label: 'Rect',      icon: '▭' },
  { id: 'circle',    label: 'Circle',    icon: '◯' },
  { id: 'arrow',     label: 'Arrow',     icon: '→' },
  { id: 'text',      label: 'Text',      icon: 'T' },
];

const PALETTE = [
  '#f8fafc', // white
  '#93c5fd', // blue-300
  '#34d399', // emerald-400
  '#f59e0b', // amber-400
  '#f87171', // red-400
  '#c4b5fd', // violet-300
  '#fbbf24', // yellow-400
  '#6ee7b7', // teal
];

const STROKE_SIZES = [2, 4, 6, 10, 16];

const CANVAS_W = 900;
const CANVAS_H = 440;

// ─── Helper: draw arrow head ───────────────────────────────────────────────────
function drawArrowHead(ctx, fromX, fromY, toX, toY) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = 14;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

// ─── Helper: fill canvas background + dot grid ────────────────────────────────
function drawBackground(ctx) {
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }
}

// ─── Helper: redraw full history onto a context ────────────────────────────────
function redrawHistory(ctx, history) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  for (const entry of history) {
    renderEntry(ctx, entry);
  }
}

function renderEntry(ctx, entry) {
  ctx.save();
  ctx.strokeStyle = entry.color;
  ctx.fillStyle = entry.color;
  ctx.lineWidth = entry.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (entry.tool) {
    case 'pen':
    case 'eraser': {
      if (entry.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      }
      const pts = entry.points;
      if (!pts || pts.length < 1) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'rect': {
      const { x1, y1, x2, y2 } = entry;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      break;
    }
    case 'circle': {
      const cx = (entry.x1 + entry.x2) / 2;
      const cy = (entry.y1 + entry.y2) / 2;
      const rx = Math.abs(entry.x2 - entry.x1) / 2;
      const ry = Math.abs(entry.y2 - entry.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(entry.x1, entry.y1);
      ctx.lineTo(entry.x2, entry.y2);
      ctx.stroke();
      drawArrowHead(ctx, entry.x1, entry.y1, entry.x2, entry.y2);
      break;
    }
    case 'text': {
      ctx.font = `${Math.max(14, entry.lineWidth * 3)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(entry.text, entry.x1, entry.y1);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ─── Helper: Format diagram analysis for interview transcript (spoken response) ──
function formatDiagramForTranscript(analysis) {
  const { components = [], relationships = [], design_notes = '' } = analysis;
  const parts = [];
  if (design_notes) {
    parts.push(design_notes);
  }
  if (components.length > 0) {
    parts.push(`In my system design, the key components are: ${components.join(', ')}.`);
  }
  if (relationships.length > 0) {
    parts.push(`The data flow and communication paths are: ${relationships.join('; ')}.`);
  }
  if (parts.length === 0) {
    return 'I have drawn the architecture diagram on the canvas detailing the components, services, and communication paths.';
  }
  return parts.join(' ');
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function DrawingCanvas({
  interviewId,
  questionId,
  currentQuestion,
  onSubmitToTranscript,
  onInsertToInput,
  loadingAnswer,
  isConcluding,
}) {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null); // for live shape preview

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#f8fafc');
  const [lineWidth, setLineWidth] = useState(3);

  // History stack for undo/redo
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const [historyLen, setHistoryLen] = useState(0); // reactive trigger

  // Drawing state
  const isDrawingRef = useRef(false);
  const currentEntryRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Text input state
  const [textInputState, setTextInputState] = useState(null); // { x, y } or null

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // ── Initialize canvas background ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawBackground(canvas.getContext('2d'));
  }, []);

  // ── Reset analysis when question changes ──────────────────────────────────
  useEffect(() => {
    setAnalysis(null);
    setSubmitError(null);
  }, [questionId]);

  // ── Coordinate helper ─────────────────────────────────────────────────────
  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // ── Commit entry to history ───────────────────────────────────────────────
  const commitEntry = useCallback((entry) => {
    historyRef.current.push(entry);
    redoRef.current = [];
    setHistoryLen(historyRef.current.length);
    // Redraw main canvas
    const ctx = canvasRef.current.getContext('2d');
    renderEntry(ctx, entry);
  }, []);

  // ── Pointer Down ──────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (submitting) return;
    e.preventDefault();

    const pos = getPos(e);

    if (tool === 'text') {
      setTextInputState({ x: pos.x, y: pos.y });
      return;
    }

    isDrawingRef.current = true;
    startPosRef.current = pos;

    if (tool === 'pen' || tool === 'eraser') {
      currentEntryRef.current = {
        tool,
        color,
        lineWidth: tool === 'eraser' ? lineWidth * 4 : lineWidth,
        points: [pos],
      };
    } else {
      // Shape tools — will be committed on pointer up
      currentEntryRef.current = {
        tool,
        color,
        lineWidth,
        x1: pos.x, y1: pos.y,
        x2: pos.x, y2: pos.y,
      };
    }
  }, [tool, color, lineWidth, submitting, getPos]);

  // ── Pointer Move ──────────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const entry = currentEntryRef.current;

    if (tool === 'pen' || tool === 'eraser') {
      entry.points.push(pos);
      // Draw incrementally on main canvas
      const ctx = canvasRef.current.getContext('2d');
      ctx.save();
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = entry.points;
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Shape: update overlay canvas with live preview
      entry.x2 = pos.x;
      entry.y2 = pos.y;
      const ovCtx = overlayCanvasRef.current.getContext('2d');
      ovCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderEntry(ovCtx, entry);
    }
  }, [tool, color, lineWidth, getPos]);

  // ── Pointer Up ────────────────────────────────────────────────────────────
  const handlePointerUp = useCallback((e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const entry = currentEntryRef.current;
    if (!entry) return;

    // Clear overlay
    const ovCtx = overlayCanvasRef.current.getContext('2d');
    ovCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Only commit if shape has meaningful size
    if (tool !== 'pen' && tool !== 'eraser') {
      const dx = Math.abs(entry.x2 - entry.x1);
      const dy = Math.abs(entry.y2 - entry.y1);
      if (dx < 3 && dy < 3) return;
    }

    if (tool === 'pen' || tool === 'eraser') {
      // Already drawn incrementally; just push to history for undo
      historyRef.current.push(entry);
      redoRef.current = [];
      setHistoryLen(historyRef.current.length);
    } else {
      commitEntry(entry);
    }
    currentEntryRef.current = null;
  }, [tool, commitEntry]);

  // ── Text input confirm ────────────────────────────────────────────────────
  const handleTextConfirm = useCallback((text) => {
    if (!text || !textInputState) return;
    commitEntry({
      tool: 'text',
      color,
      lineWidth,
      x1: textInputState.x,
      y1: textInputState.y,
      text,
    });
    setTextInputState(null);
  }, [textInputState, color, lineWidth, commitEntry]);

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!historyRef.current.length) return;
    const entry = historyRef.current.pop();
    redoRef.current.push(entry);
    setHistoryLen(historyRef.current.length);
    const ctx = canvasRef.current.getContext('2d');
    drawBackground(ctx);
    redrawHistory(ctx, historyRef.current);
  }, []);

  const handleRedo = useCallback(() => {
    if (!redoRef.current.length) return;
    const entry = redoRef.current.pop();
    historyRef.current.push(entry);
    setHistoryLen(historyRef.current.length);
    const ctx = canvasRef.current.getContext('2d');
    renderEntry(ctx, entry);
  }, []);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    historyRef.current = [];
    redoRef.current = [];
    setHistoryLen(0);
    setAnalysis(null);
    setSubmitError(null);
    drawBackground(canvasRef.current.getContext('2d'));
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting || !interviewId) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const canvas = canvasRef.current;
      const imageDataUrl = canvas.toDataURL('image/png');
      const result = await api.submitCanvas(interviewId, questionId || null, imageDataUrl);
      const analysisData = result.analysis || null;
      setAnalysis(analysisData);

      // Once the response from canvas is generated, feed it directly as the candidate's spoken response
      if (analysisData && onSubmitToTranscript) {
        const spokenAnswer = formatDiagramForTranscript(analysisData);
        onSubmitToTranscript(spokenAnswer);
      }
    } catch (err) {
      console.error('Canvas submit error:', err);
      setSubmitError(err.message || 'Failed to submit diagram. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [interviewId, questionId, submitting, onSubmitToTranscript]);

  // ── Keyboard shortcut for undo/redo ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  const canUndo = historyLen > 0;
  const canRedo = redoRef.current.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="canvas-toolbar">

        {/* Drawing Tools */}
        <div className="canvas-toolbar-group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              id={`canvas-tool-${t.id}`}
              className={`canvas-tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => { setTool(t.id); setTextInputState(null); }}
              title={t.label}
              disabled={submitting}
            >
              <span style={{ fontSize: '1em' }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="canvas-toolbar-divider" />

        {/* Color Palette */}
        <div className="canvas-toolbar-group" style={{ gap: '5px' }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`canvas-color-swatch ${color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              title={c}
              disabled={submitting}
            />
          ))}
        </div>

        <div className="canvas-toolbar-divider" />

        {/* Stroke Width */}
        <select
          className="canvas-stroke-select"
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          disabled={submitting}
          title="Stroke size"
          id="canvas-stroke-select"
        >
          {STROKE_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>

        <div className="canvas-toolbar-divider" />

        {/* Undo / Redo / Clear */}
        <div className="canvas-toolbar-group">
          <button
            id="canvas-btn-undo"
            className="canvas-tool-btn"
            onClick={handleUndo}
            disabled={!canUndo || submitting}
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            id="canvas-btn-redo"
            className="canvas-tool-btn"
            onClick={handleRedo}
            disabled={!canRedo || submitting}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪ Redo
          </button>
          <button
            id="canvas-btn-clear"
            className="canvas-tool-btn danger"
            onClick={handleClear}
            disabled={submitting}
            title="Clear canvas"
          >
            🗑 Clear
          </button>
        </div>

        <div className="canvas-toolbar-divider" />

        {/* Submit */}
        <button
          id="canvas-btn-submit"
          className="canvas-tool-btn success"
          onClick={handleSubmit}
          disabled={submitting || historyLen === 0}
          title={analysis ? "Update and re-analyze diagram" : "Submit diagram for AI analysis"}
          style={{ marginLeft: 'auto' }}
        >
          {submitting ? (
            <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyzing…</>
          ) : analysis ? (
            <>🧠 Update Diagram</>
          ) : (
            <>🧠 Submit Diagram</>
          )}
        </button>
      </div>

      {/* ── Canvas Wrapper ────────────────────────────────────────────────── */}
      <div className="canvas-wrapper" style={{ height: CANVAS_H }}>
        {/* Main canvas */}
        <canvas
          ref={canvasRef}
          id="drawing-canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: 'absolute', inset: 0, cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {/* Overlay for live shape preview */}
        <canvas
          ref={overlayCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />

        {/* Text input floating overlay */}
        {textInputState && (
          <TextInputOverlay
            x={textInputState.x}
            y={textInputState.y}
            canvasWidth={CANVAS_W}
            canvasHeight={CANVAS_H}
            color={color}
            onConfirm={handleTextConfirm}
            onCancel={() => setTextInputState(null)}
          />
        )}

        {/* Submit loading overlay */}
        {submitting && (
          <div className="canvas-submit-overlay">
            <span className="spinner" style={{ width: 20, height: 20 }} />
            <span>Analyzing your diagram with AI…</span>
          </div>
        )}
      </div>

      {/* ── Hint bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        <span>
          {tool === 'text' ? '📌 Click on the canvas to place text' :
           tool === 'eraser' ? '🧹 Click and drag to erase' :
           tool === 'pen' ? '✏️ Click and drag to draw freehand' :
           `${TOOLS.find(t => t.id === tool)?.icon} Click and drag to draw a ${tool}`}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>{historyLen} stroke{historyLen !== 1 ? 's' : ''}</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span>Ctrl+Z undo · Ctrl+Shift+Z redo</span>
        </span>
      </div>

      {/* ── Submit Error ──────────────────────────────────────────────────── */}
      {submitError && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px',
          padding: '10px 14px',
          color: '#fca5a5',
          fontSize: '0.83rem',
        }}>
          ⚠ {submitError}
        </div>
      )}

      {/* ── Analysis Result ───────────────────────────────────────────────── */}
      {analysis && (
        <DiagramAnalysisCard
          analysis={analysis}
          onSubmitToTranscript={onSubmitToTranscript}
          onInsertToInput={onInsertToInput}
          loadingAnswer={loadingAnswer}
          isConcluding={isConcluding}
        />
      )}
    </div>
  );
}

// ─── Text Input Overlay ─────────────────────────────────────────────────────────
function TextInputOverlay({ x, y, canvasWidth, canvasHeight, color, onConfirm, onCancel }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pct_x = (x / canvasWidth) * 100;
  const pct_y = (y / canvasHeight) * 100;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm(value.trim());
    }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div style={{
      position: 'absolute',
      left: `${Math.min(pct_x, 75)}%`,
      top: `${Math.min(pct_y, 80)}%`,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type and press Enter"
        id="canvas-text-input"
        style={{
          background: 'rgba(10, 13, 22, 0.92)',
          border: `1px solid ${color}`,
          borderRadius: '8px',
          padding: '6px 10px',
          color,
          fontFamily: 'var(--font-sans)',
          fontSize: '0.9rem',
          minWidth: '200px',
          outline: 'none',
          boxShadow: `0 0 12px ${color}44`,
        }}
      />
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 2 }}>
        Enter to confirm · Esc to cancel
      </div>
    </div>
  );
}

// ─── Diagram Analysis Card ──────────────────────────────────────────────────────
function DiagramAnalysisCard({
  analysis,
  onSubmitToTranscript,
  onInsertToInput,
  loadingAnswer,
  isConcluding,
}) {
  const { components = [], relationships = [], design_notes = '', suggestions = [] } = analysis;
  const [copied, setCopied] = useState(false);
  const [submittedToTranscript, setSubmittedToTranscript] = useState(false);

  const handleTranscriptSubmit = () => {
    if (loadingAnswer || isConcluding || !onSubmitToTranscript) return;
    const formatted = formatDiagramForTranscript(analysis);
    onSubmitToTranscript(formatted);
    setSubmittedToTranscript(true);
    setTimeout(() => setSubmittedToTranscript(false), 4000);
  };

  const handleInsertInput = () => {
    if (loadingAnswer || isConcluding || !onInsertToInput) return;
    const formatted = formatDiagramForTranscript(analysis);
    onInsertToInput(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="canvas-analysis-card">
      <div className="canvas-analysis-header">
        <span>🧠</span>
        <span>AI Diagram Analysis</span>
      </div>

      {components.length > 0 && (
        <div className="canvas-analysis-section">
          <div className="canvas-analysis-label">Components Identified</div>
          <div className="canvas-analysis-tags">
            {components.map((c, i) => (
              <span key={i} className="canvas-analysis-tag">{c}</span>
            ))}
          </div>
        </div>
      )}

      {relationships.length > 0 && (
        <div className="canvas-analysis-section">
          <div className="canvas-analysis-label">Data Flows / Relationships</div>
          <div className="canvas-analysis-tags">
            {relationships.map((r, i) => (
              <span key={i} className="canvas-analysis-tag relation">{r}</span>
            ))}
          </div>
        </div>
      )}

      {design_notes && (
        <div className="canvas-analysis-section">
          <div className="canvas-analysis-label">Design Assessment</div>
          <p className="canvas-analysis-note">{design_notes}</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="canvas-analysis-section">
          <div className="canvas-analysis-label">Suggestions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {suggestions.map((s, i) => (
              <div key={i} className="canvas-analysis-suggestion">{s}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── Transcript Submission Action Bar ── */}
      {onSubmitToTranscript && (
        <div style={{
          marginTop: '6px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            className="canvas-tool-btn success"
            onClick={handleTranscriptSubmit}
            disabled={loadingAnswer || isConcluding}
            title="Submit this diagram and architecture explanation directly to the live interview transcript"
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.2)',
            }}
          >
            <span>📝</span>
            <span>
              {loadingAnswer
                ? 'Evaluating Answer...'
                : submittedToTranscript
                ? '✓ Sent to Transcript!'
                : 'Submit to Interview Transcript'}
            </span>
          </button>

          {onInsertToInput && (
            <button
              type="button"
              className="canvas-tool-btn"
              onClick={handleInsertInput}
              disabled={loadingAnswer || isConcluding}
              title="Copy diagram description into the Type Your Response answer box"
              style={{
                padding: '8px 14px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📋</span>
              <span>{copied ? '✓ Copied to Answer Box!' : 'Copy to Answer Box'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
