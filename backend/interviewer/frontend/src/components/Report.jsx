import React from 'react';
import { Award, CheckCircle2, AlertTriangle, Briefcase, PenLine } from 'lucide-react';

export default function Report({ report, candidateInfo, companyDetails, canvasSubmissions = [], onReset }) {
  if (!report) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <span className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Generating Evidence-Based Candidate Report...</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Querying Groq router via otheragent.py with full interview transcripts and resume profile.
        </p>
      </div>
    );
  }

  const overallPct = Math.max(0, Math.min(100, Math.round(report.overall_match_percentage ?? 0)));

  const metrics = [
    { label: 'Job Role Match', value: report.job_role_match ?? 0 },
    { label: 'Technical Score', value: report.technical_score ?? 0 },
    { label: 'Skills Match', value: report.skills_match ?? 0 },
    { label: 'Problem Solving', value: report.problem_solving_score ?? 0 },
    { label: 'Communication', value: report.communication_score ?? 0 },
    { label: 'Experience Match', value: report.experience_match ?? 0 },
    { label: 'Qualification Match', value: report.qualification_match ?? 0 },
  ];

  const candidateName = candidateInfo?.name || candidateInfo?.candidate_name || 'Candidate';
  const roleTitle = companyDetails?.role || 'Target Role';
  const companyName = companyDetails?.company_name || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'linear-gradient(135deg, rgba(16, 20, 31, 0.95) 0%, rgba(22, 28, 44, 0.95) 100%)',
          border: '1px solid var(--border-accent)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Interview Feedback Report
            </span>
            {companyName && (
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                <Briefcase size={12} style={{ marginRight: '4px' }} />
                {companyName} — {roleTitle}
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{candidateName}</span>
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              — Candidate Feedback
            </span>
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Strict evidence-based evaluation generated from interview transcripts and resume profile.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Session Status
          </span>
          <div
            style={{
              padding: '8px 20px',
              borderRadius: '9999px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1.5px solid rgba(59, 130, 246, 0.3)',
              fontSize: '0.95rem',
              fontWeight: 700,
            }}
          >
            Interview Completed
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px' }}>
        {/* Left Column: Overall Alignment & Metric Bars */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#60a5fa" /> Overall Alignment
          </h3>

          {/* Dynamic Conic Gauge */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '136px',
                height: '136px',
                borderRadius: '50%',
                background: `conic-gradient(#3b82f6 0%, #6366f1 ${overallPct}%, rgba(255,255,255,0.08) ${overallPct}%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                boxShadow: '0 0 24px rgba(59, 130, 246, 0.25)',
              }}
            >
              <div
                style={{
                  width: '112px',
                  height: '112px',
                  borderRadius: '50%',
                  background: 'var(--bg-dark)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '1.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                  {overallPct}%
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Match</span>
              </div>
            </div>
          </div>

          {/* Metric Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {metrics.map((m) => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>{m.value}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(0, Math.min(100, m.value))}%`,
                      background: 'var(--primary-gradient)',
                      borderRadius: '9999px',
                      transition: 'width 1s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Strengths, Concerns, Hire & Reject Reasons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Strengths */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CheckCircle2 size={16} /> Candidate Strengths & Highlights
            </h4>
            <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {(report.strengths && report.strengths.length > 0) ? (
                report.strengths.map((s, idx) => <li key={idx}>{s}</li>)
              ) : (
                <li>Candidate demonstrated steady participation across evaluated topics.</li>
              )}
            </ul>
          </div>

          {/* Key Concerns */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <AlertTriangle size={16} /> Key Concerns & Areas to Probe
            </h4>
            <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {(report.concerns && report.concerns.length > 0) ? (
                report.concerns.map((c, idx) => <li key={idx}>{c}</li>)
              ) : (
                <li>No major disqualifying concerns identified.</li>
              )}
            </ul>
          </div>

          {/* Candidate-facing language and basic insights. Hiring status and
              recruiter decision rationale are intentionally omitted. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#60a5fa', marginBottom: '8px' }}>Language Skills</h5>
              <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {(report.language_skills || []).map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '8px' }}>Basic Insights</h5>
              <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {(report.basic_insights || []).map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
            </div>
          </div>

          {/* Canvas Diagram Submissions */}
          {canvasSubmissions.length > 0 && (
            <div className="card" style={{ padding: '18px 20px' }}>
              <h4
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#c4b5fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '14px',
                }}
              >
                <PenLine size={16} /> System Design Diagrams Submitted
              </h4>
              <div className="canvas-report-section">
                {canvasSubmissions.map((sub, idx) => {
                  const analysis = sub.analysis || {};
                  const components = analysis.components || [];
                  const relationships = analysis.relationships || [];
                  const design_notes = analysis.design_notes || '';
                  const suggestions = analysis.suggestions || [];
                  return (
                    <div key={idx} className="canvas-report-entry">
                      {sub.question && (
                        <p className="canvas-report-entry-q">
                          Q{idx + 1}: &ldquo;{sub.question}&rdquo;
                        </p>
                      )}
                      <div className="canvas-report-analysis-grid">
                        {components.length > 0 && (
                          <div>
                            <div className="canvas-analysis-label" style={{ marginBottom: '6px' }}>Components Identified</div>
                            <div className="canvas-analysis-tags">
                              {components.map((c, i) => (
                                <span key={i} className="canvas-analysis-tag">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {relationships.length > 0 && (
                          <div>
                            <div className="canvas-analysis-label" style={{ marginBottom: '6px' }}>Data Flows</div>
                            <div className="canvas-analysis-tags">
                              {relationships.map((r, i) => (
                                <span key={i} className="canvas-analysis-tag relation">{r}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {design_notes && (
                        <div>
                          <div className="canvas-analysis-label" style={{ marginBottom: '4px' }}>AI Assessment</div>
                          <p className="canvas-analysis-note">{design_notes}</p>
                        </div>
                      )}
                      {suggestions.length > 0 && (
                        <div>
                          <div className="canvas-analysis-label" style={{ marginBottom: '6px' }}>Improvement Suggestions</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {suggestions.map((s, i) => (
                              <div key={i} className="canvas-analysis-suggestion">{s}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            <a
              href="http://localhost:3000/dashboard/jobs"
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontWeight: 700 }}
            >
              <Briefcase size={16} />
              <span>Back to Available Jobs</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
