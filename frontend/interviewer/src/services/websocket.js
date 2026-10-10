/**
 * websocket.js
 *
 * Manages the live WebSocket connection for real-time interview events.
 */

export class InterviewWebSocket {
  constructor(interviewId) {
    this.interviewId = interviewId;
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.isClosedManually = false;
  }

  connect() {
    if (!this.interviewId) return;

    this.isClosedManually = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/interviews/${this.interviewId}/events`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this._startPing();
        this._dispatch('ws_connected', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'pong') return;
          this._dispatch(payload.event, payload.data || {});
          this._dispatch('*', payload);
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        this._stopPing();
        this._dispatch('ws_disconnected', { connected: false });
        if (!this.isClosedManually) {
          this.reconnectTimer = setTimeout(() => this.connect(), 2500);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket encountered error:', err);
        this._dispatch('ws_error', { error: err });
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
    return () => this.off(eventName, callback);
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
  }

  _dispatch(eventName, data) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in WebSocket listener for ${eventName}:`, e);
        }
      });
    }
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 25000);
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  disconnect() {
    this.isClosedManually = true;
    this._stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
