/**
 * Monaco Editor & Tab Management Controller
 */
class EditorManager {
  constructor() {
    this.editor = null;
    this.models = new Map(); // path -> monaco.editor.ITextModel
    this.openTabs = []; // Array of file paths
    this.activeTab = null; // Current active file path
    this.viewStates = new Map(); // path -> editor view state (scroll/cursor)
    this.dirtyFiles = new Set(); // set of paths that have unsaved edits

    this.tabsContainer = null;
    this.breadcrumbsContainer = null;
    this.statusLnCol = null;
    this.statusLang = null;
  }

  async init(containerEl) {
    this.tabsContainer = document.getElementById('editor-tabs');
    this.breadcrumbsContainer = document.getElementById('breadcrumbs');
    this.statusLnCol = document.getElementById('status-cursor');
    this.statusLang = document.getElementById('status-language');

    return new Promise((resolve) => {
      // Configure Monaco loader
      require.config({
        paths: {
          vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
        }
      });

      require(['vs/editor/editor.main'], () => {
        // Register custom themes
        this.registerThemes();

        // Create the Monaco editor instance
        this.editor = monaco.editor.create(containerEl, {
          theme: 'vs-dark-plus',
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          minimap: { enabled: true, renderCharacters: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'off',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true }
        });

        // Listen for cursor position changes
        this.editor.onDidChangeCursorPosition((e) => {
          if (this.statusLnCol) {
            this.statusLnCol.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
          }
        });

        // Listen for model content changes (track dirty state)
        this.editor.onDidChangeModelContent(() => {
          if (this.activeTab) {
            this.markDirty(this.activeTab, true);
          }
        });

        // Save keyboard shortcut (Ctrl+S / Cmd+S)
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          this.saveActiveFile();
        });

        // Close tab keyboard shortcut (Ctrl+W / Cmd+W - when in editor)
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
          if (this.activeTab) this.closeTab(this.activeTab);
        });

        // Listen to VFS events
        window.vfs.subscribe((event, data) => {
          if (event === 'project-loaded') {
            this.handleProjectReload();
          } else if (event === 'item-deleted') {
            this.handleItemDeleted(data.path);
          } else if (event === 'item-renamed') {
            this.handleItemRenamed(data.oldPath, data.newPath);
          }
        });

        resolve(this.editor);
      });
    });
  }

  registerThemes() {
    monaco.editor.defineTheme('vs-dark-plus', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' }
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorCursor.foreground': '#aeafad',
        'editor.lineHighlightBackground': '#2a2d2e',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6'
      }
    });

    monaco.editor.defineTheme('monokai', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '75715e' },
        { token: 'keyword', foreground: 'f92672' },
        { token: 'string', foreground: 'e6db74' },
        { token: 'number', foreground: 'ae81ff' },
        { token: 'function', foreground: 'a6e22e' },
        { token: 'type', foreground: '66d9ef' }
      ],
      colors: {
        'editor.background': '#272822',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#3e3d32'
      }
    });

    monaco.editor.defineTheme('github-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#c9d1d9',
        'editor.lineHighlightBackground': '#161b22'
      }
    });
  }

  setTheme(themeName) {
    if (this.editor) {
      monaco.editor.setTheme(themeName);
    }
  }

  getLanguageForFile(path) {
    const ext = path.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      html: 'html',
      htm: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      py: 'python',
      md: 'markdown',
      markdown: 'markdown',
      sh: 'shell',
      bash: 'shell',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      sql: 'sql'
    };
    return map[ext] || 'plaintext';
  }

  getFileIcon(path) {
    const ext = path.split('.').pop().toLowerCase();
    const map = {
      js: 'codicon-symbol-variable color-js',
      ts: 'codicon-symbol-class color-ts',
      html: 'codicon-code color-html',
      css: 'codicon-symbol-color color-css',
      json: 'codicon-json color-json',
      py: 'codicon-symbol-method color-py',
      md: 'codicon-markdown color-md'
    };
    return map[ext] || 'codicon-file';
  }

  openFile(path) {
    if (!window.vfs.exists(path)) return;

    // Save current active view state
    if (this.activeTab && this.editor) {
      this.viewStates.set(this.activeTab, this.editor.saveViewState());
    }

    // Check if model already exists
    let model = this.models.get(path);
    if (!model) {
      const content = window.vfs.readFile(path);
      const language = this.getLanguageForFile(path);
      const uri = monaco.Uri.parse(`inmemory://momentum/${path}`);
      model = monaco.editor.createModel(content, language, uri);
      this.models.set(path, model);
    }

    if (!this.openTabs.includes(path)) {
      this.openTabs.push(path);
    }
    this.activeTab = path;

    // Set model in editor
    this.editor.setModel(model);

    // Restore previous view state if saved
    if (this.viewStates.has(path)) {
      this.editor.restoreViewState(this.viewStates.get(path));
    }
    this.editor.focus();

    // Update status indicators
    const lang = this.getLanguageForFile(path);
    if (this.statusLang) {
      this.statusLang.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
    }

    this.renderTabs();
    this.renderBreadcrumbs();
  }

  saveActiveFile() {
    if (!this.activeTab) return;
    const content = this.editor.getValue();
    window.vfs.writeFile(this.activeTab, content);
    this.markDirty(this.activeTab, false);
    this.renderTabs();
    // Show quick feedback in terminal or toast
    if (window.terminal) {
      window.terminal.logSystem(`Saved: ${this.activeTab}`);
    }
  }

  markDirty(path, isDirty) {
    if (isDirty) {
      this.dirtyFiles.add(path);
    } else {
      this.dirtyFiles.delete(path);
    }
    this.renderTabs();
  }

  closeTab(path, event) {
    if (event) event.stopPropagation();

    const idx = this.openTabs.indexOf(path);
    if (idx === -1) return;

    this.openTabs.splice(idx, 1);
    this.dirtyFiles.delete(path);
    this.viewStates.delete(path);

    if (this.activeTab === path) {
      if (this.openTabs.length > 0) {
        const nextIdx = Math.max(0, idx - 1);
        this.openFile(this.openTabs[nextIdx]);
      } else {
        this.activeTab = null;
        this.editor.setModel(null);
        if (this.statusLang) this.statusLang.textContent = 'Plain Text';
        this.renderTabs();
        this.renderBreadcrumbs();
      }
    } else {
      this.renderTabs();
    }
  }

  closeOtherTabs(path) {
    this.openTabs = [path];
    this.openFile(path);
  }

  closeAllTabs() {
    this.openTabs = [];
    this.activeTab = null;
    if (this.editor) this.editor.setModel(null);
    this.renderTabs();
    this.renderBreadcrumbs();
  }

  handleProjectReload() {
    this.openTabs = [];
    this.activeTab = null;
    this.dirtyFiles.clear();
    this.viewStates.clear();
    // Dispose old models
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();

    // Auto open the primary file (index.html, main.py, or first file)
    const paths = window.vfs.getAllPaths();
    const primary = paths.find(p => p === 'index.html' || p === 'main.py' || p.endsWith('index.html')) || paths[0];
    if (primary) {
      this.openFile(primary);
    } else {
      this.renderTabs();
      this.renderBreadcrumbs();
    }
  }

  handleItemDeleted(path) {
    // If deleted item is open tab or inside deleted folder
    const tabsToClose = this.openTabs.filter(t => t === path || t.startsWith(path + '/'));
    tabsToClose.forEach(t => this.closeTab(t));
    if (this.models.has(path)) {
      this.models.get(path).dispose();
      this.models.delete(path);
    }
  }

  handleItemRenamed(oldPath, newPath) {
    const idx = this.openTabs.indexOf(oldPath);
    if (idx !== -1) {
      this.openTabs[idx] = newPath;
      if (this.activeTab === oldPath) {
        this.activeTab = newPath;
      }
    }
    if (this.models.has(oldPath)) {
      const model = this.models.get(oldPath);
      this.models.delete(oldPath);
      this.models.set(newPath, model);
    }
    this.renderTabs();
    this.renderBreadcrumbs();
  }

  renderTabs() {
    if (!this.tabsContainer) return;
    this.tabsContainer.innerHTML = '';

    this.openTabs.forEach(path => {
      const tabEl = document.createElement('div');
      tabEl.className = 'editor-tab' + (path === this.activeTab ? ' active' : '');
      const isDirty = this.dirtyFiles.has(path);
      const fileName = path.split('/').pop();
      const iconClass = this.getFileIcon(path);

      tabEl.innerHTML = `
        <span class="codicon ${iconClass} tab-icon"></span>
        <span class="tab-title" title="${path}">${fileName}</span>
        <span class="tab-close-btn codicon ${isDirty ? 'codicon-circle-filled dirty' : 'codicon-close'}" title="Close"></span>
      `;

      tabEl.addEventListener('click', () => this.openFile(path));

      // Middle click to close tab
      tabEl.addEventListener('auxclick', (e) => {
        if (e.button === 1) this.closeTab(path, e);
      });

      const closeBtn = tabEl.querySelector('.tab-close-btn');
      closeBtn.addEventListener('click', (e) => this.closeTab(path, e));

      this.tabsContainer.appendChild(tabEl);
    });
  }

  renderBreadcrumbs() {
    if (!this.breadcrumbsContainer) return;
    this.breadcrumbsContainer.innerHTML = '';
    if (!this.activeTab) {
      this.breadcrumbsContainer.innerHTML = '<span class="breadcrumb-item">Momentum IDE</span>';
      return;
    }

    const parts = [window.vfs.projectName, ...this.activeTab.split('/')];
    parts.forEach((part, idx) => {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'codicon codicon-chevron-right breadcrumb-separator';
        this.breadcrumbsContainer.appendChild(sep);
      }
      const item = document.createElement('span');
      item.className = 'breadcrumb-item';
      item.textContent = part;
      this.breadcrumbsContainer.appendChild(item);
    });
  }
}

window.editorManager = new EditorManager();
