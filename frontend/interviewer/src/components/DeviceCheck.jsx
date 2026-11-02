import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, CheckCircle2, AlertCircle, Play, Building2, Briefcase, User, Sparkles, ShieldCheck, RefreshCw, Link2, LockKeyhole } from 'lucide-react';
import { api } from '../services/api';

function repositoryNameFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let path = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (url.hostname.toLowerCase() !== 'github.com') return '';
      path = url.pathname;
    } else {
      path = raw.replace(/^git@github\.com:/i, '');
    }
  } catch (_) {
    return '';
  }
  const parts = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))) return '';
  return `${parts[0]}/${parts[1]}`;
}

export default function DeviceCheck({
  jobData,
  candidateInfo,
  resumeText,
  onStartInterview,
  loadingStart,
  loadingSetup,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const [cameraPermission, setCameraPermission] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [micPermission, setMicPermission] = useState('prompt');
  const [micVolume, setMicVolume] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [githubLogin, setGithubLogin] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [repositoryInput, setRepositoryInput] = useState('');
  const [repositoryError, setRepositoryError] = useState('');
  const [repositoryConsent, setRepositoryConsent] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const githubAuthUrl = window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000/auth/github'
    : '/auth/github';

  useEffect(() => {
    let cancelled = false;
    const callbackStatus = new URLSearchParams(window.location.search).get('github');
    if (callbackStatus === 'error') {
      setRepositoryError('GitHub connection did not complete. Check the GitHub App authorization and try again.');
    }
    if (callbackStatus) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('github');
      window.history.replaceState({}, '', cleanUrl);
    }
    const loadGithub = async () => {
      try {
        const session = await api.getGithubSession();
        if (!session.connected || cancelled) return;
        setGithubLogin(session.login || 'GitHub user');
        setGithubLoading(true);
        const result = await api.getGithubRepositories();
        if (cancelled) return;
        const repos = result.repositories || [];
        setRepositories(repos);

        const previousSelection = repos.find((repo) => repo.full_name === session.selected_repository?.full_name);
        const resumeLinks = [...String(resumeText || '').matchAll(/(?:https?:\/\/)?github\.com\/([^/\s)]+\/[^/\s?#)]+)/gi)]
          .map((match) => repositoryNameFromInput(`https://github.com/${match[1]}`));
        const mentioned = repos.find((repo) => resumeLinks.some((name) => name.toLowerCase() === repo.full_name.toLowerCase()));
        const autoSelect = previousSelection || mentioned;
        if (autoSelect) {
          const selected = previousSelection
            ? { repository: previousSelection }
            : await api.selectGithubRepository(autoSelect.full_name);
          if (!cancelled) {
            setSelectedRepository(selected.repository);
            setRepositoryInput(autoSelect.html_url);
          }
        }
      } catch (error) {
        if (!cancelled && !String(error.message || '').includes('401')) {
          setRepositoryError(error.message || 'Could not load your GitHub repositories.');
        }
      } finally {
        if (!cancelled) setGithubLoading(false);
      }
    };
    loadGithub();
    return () => { cancelled = true; };
  }, [resumeText]);

  const chooseRepository = async (fullName) => {
    setRepositoryError('');
    setRepositoryConsent(false);
    if (!fullName) {
      setSelectedRepository(null);
      return;
    }
    try {
      const selected = await api.selectGithubRepository(fullName);
      setSelectedRepository(selected.repository);
      setRepositoryInput(selected.repository.html_url);
    } catch (error) {
      setRepositoryError(error.message || 'Could not select this repository.');
    }
  };

  const selectPastedRepository = () => {
    const fullName = repositoryNameFromInput(repositoryInput);
    if (!fullName) {
      setRepositoryError('Paste a GitHub repository URL such as https://github.com/owner/repo.');
      return;
    }
    const authorizedRepo = repositories.find((repo) => repo.full_name.toLowerCase() === fullName.toLowerCase());
    if (!authorizedRepo) {
      setRepositoryError('That repository is not available to this GitHub connection. Choose one listed above.');
      return;
    }
    chooseRepository(authorizedRepo.full_name);
  };

  const disconnectGithub = async () => {
    try {
      await api.disconnectGithub();
      setGithubLogin('');
      setRepositories([]);
      setSelectedRepository(null);
      setRepositoryInput('');
      setRepositoryConsent(false);
      setRepositoryError('');
    } catch (error) {
      setRepositoryError(error.message || 'Could not disconnect GitHub.');
    }
  };

  const startMediaCheck = async () => {
    setErrorMessage(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraPermission('granted');
      setMicPermission('granted');

      // Set up Audio Analyser for live mic level
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const normalized = Math.min(Math.round((average / 128) * 100), 100);
            setMicVolume(normalized);
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        }
      } catch (audioErr) {
        console.warn('[DeviceCheck] Audio visualizer setup error:', audioErr);
      }
    } catch (err) {
      console.warn('[DeviceCheck] getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermission('denied');
        setMicPermission('denied');
        setErrorMessage('Camera or Microphone access was denied. Please allow camera and microphone access in your browser settings to proceed.');
      } else {
        setErrorMessage(`Hardware detection note: ${err.message || 'Unable to access camera/mic.'}`);
      }
    }
  };

  useEffect(() => {
    startMediaCheck();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleStart = () => {
    if (jobData?.already_completed) {
      alert("You have already completed the AI interview for this job. Each candidate may only take the interview once per job.");
      return;
    }
    if (selectedRepository && !repositoryConsent) {
      setRepositoryError('Please confirm the session-only repository review before starting.');
      return;
    }
    // Release preview stream so ElevenLabs RTC can cleanly claim hardware
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    onStartInterview(selectedRepository);
  };

  const skillsList = typeof jobData?.required_skills === 'string'
    ? jobData.required_skills.split(',').map((s) => s.trim()).filter(Boolean)
    : Array.isArray(jobData?.required_skills)
    ? jobData.required_skills
    : [];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Already Completed Notice */}
      {jobData?.already_completed && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '14px',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            color: '#f87171',
            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)',
          }}
        >
          <AlertCircle size={28} color="#ef4444" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fca5a5' }}>
              Interview Already Completed (Match Score: {jobData.completed_score || 0}%)
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '3px' }}>
              You have already taken the technical assessment for this job. Candidates are permitted to take the interview once per role. Please return to your dashboard to review open opportunities.
            </div>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          padding: '24px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <Sparkles size={13} />
              MongoDB Matched Profile
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              • Pre-Interview Readiness Check
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            {jobData?.role || 'Senior Technical Role'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#cbd5e1', fontSize: '0.9rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} color="#3b82f6" />
              <strong>{jobData?.company_name || 'Apex Cloud Systems'}</strong>
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} color="#10b981" />
              Candidate: <strong>{candidateInfo?.name || 'Applicant'}</strong> {candidateInfo?.email ? `(${candidateInfo.email})` : ''}
            </span>
          </div>
        </div>

        {/* Start Button at Top Right */}
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStart}
            disabled={loadingStart || loadingSetup}
            style={{
              padding: '14px 32px',
              fontSize: '1.05rem',
              fontWeight: 800,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: (loadingStart || loadingSetup) ? 'not-allowed' : 'pointer',
              border: 'none',
              color: '#ffffff',
              transition: 'all 0.2s ease',
            }}
          >
            {loadingStart ? (
              <>
                <RefreshCw size={18} className="spin-slow" />
                <span>Preparing AI Panel...</span>
              </>
            ) : (
              <>
                <Play size={18} fill="#ffffff" />
                <span>Start Interview</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional GitHub repository selection for this interview session */}
      <section className="card" style={{ padding: '22px 26px', border: '1px solid rgba(59, 130, 246, 0.28)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Link2 size={22} color="#93c5fd" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc' }}>Select the project you mentioned in your resume</h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.86rem', lineHeight: 1.55, color: '#94a3b8' }}>
              Connect GitHub, then choose or paste the repository URL. This step only selects the project; repository files are not downloaded or saved by this app.
            </p>
          </div>
        </div>

        {!githubLogin ? (
          <a href={githubAuthUrl} className="btn btn-secondary" style={{ width: 'fit-content', textDecoration: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
            <Link2 size={16} /> Connect GitHub
          </a>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: '#34d399', fontSize: '0.88rem' }}><CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Connected as @{githubLogin}</span>
              <button type="button" className="btn btn-secondary" onClick={disconnectGithub} style={{ padding: '6px 10px', fontSize: '0.78rem' }}>Disconnect</button>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', color: '#cbd5e1', fontSize: '0.84rem' }}>
              Repositories available to this GitHub account
              <select
                value={selectedRepository?.full_name || ''}
                onChange={(event) => chooseRepository(event.target.value)}
                disabled={githubLoading || repositories.length === 0}
                style={{ width: '100%', padding: '10px 12px', color: '#f8fafc', background: '#0f172a', border: '1px solid rgba(148,163,184,.35)', borderRadius: '8px' }}
              >
                <option value="">{githubLoading ? 'Loading repositories…' : 'Choose a repository'}</option>
                {repositories.map((repo) => (
                  <option key={repo.full_name} value={repo.full_name}>
                    {repo.full_name}{repo.private ? ' · private' : ''}{String(resumeText || '').toLowerCase().includes(repo.html_url.toLowerCase()) ? ' · mentioned in resume' : ''}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="url"
                value={repositoryInput}
                onChange={(event) => setRepositoryInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); selectPastedRepository(); } }}
                placeholder="Paste GitHub URL, e.g. https://github.com/owner/project"
                aria-label="GitHub repository URL"
                style={{ flex: '1 1 320px', minWidth: 0, padding: '10px 12px', color: '#f8fafc', background: '#0f172a', border: '1px solid rgba(148,163,184,.35)', borderRadius: '8px' }}
              />
              <button type="button" className="btn btn-secondary" onClick={selectPastedRepository} style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <Link2 size={15} /> Select URL
              </button>
            </div>

            {selectedRepository && (
              <>
                <div style={{ color: '#93c5fd', fontSize: '0.86rem' }}>
                  Selected: <strong>{selectedRepository.full_name}</strong>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  <input type="checkbox" checked={repositoryConsent} onChange={(event) => setRepositoryConsent(event.target.checked)} style={{ marginTop: '3px' }} />
                  <span><LockKeyhole size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />I authorize this project to be considered for this interview session. Repository code will not be saved in this app.</span>
                </label>
              </>
            )}
          </>
        )}

        {repositoryError && <p role="alert" style={{ margin: 0, color: '#fca5a5', fontSize: '0.82rem' }}>{repositoryError}</p>}
        {githubLogin && !selectedRepository && !githubLoading && repositories.length === 0 && (
          <p style={{ margin: 0, color: '#fbbf24', fontSize: '0.82rem' }}>No repositories are available. Check that this GitHub App has read-only Contents access to the repository.</p>
        )}
      </section>

      {/* Main Two-Column Layout: Camera/Mic Test on Left, Job & Candidate Context on Right */}
      <div className="split-layout" style={{ gridTemplateColumns: '1.1fr 0.9fr' }}>
        {/* Left Column: Camera and Mic Readiness */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#3b82f6" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Camera & Audio Verification
              </h2>
            </div>
            <button
              type="button"
              onClick={startMediaCheck}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Retest camera and microphone"
            >
              <RefreshCw size={13} /> Retest
            </button>
          </div>

          {/* Video Preview */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              paddingTop: '60%',
              background: '#0a0d16',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.8)',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror candidate
                display: cameraPermission === 'granted' ? 'block' : 'none',
              }}
            />

            {cameraPermission !== 'granted' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  color: '#94a3b8',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                <Camera size={36} color="#64748b" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {cameraPermission === 'denied' ? 'Camera access blocked' : 'Requesting camera access...'}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '300px' }}>
                  Please grant camera & microphone permissions when prompted by your browser.
                </span>
              </div>
            )}

            {/* Live Indicator overlay */}
            {cameraPermission === 'granted' && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(8px)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#34d399',
                    boxShadow: '0 0 8px #34d399',
                  }}
                />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f8fafc' }}>
                  Camera Ready
                </span>
              </div>
            )}
          </div>

          {/* Microphone Volume Meter */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                <Mic size={16} color={micVolume > 5 ? '#34d399' : '#94a3b8'} />
                Microphone Activity
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: micPermission === 'granted' ? '#34d399' : '#ef4444' }}>
                {micPermission === 'granted' ? (micVolume > 5 ? 'Voice Detected' : 'Listening...') : 'Check Mic'}
              </span>
            </div>

            {/* Visualizer bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(micVolume, 3)}%`,
                  background: micVolume > 15
                    ? 'linear-gradient(90deg, #3b82f6, #10b981)'
                    : '#3b82f6',
                  borderRadius: '4px',
                  transition: 'width 0.08s ease-out',
                }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
              Speak a few words to confirm the volume meter responds to your voice.
            </span>
          </div>

          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#fca5a5',
                fontSize: '0.82rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Column: Verified Job & Candidate Profile from MongoDB */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Target Role Card */}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={18} color="#3b82f6" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Job Assessment Parameters
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Experience</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>
                  {jobData?.required_experience || 'Not specified'}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Compensation</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#34d399', marginTop: '2px' }}>
                  {jobData?.salary || 'Competitive'}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                Required Skills & Tech Stack
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {skillsList.slice(0, 8).map((skill, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.74rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      color: '#93c5fd',
                      fontWeight: 600,
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {jobData?.role_description && (
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                  Role Overview
                </div>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, margin: 0, maxHeight: '80px', overflowY: 'auto' }}>
                  {jobData.role_description}
                </p>
              </div>
            )}
          </div>

          {/* Checklist Card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
              Interview Checklist
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Job specifications and resume loaded from MongoDB</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color={cameraPermission === 'granted' ? '#10b981' : '#64748b'} />
                <span>Camera feed online & active</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color={micPermission === 'granted' ? '#10b981' : '#64748b'} />
                <span>Microphone voice input ready</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Multi-agent AI Panel configured with distinct personas</span>
              </div>
            </div>

            {jobData?.already_completed ? (
              <a
                href="http://localhost:3000/dashboard/jobs"
                style={{
                  marginTop: '10px',
                  padding: '13px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                }}
              >
                <span>Return to Candidate Dashboard</span>
              </a>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStart}
                disabled={loadingStart || loadingSetup}
                style={{
                  marginTop: '10px',
                  padding: '12px 20px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: (loadingStart || loadingSetup) ? 'not-allowed' : 'pointer',
                }}
              >
                {loadingStart ? (
                  <>
                    <RefreshCw size={16} className="spin-slow" />
                    <span>Starting Interview...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} fill="#ffffff" />
                    <span>Begin Interview Now</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
