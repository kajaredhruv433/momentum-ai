/** Browser microphone + ElevenLabs audio client. Provider calls stay server-side. */
export class ElevenLabsVoiceService {
  constructor() {
    this.audioContext = null; this.stream = null; this.processor = null; this.socket = null;
    this.currentAudio = null; this.listening = false; this.muted = false; this.speaking = false;
    this.onTranscriptCallback = null; this.onSpeakingStateCallback = null; this.onBargeInCallback = null;
    this.onVolumeLevelCallback = null; this.onSpeechDetectedCallback = null; this.onSilenceTimeoutCallback = null;
    this.onStatusCallback = null;
    this.onSilenceCountdownCallback = null; this.partialAt = 0; this.silenceTimer = null;
    this.lastSpokenKey = ''; this.lastSpokenAt = 0;
  }
  unlockAudio() { this._context(); }
  _context() { if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); if (this.audioContext.state === 'suspended') this.audioContext.resume(); return this.audioContext; }
  async requestMicrophonePermission(interviewId) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.interviewId = interviewId; this._connectStt(); this._capture(); return { granted: true, status: 'Connected' };
    } catch (_) { return { granted: false, status: 'Microphone unavailable' }; }
  }
  _connectStt() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://${location.host}/api/interviews/${this.interviewId}/stt`);
    this.socket.onopen = () => this.onStatusCallback?.('Connected');
    this.socket.onerror = () => this.onStatusCallback?.('Speech recognition unavailable');
    this.socket.onclose = () => {
      if (this.listening) this.onStatusCallback?.('Speech recognition disconnected');
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
      this.onVolumeLevelCallback?.(Math.min(100, Math.round(Math.sqrt(energy / input.length) * 250)));
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
  _sttEvent(event) {
    if (event.type === 'partial' && event.text?.trim()) {
      this.partialAt = Date.now(); this.onTranscriptCallback?.(event.text); this.onSpeechDetectedCallback?.();
      if (this.speaking) { this.stopSpeaking(); this.onBargeInCallback?.(); }
      // A recognized transcript is proof that the candidate has taken the
      // floor, including when they began speaking during interviewer TTS.
      this.listening = true;
      clearTimeout(this.silenceTimer); this.silenceTimer = setTimeout(() => this.socket?.readyState === WebSocket.OPEN && this.socket.send(JSON.stringify({ type: 'commit' })), 2000);
    } else if (event.type === 'final') { clearTimeout(this.silenceTimer); const text = event.text?.trim(); if (text) this.onSilenceTimeoutCallback?.(text); }
    else if (event.type === 'error') { console.warn('[STT] Server error:', event.message); this.onStatusCallback?.(`Speech recognition error: ${event.message || 'unknown error'}`); }
  }
  startListening(callback) { if (callback) this.onTranscriptCallback = callback; this.listening = true; }
  stopListening() { this.listening = false; clearTimeout(this.silenceTimer); }
  resetRecognition() { clearTimeout(this.silenceTimer); }
  setMuted(value) { this.muted = value; this.stream?.getAudioTracks().forEach(track => { track.enabled = !value; }); }
  isInterviewerSpeaking() { return this.speaking; }
  async speakPersonaMessage(text, speaker, gender, done, allowReplay, memberDetails) {
    if (!text) return;
    const spokenKey = `${speaker || ''}|${text}`;
    const now = Date.now();
    if (spokenKey === this.lastSpokenKey && now - this.lastSpokenAt < 2000) return;
    this.lastSpokenKey = spokenKey; this.lastSpokenAt = now;
    this.stopSpeaking(); this.speaking = true; this.onSpeakingStateCallback?.({ speaking: true, speaker });
    try {
      const params = new URLSearchParams({ text, speaker: speaker || '', gender: gender || '', interview_id: this.interviewId || '' });
      const response = await fetch(`/api/interviews/${this.interviewId}/tts?${params}`);
      if (!response.ok) throw new Error(`TTS request failed (${response.status})`);
      const audioBytes = await response.arrayBuffer();
      if (!audioBytes.byteLength) throw new Error('TTS returned an empty audio file');

      // The start button unlocks this AudioContext before the slower interview
      // API calls. Playing a fetched HTMLAudioElement later can be blocked by
      // browser autoplay rules once that original click activation has expired.
      const context = this._context();
      if (context.state === 'suspended') await context.resume();
      const audioBuffer = await context.decodeAudioData(audioBytes);
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
      console.error('ElevenLabs speech playback failed', error);
      this.speaking = false;
      this.currentAudio = null;
      this.onSpeakingStateCallback?.({ speaking: false, speaker });
      this.onStatusCallback?.('Speech playback failed. Use Replay question to try again.');
    }
  }
  stopSpeaking() {
    if (this.currentAudio) {
      try { this.currentAudio.stop(); } catch (_) {}
      this.currentAudio = null;
    }
    this.speaking = false;
  }
  leaveChannel() { this.stopListening(); this.stopSpeaking(); this.socket?.close(); this.processor?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); }
}
