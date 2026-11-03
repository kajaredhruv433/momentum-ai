/* Loads the pinned repository snapshot into the IDE without writing to GitHub. */
(() => {
  const launchParams = new URLSearchParams(window.location.search);
  const assessmentId = launchParams.get('assessment_id') || sessionStorage.getItem('assessment_id');
  if (assessmentId) {
    sessionStorage.setItem('assessment_id', assessmentId);
    sessionStorage.setItem('assessment_repo', launchParams.get('repo') || sessionStorage.getItem('assessment_repo') || 'Selected repository');
  }
  const api = localStorage.getItem('assessment_api') || '';
  const unavailablePaths = new Set();
  let assessmentSnapshotLoaded = false;
  if (assessmentId) window.vfs?.setPersistentStorage(false);
  function purgeStoredAssessmentCopy(repositoryName) {
    try {
      const key = window.vfs?.STORAGE_KEY;
      if (!key) return;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      if (stored.projectName === repositoryName) localStorage.removeItem(key);
    } catch { /* Ignore corrupt IDE cache metadata. */ }
  }
  const preservedAssetPaths = new Set();
  let dependencySetupTimer = 0;
  let dependencyInstallMessageShown = false;
  let repositoryLoaded = false;
  let repositoryLoadPromise = null;
  let repositoryLoadState = { status: 'pending', label: 'Waiting to load the repository into the editor' };
  let latestChallenge = null;

  // Only create fallback bar if buttons don't already exist in the page
  const hasSubmitInDoc = !!document.getElementById('assessment-submit');
  if (!hasSubmitInDoc) {
    const bar = document.createElement('div');
    bar.id = 'assessment-bar';
    bar.style.cssText = 'position:fixed;z-index:1000;top:42px;right:18px;display:flex;align-items:center;gap:8px;padding:8px 12px;background:#0c1322;border:1px solid #1e294b;border-radius:8px;color:#dce7f0;font:12px Inter,sans-serif';
    bar.innerHTML = '<span id="assessment-label">Assessment loading…</span><a href="/assessment" style="color:#38bdf8;margin:0 8px">Assessment</a><button id="assessment-load">Load repo</button><button id="assessment-tests">Run tests</button><button id="assessment-hints">AI Assistant</button><button id="assessment-submit">Submit</button>';
    document.body.append(bar);
    bar.querySelectorAll('button').forEach(button => { button.style.cssText = 'background:linear-gradient(135deg, #6366f1, #8b5cf6);color:#ffffff;border:1px solid rgba(196,181,253,0.3);border-radius:5px;padding:6px 12px;cursor:pointer;font-weight:600'; });
  }

  // AI Assistant Chatbot Panel: Dark Blue, Light Blue, Lotus Pink, Violet, Purple
  let coach = document.getElementById('assessment-coach');
  if (!coach) {
    coach = document.createElement('aside');
    coach.id = 'assessment-coach';
    coach.style.cssText = 'display:none;position:fixed;z-index:999;right:20px;top:52px;width:min(440px,calc(100vw - 28px));height:min(580px,calc(100vh - 120px));background:#0b1122;border:1px solid #233154;border-radius:14px;color:#f1f5f9;font:14px Inter,sans-serif;box-shadow:0 18px 50px rgba(6,9,19,0.85);overflow:hidden;flex-direction:column';
    coach.innerHTML = `
      <div style="padding:14px 16px;border-bottom:1px solid #1e294b;display:flex;justify-content:space-between;align-items:center;background:#0f172a">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="codicon codicon-sparkle" style="color:#38bdf8;font-size:16px"></span>
          <strong style="font-size:15px;color:#f8fafc">AI Assistant</strong>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="color:#f472b6;font-size:11px;font-weight:700;background:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.3);padding:3px 9px;border-radius:10px;letter-spacing:0.5px">GUIDANCE ONLY</span>
          <button id="coach-close-btn" type="button" style="background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:0 4px" title="Close">✕</button>
        </div>
      </div>
      <div style="padding:12px 16px;color:#94a3b8;font-size:13px;line-height:1.45;border-bottom:1px solid rgba(30,41,75,0.7)">
        Ask about the code or general programming. I can explain failures, architectures, and concepts, but won’t give this challenge’s direct solution.
      </div>
      <div id="coach-messages" style="padding:14px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px"></div>
      <form id="coach-form" style="padding:12px;border-top:1px solid #1e294b;display:flex;gap:8px;background:#080e1c">
        <textarea id="coach-input" rows="2" maxlength="1200" placeholder="Ask AI Assistant a question…" style="flex:1;resize:none;background:#070b16;color:#f1f5f9;border:1px solid #1e294b;border-radius:8px;padding:9px 12px;font:13px Inter,sans-serif;outline:none"></textarea>
        <button id="coach-send" type="submit" style="background:linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #8b5cf6 100%);color:#fff;border:0;border-radius:8px;padding:0 18px;cursor:pointer;font-weight:600;font-size:13px;box-shadow:0 2px 10px rgba(244,63,94,0.35)">Ask</button>
      </form>
    `;
    document.body.append(coach);
  }

  const closeBtn = coach.querySelector('#coach-close-btn');
  if (closeBtn) closeBtn.onclick = () => { coach.style.display = 'none'; };

  const chatHistory = [];
  const messageBox = coach.querySelector('#coach-messages');
  function addCoachMessage(role, content) {
    const bubble = document.createElement('div');
    bubble.style.cssText = `align-self:${role === 'user' ? 'flex-end' : 'flex-start'};max-width:92%;white-space:pre-wrap;overflow-wrap:anywhere;background:${role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : '#111c35'};color:${role === 'user' ? '#ffffff' : '#e2e8f0'};border:${role === 'user' ? 'none' : '1px solid #1e2b4a'};padding:10px 14px;border-radius:12px;line-height:1.45;box-shadow:0 2px 8px rgba(0,0,0,0.2)`;
    bubble.textContent = content;
    messageBox.append(bubble);
    messageBox.scrollTop = messageBox.scrollHeight;
  }

  const hintsBtn = document.getElementById('assessment-hints');
  if (hintsBtn) {
    hintsBtn.onclick = () => {
      coach.style.display = coach.style.display === 'flex' ? 'none' : 'flex';
      if (coach.style.display === 'flex') {
        const input = coach.querySelector('#coach-input');
        if (input) input.focus();
      }
    };
  }

  coach.querySelector('#coach-form').onsubmit = async event => {
    event.preventDefault();
    const input = coach.querySelector('#coach-input');
    const send = coach.querySelector('#coach-send');
    const message = input.value.trim();
    if (!message || send.disabled) return;
    const prior = [...chatHistory];
    addCoachMessage('user', message);
    input.value = '';
    send.disabled = true;
    send.textContent = '…';
    try {
      if (!assessmentId) {
        addCoachMessage('assistant', 'Welcome to Momentum AI Assistant! Start an assessment from the assessment dashboard to ask questions about your active repository challenge.');
        return;
      }
      const activeFile = window.editorManager?.activeTab?.path || '';
      const activeCode = activeFile && window.vfs?.readFile(activeFile) || '';
      const result = await call(`/api/assessments/${assessmentId}/hint`, {
        method: 'POST',
        body: JSON.stringify({ message, history: prior.slice(-6), active_file: activeFile, active_code: activeCode.slice(0, 12000) })
      });
      chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: result.reply });
      addCoachMessage('assistant', result.reply);
    } catch (error) {
      addCoachMessage('assistant', error.message || 'The AI assistant is temporarily unavailable.');
    } finally {
      send.disabled = false;
      send.textContent = 'Ask';
    }
  };

  async function call(path, options = {}) {
    const response = await fetch(api + path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Request failed ${response.status}`);
    return body;
  }

  let challengeExpiresAt = 0;
  let challengeCountdownInterval = null;
  let autoSubmitStarted = false;
  function startChallengeCountdown(expiresAt) {
    challengeExpiresAt = Number(expiresAt || 0);
    const timer = document.getElementById('assessment-deadline');
    const text = timer?.querySelector('strong');
    if (!timer || !text || !challengeExpiresAt) return;
    timer.hidden = false;
    const submitButton = document.getElementById('assessment-submit');
    if (submitButton && !autoSubmitStarted) submitButton.disabled = false;
    const tick = () => {
      const remaining = Math.max(0, challengeExpiresAt - Math.floor(Date.now() / 1000));
      const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
      const seconds = (remaining % 60).toString().padStart(2, '0');
      text.textContent = `${minutes}:${seconds}`;
      timer.classList.toggle('urgent', remaining <= 60);
      if (remaining === 0 && !autoSubmitStarted) {
        const submit = document.getElementById('assessment-submit');
        if (submit && !submit.disabled && !submit.hidden) {
          autoSubmitStarted = true;
          text.textContent = 'SUBMIT';
          window.editorManager?.editor?.updateOptions?.({ readOnly: true });
          submit.click();
        }
      }
    };
    clearInterval(challengeCountdownInterval);
    tick();
    challengeCountdownInterval = setInterval(tick, 1000);
  }

  async function refresh() {
    if (!assessmentId) return null;
    const assessment = await call(`/api/assessments/${assessmentId}`);
    if (assessment.challenge?.expires_at) startChallengeCountdown(assessment.challenge.expires_at);
    const label = document.getElementById('assessment-label');
    if (label) {
      label.textContent = `${assessment.repo} · ${assessment.status}${assessment.commit_sha ? ' @ ' + assessment.commit_sha.slice(0, 8) : ''}`;
    }
    const submitBtn = document.getElementById('assessment-submit');
    if (submitBtn) {
      submitBtn.hidden = !['ready', 'needs_review'].includes(assessment.status);
      submitBtn.disabled = !challengeExpiresAt && !submitBtn.hidden;
    }
    const canEditAssessment = ['ready', 'needs_review'].includes(assessment.status);
    for (const id of ['assessment-load', 'assessment-tests', 'assessment-hints']) {
      const button = document.getElementById(id);
      if (button) button.hidden = !canEditAssessment;
    }
    const runBtn = document.getElementById('assessment-run-generated');
    if (runBtn) {
      latestChallenge = assessment.challenge;
      const setupReady = assessment.challenge?.dependency_status === 'ready' && repositoryLoaded;
      runBtn.hidden = !canEditAssessment || !assessment.challenge?.locally_testable || !setupReady;
      runBtn.style.display = runBtn.hidden ? 'none' : 'inline-flex';
    }
    if (assessment.status === 'submitted') {
      const repositoryName = assessment.repo.split('/').pop();
      purgeStoredAssessmentCopy(repositoryName);
      if (assessmentSnapshotLoaded || window.vfs?.projectName === repositoryName) {
        window.editorManager?.closeAllTabs();
        window.vfs.files = {};
        window.vfs.projectName = 'assessment-submitted';
        window.vfs.notify('project-loaded', { projectName: window.vfs.projectName });
        assessmentSnapshotLoaded = false;
      }
    }
    renderSetupStatus(assessment.challenge);
    return assessment;
  }

  function renderSetupStatus(challenge) {
    challenge = challenge || latestChallenge || { dependency_status: 'waiting', setup_steps: [] };
    const state = challenge.dependency_status || 'waiting';
    const stateLabel = { installing: 'INSTALLING', ready: 'READY', failed: 'FAILED', not_required: 'NOT REQUIRED', waiting: 'WAITING' }[state] || state.toUpperCase();
    const badge = document.getElementById('setup-status-badge');
    const stateNode = document.getElementById('setup-status-state');
    const summary = document.getElementById('setup-status-summary');
    const list = document.getElementById('setup-status-steps');
    const error = document.getElementById('setup-status-error');
    const liveLog = document.getElementById('setup-live-log');
    const liveLogOutput = document.getElementById('setup-live-log-output');
    if (badge) badge.textContent = state === 'installing' ? '…' : state === 'ready' ? '✓' : state === 'failed' ? '!' : '—';
    if (stateNode) { stateNode.textContent = stateLabel; stateNode.dataset.state = state; }
    if (summary) summary.textContent = repositoryLoadState.status === 'running' ? repositoryLoadState.label : repositoryLoadState.status === 'failed' ? 'Environment setup finished, but the repository did not load into the editor.' : repositoryLoadState.status === 'complete' ? (state === 'installing' ? 'Repository is open. Environment setup continues in the background.' : state === 'ready' ? 'Repository and environment are ready. The focused test can now run.' : state === 'failed' ? 'Repository is open, but environment setup failed.' : 'Repository is open.') : state === 'installing' ? 'Preparing the isolated project environment while the repository loads.' : state === 'ready' ? 'Environment setup is complete; loading the repository into the editor.' : state === 'failed' ? 'Setup failed. See the error details below.' : state === 'not_required' ? 'Loading the repository into the editor.' : 'Waiting for setup information…';
    if (list) {
      list.replaceChildren();
      for (const step of Array.isArray(challenge.setup_steps) ? challenge.setup_steps : []) {
        const item = document.createElement('li');
        const stepState = ['complete', 'running', 'failed', 'skipped', 'pending'].includes(step.status) ? step.status : 'pending';
        item.className = `setup-step ${stepState}`;
        const mark = document.createElement('span');
        mark.className = 'setup-step-mark';
        mark.textContent = stepState === 'complete' ? '✓' : stepState === 'running' ? '◌' : stepState === 'failed' ? '×' : stepState === 'skipped' ? '–' : '○';
        const label = document.createElement('span');
        label.textContent = step.label || step.key || 'Setup step';
        item.append(mark, label);
        list.append(item);
      }
      const repoItem = document.createElement('li');
      repoItem.className = `setup-step ${repositoryLoadState.status}`;
      const repoMark = document.createElement('span');
      repoMark.className = 'setup-step-mark';
      repoMark.textContent = repositoryLoadState.status === 'complete' ? '✓' : repositoryLoadState.status === 'running' ? '◌' : repositoryLoadState.status === 'failed' ? '×' : '○';
      const repoLabel = document.createElement('span');
      repoLabel.textContent = `Editor repository: ${repositoryLoadState.label}`;
      repoItem.append(repoMark, repoLabel);
      list.append(repoItem);
    }
    if (error) { error.textContent = repositoryLoadState.error || challenge.dependency_error || ''; error.hidden = !repositoryLoadState.error && !challenge.dependency_error; }
    if (liveLog && liveLogOutput) {
      const wasAtBottom = liveLogOutput.scrollHeight - liveLogOutput.scrollTop - liveLogOutput.clientHeight < 32;
      liveLogOutput.textContent = challenge.setup_log || 'Waiting for installer output…';
      liveLog.hidden = !challenge.setup_log;
      if (liveLog.open && wasAtBottom) liveLogOutput.scrollTop = liveLogOutput.scrollHeight;
      liveLog.querySelector('summary').textContent = state === 'installing' ? 'Live dependency terminal output · installing' : 'Dependency terminal output';
    }
    const retry = document.getElementById('setup-reload-repository');
    if (retry) retry.hidden = repositoryLoadState.status !== 'failed';
    const retryDependencies = document.getElementById('setup-retry-dependencies');
    if (retryDependencies) retryDependencies.hidden = state !== 'failed' || !challenge.locally_testable;
  }

  function updateRepositoryLoad(status, label, error = '') {
    repositoryLoadState = { status, label, error };
    renderSetupStatus(latestChallenge);
  }

  function watchDependencySetup() {
    if (dependencySetupTimer) clearTimeout(dependencySetupTimer);
    const poll = async () => {
      try {
        const assessment = await refresh();
        const setup = assessment?.challenge?.dependency_status;
        if (setup === 'installing') {
          if (!dependencyInstallMessageShown && window.terminal?.logSystem) {
            window.terminal.logSystem('Installing project dependencies in the isolated environment. You can edit the broken code while this runs…');
            dependencyInstallMessageShown = true;
          }
          dependencySetupTimer = window.setTimeout(poll, 1800);
        } else if (setup === 'ready' && dependencyInstallMessageShown) {
          window.terminal?.logSystem?.('Dependencies installed. The focused test is ready to run.');
        } else if (setup === 'failed') {
          window.terminal?.logSystem?.(`Dependency installation failed: ${assessment.challenge.dependency_error || 'See the project dependency files.'}`);
        }
      } catch {
        dependencySetupTimer = window.setTimeout(poll, 5000);
      }
    };
    void poll();
  }

  function loadRepository() {
    if (repositoryLoadPromise) return repositoryLoadPromise;
    repositoryLoadPromise = loadRepositorySnapshot().finally(() => { repositoryLoadPromise = null; });
    return repositoryLoadPromise;
  }

  async function loadRepositorySnapshot() {
    if (!assessmentId) return;
    repositoryLoaded = false;
    assessmentSnapshotLoaded = false;
    updateRepositoryLoad('running', 'Connecting to the remote repository…');
    window.app?.setBottomTab?.('status');
    window.app?.toggleBottomPanel?.(true);
    try {
    const assessment = await refresh();
    if (!assessment) return;
    if (assessment.challenge?.dependency_status === 'installing') {
      watchDependencySetup();
      window.app?.setBottomTab?.('status');
      window.app?.toggleBottomPanel?.(true);
    }
    if (!['ready', 'needs_review'].includes(assessment.status)) throw new Error(`Repository snapshot isn't ready (${assessment.progress})`);
    const { files, folders = [], assets = [] } = await call(`/api/assessments/${assessmentId}/files`);
    if (!files.length && !folders.length && !assets.length) throw new Error('The repository snapshot contains no loadable files.');
    const results = [];
    const batchSize = 8;
    for (let offset = 0; offset < files.length; offset += batchSize) {
      const batch = files.slice(offset, offset + batchSize);
      const loaded = await Promise.all(batch.map(async path => {
        try {
          const file = await call(`/api/assessments/${assessmentId}/file?path=${encodeURIComponent(path)}`);
          return { path, content: file.content };
        } catch (error) {
          return { path, content: `[Could not load this file: ${error.message}]`, unavailable: true };
        }
      }));
      results.push(...loaded);
      updateRepositoryLoad('running', `Loading repository files into editor: ${results.length} / ${files.length}`);
    }
    const contents = results.map(({ path, content }) => [path, content]);
    unavailablePaths.clear();
    for (const result of results) if (result.unavailable) unavailablePaths.add(result.path);
    purgeStoredAssessmentCopy(assessment.repo.split('/').pop());
    for (const folder of folders) contents.push([`${folder}/.keep`, '']);
    preservedAssetPaths.clear();
    for (const path of assets) {
      preservedAssetPaths.add(path);
      contents.push([path, `[Binary model asset: ${path}]\nPreserved in the isolated container for project tests; this browser editor does not decode binary weights.`]);
    }
    window.vfs.files = Object.fromEntries(contents);
    assessmentSnapshotLoaded = true;
    window.vfs.setProjectName(assessment.repo.split('/').pop());
    window.vfs.notify('project-loaded', { projectName: window.vfs.projectName });
    const problemFile = files.find(path => path === 'problem.md');
    const firstFile = problemFile || files.find(path => /\.(py|js|ts|tsx|jsx|html)$/.test(path)) || files[0] || assets[0] || `${folders[0]}/.keep`;
    window.editorManager.openFile(firstFile);
    if (!window.editorManager.activeTab || !window.vfs.exists(window.editorManager.activeTab)) throw new Error(`Repository files arrived, but the editor could not open ${firstFile}.`);
    repositoryLoaded = true;
    updateRepositoryLoad('complete', `${files.length} files and ${assets.length} binary assets are loaded`);
    const label = document.getElementById('assessment-label');
    if (label) label.textContent = `${assessment.repo} · loaded ${files.length - unavailablePaths.size} files${unavailablePaths.size ? ` · ${unavailablePaths.size} file(s) could not be displayed` : ''}${assets.length ? ` · ${assets.length} binary assets preserved in the remote sandbox` : ''}`;
    await refresh();
    } catch (error) {
      repositoryLoaded = false;
      assessmentSnapshotLoaded = false;
      updateRepositoryLoad('failed', 'Repository loading failed', error.message || String(error));
      window.app?.setBottomTab?.('status');
      window.app?.toggleBottomPanel?.(true);
      const label = document.getElementById('assessment-label');
      if (label) label.textContent = `Repository load failed: ${error.message || 'request failed'}`;
      throw error;
    }
  }

  async function saveWorkspace() {
    if (!assessmentId) return;
    if (window.editorManager.activeTab) window.editorManager.saveActiveFile();
    for (const path of window.vfs.getAllPaths()) {
      if (preservedAssetPaths.has(path) || unavailablePaths.has(path) || path.endsWith('/.keep')) continue;
      await call(`/api/assessments/${assessmentId}/file?path=${encodeURIComponent(path)}`, {
        method: 'PUT', body: JSON.stringify({ content: window.vfs.readFile(path) })
      });
    }
  }

  const loadBtn = document.getElementById('assessment-load');
  if (loadBtn) {
    loadBtn.onclick = () => loadRepository().catch(error => alert(error.message));
  }
  const retryRepositoryBtn = document.getElementById('setup-reload-repository');
  if (retryRepositoryBtn) retryRepositoryBtn.onclick = () => loadRepository().catch(() => {});
  const retryDependenciesBtn = document.getElementById('setup-retry-dependencies');
  if (retryDependenciesBtn) retryDependenciesBtn.onclick = async () => {
    retryDependenciesBtn.disabled = true;
    try {
      await call(`/api/assessments/${assessmentId}/setup/retry`, { method: 'POST' });
      window.app?.setBottomTab?.('status');
      window.app?.toggleBottomPanel?.(true);
      dependencyInstallMessageShown = false;
      watchDependencySetup();
      await refresh();
    } catch (error) {
      window.terminal?.logSystem?.(`DEPENDENCY RETRY FAILED: ${error.message}`);
      alert(error.message);
    } finally {
      retryDependenciesBtn.disabled = false;
      await refresh().catch(() => {});
    }
  };

  const testsBtn = document.getElementById('assessment-run-generated') || document.getElementById('assessment-tests');
  if (testsBtn) {
    testsBtn.onclick = async () => {
      if (!assessmentId) {
        alert('No active assessment session.');
        return;
      }
      const previousMarkup = testsBtn.innerHTML;
      const previousTitle = testsBtn.title;
      testsBtn.disabled = true;
      testsBtn.title = 'Installing/checking project dependencies and running the focused test…';
      testsBtn.innerHTML = '<span class="codicon codicon-loading codicon-modifier-spin"></span>';
      if (window.terminal && typeof window.terminal.logSystem === 'function') window.terminal.logSystem('Installing/checking project dependencies, then running the focused test…');
      try {
        await saveWorkspace();
        const result = await call(`/api/assessments/${assessmentId}/run`, { method: 'POST' });
        await call(`/api/assessments/${assessmentId}/diagnostics`, { method: 'POST', body: JSON.stringify({ stdout: result.stdout || '', stderr: result.stderr || '', summary: result.error || result.status || '', exit_code: result.exit_code ?? null, timed_out: result.status === 'timeout', duration_seconds: result.duration_seconds ?? null }) }).catch(() => {});
        if (window.terminal && typeof window.terminal.logSystem === 'function') {
          window.terminal.logSystem(`FOCUSED TEST: ${result.status === 'passed' ? 'PASS' : result.status === 'failed' ? 'FAIL' : result.status.toUpperCase()}`);
          window.terminal.logSystem(JSON.stringify(result, null, 2));
        }
        alert(result.status === 'blocked' ? result.error : `Tests ${result.status}`);
      } catch (error) {
        if (window.terminal && typeof window.terminal.logSystem === 'function') window.terminal.logSystem(`FOCUSED TEST ERROR: ${error.message}`);
        alert(error.message);
      } finally {
        testsBtn.disabled = false;
        testsBtn.title = previousTitle;
        testsBtn.innerHTML = previousMarkup;
      }
    };
  }

  const submitButton = document.getElementById('assessment-submit');
  if (submitButton) {
    submitButton.onclick = async () => {
      if (submitButton.disabled) return;
      if (!assessmentId) {
        alert('No active assessment session found. Please launch from the assessment dashboard.');
        return;
      }
      submitButton.disabled = true;
      const prevHtml = submitButton.innerHTML;
      submitButton.textContent = autoSubmitStarted ? 'Time up · evaluating…' : 'Evaluating…';
      try {
        await saveWorkspace();
        const result = await call(`/api/assessments/${assessmentId}/submit`, { method: 'POST' });
        clearInterval(challengeCountdownInterval);
        const verdict = result.correctness === 'correct' ? 'Correct' : result.correctness === 'incorrect' ? 'Incorrect' : 'Could not verify';
        const approach = result.approach?.detail || result.approach?.comparison || 'Approach comparison unavailable.';
        if (window.terminal && typeof window.terminal.logSystem === 'function') {
          window.terminal.logSystem(JSON.stringify(result, null, 2));
        }
        for (const id of ['assessment-submit', 'assessment-load', 'assessment-tests', 'assessment-hints', 'assessment-run-generated']) {
          const button = document.getElementById(id);
          if (button) button.hidden = true;
        }
        purgeStoredAssessmentCopy(window.vfs?.projectName);
        window.editorManager?.closeAllTabs();
        window.vfs.files = {};
        window.vfs.projectName = 'assessment-submitted';
        window.vfs.notify('project-loaded', { projectName: window.vfs.projectName });
        assessmentSnapshotLoaded = false;
        alert(`${verdict}: ${result.reason || 'Evaluation complete.'}\n\nApproach: ${approach}`);
        window.parent.postMessage({ type: 'momentum-repo-assessment-submitted', assessmentId }, window.location.origin);
      } catch (error) { alert(error.message); }
      finally {
        submitButton.disabled = false;
        submitButton.innerHTML = prevHtml;
      }
    };
  }

  if (assessmentId) {
    refresh().then(async assessment => {
      if (assessment && ['ready', 'needs_review'].includes(assessment.status)) {
        for (let attempt = 0; attempt < 300 && !window.editorManager?.editor; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
        if (!window.editorManager?.editor) throw new Error('The code editor did not finish initializing. Reload this page and use Retry repository loading.');
        await loadRepository();
        if (assessment.status === 'ready') {
          const start = await call(`/api/assessments/${assessmentId}/start`, { method: 'POST' });
          startChallengeCountdown(start.expires_at);
        }
      }
    }).catch(error => {
      updateRepositoryLoad('failed', 'Editor or repository failed to initialize', error.message || 'request failed');
      window.app?.setBottomTab?.('status');
      window.app?.toggleBottomPanel?.(true);
      const label = document.getElementById('assessment-label');
      if (label) label.textContent = `Could not open assessment: ${error.message || 'request failed'}`;
    });
  }
})();


