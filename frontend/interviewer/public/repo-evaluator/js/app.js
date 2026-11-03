/**
 * Momentum VS Code Web IDE - Main UI Application Controller
 */
class AppController {
  constructor() {
    this.activeSidebarView = 'explorer'; // explorer, search, git, debug, extensions, settings
    this.isSidebarVisible = true;
    this.activeBottomTab = 'terminal'; // terminal, preview, problems, output
    this.isBottomPanelVisible = true;
    this.expandedFolders = new Set(['']); // set of folder paths that are open
    this.contextTarget = null; // { path, isDirectory }
  }

  async init() {
    this.attachActivityBarEvents();
    this.attachTopBarEvents();
    this.attachSidebarHeaderEvents();
    this.attachFileTreeEvents();
    this.attachBottomPanelEvents();
    this.attachContextMenuEvents();
    this.attachDragAndDrop();
    this.attachGlobalShortcuts();

    // Initialize subsystems
    await window.editorManager.init(document.getElementById('monaco-editor-container'));
    window.terminal.init(document.getElementById('terminal-container'));
    window.previewManager.init(document.getElementById('preview-container'));
    window.commandPalette.init();

    // Render tree initially
    this.renderExplorerTree();

    // Listen to VFS updates
    window.vfs.subscribe((event) => {
      this.renderExplorerTree();
      this.updateProjectTitle();
    });

    this.updateProjectTitle();

    // If starting with web-game, auto-run preview
    setTimeout(() => {
      if (window.vfs.exists('index.html')) {
        window.previewManager.runActiveProject(false);
      }
    }, 600);
  }

  updateProjectTitle() {
    const el = document.getElementById('project-title');
    if (el) el.textContent = window.vfs.projectName;
    const topPill = document.getElementById('top-command-search-text');
    if (topPill) topPill.textContent = `${window.vfs.projectName} — Search files and commands (Ctrl+P)`;
  }

  attachActivityBarEvents() {
    const items = document.querySelectorAll('.activity-bar-item[data-view]');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (this.activeSidebarView === view && this.isSidebarVisible) {
          // Toggle off sidebar
          this.toggleSidebar(false);
        } else {
          this.switchSidebarView(view);
          this.toggleSidebar(true);
        }
      });
    });

    const settingsBtn = document.getElementById('activity-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        window.commandPalette.open();
      });
    }
  }

  switchSidebarView(view) {
    this.activeSidebarView = view;
    document.querySelectorAll('.activity-bar-item[data-view]').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    document.querySelectorAll('.sidebar-view').forEach(el => {
      el.classList.toggle('active', el.id === `sidebar-${view}`);
    });

    const titleEl = document.getElementById('sidebar-title');
    if (titleEl) {
      const titles = {
        explorer: 'EXPLORER',
        search: 'SEARCH',
        git: 'SOURCE CONTROL',
        debug: 'RUN AND DEBUG',
        extensions: 'EXTENSIONS'
      };
      titleEl.textContent = titles[view] || 'EXPLORER';
    }

    if (view === 'search') {
      const searchInput = document.getElementById('search-panel-input');
      if (searchInput) searchInput.focus();
    }
  }

  toggleSidebar(forceState) {
    const sidebar = document.getElementById('sidebar-panel');
    this.isSidebarVisible = forceState !== undefined ? forceState : !this.isSidebarVisible;
    sidebar.classList.toggle('collapsed', !this.isSidebarVisible);
    if (window.editorManager && window.editorManager.editor) {
      window.editorManager.editor.layout();
    }
  }

  attachTopBarEvents() {
    // Run button
    const runBtn = document.getElementById('top-run-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        this.setBottomTab('preview');
        this.toggleBottomPanel(true);
        window.previewManager.runActiveProject();
      });
    }

    // New File button
    const newFileBtn = document.getElementById('top-newfile-btn');
    if (newFileBtn) {
      newFileBtn.addEventListener('click', () => this.promptNewFile());
    }

    // Open Project button
    const openFolderBtn = document.getElementById('top-openfolder-btn');
    if (openFolderBtn) {
      openFolderBtn.addEventListener('click', () => this.triggerFolderUpload());
    }

    // Project sample switcher dropdown
    const sampleSelect = document.getElementById('project-sample-select');
    if (sampleSelect) {
      sampleSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'empty') {
          window.vfs.files = { 'README.md': '# New Project\n\nStart typing code here...' };
          window.vfs.projectName = 'my-app';
          window.vfs.notify('project-loaded', { projectName: 'my-app' });
        } else if (val) {
          window.vfs.loadSample(val);
        }
      });
    }

    // Export ZIP button
    const exportBtn = document.getElementById('top-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => window.vfs.exportAsZip());
    }

    // Toggle layout buttons
    const toggleSidebarBtn = document.getElementById('top-toggle-sidebar');
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
    }

    const toggleBottomBtn = document.getElementById('top-toggle-bottom');
    if (toggleBottomBtn) {
      toggleBottomBtn.addEventListener('click', () => this.toggleBottomPanel());
    }
  }

  attachSidebarHeaderEvents() {
    const newFileIcon = document.getElementById('explorer-new-file');
    if (newFileIcon) newFileIcon.addEventListener('click', () => this.promptNewFile());

    const newFolderIcon = document.getElementById('explorer-new-folder');
    if (newFolderIcon) newFolderIcon.addEventListener('click', () => this.promptNewFolder());

    const uploadFolderIcon = document.getElementById('explorer-upload-folder');
    if (uploadFolderIcon) uploadFolderIcon.addEventListener('click', () => this.triggerFolderUpload());

    const refreshIcon = document.getElementById('explorer-refresh');
    if (refreshIcon) refreshIcon.addEventListener('click', () => this.renderExplorerTree());

    const collapseIcon = document.getElementById('explorer-collapse');
    if (collapseIcon) collapseIcon.addEventListener('click', () => {
      this.expandedFolders.clear();
      this.renderExplorerTree();
    });

    // Hidden Folder input
    const folderInput = document.getElementById('hidden-folder-input');
    if (folderInput) {
      folderInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          window.terminal.logSystem(`Importing ${e.target.files.length} files from folder...`);
          await window.vfs.importFromFileList(e.target.files, true);
          window.terminal.logSuccess(`Imported project successfully.`);
        }
        folderInput.value = '';
      });
    }

    // Hidden ZIP input
    const zipInput = document.getElementById('hidden-zip-input');
    if (zipInput) {
      zipInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          window.terminal.logSystem(`Extracting ${file.name}...`);
          await window.vfs.importFromZip(file);
          window.terminal.logSuccess(`Extracted project successfully.`);
        }
        zipInput.value = '';
      });
    }

    // Search panel logic
    const searchInput = document.getElementById('search-panel-input');
    const searchResults = document.getElementById('search-results');
    if (searchInput && searchResults) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        searchResults.innerHTML = '';
        if (!query) return;

        let totalMatches = 0;
        for (const [path, content] of Object.entries(window.vfs.files)) {
          if (path.endsWith('/.keep')) continue;
          const lines = content.split('\n');
          const matchedLines = [];
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query)) {
              matchedLines.push({ lineNum: index + 1, text: line.trim() });
              totalMatches++;
            }
          });

          if (matchedLines.length > 0) {
            const group = document.createElement('div');
            group.className = 'search-file-group';
            group.innerHTML = `
              <div class="search-file-title">
                <span class="codicon codicon-chevron-down"></span>
                <span class="codicon ${window.editorManager.getFileIcon(path)}"></span>
                <span class="search-file-name">${path}</span>
                <span class="search-count-badge">${matchedLines.length}</span>
              </div>
              <div class="search-matches">
                ${matchedLines.map(m => `
                  <div class="search-match-row" data-path="${path}" data-line="${m.lineNum}">
                    <span class="search-line-num">${m.lineNum}:</span>
                    <span class="search-line-text">${this.escapeHtml(m.text)}</span>
                  </div>
                `).join('')}
              </div>
            `;
            searchResults.appendChild(group);
          }
        }

        if (totalMatches === 0) {
          searchResults.innerHTML = '<div class="search-no-results">No results found.</div>';
        }

        // Attach click jump to line
        searchResults.querySelectorAll('.search-match-row').forEach(row => {
          row.addEventListener('click', () => {
            const path = row.dataset.path;
            const line = parseInt(row.dataset.line, 10);
            window.editorManager.openFile(path);
            if (window.editorManager.editor) {
              window.editorManager.editor.revealLineInCenter(line);
              window.editorManager.editor.setPosition({ lineNumber: line, column: 1 });
              window.editorManager.editor.focus();
            }
          });
        });
      });
    }

    // Git panel commit logic
    const commitBtn = document.getElementById('git-commit-btn');
    const commitMsg = document.getElementById('git-commit-input');
    if (commitBtn && commitMsg) {
      commitBtn.addEventListener('click', () => {
        const msg = commitMsg.value.trim() || 'Quick commit';
        window.terminal.execute(`git commit -m "${msg}"`);
        commitMsg.value = '';
      });
    }
  }

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  triggerFolderUpload() {
    const input = document.getElementById('hidden-folder-input');
    if (input) input.click();
  }

  triggerZipUpload() {
    const input = document.getElementById('hidden-zip-input');
    if (input) input.click();
  }

  attachFileTreeEvents() {
    // Click outside context menu to close it
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('context-menu');
      if (menu && !menu.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
  }

  renderExplorerTree() {
    const container = document.getElementById('file-tree-container');
    if (!container) return;
    container.innerHTML = '';

    const tree = window.vfs.getTree();
    this.renderTreeNode(tree, container, 0);
  }

  renderTreeNode(node, containerEl, depth = 0) {
    if (node.path === '') {
      // Root level children
      const sortedKeys = Object.keys(node.children).sort((a, b) => {
        const itemA = node.children[a];
        const itemB = node.children[b];
        if (itemA.type === itemB.type) return a.localeCompare(b);
        return itemA.type === 'directory' ? -1 : 1;
      });

      sortedKeys.forEach(key => {
        this.renderTreeNode(node.children[key], containerEl, depth);
      });
      return;
    }

    const row = document.createElement('div');
    row.className = 'tree-item ' + (node.type === 'directory' ? 'tree-folder' : 'tree-file');
    row.style.paddingLeft = `${16 + depth * 14}px`;
    row.dataset.path = node.path;

    if (node.type === 'file' && window.editorManager.activeTab === node.path) {
      row.classList.add('active');
    }

    if (node.type === 'directory') {
      const isExpanded = this.expandedFolders.has(node.path);
      row.innerHTML = `
        <span class="codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'} tree-arrow"></span>
        <span class="codicon ${isExpanded ? 'codicon-folder-opened' : 'codicon-folder'} folder-icon"></span>
        <span class="tree-label">${node.name}</span>
      `;

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.expandedFolders.has(node.path)) {
          this.expandedFolders.delete(node.path);
        } else {
          this.expandedFolders.add(node.path);
        }
        this.renderExplorerTree();
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(e.clientX, e.clientY, node.path, true);
      });

      containerEl.appendChild(row);

      // Render children if expanded
      if (isExpanded) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        const sortedKeys = Object.keys(node.children).sort((a, b) => {
          const itemA = node.children[a];
          const itemB = node.children[b];
          if (itemA.type === itemB.type) return a.localeCompare(b);
          return itemA.type === 'directory' ? -1 : 1;
        });

        sortedKeys.forEach(key => {
          this.renderTreeNode(node.children[key], childrenContainer, depth + 1);
        });
        containerEl.appendChild(childrenContainer);
      }
    } else {
      // File node
      const iconClass = window.editorManager.getFileIcon(node.name);
      const locked = window.editorManager.lockedFiles?.has(node.path);
      row.innerHTML = `
        <span class="tree-indent-spacer"></span>
        <span class="codicon ${iconClass} file-icon"></span>
        <span class="tree-label">${node.name}${locked ? ' · locked' : ''}</span>
      `;
      if (locked) row.title = 'Visible for reference, but cannot be opened.';

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        window.editorManager.openFile(node.path);
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(e.clientX, e.clientY, node.path, false);
      });

      containerEl.appendChild(row);
    }
  }

  showContextMenu(x, y, path, isDirectory) {
    this.contextTarget = { path, isDirectory };
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
    menu.classList.remove('hidden');
  }

  attachContextMenuEvents() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    menu.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action || !this.contextTarget) return;

      const { path, isDirectory } = this.contextTarget;
      menu.classList.add('hidden');

      switch (action) {
        case 'new-file':
          this.promptNewFile(isDirectory ? path : path.split('/').slice(0, -1).join('/'));
          break;
        case 'new-folder':
          this.promptNewFolder(isDirectory ? path : path.split('/').slice(0, -1).join('/'));
          break;
        case 'rename':
          this.promptRename(path);
          break;
        case 'delete':
          if (confirm(`Are you sure you want to delete ${path}?`)) {
            window.vfs.deleteItem(path);
          }
          break;
        case 'download':
          if (!isDirectory) {
            this.downloadSingleFile(path);
          }
          break;
      }
    });
  }

  downloadSingleFile(path) {
    const content = window.vfs.readFile(path);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  attachBottomPanelEvents() {
    const tabs = document.querySelectorAll('.panel-tab-btn[data-panel]');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        this.setBottomTab(panel);
        this.toggleBottomPanel(true);
      });
    });

    const closeBtn = document.getElementById('panel-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleBottomPanel(false));
    }
  }

  setBottomTab(panel) {
    this.activeBottomTab = panel;
    document.querySelectorAll('.panel-tab-btn[data-panel]').forEach(b => {
      b.classList.toggle('active', b.dataset.panel === panel);
    });
    document.querySelectorAll('.panel-content-view').forEach(v => {
      v.classList.toggle('active', v.id === `panel-${panel}`);
    });
  }

  toggleBottomPanel(forceState) {
    const panel = document.getElementById('bottom-panel');
    this.isBottomPanelVisible = forceState !== undefined ? forceState : !this.isBottomPanelVisible;
    panel.classList.toggle('collapsed', !this.isBottomPanelVisible);
    if (window.editorManager && window.editorManager.editor) {
      window.editorManager.editor.layout();
    }
  }

  promptNewFile(parentFolder = '') {
    const name = prompt('Enter new file name (e.g. script.js, utils/math.js):');
    if (!name) return;
    const fullPath = parentFolder ? `${parentFolder}/${name}` : name;
    try {
      window.vfs.createFile(fullPath, '');
      if (parentFolder) this.expandedFolders.add(parentFolder);
      window.editorManager.openFile(fullPath);
    } catch (e) {
      alert(e.message);
    }
  }

  promptNewFolder(parentFolder = '') {
    const name = prompt('Enter new folder name:');
    if (!name) return;
    const fullPath = parentFolder ? `${parentFolder}/${name}` : name;
    try {
      window.vfs.createFolder(fullPath);
      this.expandedFolders.add(fullPath);
      this.renderExplorerTree();
    } catch (e) {
      alert(e.message);
    }
  }

  promptRename(path) {
    const currentName = path.split('/').pop();
    const newName = prompt('Enter new name:', currentName);
    if (!newName || newName === currentName) return;

    const parts = path.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    window.vfs.renameItem(path, newPath);
  }

  attachDragAndDrop() {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.zip')) {
          window.terminal.logSystem(`Extracting dragged ZIP: ${file.name}...`);
          await window.vfs.importFromZip(file);
          window.terminal.logSuccess(`Extracted project successfully.`);
        } else {
          window.terminal.logSystem(`Importing ${e.dataTransfer.files.length} dragged file(s)...`);
          await window.vfs.importFromFileList(e.dataTransfer.files, false);
          window.terminal.logSuccess(`Files imported to workspace.`);
        }
      }
    });
  }

  attachGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Toggle Terminal: Ctrl+` (backtick)
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        this.toggleBottomPanel();
      }
      // Toggle Sidebar: Ctrl+B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
      // Run: F5
      if (e.key === 'F5') {
        e.preventDefault();
        this.setBottomTab('preview');
        this.toggleBottomPanel(true);
        window.previewManager.runActiveProject();
      }
    });
  }
}

window.app = new AppController();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
