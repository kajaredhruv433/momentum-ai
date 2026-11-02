/**
 * Command Palette Controller (Ctrl+Shift+P / F1)
 */
class CommandPalette {
  constructor() {
    this.modalEl = null;
    this.inputEl = null;
    this.listEl = null;
    this.isOpen = false;
    this.selectedIndex = 0;
    this.filteredCommands = [];

    this.commands = [
      {
        id: 'view.terminal',
        category: 'View',
        title: 'Toggle Terminal Panel',
        shortcut: 'Ctrl+`',
        action: () => window.app.toggleBottomPanel('terminal')
      },
      {
        id: 'view.preview',
        category: 'View',
        title: 'Toggle Live Preview',
        shortcut: 'Ctrl+Shift+V',
        action: () => window.app.toggleBottomPanel('preview')
      },
      {
        id: 'file.newFile',
        category: 'File',
        title: 'New File',
        shortcut: 'Ctrl+N',
        action: () => window.app.promptNewFile()
      },
      {
        id: 'file.newFolder',
        category: 'File',
        title: 'New Folder',
        shortcut: '',
        action: () => window.app.promptNewFolder()
      },
      {
        id: 'file.openFolder',
        category: 'File',
        title: 'Open Project Folder / Upload Directory...',
        shortcut: 'Ctrl+O',
        action: () => window.app.triggerFolderUpload()
      },
      {
        id: 'file.exportZip',
        category: 'File',
        title: 'Export / Download Project as ZIP',
        shortcut: 'Ctrl+Shift+D',
        action: () => window.vfs.exportAsZip()
      },
      {
        id: 'run.active',
        category: 'Run',
        title: 'Run Active Project / Live Preview',
        shortcut: 'F5',
        action: () => {
          window.app.setBottomTab('preview');
          window.previewManager.runActiveProject();
        }
      },
      {
        id: 'sample.cyberpunk',
        category: 'Project',
        title: 'Load Starter: Cyberpunk Neon Runner Game',
        shortcut: '',
        action: () => window.vfs.loadSample('web-game')
      },
      {
        id: 'sample.python',
        category: 'Project',
        title: 'Load Starter: Python Data Science & Algorithms',
        shortcut: '',
        action: () => window.vfs.loadSample('python-algorithms')
      },
      {
        id: 'sample.todo',
        category: 'Project',
        title: 'Load Starter: Modern Task Tracker App',
        shortcut: '',
        action: () => window.vfs.loadSample('react-todo')
      },
      {
        id: 'theme.darkplus',
        category: 'Preferences',
        title: 'Color Theme: VS Code Dark+ (Default)',
        shortcut: '',
        action: () => {
          window.editorManager.setTheme('vs-dark-plus');
          document.body.removeAttribute('data-theme');
        }
      },
      {
        id: 'theme.monokai',
        category: 'Preferences',
        title: 'Color Theme: Monokai',
        shortcut: '',
        action: () => {
          window.editorManager.setTheme('monokai');
          document.body.setAttribute('data-theme', 'monokai');
        }
      },
      {
        id: 'theme.github',
        category: 'Preferences',
        title: 'Color Theme: GitHub Dark',
        shortcut: '',
        action: () => {
          window.editorManager.setTheme('github-dark');
          document.body.setAttribute('data-theme', 'github-dark');
        }
      },
      {
        id: 'tabs.closeAll',
        category: 'View',
        title: 'Close All Editor Tabs',
        shortcut: 'Ctrl+K Ctrl+W',
        action: () => window.editorManager.closeAllTabs()
      },
      {
        id: 'editor.save',
        category: 'File',
        title: 'Save Active File',
        shortcut: 'Ctrl+S',
        action: () => window.editorManager.saveActiveFile()
      }
    ];
  }

  init() {
    this.createDom();
    this.attachEvents();
  }

  createDom() {
    const modal = document.createElement('div');
    modal.className = 'command-palette-overlay hidden';
    modal.id = 'command-palette-modal';
    modal.innerHTML = `
      <div class="command-palette-card">
        <div class="command-palette-input-wrap">
          <span class="codicon codicon-chevron-right command-prompt-icon"></span>
          <input type="text" id="command-palette-input" placeholder="Type a command or search..." spellcheck="false" autocomplete="off" />
        </div>
        <div class="command-palette-list" id="command-palette-list"></div>
      </div>
    `;
    document.body.appendChild(modal);

    this.modalEl = modal;
    this.inputEl = modal.querySelector('#command-palette-input');
    this.listEl = modal.querySelector('#command-palette-list');
  }

  attachEvents() {
    // Global keyboard triggers
    window.addEventListener('keydown', (e) => {
      // Ctrl+Shift+P or F1
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.open();
      } else if (e.key === 'F1') {
        e.preventDefault();
        this.open();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Top search bar trigger
    const topSearch = document.getElementById('top-command-search');
    if (topSearch) {
      topSearch.addEventListener('click', () => this.open());
    }

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    this.inputEl.addEventListener('input', () => {
      this.filter(this.inputEl.value);
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.filteredCommands.length);
        this.renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % Math.max(1, this.filteredCommands.length);
        this.renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSelected();
      }
    });
  }

  open() {
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.inputEl.value = '';
    this.selectedIndex = 0;
    this.filter('');
    this.inputEl.focus();
  }

  close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    if (window.editorManager && window.editorManager.editor) {
      window.editorManager.editor.focus();
    }
  }

  filter(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredCommands = [...this.commands];
    } else {
      this.filteredCommands = this.commands.filter(cmd => {
        const full = `${cmd.category}: ${cmd.title}`.toLowerCase();
        return full.includes(q);
      });
    }
    this.selectedIndex = 0;
    this.renderList();
  }

  renderList() {
    this.listEl.innerHTML = '';
    if (this.filteredCommands.length === 0) {
      this.listEl.innerHTML = '<div class="command-empty">No matching commands</div>';
      return;
    }

    this.filteredCommands.forEach((cmd, idx) => {
      const item = document.createElement('div');
      item.className = 'command-item' + (idx === this.selectedIndex ? ' selected' : '');
      item.innerHTML = `
        <div class="command-info">
          <span class="command-category">${cmd.category}:</span>
          <span class="command-title">${cmd.title}</span>
        </div>
        ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
      `;
      item.addEventListener('mouseenter', () => {
        this.selectedIndex = idx;
        this.renderList();
      });
      item.addEventListener('click', () => {
        this.executeSelected();
      });
      this.listEl.appendChild(item);
    });

    const selectedEl = this.listEl.querySelector('.command-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  executeSelected() {
    const selected = this.filteredCommands[this.selectedIndex];
    if (selected && selected.action) {
      this.close();
      selected.action();
    }
  }
}

window.commandPalette = new CommandPalette();
