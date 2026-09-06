/**
 * agora.js
 *
 * Manages Agora RTC client connection, microphone permissions,
 * Web Audio API Voice Activity Detection (VAD), instantaneous candidate
 * barge-in interruption, Edge-TTS audio playback, and live speech-to-text.
 */

import AgoraRTC from 'agora-rtc-sdk-ng';

export class AgoraClientService {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.remoteAudioTracks = new Map();
    this.micPermissionGranted = false;
    this.isConnected = false;

    // Web Speech Recognition (STT)
    this.recognition = null;
    this.isRecognizing = false;
    this.isListeningActive = false;
    this.onTranscriptCallback = null;
    this.onSpeakingStateCallback = null;
    this.onBargeInCallback = null;
    this.onVolumeLevelCallback = null;
    this.onSpeechDetectedCallback = null;
    this.onSilenceTimeoutCallback = null;
    this.onSilenceCountdownCallback = null;

    // Web Audio API playback & VAD
    this.audioCtx = null;
    this.currentAudio = null;
    this.currentSourceNode = null;
    this.currentSpeakingText = null;
    this.lastSpokenText = null;
    this.audioGeneration = 0;
    this.activeSources = new Set();
    this.audioUnlocked = false;

    // Microphone stream & Analyser for real-time VAD
    this.micStream = null;
    this.micSourceNode = null;
    this.analyserNode = null;
    this.vadInterval = null;
    this.isMuted = false;
    this.volumeLevel = 0;
    this.noiseFloor = 8;
    this.calibrationFrames = 0;
    this.consecutiveSpeechFrames = 0;

    // Silence detection & natural conversational turn-taking
    this.silenceTimeout = null;
    this.silenceInterval = null;
    this.silenceDurationMs = 2500; // 2.5 seconds natural conversational pause
    this.currentTranscriptLength = 0;
    this.lastSpokenTranscript = '';
    this.lastBargeInTime = 0;
    this.speechStartTime = 0;
    this.keepAliveInterval = null;
    this.pendingFinishCallback = null;

    // Distinct Persona Voice Allocation
    this.assignedVoiceProfiles = new Map();
    this.usedVoiceURIs = new Set();
  }

  /**
   * Internal AudioContext initializer / resume helper.
   */
  _initAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {
      console.warn('AudioContext initialization warning:', e);
    }
  }

  /**
   * Unlock browser audio context synchronously during a user gesture.
   */
  unlockAudio() {
    try {
      this._initAudioContext();
      const primer = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      primer.volume = 0.01;
      primer.play().catch(() => {});
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
      this.audioUnlocked = true;
    } catch (_) {}
  }

  /**
   * Request microphone permission upon entering interview room.
   * Keeps live MediaStream with Acoustic Echo Cancellation (AEC) and hooks up VAD.
   */
  async requestMicrophonePermission() {
    try {
      this._initAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      this.micPermissionGranted = true;

      // Set up real-time Web Audio VAD
      this._setupMicrophoneVAD(stream);

      // Start continuous listening in standby mode
      this.startListening(this.onTranscriptCallback, true);

      return { granted: true, status: 'Connected' };
    } catch (err) {
      this.micPermissionGranted = false;
      console.warn('Microphone permission denied or unavailable:', err);
      return { granted: false, status: 'Microphone unavailable' };
    }
  }

  /**
   * Sets up Web Audio AnalyserNode to calculate real-time microphone volume
   * and monitor for candidate speech energy to trigger immediate interruption.
   */
  _setupMicrophoneVAD(stream) {
    try {
      if (!this.audioCtx) {
        this._initAudioContext();
      }
      if (!this.audioCtx) return;

      if (this.micSourceNode) {
        try {
          this.micSourceNode.disconnect();
        } catch (_) {}
      }

      this.micSourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.25;

      this.micSourceNode.connect(this.analyserNode);

      if (this.vadInterval) {
        clearInterval(this.vadInterval);
      }

      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.vadInterval = setInterval(() => {
        if (this.isMuted || !this.analyserNode) {
          if (this.volumeLevel !== 0) {
            this.volumeLevel = 0;
            this.onVolumeLevelCallback?.(0);
          }
          return;
        }

        this.analyserNode.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const normalized = Math.min(100, Math.round((rms / 128) * 100));
        this.volumeLevel = normalized;
        this.onVolumeLevelCallback?.(normalized);

        // Dynamic noise floor calibration
        if (this.calibrationFrames < 20) {
          this.calibrationFrames++;
          this.noiseFloor = Math.max(6, Math.min(22, this.noiseFloor * 0.8 + rms * 0.2));
        }

        // VAD volume is used purely for UI audio wave visualizer meters.
        // Interruption is strictly reserved for STT-confirmed words as requested.
      }, 30);
    } catch (e) {
      console.warn('Failed to set up microphone VAD:', e);
    }
  }

  /**
   * Check if any interviewer persona audio is currently playing.
   */
  isInterviewerSpeaking() {
    return Boolean(
      this.currentSpeakingText ||
      this.activeSources.size > 0 ||
      (this.currentAudio && !this.currentAudio.paused) ||
      ('speechSynthesis' in window && window.speechSynthesis.speaking)
    );
  }

  /**
   * ⚡ BARGE-IN INTERRUPTION HANDLER:
   * Called immediately whenever candidate starts speaking while interviewer is talking.
   */
  handleBargeIn(source = 'candidate_speech') {
    const now = Date.now();
    // Debounce rapid duplicate triggers within 300ms
    if (now - this.lastBargeInTime < 300) return;
    this.lastBargeInTime = now;

    console.info(`⚡ [Barge-in] Candidate started speaking (${source}). IMMEDIATELY stopping interviewer!`);

    // 1. Instantly halt all interviewer speech audio!
    this.stopSpeaking();

    // 2. Notify barge-in callback
    if (this.onBargeInCallback) {
      this.onBargeInCallback({ source });
    }

    // 3. Make sure speech recognition is active to capture candidate words
    this.startListening(this.onTranscriptCallback);

    // 4. Notify speech detected
    this.onSpeechDetectedCallback?.();
  }

  /**
   * Join Agora RTC channel using tokens provided by the backend.
   */
  async joinChannel(appId, channel, token, uid) {
    if (!appId || !channel) {
      console.warn('Agora credentials missing for joinChannel');
      return false;
    }

    try {
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      this._setupClientEvents();

      const numericUid = uid ? parseInt(uid, 10) : null;
      await this.client.join(appId, channel, token || null, numericUid);
      this.isConnected = true;

      // If microphone permission is granted, create and publish local audio track
      if (this.micPermissionGranted) {
        try {
          this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'speech_standard',
            AEC: true,
            ANS: true,
          });
          await this.client.publish([this.localAudioTrack]);
          console.info('Agora RTC audio track published successfully');
        } catch (trackErr) {
          console.warn('Failed to publish microphone track:', trackErr);
        }
      }

      return true;
    } catch (err) {
      console.warn('Failed to join Agora channel:', err);
      return false;
    }
  }

  _setupClientEvents() {
    this.client.on('user-published', async (user, mediaType) => {
      await this.client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        const remoteAudioTrack = user.audioTrack;
        this.remoteAudioTracks.set(user.uid, remoteAudioTrack);
      }
    });

    this.client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') {
        this.remoteAudioTracks.delete(user.uid);
      }
    });
  }

  _destroyRecognition() {
    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch (_) {}
    }
    this.isRecognizing = false;
  }

  _createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[STT] Web Speech API is not supported in this browser.');
      return null;
    }

    this._destroyRecognition();

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.isRecognizing = true;
        console.info('[STT] SpeechRecognition listening started');
      };

      rec.onresult = (event) => {
        let completeFinal = '';
        let currentInterim = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item && item[0]) {
            const text = item[0].transcript;
            if (item.isFinal) {
              completeFinal += text + ' ';
            } else {
              currentInterim += text;
            }
          }
        }

        const fullTranscript = (completeFinal + currentInterim).trim();
        if (!fullTranscript) {
          return;
        }

        // 🛡️ WORD-CONFIRMED INTERRUPTION:
        // Must contain at least ONE genuine spoken word (alphanumeric).
        // Prevents wind noise, breathing, mic rustle, or ambient sounds from interrupting the panel!
        const words = fullTranscript.match(/\b[\p{L}\p{N}']+\b/gu) || [];
        const hasSpokenWords = words.length >= 1;

        if (hasSpokenWords) {
          // Cut off AI interviewer immediately once genuine candidate words are confirmed
          if (this.isInterviewerSpeaking()) {
            const elapsedSpeech = Date.now() - (this.speechStartTime || 0);
            // Grace period: allow initial 600ms for audio stream ramp-up
            if (elapsedSpeech < 600) {
              return;
            }

            // Echo filter: if candidate words are substrings of the question currently being spoken, ignore laptop speaker bleed
            if (this.currentSpeakingText) {
              const spokenClean = this.currentSpeakingText.toLowerCase();
              const genuineCandidateWords = words.filter((w) => !spokenClean.includes(w.toLowerCase()));
              if (genuineCandidateWords.length === 0) {
                return;
              }
            }

            console.info(`⚡ [Word-Confirmed Barge-In] Spoken word detected: "${words[0]}". Interrupting interviewer.`);
            this.handleBargeIn(`stt_word: "${words[0]}"`);
          }

          this.currentTranscriptLength = fullTranscript.length;
          this.lastSpokenTranscript = fullTranscript;
          this.onSpeechDetectedCallback?.();
          this._armSilenceTimer();

          if (this.onTranscriptCallback) {
            this.onTranscriptCallback({
              text: fullTranscript,
              interim: currentInterim,
              final: completeFinal.trim(),
              fullTranscript,
            });
          }
        }
      };

      rec.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[STT] SpeechRecognition error:', e.error);
        }
        if (e.error === 'not-allowed') {
          this.isListeningActive = false;
          this.isRecognizing = false;
        }
      };

      rec.onend = () => {
        this.isRecognizing = false;
        console.info('[STT] SpeechRecognition ended');
        // Auto-restart if listening is active, not muted, and this instance hasn't been replaced
        if (this.isListeningActive && !this.isMuted && this.recognition === rec) {
          setTimeout(() => {
            if (this.isListeningActive && !this.isMuted && this.recognition === rec && !this.isRecognizing) {
              try {
                rec.start();
              } catch (_) {
                if (this.isListeningActive && !this.isMuted) {
                  this._createRecognition();
                }
              }
            }
          }, 120);
        }
      };

      this.recognition = rec;
      rec.start();
      return rec;
    } catch (err) {
      console.warn('[STT] Failed to start SpeechRecognition:', err);
      this.isRecognizing = false;
      return null;
    }
  }

  _armSilenceTimer() {
    this.cancelSilenceTimer();

    // Only arm silence auto-commit if candidate has spoken meaningful text (>3 chars)
    if (this.currentTranscriptLength > 3) {
      const startTime = Date.now();
      const targetDuration = this.silenceDurationMs; // 2500ms natural conversational pause

      this.silenceInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, targetDuration - elapsed);
        const secondsRemaining = Math.max(1, Math.ceil(remaining / 1000));
        if (this.onSilenceCountdownCallback) {
          this.onSilenceCountdownCallback({
            isPaused: true,
            remainingMs: remaining,
            remainingSeconds: secondsRemaining,
          });
        }
        if (remaining <= 0) {
          if (this.silenceInterval) {
            clearInterval(this.silenceInterval);
            this.silenceInterval = null;
          }
        }
      }, 120);

      this.silenceTimeout = setTimeout(() => {
        this.cancelSilenceTimer();
        if (this.onSilenceTimeoutCallback && this.currentTranscriptLength > 3) {
          const finalCandidateText = (this.lastSpokenTranscript || '').trim();
          console.info('[SilenceDetection] Natural candidate speech pause (2.5s) detected. Submitting response:', finalCandidateText);
          
          // Stop listening immediately upon silence auto-commit so background sounds aren't recorded
          this.stopListening();

          this.onSilenceTimeoutCallback(finalCandidateText);
        }
      }, targetDuration);
    }
  }

  cancelSilenceTimer() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.silenceInterval) {
      clearInterval(this.silenceInterval);
      this.silenceInterval = null;
    }
    if (this.onSilenceCountdownCallback) {
      this.onSilenceCountdownCallback({
        isPaused: false,
        remainingMs: 0,
        remainingSeconds: 0,
      });
    }
  }

  /**
   * Reset candidate speech recognition state completely so that past answers
   * are never appended or carried over into new questions or subsequent answers.
   */
  resetRecognition() {
    this.cancelSilenceTimer();
    this.lastSpokenTranscript = '';
    this.currentTranscriptLength = 0;

    if (this.onTranscriptCallback) {
      this.onTranscriptCallback({
        text: '',
        interim: '',
        final: '',
        fullTranscript: '',
      });
    }

    if (this.isListeningActive && !this.isMuted) {
      this._createRecognition();
    }
  }

  startListening(onTranscript, fresh = false) {
    this.isListeningActive = true;
    if (onTranscript) {
      this.onTranscriptCallback = onTranscript;
    }

    if (fresh || !this.recognition) {
      this.cancelSilenceTimer();
      this.lastSpokenTranscript = '';
      this.currentTranscriptLength = 0;
      this._createRecognition();
      return;
    }

    if (!this.isRecognizing && !this.isMuted && this.recognition) {
      try {
        this.recognition.start();
      } catch (_) {
        this._createRecognition();
      }
    }
  }

  stopListening() {
    this.isListeningActive = false;
    this.cancelSilenceTimer();
    this.currentTranscriptLength = 0;
    this.lastSpokenTranscript = '';
    this._destroyRecognition();
  }

  /**
   * Spoken audio delivery for panel persona voices with instant zero-latency start.
   * Begins speaking immediately (<30ms) on candidate's device with rich persona voices.
   */
  /**
   * Spoken audio delivery for panel persona voices with instant zero-latency start.
   * Begins speaking immediately (<30ms) on candidate's device with rich persona voices.
   */
  async speakPersonaMessage(text, memberName, gender = 'Female', onFinished = null, force = false, memberDetails = null) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      if (onFinished) onFinished();
      return;
    }

    // 🛡️ Atomic Deduplication: If this exact question text is actively speaking, ignore duplicate triggers
    if (!force && this.lastSpokenText === cleanText && this.isInterviewerSpeaking()) {
      console.info('[AgoraTTS] Suppressing duplicate speech for identical active question:', cleanText.slice(0, 50));
      if (onFinished && !this.pendingFinishCallback) {
        this.pendingFinishCallback = onFinished;
      }
      return;
    }

    // Immediately stop any existing speech
    this.stopSpeaking();

    // 🛡️ FRESH QUESTION RESET: Cancel silence timers, clear previous answer transcripts,
    // and reset speech recognition so past candidate answers can never bleed into this turn!
    this.resetRecognition();

    const generation = ++this.audioGeneration;
    this.lastSpokenText = cleanText;
    this.currentSpeakingText = cleanText;
    this.speechStartTime = Date.now();
    this.pendingFinishCallback = onFinished;

    if (this.onSpeakingStateCallback) {
      this.onSpeakingStateCallback({ speaking: true, speaker: memberName });
    }

    let hasEnded = false;
    const finishCallback = () => {
      if (this.audioGeneration !== generation) return;
      if (hasEnded) return;
      hasEnded = true;
      const cb = this.pendingFinishCallback;
      this.pendingFinishCallback = null;
      this.currentSpeakingText = null;
      if (this.onSpeakingStateCallback) {
        this.onSpeakingStateCallback({ speaking: false, speaker: '' });
      }
      if (cb) {
        try {
          cb();
        } catch (err) {
          console.warn('Error in finishCallback:', err);
        }
      }
    };

    // 🚀 ZERO-LATENCY INSTANT SPEECH DELIVERY with DISTINCT PERSONA VOICES:
    this.speakWithWebSpeech(cleanText, memberName, gender, finishCallback, generation, memberDetails);
  }

  stopSpeaking() {
    this.audioGeneration++; // Invalidates in-flight promises immediately
    this.currentSpeakingText = null;
    this.pendingFinishCallback = null;

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    // 1. Stop and disconnect ALL active Web Audio buffer sources
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources.clear();
    this.currentSourceNode = null;

    // 2. Stop HTML5 Audio
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch (_) {}
      this.currentAudio = null;
    }

    // 3. Stop SpeechSynthesis
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    if (this.onSpeakingStateCallback) {
      this.onSpeakingStateCallback({ speaking: false, speaker: '' });
    }
  }

  /**
   * Resolves or assigns a distinct, unique persona voice profile for each panel member.
   * Every panel member is guaranteed a unique voice (or different pitch + rate),
   * ensuring that different interviewers never sound like the same person!
   */
  _getPersonaVoiceProfile(memberName, gender = 'Female', memberDetails = null) {
    if (!memberName) memberName = 'Interviewer';
    const key = memberName.trim().toLowerCase();

    // Return existing profile if already assigned to stay consistent throughout the interview
    if (this.assignedVoiceProfiles.has(key)) {
      const existing = this.assignedVoiceProfiles.get(key);
      if (existing && existing.voice) {
        return existing;
      }
    }

    const isFemale = (
      gender ||
      memberDetails?.gender ||
      memberDetails?.voiceGender ||
      ''
    ).toLowerCase() === 'female';

    const cleanMember = key;
    const voiceName = (memberDetails?.voiceName || memberDetails?.voice || '').toLowerCase();
    const tone = (memberDetails?.voiceTone || '').toLowerCase();
    const accent = (memberDetails?.voiceAccent || '').toLowerCase();
    const role = (memberDetails?.role || '').toLowerCase();

    // 1. Determine Distinct Persona Acoustic Signature (Pitch & Rate)
    let pitch = isFemale ? 1.10 : 0.96;
    let rate = 1.02;

    if (!isFemale) {
      if (
        voiceName.includes('alexander') ||
        cleanMember.includes('alexander') ||
        cleanMember.includes('raj') ||
        tone.includes('deep') ||
        tone.includes('measured') ||
        role.includes('architect')
      ) {
        // Deep, authoritative, contemplative architect / principal lead
        pitch = 0.82;
        rate = 0.95;
      } else if (
        voiceName.includes('marcus') ||
        cleanMember.includes('marcus') ||
        tone.includes('calm') ||
        tone.includes('technical') ||
        role.includes('manager')
      ) {
        // Calm, rich baritone, structured cadence
        pitch = 0.88;
        rate = 0.98;
      } else if (
        cleanMember.includes('amit') ||
        cleanMember.includes('vikram') ||
        cleanMember.includes('rohit') ||
        tone.includes('sharp') ||
        tone.includes('fast') ||
        tone.includes('inquisitive')
      ) {
        // Energetic, crisp, brisk senior tech lead
        pitch = 1.06;
        rate = 1.08;
      } else if (
        voiceName.includes('david') ||
        cleanMember.includes('david') ||
        cleanMember.includes('rahul') ||
        cleanMember.includes('arjun') ||
        tone.includes('methodical') ||
        tone.includes('precise')
      ) {
        // Precise, analytical, standard pitch
        pitch = 0.94;
        rate = 1.01;
      } else {
        const hash = cleanMember.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const variants = [
          { pitch: 0.84, rate: 0.95 },
          { pitch: 1.05, rate: 1.07 },
          { pitch: 0.91, rate: 1.01 },
          { pitch: 0.98, rate: 1.04 },
        ];
        const v = variants[hash % variants.length];
        pitch = v.pitch;
        rate = v.rate;
      }
    } else {
      if (
        voiceName.includes('elena') ||
        cleanMember.includes('elena') ||
        cleanMember.includes('sonia') ||
        cleanMember.includes('meera') ||
        tone.includes('warm') ||
        tone.includes('empathetic')
      ) {
        // Warm, rounded, empathetic cadence
        pitch = 1.15;
        rate = 0.97;
      } else if (
        voiceName.includes('priya') ||
        cleanMember.includes('priya') ||
        cleanMember.includes('ananya') ||
        cleanMember.includes('juhi') ||
        tone.includes('sharp') ||
        tone.includes('inquisitive')
      ) {
        // Bright, sharp, inquisitive cadence
        pitch = 1.26;
        rate = 1.04;
      } else if (
        voiceName.includes('sarah') ||
        cleanMember.includes('sarah') ||
        tone.includes('energetic') ||
        tone.includes('pragmatic') ||
        role.includes('director')
      ) {
        // Decisive, grounded, confident director
        pitch = 1.04;
        rate = 1.06;
      } else if (
        voiceName.includes('aria') ||
        cleanMember.includes('aria') ||
        cleanMember.includes('kavya') ||
        cleanMember.includes('neha') ||
        tone.includes('crisp') ||
        tone.includes('direct')
      ) {
        // Crisp, articulate, modern cadence
        pitch = 1.12;
        rate = 1.02;
      } else {
        const hash = cleanMember.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const variants = [
          { pitch: 1.16, rate: 0.98 },
          { pitch: 1.25, rate: 1.04 },
          { pitch: 1.05, rate: 1.06 },
          { pitch: 1.12, rate: 1.01 },
        ];
        const v = variants[hash % variants.length];
        pitch = v.pitch;
        rate = v.rate;
      }
    }

    // 2. Select Unique Browser Voice for this Panel Member
    let chosenVoice = null;
    if ('speechSynthesis' in window) {
      const allVoices = window.speechSynthesis.getVoices() || [];
      if (allVoices.length > 0) {
        const englishVoices = allVoices.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));
        const pool = englishVoices.length > 0 ? englishVoices : allVoices;

        const femaleKeywords = ['female', 'zira', 'samantha', 'aria', 'jenny', 'sonia', 'neerja', 'heera', 'karen', 'victoria', 'eva', 'hazel', 'libby', 'michelle', 'catherine'];
        const maleKeywords = ['male', 'david', 'guy', 'ryan', 'prabhat', 'ravi', 'george', 'daniel', 'alex', 'fred', 'mark', 'richard', 'steffan', 'christopher', 'eric', 'oliver'];

        const isVoiceFemale = (v) => {
          const name = (v.name || '').toLowerCase();
          return femaleKeywords.some((k) => name.includes(k));
        };

        const isVoiceMale = (v) => {
          const name = (v.name || '').toLowerCase();
          return maleKeywords.some((k) => name.includes(k)) && !isVoiceFemale(v);
        };

        const genderVoices = isFemale
          ? pool.filter(isVoiceFemale)
          : pool.filter(isVoiceMale);

        const candidateList = genderVoices.length > 0 ? genderVoices : pool;

        // Try to pick an unused voice first so different panel members get different voices
        const unusedCandidates = candidateList.filter(
          (v) => !this.usedVoiceURIs.has(v.voiceURI || v.name)
        );

        const searchPool = unusedCandidates.length > 0 ? unusedCandidates : candidateList;

        // Match British
        if (accent.includes('british') || cleanMember.includes('alexander') || cleanMember.includes('elena') || cleanMember.includes('sonia')) {
          chosenVoice = searchPool.find((v) => (v.lang || '').toLowerCase().includes('en-gb') || (v.lang || '').toLowerCase().includes('en_gb'));
        }
        // Match Indian
        if (!chosenVoice && (accent.includes('indian') || cleanMember.includes('priya') || cleanMember.includes('amit') || cleanMember.includes('raj') || cleanMember.includes('neha') || cleanMember.includes('rahul'))) {
          chosenVoice = searchPool.find((v) => (v.lang || '').toLowerCase().includes('en-in') || (v.lang || '').toLowerCase().includes('en_in'));
        }
        // Match voiceName from persona catalog
        if (!chosenVoice && voiceName) {
          chosenVoice = searchPool.find((v) => (v.name || '').toLowerCase().includes(voiceName));
        }
        // Match member name directly
        if (!chosenVoice) {
          chosenVoice = searchPool.find((v) => (v.name || '').toLowerCase().includes(cleanMember));
        }
        // Natural Online voices
        if (!chosenVoice) {
          chosenVoice = searchPool.find((v) => {
            const n = (v.name || '').toLowerCase();
            return n.includes('natural') || n.includes('online') || n.includes('google');
          });
        }
        // Unused candidate
        if (!chosenVoice && searchPool.length > 0) {
          chosenVoice = searchPool[0];
        }
        // Fallback candidate
        if (!chosenVoice && candidateList.length > 0) {
          chosenVoice = candidateList[0];
        }
        if (!chosenVoice && pool.length > 0) {
          chosenVoice = pool[0];
        }

        if (chosenVoice) {
          this.usedVoiceURIs.add(chosenVoice.voiceURI || chosenVoice.name);
        }
      }
    }

    const profile = { voice: chosenVoice, pitch, rate, memberName, gender: isFemale ? 'Female' : 'Male' };
    this.assignedVoiceProfiles.set(key, profile);
    console.info(`🎙️ [PersonaVoice] ${memberName} (${isFemale ? 'Female' : 'Male'}): Voice="${chosenVoice?.name || 'Default'}", Pitch=${pitch}, Rate=${rate}`);
    return profile;
  }

  speakWithWebSpeech(text, memberName, gender = 'Female', onFinished = null, generation = null, memberDetails = null) {
    if (generation !== null && this.audioGeneration !== generation) return;
    if (!('speechSynthesis' in window)) {
      if (onFinished) onFinished();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch (_) {}

    const profile = this._getPersonaVoiceProfile(memberName, gender, memberDetails);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;

    if (profile.voice) {
      utterance.voice = profile.voice;
    }

    // If voices were not loaded yet when profile was formed, reload on event
    if (!profile.voice && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.assignedVoiceProfiles.delete((memberName || '').trim().toLowerCase());
        const fresh = this._getPersonaVoiceProfile(memberName, gender, memberDetails);
        if (fresh.voice) {
          utterance.voice = fresh.voice;
        }
      };
    }

    let hasEnded = false;
    const finish = () => {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
      if (generation !== null && this.audioGeneration !== generation) return;
      if (hasEnded) return;
      hasEnded = true;
      if (this.onSpeakingStateCallback) {
        this.onSpeakingStateCallback({ speaking: false, speaker: memberName });
      }
      if (onFinished) onFinished();
    };

    utterance.onstart = () => {
      if (generation !== null && this.audioGeneration !== generation) return;
      this.speechStartTime = Date.now();
      if (this.onSpeakingStateCallback) {
        this.onSpeakingStateCallback({ speaking: true, speaker: memberName });
      }
    };

    utterance.onend = finish;
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis event warning:', e);
      finish();
    };

    // Chrome 15s pause bug heartbeat keeper
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    this.keepAliveInterval = setInterval(() => {
      if (!('speechSynthesis' in window) || !window.speechSynthesis.speaking) {
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
      } else {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    // Speak immediately with zero latency!
    window.speechSynthesis.speak(utterance);
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (this.localAudioTrack) {
      this.localAudioTrack.setEnabled(!muted).catch(() => {});
    }
    if (muted) {
      this.cancelSilenceTimer();
      this._destroyRecognition();
    } else {
      if (this.isListeningActive) {
        this._createRecognition();
      }
    }
  }

  async leaveChannel() {
    this.stopListening();
    this.stopSpeaking();
    this.assignedVoiceProfiles.clear();
    this.usedVoiceURIs.clear();
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch (_) {}
      this.micSourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    if (this.client) {
      try {
        await this.client.leave();
      } catch (_) {}
      this.client = null;
    }
    this.isConnected = false;
  }
}
