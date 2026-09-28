/** Browser microphone + ElevenLabs audio client. Provider calls stay server-side. */
export class ElevenLabsVoiceService {
  constructor() {
    this.audioContext = null; this.stream = null; this.processor = null; this.socket = null;
    this.currentAudio = null; this.listening = false; this.muted = false; this.speaking = false;
    this.onTranscriptCallback = null; this.onSpeakingStateCallback = null; this.onBargeInCallback = null;
    this.onVolumeLevelCallback = null; this.onSpeechDetectedCallback = null; this.onSilenceTimeoutCallback = null;
    this.onSilenceCountdownCallback = null; this.partialAt = 0; this.silenceTimer = null;
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
    this.socket.onmessage = ({ data }) => this._sttEvent(JSON.parse(data));
  }
  _capture() {
    const context = this._context(); const source = context.createMediaStreamSource(this.stream);
    this.processor = context.createScriptProcessor(2048, 1, 1);
    this.processor.onaudioprocess = ({ inputBuffer }) => {
      if (this.muted) return;
      const input = inputBuffer.getChannelData(0); let energy = 0; const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) { energy += input[i] * input[i]; pcm[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff; }
      this.onVolumeLevelCallback?.(Math.min(100, Math.round(Math.sqrt(energy / input.length) * 250)));
      if (this.listening && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'audio', audio: this._base64(pcm.buffer) }));
    };
    source.connect(this.processor); this.processor.connect(context.destination);
  }
  _base64(buffer) { let s = ''; for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b); return btoa(s); }
  _sttEvent(event) {
    if (event.type === 'partial' && event.text?.trim()) {
      this.partialAt = Date.now(); this.onTranscriptCallback?.(event.text); this.onSpeechDetectedCallback?.();
      if (this.speaking) { this.stopSpeaking(); this.onBargeInCallback?.(); }
      clearTimeout(this.silenceTimer); this.silenceTimer = setTimeout(() => this.socket?.readyState === WebSocket.OPEN && this.socket.send(JSON.stringify({ type: 'commit' })), 2000);
    } else if (event.type === 'final') { clearTimeout(this.silenceTimer); const text = event.text?.trim(); if (text) this.onSilenceTimeoutCallback?.(text); }
  }
  startListening(callback) { if (callback) this.onTranscriptCallback = callback; this.listening = true; }
  stopListening() { this.listening = false; clearTimeout(this.silenceTimer); }
  resetRecognition() { clearTimeout(this.silenceTimer); }
  setMuted(value) { this.muted = value; this.stream?.getAudioTracks().forEach(track => { track.enabled = !value; }); }
  isInterviewerSpeaking() { return this.speaking; }
  async speakPersonaMessage(text, speaker, gender, done, allowReplay, memberDetails) {
    if (!text) return; this.stopSpeaking(); this.speaking = true; this.onSpeakingStateCallback?.({ speaking: true, speaker });
    try {
      const params = new URLSearchParams({ text, speaker: speaker || '', gender: gender || '', interview_id: this.interviewId || '' });
      const response = await fetch(`/api/interviews/${this.interviewId}/tts?${params}`); if (!response.ok) throw new Error('TTS request failed');
      const url = URL.createObjectURL(await response.blob()); const audio = new Audio(url); this.currentAudio = audio;
      audio.onended = () => { URL.revokeObjectURL(url); this.speaking = false; this.currentAudio = null; this.onSpeakingStateCallback?.({ speaking: false, speaker }); done?.(); };
      await audio.play();
    } catch (error) { console.warn('ElevenLabs TTS failed', error); this.speaking = false; this.onSpeakingStateCallback?.({ speaking: false, speaker }); done?.(); }
  }
  stopSpeaking() { if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio = null; } this.speaking = false; }
  leaveChannel() { this.stopListening(); this.stopSpeaking(); this.socket?.close(); this.processor?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); }
}
