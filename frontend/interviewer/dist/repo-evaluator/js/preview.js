/**
 * Live Preview Sandbox Engine for Web Projects
 * Bundles HTML, CSS, and JS from VFS, injects console capture,
 * and renders inside an isolated iframe.
 */
class LivePreviewManager {
  constructor() {
    this.iframe = null;
    this.container = null;
    this.urlDisplay = null;
    this.deviceMode = 'desktop'; // desktop, tablet, mobile
    this.autoReload = true;
    this.activeBlobUrl = null;
  }

  init(containerEl) {
    this.container = containerEl;
    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="preview-header">
        <div class="preview-nav-controls">
          <button class="preview-btn" id="preview-refresh-btn" title="Reload (Ctrl+R)">
            <span class="codicon codicon-refresh"></span>
          </button>
        </div>
        <div class="preview-address-bar">
          <span class="codicon codicon-lock address-lock"></span>
          <span id="preview-url-text">http://localhost:5500/index.html</span>
        </div>
        <div class="preview-actions">
          <div class="preview-device-toggle">
            <button class="preview-btn active" data-device="desktop" title="Desktop View">
              <span class="codicon codicon-browser"></span>
            </button>
            <button class="preview-btn" data-device="tablet" title="Tablet View (768px)">
              <span class="codicon codicon-device-tablet"></span>
            </button>
            <button class="preview-btn" data-device="mobile" title="Mobile View (375px)">
              <span class="codicon codicon-device-mobile"></span>
            </button>
          </div>
          <button class="preview-btn" id="preview-popout-btn" title="Open Preview in New Window">
            <span class="codicon codicon-link-external"></span>
          </button>
        </div>
      </div>
      <div class="preview-viewport-wrapper">
        <div class="preview-viewport desktop" id="preview-viewport">
          <iframe id="preview-frame" sandbox="allow-scripts allow-modals allow-same-origin allow-forms"></iframe>
        </div>
      </div>
    `;

    this.iframe = document.getElementById('preview-frame');
    this.urlDisplay = document.getElementById('preview-url-text');
  }

  attachEvents() {
    const refreshBtn = document.getElementById('preview-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.runActiveProject());

    const popoutBtn = document.getElementById('preview-popout-btn');
    if (popoutBtn) popoutBtn.addEventListener('click', () => this.openPopout());

    const deviceBtns = this.container.querySelectorAll('.preview-device-toggle .preview-btn');
    deviceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        deviceBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const device = btn.dataset.device;
        const viewport = document.getElementById('preview-viewport');
        viewport.className = `preview-viewport ${device}`;
      });
    });

    // Listen for window messages from iframe console capture
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'momentum-preview-console') {
        const { level, args } = e.data;
        const msg = args.join(' ');
        if (window.terminal) {
          if (level === 'error') {
            window.terminal.log(`\x1b[31m[Browser Error]\x1b[0m ${msg}`, 'term-text-error');
          } else if (level === 'warn') {
            window.terminal.log(`\x1b[33m[Browser Warn]\x1b[0m ${msg}`, 'term-text-yellow');
          } else {
            window.terminal.log(`\x1b[36m[Browser Console]\x1b[0m ${msg}`);
          }
        }
      }
    });

    // Auto update preview on save
    window.vfs.subscribe((event) => {
      if (this.autoReload && (event === 'file-changed' || event === 'project-loaded')) {
        // Debounce reload
        clearTimeout(this._reloadTimeout);
        this._reloadTimeout = setTimeout(() => {
          this.runActiveProject(false);
        }, 500);
      }
    });
  }

  buildBundle() {
    const files = window.vfs.files;
    let htmlPath = 'index.html';
    if (!files[htmlPath]) {
      const candidates = Object.keys(files).filter(k => k.endsWith('.html'));
      if (candidates.length > 0) {
        htmlPath = candidates[0];
      } else {
        return `
          <!DOCTYPE html>
          <html>
          <body style="background:#1e1e1e;color:#858585;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:90vh;">
            <div style="text-align:center;">
              <h2>No HTML File Found</h2>
              <p>Create or select an <code>index.html</code> file to preview web projects.</p>
            </div>
          </body>
          </html>
        `;
      }
    }

    let html = files[htmlPath] || '';

    // Script to inject for capturing console and errors
    const injectConsoleProxy = `
      <script>
        (function() {
          function sendLog(level, args) {
            try {
              window.parent.postMessage({
                type: 'momentum-preview-console',
                level: level,
                args: Array.from(args).map(a => {
                  try {
                    return typeof a === 'object' ? JSON.stringify(a) : String(a);
                  } catch(e) { return String(a); }
                })
              }, '*');
            } catch(e) {}
          }
          var origLog = console.log;
          var origWarn = console.warn;
          var origError = console.error;
          console.log = function() { sendLog('log', arguments); origLog.apply(console, arguments); };
          console.warn = function() { sendLog('warn', arguments); origWarn.apply(console, arguments); };
          console.error = function() { sendLog('error', arguments); origError.apply(console, arguments); };
          window.onerror = function(msg, url, line) {
            sendLog('error', ['Error on line ' + line + ': ' + msg]);
          };
        })();
      </script>
    `;

    // Inline CSS links: <link rel="stylesheet" href="style.css">
    html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
      const cleanHref = href.replace(/^\.?\//, '');
      if (files[cleanHref]) {
        return `<style data-href="${href}">\n${files[cleanHref]}\n</style>`;
      }
      return match;
    });

    // Inline JS scripts: <script src="game.js"></script>
    html = html.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
      const cleanSrc = src.replace(/^\.?\//, '');
      if (files[cleanSrc]) {
        return `<script data-src="${src}">\n${files[cleanSrc]}\n</script>`;
      }
      return match;
    });

    // Insert console proxy in <head>
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>\n' + injectConsoleProxy);
    } else {
      html = injectConsoleProxy + html;
    }

    return html;
  }

  runActiveProject(logToTerm = true) {
    if (!this.iframe) return;
    const bundledHtml = this.buildBundle();

    // Revoke previous blob url
    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
    }

    const blob = new Blob([bundledHtml], { type: 'text/html' });
    this.activeBlobUrl = URL.createObjectURL(blob);
    this.iframe.src = this.activeBlobUrl;

    if (this.urlDisplay) {
      this.urlDisplay.textContent = `http://localhost:5500/${window.vfs.projectName}/index.html`;
    }

    if (logToTerm && window.terminal) {
      window.terminal.logSystem(`Compiled and rendered project at http://localhost:5500/`);
    }
  }

  openPopout() {
    const bundledHtml = this.buildBundle();
    const blob = new Blob([bundledHtml], { type: 'text/html' });
    const popoutUrl = URL.createObjectURL(blob);
    window.open(popoutUrl, '_blank');
  }
}

window.previewManager = new LivePreviewManager();
