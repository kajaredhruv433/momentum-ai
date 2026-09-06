import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Radio } from 'lucide-react';
import DeviceCheck from './components/DeviceCheck';
import InterviewRoom from './components/InterviewRoom';
import Report from './components/Report';
import { api } from './services/api';
import { InterviewWebSocket } from './services/websocket';
import { AgoraClientService } from './services/agora';

const DEFAULT_JOB = {
  company_name: 'TechNova Solutions',
  role: 'Senior Backend Engineer',
  required_skills: 'Python, FastAPI, PostgreSQL, Redis, Docker, REST APIs, System Design, Microservices',
  required_experience: '3-5 years',
  required_qualification: 'B.Tech / B.E. in Computer Science or equivalent',
  salary: '15-25 LPA',
  role_description: 'Design and develop high-throughput, resilient backend systems, distributed caching layers, and microservice architectures handling 20,000+ RPM.',
  employee_qualities: 'Problem solving, ownership, communication, architecture reasoning, team collaboration',
};

const DEFAULT_RESUME = `DHRUV SHARMA
Email: dhruv.sharma@example.com | Phone: +91 9876543210 | Bangalore, India
LinkedIn: https://linkedin.com/in/dhruv-backend | GitHub: https://github.com/dhruv-sharma

SUMMARY
Full-Stack Python Backend Engineer with 4 years of experience designing high-throughput microservices, REST APIs, database schemas, and distributed caching layers with FastAPI, Django, Redis, and PostgreSQL.

SKILLS
- Languages: Python, SQL, JavaScript, Bash
- Frameworks: FastAPI, Django, Flask, SQLAlchemy, Celery, Pydantic
- Databases: PostgreSQL, Redis, MongoDB, Qdrant
- Cloud & DevOps: Docker, AWS (EC2, S3), Git, CI/CD, Linux
- Concepts: Distributed Systems, System Design, Caching, Event-Driven Architecture

EXPERIENCE
Senior Software Engineer - CloudCraft Technologies (2022 - Present)
- Architected and built high-performance asynchronous REST APIs in FastAPI handling 20,000+ RPM with sub-50ms latency.
- Implemented a two-tiered Redis caching layer reducing PostgreSQL query overhead by 45%.
- Built an event-driven worker queue for asynchronous batch report generation using Celery and Redis.

Junior Backend Developer - DataSphere Labs (2020 - 2022)
- Developed Django REST framework endpoints for candidate analytics and reporting workflows.
- Optimized slow SQL database queries, improving dashboard load times by 60%.

PROJECTS
1. Distributed Task Engine & Event Pipeline
- Built an asynchronous distributed job queue in Python using Redis streams and FastAPI for processing batch data jobs.
- Implemented dead-letter queues, exponential backoff retries, and worker heartbeat monitors.

2. Real-Time Analytics Cache
- Designed a write-through Redis cache cluster with PostgreSQL persistence for live user telemetry, handling sudden traffic spikes and cache stampede scenarios.

EDUCATION
B.Tech in Computer Science and Engineering (2016 - 2020)
Visvesvaraya Technological University (VTU) - First Class with Distinction`;

export default function App() {
  const [screen, setScreen] = useState('DEVICE_CHECK'); // 'DEVICE_CHECK' | 'INTERVIEW' | 'REPORT'
  const [jobData, setJobData] = useState(DEFAULT_JOB);
  const [resumeText, setResumeText] = useState(DEFAULT_RESUME);
  const [candidateInfo, setCandidateInfo] = useState(null);
  const [urlParams, setUrlParams] = useState({ jobId: '', candidateEmail: '', candidateId: '', applicationId: '' });
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [interviewState, setInterviewState] = useState(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Auto-fetch job and resume from MongoDB via query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jId = params.get('jobId') || '';
    const cEmail = params.get('candidateEmail') || '';
    const cId = params.get('candidateId') || '';
    const aId = params.get('applicationId') || '';

    setUrlParams({ jobId: jId, candidateEmail: cEmail, candidateId: cId, applicationId: aId });

    if (jId || cEmail || cId || aId) {
      setLoadingSetup(true);
      api.getSetupData(jId, cId, cEmail, aId)
        .then((data) => {
          if (data.jobData) setJobData(data.jobData);
          if (data.resumeText) setResumeText(data.resumeText);
          if (data.candidateProfile) setCandidateInfo(data.candidateProfile);
        })
        .catch((err) => {
          console.warn('[App] Failed to auto-load setup data from MongoDB:', err);
        })
        .finally(() => {
          setLoadingSetup(false);
        });
    } else {
      setLoadingSetup(false);
    }
  }, []);

  // Microphone & Voice-Only Answering
  const [micStatus, setMicStatus] = useState('Prompting...');
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micVolume, setMicVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const [pauseCountdown, setPauseCountdown] = useState(null);
  const [silenceSeconds, setSilenceSeconds] = useState(0);

  const wsRef = useRef(null);
  const agoraRef = useRef(null);
  const liveTranscriptRef = useRef('');
  liveTranscriptRef.current = liveTranscript;
  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;
  const loadingAnswerRef = useRef(false);
  loadingAnswerRef.current = loadingAnswer;
  const interviewStateRef = useRef(interviewState);
  interviewStateRef.current = interviewState;
  const lastCandidateSpeechTimeRef = useRef(Date.now());
  const handleSubmitAnswerRef = useRef(null);

  // Initialize Agora Service instance
  useEffect(() => {
    const service = new AgoraClientService();
    agoraRef.current = service;

    service.onSpeakingStateCallback = ({ speaking }) => {
      setInterviewState((prev) => (prev ? { ...prev, isSpeaking: speaking } : prev));
      if (speaking) {
        setWasInterrupted(false);
      }
    };

    service.onVolumeLevelCallback = (level) => {
      setMicVolume(level);
    };

    service.onBargeInCallback = () => {
      console.info('⚡ Interviewer interrupted by candidate speech!');
      setWasInterrupted(true);
      setInterviewState((prev) => (prev ? { ...prev, isSpeaking: false } : prev));
      setIsRecording(true);
    };

    service.onSpeechDetectedCallback = () => {
      lastCandidateSpeechTimeRef.current = Date.now();
      setSilenceSeconds(0);
      setIsRecording(true);
    };

    service.onTranscriptCallback = (data) => {
      if (loadingAnswerRef.current) return;
      const spoken = (typeof data === 'string' ? data : (data?.fullTranscript || data?.text || data?.final || data?.interim || '')).trim();
      if (spoken) {
        lastCandidateSpeechTimeRef.current = Date.now();
        setSilenceSeconds(0);
        liveTranscriptRef.current = spoken;
        setLiveTranscript(spoken);
        setIsRecording(true);
      } else {
        liveTranscriptRef.current = '';
        setLiveTranscript('');
      }
    };

    service.onSilenceCountdownCallback = (info) => {
      setPauseCountdown(info);
    };

    service.onSilenceTimeoutCallback = (transcriptFromAgora) => {
      lastCandidateSpeechTimeRef.current = Date.now();
      setSilenceSeconds(0);
      const text = (transcriptFromAgora || liveTranscriptRef.current || '').trim();
      console.info('[App] onSilenceTimeoutCallback triggered with candidate speech:', text);
      if (text && !loadingAnswerRef.current) {
        console.info('[App] Natural pause detected after speech. Auto-submitting response:', text);
        setIsRecording(false);
        setPauseCountdown(null);
        setLiveTranscript('');
        liveTranscriptRef.current = '';
        setWasInterrupted(false);
        handleSubmitAnswerRef.current?.(text, 'voice');
      }
    };

    return () => {
      service.leaveChannel();
      wsRef.current?.disconnect();
    };
  }, []);

  const handleReplayQuestion = (qText, speakerName, gender) => {
    const textToSpeak = qText || interviewState?.current_question;
    const speaker = speakerName || interviewState?.selected_panel_member || 'Interviewer';
    const voiceGender = gender || interviewState?.panel_member_details?.gender || 'Female';
    if (!textToSpeak) return;

    agoraRef.current?.speakPersonaMessage(
      textToSpeak,
      speaker,
      voiceGender,
      () => {
        if (!interviewState?.timer_started && interviewState?.interview_id) {
          api.notifyAgoraEvent(interviewState.interview_id, 'question_started', { first_question: true }).catch(() => {});
        }
      },
      true, // Allow intentional question replay
      interviewState?.panel_member_details
    );
  };

  // Sync Timer interval from backend
  useEffect(() => {
    if (screen !== 'INTERVIEW' || !interviewState?.interview_id) return;
    const interval = setInterval(async () => {
      try {
        const latest = await api.getInterviewStatus(interviewState.interview_id);
        setInterviewState((prev) => ({
          ...prev,
          elapsed_time: latest.elapsed_time,
          stage: latest.stage,
          timer_started: latest.timer_started,
          covered_areas: latest.covered_areas,
        }));
      } catch (_) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [screen, interviewState?.interview_id]);

  // Start Interview Flow
  const handleStartInterview = async () => {
    // Prime browser audio context immediately during user click gesture
    agoraRef.current?.unlockAudio();

    setLoadingStart(true);
    setErrorMsg(null);

    try {
      // 1. Initialize Interview in Backend with MongoDB IDs
      const response = await api.createInterview(
        jobData,
        resumeText,
        1800,
        2700,
        urlParams.candidateId,
        urlParams.candidateEmail,
        candidateInfo?.name,
        urlParams.jobId,
        urlParams.applicationId
      );
      const interviewId = response.interview_id;
      setInterviewState(response);
      setScreen('INTERVIEW');

      // 2. 🔥 SPEAK IMMEDIATELY AS SOON AS QUESTION IS GENERATED!
      if (response.current_question && response.selected_panel_member) {
        agoraRef.current?.speakPersonaMessage(
          response.current_question,
          response.selected_panel_member,
          response.panel_member_details?.gender || 'Female',
          () => {
            // Once spoken, notify backend and start listening for candidate answer
            api.notifyAgoraEvent(interviewId, 'question_started', { first_question: true }).catch(() => {});
            agoraRef.current?.startListening(null, true);
          },
          false,
          response.panel_member_details
        );
      }

      // 3. Connect WebSocket for Real-time Events
      const ws = new InterviewWebSocket(interviewId);
      wsRef.current = ws;
      ws.connect();

      ws.on('speaker_changed', (data) => {
        setLiveTranscript('');
        liveTranscriptRef.current = '';
        agoraRef.current?.stopListening();

        setInterviewState((prev) => ({
          ...prev,
          selected_panel_member: data.panel_member,
          current_question: data.question,
          selected_area: data.selected_area || prev?.selected_area,
          panel_member_details: data.panel_member_details || {
            ...(prev?.panel_member_details || {}),
            name: data.panel_member,
            gender: data.gender || 'Female',
          },
        }));
        // Auto-speak immediately as soon as question is generated
        if (data.question && data.panel_member) {
          agoraRef.current?.speakPersonaMessage(
            data.question,
            data.panel_member,
            data.gender || data.panel_member_details?.gender || 'Female',
            () => {
              agoraRef.current?.startListening(null, true);
            },
            false,
            data.panel_member_details
          );
        }
      });

      ws.on('timer_started', (data) => {
        setInterviewState((prev) => ({ ...prev, timer_started: true }));
      });

      ws.on('stage_changed', (data) => {
        setInterviewState((prev) => ({ ...prev, stage: data.stage }));
      });

      ws.on('closing_started', (data) => {
        setInterviewState((prev) => ({
          ...prev,
          stage: 'CONCLUDING',
          selected_panel_member: data.panel_member,
          current_question: data.message,
        }));

        let reportRequested = false;
        const triggerReportGeneration = async () => {
          if (reportRequested) return;
          reportRequested = true;
          try {
            const finalStatus = await api.notifyAgoraEvent(interviewId, 'speech_finished');
            if (finalStatus?.report) {
              setInterviewState((prev) => ({
                ...prev,
                ...finalStatus,
                report: finalStatus.report,
                stage: 'COMPLETED',
              }));
              setScreen('REPORT');
            }
          } catch (e) {
            console.warn('Error finishing closing speech / generating report:', e);
            try {
              const rep = await api.getReport(interviewId);
              if (rep) {
                setInterviewState((prev) => ({ ...prev, report: rep, stage: 'COMPLETED' }));
                setScreen('REPORT');
              }
            } catch (_) {}
          }
        };

        // Safety fallback timer: if audio synthesis onend doesn't fire within 8s, generate report anyway
        const safetyTimer = setTimeout(triggerReportGeneration, 8000);

        // Speak closing message, then notify speech_finished
        agoraRef.current?.speakPersonaMessage(
          data.message,
          data.panel_member,
          data.gender || data.panel_member_details?.gender || 'Female',
          () => {
            clearTimeout(safetyTimer);
            triggerReportGeneration();
          },
          false,
          data.panel_member_details
        );
      });

      ws.on('report_ready', (data) => {
        if (data?.report) {
          setInterviewState((prev) => ({ ...prev, report: data.report, stage: 'COMPLETED' }));
          setScreen('REPORT');
          if (urlParams.applicationId) {
            fetch(`/api/applications/${urlParams.applicationId}/report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                report: data.report,
                matchScore: data.report.overall_match_percentage,
                technicalScore: data.report.technical_score,
                communicationScore: data.report.communication_score,
                recommendation: data.report.final_recommendation,
              }),
            }).catch((e) => console.warn('App report sync warning:', e));
          }
        }
      });

      // 4. Concurrently initialize Microphone & Agora RTC in background (non-blocking!)
      (async () => {
        try {
          const micResult = await agoraRef.current.requestMicrophonePermission();
          setMicStatus(micResult.status);

          const agoraInfo = response.agora || (await api.getAgoraToken(interviewId));
          if (agoraInfo && agoraInfo.app_id) {
            await agoraRef.current.joinChannel(
              agoraInfo.app_id,
              agoraInfo.channel,
              agoraInfo.token,
              agoraInfo.uid
            );
          }
        } catch (setupErr) {
          console.warn('Background microphone/RTC setup warning:', setupErr);
        }
      })();
    } catch (err) {
      console.error('Failed to start interview:', err);
      setErrorMsg(err.message || 'Failed to start interview. Please check server logs.');
    } finally {
      setLoadingStart(false);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    agoraRef.current?.setMuted(nextMuted);
  };

  const handleClearTranscript = () => {
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    agoraRef.current?.resetRecognition();
  };

  // Toggle Voice Recording
  const handleToggleRecord = () => {
    agoraRef.current?.stopSpeaking();

    const recorded = (liveTranscriptRef.current || liveTranscript || '').trim();
    if (isRecording || recorded) {
      setIsRecording(false);
      setPauseCountdown(null);
      agoraRef.current?.stopListening();
      if (recorded) {
        handleSubmitAnswer(recorded, 'voice');
      }
      setLiveTranscript('');
      liveTranscriptRef.current = '';
      setWasInterrupted(false);
    } else {
      setIsRecording(true);
      setLiveTranscript('');
      liveTranscriptRef.current = '';
      setWasInterrupted(false);
      agoraRef.current?.startListening(null, true);
    }
  };

  // Submit Answer
  const handleSubmitAnswer = async (answerText, inputMethod = 'voice') => {
    const cleanText = (answerText || '').trim();
    if (!cleanText || loadingAnswerRef.current) return;

    lastCandidateSpeechTimeRef.current = Date.now();
    setSilenceSeconds(0);
    setLoadingAnswer(true);
    loadingAnswerRef.current = true;
    setIsRecording(false);
    setPauseCountdown(null);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    agoraRef.current?.stopSpeaking();
    agoraRef.current?.stopListening();

    try {
      const activeState = interviewStateRef.current || interviewState;
      const interviewId = activeState?.interview_id;
      if (!interviewId) {
        console.error('Answer submission failed: No active interview ID found.');
        return;
      }

      console.info(`[App] Submitting candidate answer (${inputMethod}):`, cleanText);
      const updated = await api.submitAnswer(interviewId, cleanText, inputMethod);
      setInterviewState(updated);
      interviewStateRef.current = updated;

      // Ensure transcript buffer is completely reset for the next question/turn
      setLiveTranscript('');
      liveTranscriptRef.current = '';

      if (updated.stage === 'COMPLETED' || updated.report) {
        setInterviewState((prev) => ({ ...prev, report: updated.report, stage: 'COMPLETED' }));
        setScreen('REPORT');
      } else if (updated.action === 'CONCLUDE' || updated.stage === 'CONCLUDING' || updated.stage === 'WAITING_FOR_CLOSING_SPEECH') {
        const closingMsg = updated.closing?.message || 'Thank you for your time today. That concludes the interview.';
        const closingMember = updated.closing?.panel_member || updated.selected_panel_member || 'Interviewer';
        const closingGender = updated.closing?.panel_member_details?.gender || 'Female';

        let done = false;
        const triggerFinished = async () => {
          if (done) return;
          done = true;
          try {
            const res = await api.notifyAgoraEvent(interviewId, 'speech_finished');
            if (res?.report) {
              setInterviewState((prev) => ({ ...prev, ...res, report: res.report, stage: 'COMPLETED' }));
              setScreen('REPORT');
            }
          } catch (err) {
            console.warn('Closing speech notify error:', err);
          }
        };

        const timer = setTimeout(triggerFinished, 8000);
        agoraRef.current?.speakPersonaMessage(
          closingMsg,
          closingMember,
          closingGender,
          () => {
            clearTimeout(timer);
            triggerFinished();
          },
          false,
          updated.closing?.panel_member_details
        );
      } else if (updated.current_question && updated.selected_panel_member) {
        // Speak as soon as the question is generated
        agoraRef.current?.speakPersonaMessage(
          updated.current_question,
          updated.selected_panel_member,
          updated.panel_member_details?.gender || 'Female',
          () => {
            // Once interviewer finishes speaking the next question, prime mic to listen fresh
            agoraRef.current?.startListening(null, true);
          },
          false,
          updated.panel_member_details
        );
      }
    } catch (err) {
      console.error('Answer submission error:', err);
      alert(`Answer submission failed: ${err.message}`);
    } finally {
      setLoadingAnswer(false);
      loadingAnswerRef.current = false;
    }
  };

  handleSubmitAnswerRef.current = handleSubmitAnswer;

  // End Interview manually or automatically on 100s silence
  const handleEndInterview = async (promptConfirm = true) => {
    if (promptConfirm && !confirm('Are you sure you want to conclude the interview and generate the evaluation report?')) return;
    agoraRef.current?.stopSpeaking();
    agoraRef.current?.stopListening();
    const interviewId = interviewState?.interview_id;
    if (!interviewId) return;

    try {
      setLoadingAnswer(true);
      const updated = await api.concludeInterview(interviewId);
      setInterviewState(updated);
      interviewStateRef.current = updated;

      const closingMsg = updated.closing?.message || 'Thank you for your time today. That concludes the interview.';
      const closingMember = updated.closing?.panel_member || 'Interviewer';
      const closingGender = updated.closing?.panel_member_details?.gender || 'Female';

      let done = false;
      const finishAndShowReport = async () => {
        if (done) return;
        done = true;
        try {
          const res = await api.notifyAgoraEvent(interviewId, 'speech_finished');
          if (res?.report) {
            setInterviewState((prev) => ({ ...prev, ...res, report: res.report, stage: 'COMPLETED' }));
            setScreen('REPORT');
          }
        } catch (e) {
          console.warn('Finish after manual conclude error:', e);
          try {
            const rep = await api.getReport(interviewId);
            if (rep) {
              setInterviewState((prev) => ({ ...prev, report: rep, stage: 'COMPLETED' }));
              setScreen('REPORT');
            }
          } catch (_) {}
        }
      };

      const fallbackTimer = setTimeout(finishAndShowReport, 7000);

      agoraRef.current?.speakPersonaMessage(
        closingMsg,
        closingMember,
        closingGender,
        () => {
          clearTimeout(fallbackTimer);
          finishAndShowReport();
        },
        false,
        updated.closing?.panel_member_details || updated.panel_member_details
      );
    } catch (err) {
      console.warn('Manual conclusion failed:', err);
      try {
        const res = await api.notifyAgoraEvent(interviewId, 'speech_finished');
        if (res?.report) {
          setInterviewState((prev) => ({ ...prev, ...res, report: res.report, stage: 'COMPLETED' }));
          setScreen('REPORT');
        }
      } catch (_) {}
    } finally {
      setLoadingAnswer(false);
    }
  };

  const handleReset = () => {
    agoraRef.current?.leaveChannel();
    wsRef.current?.disconnect();
    setInterviewState(null);
    setScreen('DEVICE_CHECK');
  };

  // 100-Second Prolonged Silence Watchdog:
  // Conclude interview if candidate has not spoken any word in 100 seconds.
  useEffect(() => {
    if (screen !== 'INTERVIEW') {
      setSilenceSeconds(0);
      return;
    }

    lastCandidateSpeechTimeRef.current = Date.now();
    setSilenceSeconds(0);

    const interval = setInterval(() => {
      // If interviewer is currently speaking, candidate is listening -> keep timer at 0
      if (agoraRef.current?.isInterviewerSpeaking()) {
        lastCandidateSpeechTimeRef.current = Date.now();
        setSilenceSeconds(0);
        return;
      }

      // If evaluating an answer, concluding, or completed -> keep timer at 0
      const activeState = interviewStateRef.current || interviewState;
      if (
        loadingAnswerRef.current ||
        activeState?.stage === 'COMPLETED' ||
        activeState?.stage === 'CONCLUDING' ||
        activeState?.stage === 'WAITING_FOR_CLOSING_SPEECH' ||
        activeState?.report
      ) {
        lastCandidateSpeechTimeRef.current = Date.now();
        setSilenceSeconds(0);
        return;
      }

      // If candidate is actively speaking, reset timer
      if (micVolume > 15) {
        lastCandidateSpeechTimeRef.current = Date.now();
        setSilenceSeconds(0);
        return;
      }

      const elapsed = Math.floor((Date.now() - lastCandidateSpeechTimeRef.current) / 1000);
      setSilenceSeconds(elapsed);

      // Conclude interview if candidate is silent for 100 seconds
      if (elapsed >= 100) {
        console.warn('[Watchdog] Candidate has been silent for 100 seconds without speaking. Concluding interview.');
        lastCandidateSpeechTimeRef.current = Date.now();
        setSilenceSeconds(0);
        handleEndInterview(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, interviewState?.interview_id, micVolume]);

  return (
    <div className="app-container">
      {/* Platform Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">
            <Radio size={22} />
          </div>
          <div>
            <h1>EchoSphere</h1>
            <p className="brand-subtitle">State-of-the-Art Multi-Panel AI Interview Platform</p>
          </div>
        </div>

        {screen !== 'DEVICE_CHECK' && (
          <div className="header-meta">
            <div className="badge badge-primary">
              <span className="pulse" />
              <span>Session: {interviewState?.stage || 'IN PROGRESS'}</span>
            </div>
            {interviewState?.company_details?.company_name && (
              <span className="badge badge-neutral">
                {interviewState.company_details.company_name} - {interviewState.company_details.role}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '12px 20px',
            color: '#fca5a5',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Main Content Sections */}
      {screen === 'DEVICE_CHECK' && (
        <main>
          <DeviceCheck
            jobData={jobData}
            candidateInfo={candidateInfo}
            onStartInterview={handleStartInterview}
            loadingStart={loadingStart}
            loadingSetup={loadingSetup}
          />
        </main>
      )}

      {screen === 'INTERVIEW' && (
        <InterviewRoom
          state={interviewState}
          micStatus={micStatus}
          isRecording={isRecording}
          onToggleRecord={handleToggleRecord}
          liveTranscript={liveTranscript}
          onSubmitAnswer={handleSubmitAnswer}
          onEndInterview={handleEndInterview}
          loadingAnswer={loadingAnswer}
          onCandidateInteracted={() => agoraRef.current?.stopSpeaking()}
          micVolume={micVolume}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          wasInterrupted={wasInterrupted}
          onClearTranscript={handleClearTranscript}
          pauseCountdown={pauseCountdown}
          silenceSeconds={silenceSeconds}
        />
      )}

      {screen === 'REPORT' && (
        <Report
          report={interviewState?.report}
          candidateInfo={interviewState?.candidate_profile}
          companyDetails={interviewState?.company_details}
          canvasSubmissions={interviewState?.canvas_submissions || []}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
