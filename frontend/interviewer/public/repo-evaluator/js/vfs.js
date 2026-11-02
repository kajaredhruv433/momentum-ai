/**
 * Virtual File System (VFS) for Momentum VS Code Web IDE
 * Handles in-browser file storage, nested tree representations,
 * folder uploads (webkitdirectory), drag-and-drop, and ZIP exports.
 */
class VirtualFileSystem {
  constructor() {
    this.STORAGE_KEY = 'momentum_ide_vfs_v1';
    const assessmentSession = Boolean(sessionStorage.getItem('assessment_id'));
    const selectedRepo = sessionStorage.getItem('assessment_repo') || '';
    this.projectName = assessmentSession
      ? (selectedRepo.split('/').pop() || 'Loading repository…')
      : 'my-project';
    this.files = {}; // path -> content
    this.listeners = new Set();
    this.persistentStorageEnabled = !assessmentSession;
    // Assessment pages must never briefly restore a different project's
    // browser cache before their Docker-backed repository has loaded.
    if (!assessmentSession) this.loadFromStorage();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('VFS Listener Error:', err);
      }
    }
    this.saveToStorage();
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.files && Object.keys(parsed.files).length > 0) {
          this.files = parsed.files;
          this.projectName = parsed.projectName || 'my-project';
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read VFS from localStorage:', e);
    }
    // Default fallback: Cyberpunk game
    this.loadSample('web-game', false);
  }

  saveToStorage() {
    if (!this.persistentStorageEnabled) return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        projectName: this.projectName,
        files: this.files
      }));
    } catch (e) {
      console.warn('Could not save VFS to localStorage:', e);
    }
  }

  setPersistentStorage(enabled) {
    this.persistentStorageEnabled = Boolean(enabled);
  }

  loadSample(key, shouldNotify = true) {
    if (window.SAMPLE_PROJECTS && window.SAMPLE_PROJECTS[key]) {
      const proj = window.SAMPLE_PROJECTS[key];
      this.files = {};
      this.projectName = key;
      for (const [path, content] of Object.entries(proj.files)) {
        this.files[path] = content;
      }
      if (shouldNotify) {
        this.notify('project-loaded', { projectName: this.projectName });
      }
    }
  }

  setProjectName(name) {
    this.projectName = name.trim() || 'my-project';
    this.notify('project-renamed', { projectName: this.projectName });
  }

  normalizePath(path) {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  exists(path) {
    const p = this.normalizePath(path);
    return Object.prototype.hasOwnProperty.call(this.files, p);
  }

  readFile(path) {
    const p = this.normalizePath(path);
    if (!this.exists(p)) {
      throw new Error(`File not found: ${path}`);
    }
    return this.files[p];
  }

  writeFile(path, content, silent = false) {
    const p = this.normalizePath(path);
    this.files[p] = content;
    if (!silent) {
      this.notify('file-changed', { path: p });
    }
  }

  createFile(path, content = '') {
    const p = this.normalizePath(path);
    if (this.exists(p)) {
      throw new Error(`File already exists: ${p}`);
    }
    this.files[p] = content;
    this.notify('file-created', { path: p });
    return p;
  }

  createFolder(folderPath) {
    let p = this.normalizePath(folderPath);
    if (!p.endsWith('/')) p += '/';
    // A folder can be represented as an empty marker or by having files under it
    // Store a dummy file if needed or keep folder tracked
    const marker = p + '.keep';
    this.files[marker] = '';
    this.notify('folder-created', { path: p });
  }

  deleteItem(path) {
    const p = this.normalizePath(path);
    let deletedCount = 0;
    // Check exact file match
    if (this.exists(p)) {
      delete this.files[p];
      deletedCount++;
    }
    // Also delete any nested files if it's a folder
    const prefix = p + '/';
    for (const key of Object.keys(this.files)) {
      if (key.startsWith(prefix)) {
        delete this.files[key];
        deletedCount++;
      }
    }
    this.notify('item-deleted', { path: p, count: deletedCount });
  }

  renameItem(oldPath, newPath) {
    const oldP = this.normalizePath(oldPath);
    const newP = this.normalizePath(newPath);
    if (oldP === newP) return;

    if (this.exists(oldP)) {
      this.files[newP] = this.files[oldP];
      delete this.files[oldP];
    } else {
      // Folder rename
      const oldPrefix = oldP + '/';
      const newPrefix = newP + '/';
      for (const key of Object.keys(this.files)) {
        if (key.startsWith(oldPrefix)) {
          const suffix = key.slice(oldPrefix.length);
          this.files[newPrefix + suffix] = this.files[key];
          delete this.files[key];
        }
      }
    }
    this.notify('item-renamed', { oldPath: oldP, newPath: newP });
  }

  /**
   * Generates a nested directory tree object suitable for rendering the Explorer.
   */
  getTree() {
    const root = {
      name: this.projectName,
      type: 'directory',
      path: '',
      children: {}
    };

    for (const rawPath of Object.keys(this.files)) {
      if (rawPath.endsWith('/.keep')) {
        // Just folder placeholder
        const folderOnly = rawPath.replace('/.keep', '');
        this._ensureFolderPath(root, folderOnly);
        continue;
      }

      const parts = rawPath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = (i === parts.length - 1);
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isFile) {
          current.children[part] = {
            name: part,
            type: 'file',
            path: currentPath,
            extension: part.includes('.') ? part.split('.').pop().toLowerCase() : ''
          };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              type: 'directory',
              path: currentPath,
              children: {}
            };
          }
          current = current.children[part];
        }
      }
    }

    return root;
  }

  _ensureFolderPath(root, folderPath) {
    const parts = folderPath.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const currentPath = parts.slice(0, i + 1).join('/');
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          type: 'directory',
          path: currentPath,
          children: {}
        };
      }
      current = current.children[part];
    }
  }

  /**
   * Imports files from an HTML5 FileList (e.g. from webkitdirectory or drag-and-drop)
   */
  async importFromFileList(files, clearExisting = false) {
    if (clearExisting) {
      this.files = {};
    }

    let detectedProjectName = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // webkitRelativePath gives "FolderName/sub/file.js"
      let relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/');

      if (parts.length > 1 && !detectedProjectName) {
        detectedProjectName = parts[0];
      }

      // If imported via folder, we can strip the top root name if we want project name set to it
      if (parts.length > 1) {
        relPath = parts.slice(1).join('/');
      }

      if (!relPath) continue;

      try {
        const text = await this._readFileAsText(file);
        this.files[this.normalizePath(relPath)] = text;
      } catch (err) {
        console.warn('Skipping binary/unreadable file:', file.name, err);
      }
    }

    if (detectedProjectName) {
      this.projectName = detectedProjectName;
    }

    this.notify('project-loaded', { projectName: this.projectName });
  }

  /**
   * Import files from a ZIP file buffer
   */
  async importFromZip(zipFileBlob) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is not loaded');
    }
    const zip = await JSZip.loadAsync(zipFileBlob);
    this.files = {};
    let folderName = zipFileBlob.name.replace(/\.zip$/i, '');

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      // Skip Mac OS metadata files
      if (relativePath.includes('__MACOSX/') || relativePath.includes('.DS_Store')) continue;
      
      const content = await zipEntry.async('string');
      this.files[this.normalizePath(relativePath)] = content;
    }

    this.projectName = folderName || 'imported-project';
    this.notify('project-loaded', { projectName: this.projectName });
  }

  /**
   * Exports entire project as a ZIP download
   */
  async exportAsZip() {
    if (typeof JSZip === 'undefined') {
      alert('JSZip library is loading. Please wait a second and try again.');
      return;
    }
    const zip = new JSZip();
    for (const [path, content] of Object.entries(this.files)) {
      if (path.endsWith('/.keep')) continue;
      zip.file(path, content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.projectName || 'project'}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  getAllPaths() {
    return Object.keys(this.files).filter(p => !p.endsWith('/.keep'));
  }
}

window.vfs = new VirtualFileSystem();
