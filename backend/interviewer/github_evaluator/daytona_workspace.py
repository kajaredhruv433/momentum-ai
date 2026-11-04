"""Daytona-backed assessment workspace provider.

All remote compute operations live here so another provider can replace this
module without changing the assessment API/workflow contract.
"""
from __future__ import annotations

import ast, hashlib, json, os, re, shlex, subprocess, threading, time, uuid
from pathlib import PurePosixPath

from .config import settings
from .runtime import resolve_python_version

WORKSPACE_PREFIX = "daytona://momentum/"
_client = None
_cache: dict[str, object] = {}
_lock = threading.RLock()
_dependency_locks: dict[str, threading.Lock] = {}
MODEL_ASSET_SUFFIXES = {".pt", ".pth", ".onnx", ".safetensors", ".h5", ".keras", ".pb", ".tflite", ".weights", ".ckpt", ".engine", ".npy", ".npz", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}

def _daytona():
    global _client
    if not settings.daytona_api_key:
        raise RuntimeError("Set DAYTONA_API_KEY in backend/.env to enable remote workspaces")
    if _client is None:
        try:
            from daytona import Daytona, DaytonaConfig
        except ImportError as exc:
            raise RuntimeError("Install the Daytona SDK with: python -m pip install daytona") from exc
        _client = Daytona(DaytonaConfig(api_key=settings.daytona_api_key))
    return _client

def workspace_uri(assessment_id: str) -> str:
    return WORKSPACE_PREFIX + str(uuid.UUID(str(assessment_id)))

def _id(uri: str) -> str:
    if not isinstance(uri, str) or not uri.startswith(WORKSPACE_PREFIX):
        raise ValueError("This assessment does not use a Daytona workspace")
    return str(uuid.UUID(uri[len(WORKSPACE_PREFIX):]))

def _sandbox(uri: str):
    key = _id(uri)
    with _lock:
        if key not in _cache:
            _cache[key] = _daytona().get(key)
        return _cache[key]

def _exec(sb, command: str, timeout: int = 120, *, check: bool = True):
    # Do not set cwd to /workspace here: the first command runs before that
    # directory exists. Daytona reports a missing cwd as a bash fork/exec
    # failure, which obscures the real cause.
    response = sb.process.exec(command, timeout=timeout)
    result = getattr(response, "result", "") or ""
    code = getattr(response, "exit_code", 0)
    if check and code:
        raise RuntimeError(str(result)[-2400:] or f"Remote command failed ({code})")
    return subprocess.CompletedProcess(command, code, str(result).encode(), b"")

def _exec_with_live_logs(sb, command: str, progress_callback=None, timeout: int = 900):
    """Run a setup command in a Daytona session and forward output as it arrives."""
    import asyncio
    from daytona import SessionExecuteRequest

    session_id = "momentum-setup-" + uuid.uuid4().hex[:16]
    sb.process.create_session(session_id)
    captured = ""
    last_update = 0.0
    try:
        response = sb.process.execute_session_command(
            session_id,
            SessionExecuteRequest(command=f"timeout {int(timeout)}s {command}", run_async=True),
        )
        command_id = getattr(response, "cmd_id", None)
        if not command_id:
            raise RuntimeError("Daytona did not return a setup command ID")

        async def forward(chunk):
            nonlocal captured, last_update
            if not chunk:
                return
            captured += str(chunk).replace("\r", "\n")
            captured = captured[-16000:]
            now = time.monotonic()
            if progress_callback and now - last_update >= 0.8:
                try:
                    await asyncio.to_thread(progress_callback, {"key": "__log__", "log": captured})
                except Exception:
                    pass
                last_update = now

        async def stream():
            await sb.process.get_session_command_logs_async(
                session_id, command_id, forward, forward
            )

        async def stream_with_heartbeat():
            log_task = asyncio.create_task(stream())
            while not log_task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(log_task), timeout=8)
                except asyncio.TimeoutError:
                    if progress_callback:
                        message = (
                            {"key": "__log__", "log": captured}
                            if captured.strip()
                            else {"key": "__log__", "log": "Setup command is still running; waiting for Git and runtime checks…"}
                        )
                        try:
                            await asyncio.to_thread(progress_callback, message)
                        except Exception:
                            pass
            await log_task

        asyncio.run(asyncio.wait_for(stream_with_heartbeat(), timeout=timeout + 30))
        if progress_callback:
            try:
                progress_callback({"key": "__log__", "log": captured})
            except Exception:
                pass
        result = sb.process.get_session_command(session_id, command_id)
        code = getattr(result, "exit_code", None)
        if code is None:
            raise RuntimeError("Daytona setup command ended without an exit code")
        completed = subprocess.CompletedProcess(command, code, captured.encode(), b"")
        if code:
            raise RuntimeError((completed.stdout.decode(errors="replace")[-4000:] or f"Remote command failed ({code})"))
        return completed
    finally:
        try:
            sb.process.delete_session(session_id)
        except Exception:
            pass

def _path(path: str) -> PurePosixPath:
    if not isinstance(path, str) or not path or "\x00" in path or "\\" in path:
        raise ValueError("Invalid repository path")
    p = PurePosixPath(path)
    if p.is_absolute() or not p.parts or any(x in {"", ".", ".."} for x in p.parts) or any(x.startswith(".momentum-") for x in p.parts):
        raise ValueError("Invalid repository path")
    return p

def is_model_asset(path: str) -> bool:
    return PurePosixPath(path).suffix.lower() in MODEL_ASSET_SUFFIXES

def create_workspace(assessment_id, files, language, oracle=None, runtime_version=None, clone=None, progress_callback=None):
    def progress(message):
        if progress_callback:
            progress_callback(message)

    from daytona import CreateSandboxFromImageParams, Resources
    aid = str(uuid.UUID(str(assessment_id)))
    uri = workspace_uri(aid)
    existing = None
    try: existing = _daytona().get(aid)
    except Exception: pass
    if existing: return uri
    # The name makes remote workspace recovery possible after an API restart.
    # Daytona's wall-clock TTL is the final backstop if this API process exits
    # before its expiry sweeper can delete the assessment sandbox.
    # Use official full language images so Bash, Git, curl, and the selected
    # Node runtime are present at boot; ordinary repositories avoid apt setup.
    # The organization has a 10 GiB *aggregate* memory quota. Existing active
    # assessment sandboxes count against it, so a per-sandbox 8 GiB request
    # can be rejected before setup starts. Prefer the requested shape and
    # reduce it only when Daytona explicitly reports an aggregate quota error.
    image = "node:22-bookworm" if language == "node" else "python:3.12-bookworm"
    resource_shapes = [(4, 8, 10), (4, 4, 10), (4, 2, 10), (2, 1, 10)]
    sb = None
    last_resource_error = None
    for index, (cpu, memory, disk) in enumerate(resource_shapes):
        params = CreateSandboxFromImageParams(
            image=image,
            name=aid,
            resources=Resources(cpu=cpu, memory=memory, disk=disk),
            auto_stop_interval=0,
            ttl_minutes=max(10, settings.assessment_minutes + 40),
        )
        progress(f"Starting the {image} Daytona sandbox ({cpu} CPU, {memory} GiB RAM, {disk} GiB disk)…")
        try:
            sb = _daytona().create(params, timeout=300)
            break
        except Exception as exc:
            detail = str(exc)
            lowered = detail.lower()
            if not any(token in lowered for token in ("total memory limit exceeded", "memory limit exceeded", "resource quota")):
                raise
            last_resource_error = exc
            if index + 1 < len(resource_shapes):
                next_memory = resource_shapes[index + 1][1]
                progress(f"Daytona's aggregate memory quota is in use; retrying with {next_memory} GiB RAM…")
    if sb is None:
        raise RuntimeError(f"Daytona memory quota is full; sandbox could not be started even at the minimum resource shape: {str(last_resource_error)[:500]}")
    _cache[aid] = sb
    try:
        progress("Daytona sandbox is running. Checking repository tools and project runtime…")
        needs_lfs = bool(clone and clone.get("lfs"))
        packages = ["ca-certificates", "git"]
        if needs_lfs:
            packages.append("git-lfs")
        if language == "node":
            packages += ["curl", "nodejs", "npm"]
        else:
            # uv installs the repository's requested Python version; Ubuntu's
            # system python can differ and must never silently pick the runtime.
            packages += ["curl"]
        package_list = " ".join(shlex.quote(package) for package in packages)
        tools_check = "command -v git >/dev/null 2>&1"
        if needs_lfs:
            tools_check += " && command -v git-lfs >/dev/null 2>&1"
        tools_check += " && command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1" if language == "node" else " && command -v curl >/dev/null 2>&1"
        needs_install = _exec(sb, tools_check, 15, check=False).returncode != 0
        if needs_install:
            progress("Updating package indexes for missing repository tools (60-second limit)…")
            update_packages = (
                "set -eu; export DEBIAN_FRONTEND=noninteractive; "
                "timeout --signal=TERM --kill-after=5 60s apt-get update "
                "-o Acquire::Retries=0 -o Acquire::http::Timeout=10 -o Acquire::https::Timeout=10 "
                "-o Dpkg::Use-Pty=0"
            )
            _exec_with_live_logs(sb, update_packages, progress_callback, timeout=75)
            progress("Installing missing repository tools (60-second limit)…")
            install_packages = (
                "set -eu; export DEBIAN_FRONTEND=noninteractive; "
                "timeout --signal=TERM --kill-after=5 60s apt-get install -y --no-install-recommends "
                "-o Acquire::Retries=0 -o Acquire::http::Timeout=10 -o Acquire::https::Timeout=10 "
                "-o Dpkg::Use-Pty=0 " + package_list
            )
            _exec_with_live_logs(sb, install_packages, progress_callback, timeout=75)
        verify_tools = "test -x /usr/bin/bash && git --version"
        if needs_lfs:
            verify_tools += " && git-lfs version"
        if language == "node":
            verify_tools += " && node --version && npm --version"
        else:
            verify_tools += " && curl --version"
        _exec(sb, verify_tools, 30)
        if language == "python":
            requested = str(runtime_version or "3.9").strip()
            match = re.search(r"(?<!\d)(3\.\d{1,2}(?:\.\d{1,2})?)(?!\d)", requested)
            python_version = match.group(1) if match else "3.9"
            progress(f"Installing Python {python_version} and creating the project virtual environment…")
            setup_python = (
                "set -eu; if ! command -v uv >/dev/null 2>&1; then "
                "curl --connect-timeout 12 --max-time 45 -fsSL https://astral.sh/uv/install.sh -o /tmp/uv-install.sh; "
                "UV_INSTALL_DIR=/usr/local/bin sh /tmp/uv-install.sh; fi; "
                f"UV_PYTHON_INSTALL_DIR=/opt/uv-python uv python install {shlex.quote(python_version)}; "
                "mkdir -p /workspace; "
                f"UV_PYTHON_INSTALL_DIR=/opt/uv-python uv venv --seed --python {shlex.quote(python_version)} /workspace/.venv; "
                f"printf '%s' {shlex.quote(python_version)} > /workspace/.momentum-python-version; "
                "/workspace/.venv/bin/python --version"
            )
            _exec_with_live_logs(sb, setup_python, progress_callback, timeout=300)
            progress(f"Python {python_version} virtual environment is ready.")
        if clone:
            repo, commit, token = clone.get("repo", ""), clone.get("commit", ""), clone.get("token", "")
            if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo) or not re.fullmatch(r"[0-9a-f]{40,64}", commit) or not token:
                raise ValueError("A valid repository, pinned commit, and GitHub access token are required")
            branch = clone.get("branch", "")
            url = f"https://x-access-token:{token}@github.com/{repo}.git"
            if needs_lfs:
                _exec(sb, "git lfs install --system", 30)
            progress(f"Git is ready. Fetching {repo} at pinned commit {commit[:12]}…")
            # Fetch the pinned SHA directly. A shallow clone of a branch tip
            # can omit the requested commit when the branch has advanced.
            script = (
                "set -eu; mkdir -p /workspace; cd /workspace; git init -q; "
                f"git remote add origin {shlex.quote(url)}; "
                f"git fetch --depth 1 origin {shlex.quote(commit)}; "
                "git checkout --quiet --detach FETCH_HEAD; "
                + ("git lfs pull; " if needs_lfs else "")
                + f"git remote set-url origin https://github.com/{shlex.quote(repo)}.git"
            )
            _exec(sb, script, 900)
            head = _exec(sb, "git -C /workspace rev-parse HEAD", 30).stdout.decode().strip().lower()
            if head != commit.lower():
                raise RuntimeError("Daytona Git checkout does not match the pinned repository commit")
            progress(f"Pinned repository clone complete at {commit[:12]}.")
        else:
            progress("Sandbox is ready. Staging assessment files…")
        _exec(sb, "mkdir -p /workspace/.momentum-reference && chmod 700 /workspace/.momentum-reference", 30)
        for filename, content in files.items():
            p = _path(filename); remote = "/workspace/" + p.as_posix()
            _exec(sb, f"mkdir -p {shlex.quote('/workspace/'+p.parent.as_posix())}", 30)
            data = content if isinstance(content, bytes) else content.encode()
            sb.fs.upload_file(data, remote)
        if oracle:
            sb.fs.upload_file(json.dumps(oracle, ensure_ascii=False).encode(), "/workspace/.momentum-reference/oracle.json")
            _exec(sb, "chmod 600 /workspace/.momentum-reference/oracle.json", 30)
        progress("Remote workspace is ready.")
        return uri
    except Exception:
        try: sb.delete()
        finally: _cache.pop(aid, None)
        raise

def list_files(uri):
    sb = _sandbox(uri)
    out = _exec(sb, "find /workspace -type d \\( -name node_modules -o -name .git -o -name .venv -o -name __pycache__ -o -name .next -o -name .momentum-reference -o -name dist -o -name build -o -name coverage \\) -prune -o -type f -print", 60).stdout.decode()
    return sorted(p[len('/workspace/'):] for p in out.splitlines() if p.startswith('/workspace/') and not p.startswith('/workspace/.momentum-'))

def read_file(uri, path, max_bytes=2_000_000):
    p = _path(path); sb = _sandbox(uri)
    try: data = sb.fs.download_file('/workspace/'+p.as_posix())
    except Exception as exc: raise FileNotFoundError(path) from exc
    if len(data) > max_bytes: raise ValueError("File exceeds the configured editor limit")
    return data.decode('utf-8', 'replace')

def write_file(uri, path, content):
    p = _path(path); sb = _sandbox(uri)
    _exec(sb, f"mkdir -p {shlex.quote('/workspace/'+p.parent.as_posix())} && test ! -L {shlex.quote('/workspace/'+p.as_posix())}", 30)
    sb.fs.upload_file(content if isinstance(content, bytes) else content.encode(), '/workspace/'+p.as_posix())

def write_oracle(uri, oracle):
    """Write private challenge reference data after workspace creation."""
    sb = _sandbox(uri)
    _exec(sb, "mkdir -p /workspace/.momentum-reference && chmod 700 /workspace/.momentum-reference", 30)
    sb.fs.upload_file(json.dumps(oracle, ensure_ascii=False).encode(), "/workspace/.momentum-reference/oracle.json")
    _exec(sb, "chmod 600 /workspace/.momentum-reference/oracle.json", 30)

def read_oracle(uri):
    try: value=json.loads(_sandbox(uri).fs.download_file('/workspace/.momentum-reference/oracle.json').decode())
    except Exception as exc: raise RuntimeError("Private reference data is unavailable in the Daytona workspace") from exc
    if not isinstance(value,dict): raise RuntimeError("Private reference data has an invalid format")
    return value

def _dependency_lock(uri):
    return _dependency_locks.setdefault(uri, threading.Lock())

def _dependency_signature(uri, language, runtime_dependencies=None):
    names=("requirements.txt","pyproject.toml","setup.py","setup.cfg","test.py","tests/test_momentum_generated.py") if language=="python" else ("package.json","package-lock.json","npm-shrinkwrap.json","pnpm-lock.yaml","yarn.lock","tests/momentum.generated.test.js")
    h=hashlib.sha256(language.encode())
    for name in names:
        try: h.update(name.encode()+read_file(uri,name,8_000_000).encode())
        except FileNotFoundError: pass
    h.update(json.dumps(sorted(runtime_dependencies or [])).encode()); return h.hexdigest()

def _focused_python_requirements(uri, requested):
    norm=lambda x: re.sub(r"[-_.]+","-",x).lower(); selected={norm(x) for x in requested}; specs={}
    try: manifest=read_file(uri,"requirements.txt",8_000_000)
    except FileNotFoundError: manifest=""
    for line in manifest.splitlines():
        val=line.split('#',1)[0].strip(); m=re.match(r"^([A-Za-z0-9][A-Za-z0-9._-]*)",val)
        if m: specs[norm(m.group(1))]=val
    return [specs[n] for n in sorted(selected) if n in specs]+[x for x in sorted(requested) if norm(x) not in specs]

def _cpu_torch_plan(uri, requested, requirements):
    """Split PyTorch packages so they can only come from the official CPU wheel index."""
    normalize = lambda value: re.sub(r"[-_.]+", "-", value).lower()
    parse_name = lambda value: re.match(r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)", value)
    package_names = {normalize(name) for name in requested}
    needs_torch = bool(package_names & {"torch", "torchvision", "torchaudio", "ultralytics"})
    if not needs_torch:
        return [], requirements, False

    if "ultralytics" in package_names:
        requirements = _focused_python_requirements(uri, sorted(package_names | {"torch", "torchvision"}))
    cpu_names = {"torch", "torchvision", "torchaudio"}
    cpu_requirements = []
    other_requirements = []
    for requirement in requirements:
        match = parse_name(requirement)
        name = normalize(match.group(1)) if match else ""
        if name in cpu_names:
            # Keep simple version pins from the selected manifest, but reject
            # direct URLs/options so these packages always come from CPU index.
            if re.fullmatch(r"[A-Za-z0-9._-]+(?:\[[A-Za-z0-9_,.-]+\])?(?:\s*(?:===|==|~=|!=|<=|>=|<|>)\s*[A-Za-z0-9.*+!,<>=. -]+)?", requirement):
                cpu_requirements.append(requirement.strip())
            else:
                cpu_requirements.append(match.group(1))
        elif name.startswith(("nvidia-", "cuda-")) or name in {"pytorch-cuda", "cudatoolkit", "cudnn", "triton"}:
            continue
        else:
            other_requirements.append(requirement)
    if "ultralytics" in package_names:
        for package in ("torch", "torchvision"):
            if not any(normalize((parse_name(item) or [None, ""])[1]) == package for item in cpu_requirements):
                cpu_requirements.append(package)
    return sorted(set(cpu_requirements)), other_requirements, True

def _python_test_needs_pytest(uri):
    try: read_file(uri,"tests/test_momentum_generated.py",1_000_000); return True
    except FileNotFoundError: pass
    try: source=read_file(uri,"test.py",1_000_000)
    except FileNotFoundError: return False
    try: tree=ast.parse(source)
    except SyntaxError: return False
    return any((isinstance(n,ast.Import) and any(a.name=="pytest" or a.name.startswith("pytest.") for a in n.names)) or (isinstance(n,ast.ImportFrom) and n.module and (n.module=="pytest" or n.module.startswith("pytest."))) for n in ast.walk(tree))

def ensure_dependencies(uri, language, runtime_dependencies=None, progress_callback=None):
    if language not in {"python","node"}: return {"status":"blocked","error":"No isolated dependency installer is configured for this language."}
    sb=_sandbox(uri)
    def report(key, label, status="running"):
        if progress_callback:
            progress_callback({"key": key, "label": label, "status": status})
    with _dependency_lock(uri):
        deps=sorted({x for x in (runtime_dependencies or []) if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,100}",x)})
        sig=f"{language}:{_dependency_signature(uri,language,deps)}"
        try:
            if language=="python":
                try:
                    provisioned = sb.fs.download_file('/workspace/.momentum-python-version').decode().strip()
                except Exception:
                    provisioned = ""
                metadata = {}
                runtime_names = {".python-version", ".tool-versions", "runtime.txt", "Pipfile", "pyproject.toml", "setup.cfg", "tox.ini", "Dockerfile", "README.md", "installation.md", "install.md"}
                for path in list_files(uri):
                    if PurePosixPath(path).name not in runtime_names:
                        continue
                    try:
                        metadata[path] = read_file(uri, path, 1_000_000)
                    except (FileNotFoundError, ValueError):
                        continue
                expected = resolve_python_version(metadata, provisioned, "3.9")
                if expected != provisioned:
                    report("venv", f"Repository requires Python {expected}; replacing the existing Python {provisioned or 'unknown'} environment…")
                    setup = (
                        "set -eu; command -v uv >/dev/null 2>&1 || (curl -LsSf https://astral.sh/uv/install.sh -o /tmp/uv-install.sh && UV_INSTALL_DIR=/usr/local/bin sh /tmp/uv-install.sh); "
                        f"UV_PYTHON_INSTALL_DIR=/opt/uv-python uv python install {shlex.quote(expected)}; "
                        "rm -rf /workspace/.venv; "
                        f"UV_PYTHON_INSTALL_DIR=/opt/uv-python uv venv --seed --python {shlex.quote(expected)} /workspace/.venv; "
                        f"printf '%s' {shlex.quote(expected)} > /workspace/.momentum-python-version; "
                        "rm -f /workspace/.momentum-dependencies-ready; /workspace/.venv/bin/python --version"
                    )
                    _exec_with_live_logs(sb, setup, progress_callback, timeout=900)
                    provisioned = expected
                sig=f"{language}:{expected}:{_dependency_signature(uri,language,deps)}"
                marker=sb.fs.download_file('/workspace/.momentum-dependencies-ready').decode().strip() if _exec(sb,"test -f /workspace/.momentum-dependencies-ready",10,check=False).returncode==0 else ""
                if marker==sig:
                    report("venv", f"Reused installed dependencies in Python {expected} Daytona environment", "complete")
                    report("test_contract", "Checking the focused test against the untouched source and injected regression")
                    verification = verify_generated_test(uri, language)
                    if verification.get("status") == "failed":
                        raise RuntimeError("FOCUSED_TEST_CONTRACT: " + (verification.get("error") or "The generated test did not validate against the original repository source"))
                    report("test_contract", "Focused test passes on the original source and detects the injected regression", "complete")
                    return {"status":"passed","output":"Dependencies are already available in the Daytona sandbox."}
                if not re.fullmatch(r"3\.\d{1,2}(?:\.\d{1,2})?", expected):
                    raise RuntimeError("The requested Python runtime was not provisioned in the Daytona sandbox")
                actual = _exec(sb,"/workspace/.venv/bin/python --version",30).stdout.decode().strip()
                if not re.search(rf"Python {re.escape(expected)}(?:\.\d+)?$", actual):
                    raise RuntimeError(f"Daytona venv runtime mismatch: expected Python {expected}, got {actual}")
                report("venv", f"Using Python {expected} virtual environment in the Daytona sandbox")
                report("venv", "Python virtual environment ready", "complete")
                if _python_test_needs_pytest(uri):
                    report("pytest", "Installing focused test runner: pytest")
                    _exec_with_live_logs(sb,"/workspace/.venv/bin/python -u -m pip install --progress-bar on pytest",progress_callback)
                    report("pytest", "Focused pytest runner installed", "complete")
                req=_focused_python_requirements(uri,deps)
                cpu_torch, req, verify_cpu_torch = _cpu_torch_plan(uri,deps,req)
                if cpu_torch:
                    report("requirements", "Installing CPU-only PyTorch wheels from the official CPU index")
                    cleanup_code = "import importlib.metadata as m, subprocess, sys; names=[d.metadata.get('Name','') for d in m.distributions() if d.metadata.get('Name','').lower() in {'torch','torchvision','torchaudio','triton','pytorch-cuda','cudatoolkit','cudnn'} or d.metadata.get('Name','').lower().startswith(('nvidia-','cuda-'))]; subprocess.run([sys.executable,'-m','pip','uninstall','-y',*names],check=False)"
                    cleanup_command = "/workspace/.venv/bin/python -c " + shlex.quote(cleanup_code)
                    _exec_with_live_logs(sb,cleanup_command,progress_callback)
                    cpu_command = "/workspace/.venv/bin/python -u -m pip install --no-cache-dir --progress-bar on --index-url https://download.pytorch.org/whl/cpu " + " ".join(map(shlex.quote,cpu_torch))
                    _exec_with_live_logs(sb,cpu_command,progress_callback)
                if req:
                    report("requirements", "Installing focused Python project dependencies")
                    _exec_with_live_logs(sb,"/workspace/.venv/bin/python -u -m pip install --no-cache-dir --progress-bar on "+" ".join(map(shlex.quote,req)),progress_callback)
                    report("requirements", "Focused Python project dependencies installed", "complete")
                if verify_cpu_torch:
                    # nvidia-ml-py is only an optional NVML management binding;
                    # it is not a CUDA runtime wheel. Verify the actual torch
                    # build and reject CUDA runtime libraries instead.
                    verify = "/workspace/.venv/bin/python -c " + shlex.quote("import importlib.metadata as m, torch; allowed={'nvidia-ml-py','nvidia-ml-py3'}; bad=[d.metadata.get('Name','') for d in m.distributions() if (d.metadata.get('Name','').lower().startswith(('nvidia-','cuda-'))) and d.metadata.get('Name','').lower() not in allowed]; assert torch.version.cuda is None, f'CUDA-enabled torch detected: {torch.version.cuda}'; assert not bad, f'CUDA runtime packages detected: {bad}'; print(f'CPU-only PyTorch verified: {torch.__version__}')")
                    result = _exec(sb,verify,60)
                    if progress_callback:
                        progress_callback({"key":"__log__","log":result.stdout.decode(errors="replace")[-16000:]})
            elif _exec(sb,"test -f /workspace/package.json",10,check=False).returncode==0:
                sig=f"{language}:{_dependency_signature(uri,language,deps)}"
                marker=sb.fs.download_file('/workspace/.momentum-dependencies-ready').decode().strip() if _exec(sb,"test -f /workspace/.momentum-dependencies-ready",10,check=False).returncode==0 else ""
                if marker==sig:
                    report("npm", "Reused installed dependencies in the Daytona sandbox", "complete")
                    report("test_contract", "Checking the focused test against the untouched source and injected regression")
                    verification = verify_generated_test(uri, language)
                    if verification.get("status") == "failed":
                        raise RuntimeError("FOCUSED_TEST_CONTRACT: " + (verification.get("error") or "The generated test did not validate against the original repository source"))
                    report("test_contract", "Focused test passes on the original source and detects the injected regression", "complete")
                    return {"status":"passed","output":"Dependencies are already available in the Daytona sandbox."}
                report("npm", "Installing project dependencies with npm")
                _exec_with_live_logs(sb,"sh -lc 'cd /workspace && npm install --no-audit --no-fund'",progress_callback)
                report("npm", "Node dependencies installed", "complete")
            report("test_contract", "Checking the focused test against the untouched source and injected regression")
            verification = verify_generated_test(uri, language)
            if verification.get("status") == "failed":
                raise RuntimeError("FOCUSED_TEST_CONTRACT: " + (verification.get("error") or "The generated test did not validate against the original repository source"))
            report("test_contract", "Focused test passes on the original source and detects the injected regression", "complete")
            sb.fs.upload_file(sig.encode(),'/workspace/.momentum-dependencies-ready')
            return {"status":"passed","output":"Dependencies installed inside the Daytona sandbox."}
        except Exception as exc:
            report("requirements" if language=="python" else "npm", "Dependency setup failed", "failed")
            detail = str(exc)[-3000:]
            return {"status":"failed","test_contract_failed":"FOCUSED_TEST_CONTRACT:" in detail,"output":detail}

def run_meta_terminal(uri, action, packages=None, runtime_dependencies=None, progress_callback=None):
    """Expose a small, allowlisted dependency terminal to Meta's repair tool loop."""
    packages = packages or []
    approved = {str(name).lower() for name in (runtime_dependencies or [])}
    approved.update({"pytest", "torch", "torchvision", "torchaudio", "ultralytics", "nvidia-ml-py", "nvidia-ml-py3"})
    if action == "retry_cpu_setup":
        return ensure_dependencies(uri, "python", runtime_dependencies, progress_callback)
    if action == "pip_check":
        command = "/workspace/.venv/bin/python -m pip check"
    elif action == "pip_list":
        command = "/workspace/.venv/bin/python -m pip list --format=columns"
    elif action == "pip_show":
        names = sorted({str(name) for name in packages if str(name).lower() in approved and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,100}", str(name))})
        if not names or len(names) != len(set(packages)):
            return {"status":"blocked","error":"Only approved dependency names can be inspected."}
        command = "/workspace/.venv/bin/python -m pip show " + " ".join(map(shlex.quote,names))
    else:
        return {"status":"blocked","error":"That terminal action is not available."}
    result = _exec(_sandbox(uri),command,60,check=False)
    return {"status":"passed" if result.returncode == 0 else "failed","exit_code":result.returncode,"output":result.stdout.decode(errors="replace")[-12000:]}

def _has_tests(uri, language):
    paths=list_files(uri)
    if any(x in paths for x in ("test.py","tests/test_momentum_generated.py","tests/momentum.generated.test.js")): return True
    if language=="python": return any(PurePosixPath(p).name.startswith("test_") or PurePosixPath(p).name.endswith("_test.py") for p in paths)
    try: return bool(json.loads(read_file(uri,"package.json",8_000_000)).get("scripts",{}).get("test"))
    except Exception: return False

def _run_focused_test(uri, test_path, language):
    sb = _sandbox(uri)
    if language == "python":
        if test_path == "test.py":
            command = "cd /workspace && /workspace/.venv/bin/python test.py"
        else:
            command = f"cd /workspace && /workspace/.venv/bin/python -m pytest -q -p no:cacheprovider {shlex.quote(test_path)}"
    elif language == "node":
        command = f"cd /workspace && node --test {shlex.quote(test_path)}"
    else:
        return {"status": "blocked", "output": "No focused test runner is available for this language."}
    try:
        result = _exec(sb, command, 180, check=False)
        output = result.stdout.decode(errors="replace")[-8000:]
        return {"status": "passed" if result.returncode == 0 else "failed", "exit_code": result.returncode, "output": output}
    except Exception as exc:
        return {"status": "error", "output": str(exc)[:2000]}

def verify_generated_test(uri, language):
    """Require a focused test to pass on the reference and fail on the broken target."""
    try:
        oracle = read_oracle(uri)
        test_path = str(oracle.get("test_path") or "")
        target_path = str(oracle.get("target_path") or "")
        fixed_source = str(oracle.get("fixed_source") or "")
        broken_source = str(oracle.get("broken_source") or "")
        if not test_path:
            return {"status": "skipped", "output": "No focused test was generated."}
        if not target_path or not fixed_source or not broken_source:
            return {"status": "failed", "error": "Reference source required to validate the generated test is missing."}
        current_source = read_file(uri, target_path, 2_000_000)
        try:
            write_file(uri, target_path, fixed_source)
            reference = _run_focused_test(uri, test_path, language)
            if reference.get("status") != "passed":
                return {"status": "failed", "error": "The focused test does not pass against the untouched original source. " + reference.get("output", "")[-1600:]}
            write_file(uri, target_path, broken_source)
            regression = _run_focused_test(uri, test_path, language)
            if regression.get("status") == "passed":
                return {"status": "failed", "error": "The focused test passes against the injected regression and does not distinguish the original behavior."}
            return {"status": "passed", "reference": reference, "regression": regression}
        finally:
            write_file(uri, target_path, current_source)
    except Exception as exc:
        return {"status": "failed", "error": str(exc)[:2400]}

def run_tests(uri, language, runtime_dependencies=None):
    if not _has_tests(uri,language): return {"status":"skipped","output":"No supported repository test suite was found."}
    d=ensure_dependencies(uri,language,runtime_dependencies)
    if d.get("status")!="passed": return {"status":"blocked","error":"Dependencies could not be installed inside Daytona.","output":d.get("output","")}
    paths=list_files(uri)
    if language=="python":
        cmd=("cd /workspace && /workspace/.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_momentum_generated.py" if "tests/test_momentum_generated.py" in paths else "cd /workspace && /workspace/.venv/bin/python test.py" if "test.py" in paths else "cd /workspace && /workspace/.venv/bin/python -m pytest -q -p no:cacheprovider")
    elif language=="node": cmd="cd /workspace && node --test tests/momentum.generated.test.js" if "tests/momentum.generated.test.js" in paths else "cd /workspace && npm test"
    else: return {"status":"blocked","error":"No isolated test runner is configured for this language."}
    try:
        r=_exec(_sandbox(uri),cmd,180,check=False); out=r.stdout.decode(errors='replace')[-10000:]
        return {"status":"passed" if r.returncode==0 else "failed","exit_code":r.returncode,"output":out}
    except Exception as exc: return {"status":"timeout","output":str(exc)[:1000]}

def _function_shape(source,function_name,language):
    if language!="python": return None
    try: tree=ast.parse(source)
    except SyntaxError: return None
    nodes=[n for n in ast.walk(tree) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==function_name]
    if not nodes:return None
    n=nodes[0]; return {"shape":ast.dump(n,include_attributes=False),"complexity":sum(isinstance(x,(ast.If,ast.For,ast.AsyncFor,ast.While,ast.Try,ast.IfExp,ast.Match)) for x in ast.walk(n)),"nodes":sum(1 for _ in ast.walk(n))}

def _approach(candidate,fixed):
    if not candidate or not fixed:return {"comparison":"unavailable","detail":"Could not compare the target function structure for this language."}
    if candidate['shape']==fixed['shape']:return {"comparison":"same_approach","detail":"The candidate function matches the saved reference structure."}
    cd=candidate['complexity']-fixed['complexity']; nd=candidate['nodes']-fixed['nodes']
    if cd<0 and nd<=0:return {"comparison":"better_approach","detail":"The correct implementation uses fewer branches and no more syntax nodes than the reference; this suggests a simpler structure, not necessarily faster execution."}
    if cd>0 and nd>=0:return {"comparison":"lower_grade_approach","detail":"The correct implementation uses more branches and no fewer syntax nodes than the reference, which may make it harder to maintain."}
    return {"comparison":"same_grade_different_approach","detail":"The implementation is correct and uses a different structure with no clear static complexity advantage or disadvantage."}

def _not_evaluated(): return {"comparison":"not_evaluated","detail":"Approach is evaluated only after correctness is established."}

def evaluate_submission(uri,target_path,function_name,language,fixed_source,broken_source,runtime_dependencies=None):
    candidate=read_file(uri,target_path); cs=_function_shape(candidate,function_name,language); fs=_function_shape(fixed_source,function_name,language); bs=_function_shape(broken_source,function_name,language)
    if candidate==broken_source or (cs and bs and cs['shape']==bs['shape']): return {"correctness":"incorrect","reason":"The target function still matches the intentionally broken baseline.","tests":{"status":"not_run"},"approach":_not_evaluated()}
    if candidate==fixed_source or (cs and fs and cs['shape']==fs['shape']): return {"correctness":"correct","reason":"The submitted implementation matches the saved fixed reference.","tests":{"status":"not_needed_for_reference_match"},"approach":_approach(cs,fs)}
    if not _has_tests(uri,language): return {"correctness":"unverified","reason":"No supported repository tests exist to verify this alternative implementation.","tests":{"status":"unavailable"},"approach":_not_evaluated()}
    d=ensure_dependencies(uri,language,runtime_dependencies)
    if d.get('status')!="passed": return {"correctness":"unverified","reason":"Dependencies could not be installed in the isolated sandbox.","tests":{"status":"blocked","output":d.get('output','')[-2000:]},"approach":_not_evaluated()}
    try:
        write_file(uri,target_path,fixed_source); fixed=run_tests(uri,language,runtime_dependencies)
        write_file(uri,target_path,candidate); result=run_tests(uri,language,runtime_dependencies)
    finally: write_file(uri,target_path,candidate)
    ok=fixed.get('status')=='passed' and result.get('status')=='passed'
    correctness='correct' if ok else 'incorrect' if fixed.get('status')=='passed' and result.get('status')=='failed' else 'unverified'
    return {"correctness":correctness,"reason":"The candidate and saved fixed implementation both pass the same isolated repository test suite." if ok else "The saved fixed implementation passes the repository tests, but the candidate implementation does not." if correctness=='incorrect' else "The repository tests do not provide a passing fixed reference, so correctness cannot be determined.","tests":{"candidate":result,"reference":fixed},"approach":_approach(cs,fs) if ok else _not_evaluated()}

def remove_workspace(uri):
    aid=_id(uri)
    with _lock:
        sb=_cache.pop(aid,None)
        if sb is None:
            try:
                sb=_daytona().get(aid)
            except Exception as exc:
                # Treat an already expired/deleted sandbox as successful
                # cleanup, while preserving real auth/network failures.
                if getattr(exc, "status_code", None) == 404:
                    return
                raise
        sb.delete()
