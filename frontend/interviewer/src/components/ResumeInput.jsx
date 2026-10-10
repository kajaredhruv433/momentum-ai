import React from 'react';
import { FileCode, Sparkles } from 'lucide-react';

export default function ResumeInput({ resumeText, onChange, onStart, loading, disabled }) {
  return (
    <div className="card setup-card right-column">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>02</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Candidate Resume</h3>
        </div>
        <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', color: '#94a3b8' }}>Raw Text</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <label htmlFor="resume-text" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileCode size={15} color="#818cf8" /> Paste Resume Content
          </label>
          <textarea
            id="resume-text"
            rows="16"
            value={resumeText}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste candidate's complete resume text here..."
            disabled={disabled}
            required
            style={{ flex: 1, minHeight: '340px' }}
          />
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            The parser extracts projects, skills, education, and career achievements into the candidate profile.
          </p>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="btn btn-primary btn-large"
            style={{ width: '100%' }}
            onClick={onStart}
            disabled={disabled || loading || !resumeText.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Preparing Panel & Opening Question...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>START INTERVIEW</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
