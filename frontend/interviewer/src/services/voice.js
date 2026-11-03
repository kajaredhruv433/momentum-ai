/** Browser microphone + ElevenLabs audio client. Provider calls stay server-side. */
export class ElevenLabsVoiceService {
  constructor() {
    this.audioContext = null; this.stream = null; this.processor = null; this.socket = null;
    this.currentAudio = null; this.listening = false; this.muted = false; this.speaking = false;
    this.onTranscriptCallback = null; this.onSpeakingStateCallback = null; this.onBargeInCallback = null;
    this.onVolumeLevelCallback = null; this.onSpeechDetectedCallback = null; this.onSilenceTimeoutCallback = null;
    this.onStatusCallback = null;
    this.onSilenceCountdownCallback = null; this.partialAt = 0; this.silenceTimer = null;
    this.speechStarted = false; this.lastVoiceActivityAt = 0; this.commitRequested = false;
    this.lastSpokenKey = ''; this.lastSpokenAt = 0;
    this.speechRequestId = 0; this.speechAbortController = null;
    this.sttRetryTimer = null; this.sttRetryDelay = 1000; this.closed = false; this.sttTerminal = false;
  }
  unlockAudio() { this._context(); }
  _context() { if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); if (this.audioContext.state === 'suspended') this.audioContext.resume(); return this.audioContext; }
  async requestMicrophonePermission(interviewId) {
    try {
      this.closed = false;
      this.sttTerminal = false;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.interviewId = interviewId; this._connectStt(); this._capture(); return { granted: true, status: 'Connecting to speech recognition…' };
    } catch (_) { return { granted: false, status: 'Microphone unavailable' }; }
  }
  _connectStt() {
    if (this.closed || this.muted || !this.interviewId || [WebSocket.CONNECTING, WebSocket.OPEN].includes(this.socket?.readyState)) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://${location.host}/api/interviews/${this.interviewId}/stt`);
    const socket = this.socket;
    socket.onopen = () => { this.sttRetryDelay = 1000; this.onStatusCallback?.('Connected'); };
    socket.onerror = () => this.onStatusCallback?.('Speech recognition unavailable; reconnecting');
    socket.onclose = () => {
      if (socket !== this.socket || this.closed || this.sttTerminal) return;
      if (this.listening && !this.muted) this.onStatusCallback?.('Reconnecting to speech recognition…');
      clearTimeout(this.sttRetryTimer);
      this.sttRetryTimer = setTimeout(() => this._connectStt(), this.sttRetryDelay);
      this.sttRetryDelay = Math.min(this.sttRetryDelay * 2, 15000);
    };
    this.socket.onmessage = ({ data }) => {
      try { this._sttEvent(JSON.parse(data)); }
      catch (error) { console.warn('[STT] Invalid server message', error); }
    };
  }
  _capture() {
    const context = this._context(); const source = context.createMediaStreamSource(this.stream);
    this.processor = context.createScriptProcessor(2048, 1, 1);
    this.processor.onaudioprocess = ({ inputBuffer }) => {
      if (this.muted) return;
      const input = inputBuffer.getChannelData(0); let energy = 0;
      for (let i = 0; i < input.length; i++) energy += input[i] * input[i];
      const rms = Math.sqrt(energy / input.length);
      this.onVolumeLevelCallback?.(Math.min(100, Math.round(rms * 250)));
      // Use microphone activity as well as transcript updates. Realtime STT
      // may pause partial results while the candidate is still speaking.
      if (this.listening && !this.speaking && !this.muted && rms >= 0.018) this._noteVoiceActivity();
      // Keep streaming microphone frames while TTS is playing as well. This
      // is required for barge-in; only an actual STT transcript may interrupt.
      if (this.socket?.readyState === WebSocket.OPEN) {
        // ElevenLabs expects PCM16 at 16 kHz. Browser devices commonly run at
        // 44.1/48 kHz, so resample before encoding instead of relabeling audio.
        const pcm = this._resampleTo16k(input, context.sampleRate);
        this.socket.send(JSON.stringify({ type: 'audio', audio: this._base64(pcm.buffer) }));
      }
    };
    source.connect(this.processor); this.processor.connect(context.destination);
  }
  _base64(buffer) { let s = ''; for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b); return btoa(s); }
  _resampleTo16k(input, sourceRate) {
    if (sourceRate === 16000) {
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
      return pcm;
    }
    const outputLength = Math.max(1, Math.round(input.length * 16000 / sourceRate));
    const pcm = new Int16Array(outputLength);
    const ratio = sourceRate / 16000;
    for (let i = 0; i < outputLength; i++) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(left + 1, input.length - 1);
      const fraction = position - left;
      const sample = input[left] * (1 - fraction) + input[right] * fraction;
      pcm[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }
    return pcm;
  }
  _noteVoiceActivity() {
    this.speechStarted = true;
    this.lastVoiceActivityAt = Date.now();
    if (this.commitRequested) return;
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      const silenceMs = Date.now() - this.lastVoiceActivityAt;
      if (silenceMs < 3000) {
        this.silenceTimer = setTimeout(() => this._commitAfterSilence(), 3000 - silenceMs);
        return;
      }
      this._commitAfterSilence();
    }, 3000);
  }
  _commitAfterSilence() {
    if (!this.speechStarted || this.commitRequested || this.muted || !this.listening) return;
    const silenceMs = Date.now() - this.lastVoiceActivityAt;
    if (silenceMs < 3000) {
      this.silenceTimer = setTimeout(() => this._commitAfterSilence(), 3000 - silenceMs);
      return;
    }
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.commitRequested = true;
      this.socket.send(JSON.stringify({ type: 'commit' }));
    }
  }
  _sttEvent(event) {
    if (event.type === 'partial' && event.text?.trim()) {
      this.partialAt = Date.now(); this._noteVoiceActivity(); this.onTranscriptCallback?.(event.text); this.onSpeechDetectedCallback?.();
      if (this.speaking) { this.stopSpeaking(); this.onBargeInCallback?.(); }
      // A recognized transcript is proof that the candidate has taken the
      // floor, including when they began speaking during interviewer TTS.
      this.listening = true;
      // The final transcript event follows a commit after three seconds with
      // no detected microphone activity, not merely a pause in STT partials.
    } else if (event.type === 'final') {
      clearTimeout(this.silenceTimer);
      this.speechStarted = false; this.lastVoiceActivityAt = 0; this.commitRequested = false;
      const text = event.text?.trim(); if (text) this.onSilenceTimeoutCallback?.(text);
    }
    else if (event.type === 'error') {
      console.warn('[STT] Server error:', event.message);
      if (event.terminal) this.sttTerminal = true;
      this.onStatusCallback?.(event.message ? `Speech recognition error: ${event.message}` : 'Speech recognition error');
    }
  }
  startListening(callback) { if (callback) this.onTranscriptCallback = callback; this.listening = true; }
  stopListening() { this.listening = false; clearTimeout(this.silenceTimer); this.speechStarted = false; this.commitRequested = false; }
  resetRecognition() { clearTimeout(this.silenceTimer); this.speechStarted = false; this.commitRequested = false; }
  setMuted(value) {
    const wasMuted = this.muted;
    this.muted = value;
    this.stream?.getAudioTracks().forEach(track => { track.enabled = !value; });
    if (value && !wasMuted && this.socket) {
      // Coding tasks do not use STT. Close this session intentionally so an
      // idle provider timeout cannot surface as a recognition error.
      const socket = this.socket;
      this.socket = null;
      clearTimeout(this.sttRetryTimer);
      socket.close(1000, 'Microphone paused');
      this.onStatusCallback?.('Voice input paused');
    } else if (!value && wasMuted) {
      this.onStatusCallback?.('Connecting to speech recognition…');
      this.sttRetryDelay = 1000;
      this._connectStt();
    }
  }
  isInterviewerSpeaking() { return this.speaking; }
  async speakPersonaMessage(text, speaker, gender, done, allowReplay, memberDetails) {
    if (!text) return;
    const spokenKey = `${speaker || ''}|${text}`;
    const now = Date.now();
    if (spokenKey === this.lastSpokenKey && now - this.lastSpokenAt < 2000) return;
    this.lastSpokenKey = spokenKey; this.lastSpokenAt = now;
    this.stopSpeaking();
    const requestId = ++this.speechRequestId;
    const abortController = new AbortController();
    this.speechAbortController = abortController;
    this.speaking = true; this.onSpeakingStateCallback?.({ speaking: true, speaker });
    try {
      const params = new URLSearchParams({ text, speaker: speaker || '', gender: gender || '', interview_id: this.interviewId || '' });
      const response = await fetch(`/api/interviews/${this.interviewId}/tts?${params}`, { signal: abortController.signal });
      if (requestId !== this.speechRequestId) return;
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `TTS request failed (${response.status})`);
      }
      const audioBytes = await response.arrayBuffer();
      if (requestId !== this.speechRequestId) return;
      if (!audioBytes.byteLength) throw new Error('TTS returned an empty audio file');

      // The start button unlocks this AudioContext before the slower interview
      // API calls. Playing a fetched HTMLAudioElement later can be blocked by
      // browser autoplay rules once that original click activation has expired.
      const context = this._context();
      if (context.state === 'suspended') await context.resume();
      const audioBuffer = await context.decodeAudioData(audioBytes);
      if (requestId !== this.speechRequestId) return;
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      this.currentAudio = source;
      source.onended = () => {
        if (this.currentAudio !== source) return;
        this.speaking = false;
        this.currentAudio = null;
        this.onSpeakingStateCallback?.({ speaking: false, speaker });
        done?.();
      };
      source.start();
    } catch (error) {
      if (requestId !== this.speechRequestId || error.name === 'AbortError') return;
      console.error('ElevenLabs speech playback failed', error);
      this.speaking = false;
      this.currentAudio = null;
      this.onSpeakingStateCallback?.({ speaking: false, speaker });
      this.onStatusCallback?.(error.message || 'Speech playback failed. Use Replay question to try again.');
    }
  }
  stopSpeaking() {
    this.speechRequestId++;
    this.speechAbortController?.abort();
    this.speechAbortController = null;
    if (this.currentAudio) {
      try { this.currentAudio.stop(); } catch (_) {}
      this.currentAudio = null;
    }
    this.speaking = false;
  }
  leaveChannel() { this.closed = true; clearTimeout(this.sttRetryTimer); this.stopListening(); this.stopSpeaking(); this.socket?.close(); this.processor?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); }
}
