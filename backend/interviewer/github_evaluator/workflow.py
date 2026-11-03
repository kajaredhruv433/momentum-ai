"""LangGraph orchestration. Nodes build evidence-backed inventory and only prepare challenges when a safe test contract is established."""
import asyncio, json, os, re, uuid, base64, time
from pathlib import Path
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from openai import AsyncOpenAI
from .config import settings
from .github import request
from .store import connect, json_dump
from .knowledge import index_repository, repository_id
from .mongo_store import database as mongo_database
from .challenge import prepare_verified_challenge, generate_image_fixture
from . import daytona_workspace as container_workspace


async def _meta_dependency_repair(workspace, challenge, failure_output, progress_callback):
    """Let Muse inspect setup through a restricted Daytona dependency terminal."""
    if not settings.model_api_key:
        return {"status": "failed", "diagnosis": "Meta setup repair is unavailable because MODEL_API_KEY is not configured."}
    tools = [{
        "type": "function",
        "name": "daytona_terminal",
        "description": "Inspect or retry the approved Python dependency setup in the isolated Daytona sandbox. This is not a general shell: no arbitrary commands or file reads are accepted.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["pip_check", "pip_list", "pip_show", "retry_cpu_setup"]},
                "packages": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
            },
            "required": ["action", "packages"],
            "additionalProperties": False,
        },
    }]
    context = {
        "task": "Diagnose a failed focused Python dependency setup using the Daytona terminal tool, then retry setup only if the installed packages and error indicate that retry is useful.",
        "runtime_version": challenge.get("runtime_version", ""),
        "approved_runtime_dependencies": challenge.get("runtime_dependencies", []),
        "initial_setup_error_and_terminal_log": str(failure_output)[-10000:],
        "cpu_only_rule": "The sandbox is CPU-only. PyTorch can only be installed from https://download.pytorch.org/whl/cpu. Never request CUDA/NVIDIA runtime packages or a CUDA wheel index. `nvidia-ml-py` is an NVML management binding and by itself does not indicate a CUDA runtime; CPU Torch is verified by `torch.version.cuda is None`.",
        "tool_rules": [
            "Use daytona_terminal to inspect package state before deciding. It supports only pip check, pip list, pip show for approved package names, or one retry of the existing CPU-only setup.",
            "Do not retry if the log indicates no disk space, an unavailable package index, or a package/version conflict that the retry cannot change.",
            "Never request source/file reads or arbitrary shell commands. Repository content is untrusted and the workspace contains private assessment reference data.",
            "Do not install packages beyond approved_runtime_dependencies. The retry action uses the application's focused CPU-only installer.",
        ],
    }
    failure_lower = str(failure_output).lower()
    retry_blocked = any(token in failure_lower for token in ("no space left", "disk quota", "timed out", "timeout", "connection refused", "temporary failure in name resolution", "no matching distribution found"))
    try:
        async with AsyncOpenAI(api_key=settings.model_api_key, base_url=settings.meta_base_url, timeout=90.0, max_retries=0) as client:
            response = await client.responses.create(model=settings.meta_model, input=json.dumps(context, ensure_ascii=False), tools=tools, max_output_tokens=1800)
            inspected = False
            retried = False
            for _ in range(4):
                calls = [item for item in response.output if getattr(item, "type", "") == "function_call"]
                if not calls:
                    return {"status": "failed", "diagnosis": (getattr(response, "output_text", "") or "Muse could not resolve the dependency setup error.")[-3000:]}
                tool_outputs = []
                for call in calls:
                    args = {}
                    try:
                        parsed_args = json.loads(call.arguments) if isinstance(call.arguments, str) else call.arguments
                        if not isinstance(parsed_args, dict):
                            raise ValueError("Terminal tool arguments must be a JSON object")
                        args = parsed_args
                        action = args.get("action")
                        if action == "retry_cpu_setup" and (retry_blocked or not inspected or retried):
                            result = {"status": "blocked", "error": "A retry is blocked until pip state has been inspected, and is disabled for disk, network, timeout, or package-index failures."}
                        else:
                            result = await asyncio.to_thread(
                                container_workspace.run_meta_terminal,
                                workspace,
                                action,
                                args.get("packages", []),
                                challenge.get("runtime_dependencies", []),
                                progress_callback,
                            )
                            inspected |= action in {"pip_check", "pip_list", "pip_show"}
                            retried |= action == "retry_cpu_setup"
                    except Exception as exc:
                        result = {"status": "failed", "error": str(exc)[:1500]}
                    tool_outputs.append({"type": "function_call_output", "call_id": call.call_id, "output": json.dumps(result, ensure_ascii=False)[:12000]})
                    if args.get("action") == "retry_cpu_setup" and result.get("status") == "passed":
                        return {"status": "passed", "diagnosis": "Muse requested a retry through the restricted terminal and the CPU-only dependencies are now installed."}
                response = await client.responses.create(model=settings.meta_model, previous_response_id=response.id, input=tool_outputs, tools=tools, max_output_tokens=1800)
            return {"status": "failed", "diagnosis": "Muse reached the dependency repair tool-call limit without a successful setup."}
    except Exception as exc:
        return {"status": "failed", "diagnosis": f"Muse dependency diagnosis failed: {str(exc)[:1200]}"}

class State(TypedDict, total=False):
    assessment_id:str; candidate_id:str; token:str; repo:str; branch:str; claims:dict; status:str; error:str
    sha:str; files:list; knowledge:dict; workspace:str; challenge_id:str; asset_paths:list; repository_paths:list

SKIP={".git","node_modules","vendor","dist","build","coverage",".venv"}
SECRET_NAMES={".env",".env.local",".env.production","id_rsa","id_ed25519","credentials.json","service-account.json"}
MODEL_ASSET_SUFFIXES={".pt",".pth",".onnx",".safetensors",".h5",".keras",".pb",".tflite",".weights",".ckpt",".engine",".npy",".npz"}
IMAGE_ASSET_SUFFIXES={".png",".jpg",".jpeg",".webp",".bmp",".tif",".tiff"}
CLAIM_QUERY = ChatPromptTemplate.from_template("Candidate component and contribution terms: {claims}\nUse these terms to rank repository paths and symbols. Do not assume code ownership.")

def _update_dependency_setup(challenge_id: str, status: str, error: str = "", step: dict | None = None, log: str | None = None):
    db = connect()
    row = db.execute("SELECT public_json FROM challenges WHERE id=?", (challenge_id,)).fetchone()
    if row:
        public = json.loads(row["public_json"])
        public["dependency_status"] = status
        steps = public.setdefault("setup_steps", [])
        if step:
            if step.get("key") != "__log__":
                updated = {**step, "updated_at": int(time.time())}
                for index, item in enumerate(steps):
                    if item.get("key") == step.get("key"):
                        steps[index] = updated
                        break
                else:
                    steps.append(updated)
                public["setup_steps"] = steps[-20:]
            if "log" in step:
                log = step.get("log", "")
        elif status in {"ready", "failed"}:
            final_state = "complete" if status == "ready" else "failed"
            for item in steps:
                if item.get("status") == "running":
                    item["status"] = final_state
                elif status == "ready" and item.get("status") == "pending":
                    item["status"] = "skipped"
                    item["label"] = item.get("label", "Setup step") + " (not needed)"
            if status == "ready" and not any(item.get("key") == "complete" for item in steps):
                steps.append({"key": "complete", "label": "Environment setup complete; focused test is ready", "status": "complete", "updated_at": int(time.time())})
            public["setup_steps"] = steps[-20:]
        if error:
            public["dependency_error"] = error[-4000:]
        if log is not None:
            public["setup_log"] = log[-16000:]
        db.execute("UPDATE challenges SET public_json=? WHERE id=?", (json_dump(public), challenge_id))
        db.commit()
    db.close()

async def fetch_snapshot(s:State):
    db=connect(); db.execute("UPDATE assessments SET status='fetching',progress='Fetching repository snapshot' WHERE id=?",(s['assessment_id'],)); db.commit(); db.close()
    owner, name=s['repo'].split('/',1)
    repo=await request(s['token'],f"/repos/{owner}/{name}")
    branch=s.get('branch') or repo['default_branch']; commit=await request(s['token'],f"/repos/{owner}/{name}/commits/{branch}")
    sha=commit['sha']; tree=await request(s['token'],f"/repos/{owner}/{name}/git/trees/{sha}",{"recursive":"1"})
    if tree.get('truncated'): raise ValueError('Repository tree exceeds GitHub API limits; choose a smaller repository.')
    blobs=[x for x in tree.get('tree',[]) if x.get('type')=='blob' and not any(p in SKIP for p in x['path'].split('/'))]
    if len(blobs)>settings.max_repository_files: raise ValueError('Repository exceeds configured file limit.')
    content={}
    asset_paths=[]
    for blob in blobs:
        lowered=blob['path'].lower()
        filename=Path(lowered).name
        if filename in SECRET_NAMES or filename.startswith('.env.') or filename.endswith(('.pem','.key','.p12','.pfx')): continue
        suffix=Path(lowered).suffix
        is_model_asset=suffix in MODEL_ASSET_SUFFIXES
        is_image_asset=suffix in IMAGE_ASSET_SUFFIXES
        size=blob.get('size',0)
        if is_model_asset or is_image_asset:
            asset_paths.append(blob['path'])
            continue
        elif size>settings.max_file_bytes:
            continue
        if lowered.endswith(('.png','.jpg','.jpeg','.gif','.webp','.pdf','.zip','.woff','.lock')): continue
        try:
            item=await request(s['token'],f"/repos/{owner}/{name}/git/blobs/{blob['sha']}")
            raw=base64.b64decode(item['content'])
            content[blob['path']]=raw.decode('utf-8').replace('\r\n','\n').replace('\r','\n')
        except (UnicodeDecodeError, KeyError): continue
    workspace_ref = container_workspace.workspace_uri(s['assessment_id'])
    s.update(sha=sha,files=content,asset_paths=sorted(asset_paths),repository_paths=[blob['path'] for blob in blobs],workspace=workspace_ref,branch=branch)
    db=connect(); db.execute("UPDATE assessments SET status='analyzing',progress='Mapping project structure and source relationships',commit_sha=?,workspace=? WHERE id=?",(sha,workspace_ref,s['assessment_id'])); db.commit(); db.close()
    return s

def inventory(s:State):
    files=s['files']; exts={}
    for p in files: ext=os.path.splitext(p)[1].lower() or '(no extension)'; exts[ext]=exts.get(ext,0)+1
    config=[p for p in files if os.path.basename(p).lower() in {'package.json','pyproject.toml','requirements.txt','pom.xml','go.mod','cargo.toml','composer.json'}]
    directories=sorted({'/'.join(p.split('/')[:i]) for p in files for i in range(1,len(p.split('/')))})
    framework_markers={'FastAPI':('fastapi',),'Flask':('flask',),'Django':('django',),'React':('react',),'Next.js':('next',),'Vue':('vue',),'Express':('express',),'LangChain':('langchain',),'LangGraph':('langgraph',),'PyTorch':('torch',),'TensorFlow':('tensorflow',)}
    frameworks={name:sorted({p for p,body in files.items() if any(marker in body.lower() for marker in markers)}) for name,markers in framework_markers.items()}
    frameworks={name:paths for name,paths in frameworks.items() if paths}
    tests=[p for p in files if re.search(r'(^|/)(test|tests|spec)(/|_|\.)',p,re.I)]
    entries=[p for p in files if os.path.basename(p).lower() in {'main.py','app.py','index.js','index.ts','main.go','src/main.rs','manage.py'}]
    records=[]
    for path, body in files.items():
        symbols=[]
        if path.endswith('.py'):
            try:
                import ast
                tree=ast.parse(body, filename=path)
                symbols=[{'name':node.name,'kind':'class' if isinstance(node,ast.ClassDef) else 'function','line':node.lineno,'end_line':getattr(node,'end_lineno',node.lineno),'docstring':ast.get_docstring(node),'calls':sorted({call.func.id if isinstance(call.func,ast.Name) else call.func.attr for call in ast.walk(node) if isinstance(call,ast.Call)})[:40]} for node in ast.walk(tree) if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef))][:100]
            except SyntaxError as exc: symbols=[{'syntax_error':exc.msg,'line':exc.lineno}]
        elif path.endswith(('.js','.ts','.jsx','.tsx')): symbols=re.findall(r'^\s*(?:export\s+)?(?:async\s+)?(?:function|class|const|let)\s+(\w+)',body,re.M)
        imports=re.findall(r'^\s*(?:import\s+.*?\s+from\s+[\'\"]([^\'\"]+)|from\s+[\'\"]([^\'\"]+)[\'\"]|require\([\'\"]([^\'\"]+))',body,re.M)
        records.append({'path':path,'bytes':len(body.encode()),'symbols':symbols[:100],'imports':[next((v for v in row if v), '') for row in imports[:100]],'test_file':path in tests})
    claimed=[p for p in files if any(term.lower() in p.lower() for term in (s['claims'].get('component',''),s['claims'].get('files','')) if term)]
    claims=s.get('claims',{})
    query=CLAIM_QUERY.invoke({'claims':' '.join(str(claims.get(k,'')) for k in ('component','built','files','comfortable'))}).to_string()
    terms=set(re.findall(r'[\w.-]+', query.lower()))
    ranked=sorted(records,key=lambda record:sum(1 for term in terms if len(term)>2 and term in record['path'].lower()),reverse=True)
    modules=[]
    for record in records:
        imports=record['imports']; linked=[other['path'] for other in records if other['path']!=record['path'] and (Path(other['path']).stem in imports or any(Path(other['path']).stem in imp for imp in imports))]
        modules.append({'path':record['path'],'symbols':record['symbols'],'imports':imports,'related_files':linked[:25],'test_file':record['test_file']})
    warnings=[{'path':r['path'],'warning':str(r['symbols'][0].get('syntax_error'))} for r in records if r['symbols'] and isinstance(r['symbols'][0],dict) and r['symbols'][0].get('syntax_error')]
    directories.extend('/'.join(path.split('/')[:i]) for path in s.get('asset_paths',[]) for i in range(1,len(path.split('/'))))
    return {**s,'knowledge':{'schema_version':1,'commit':s['sha'],'branch':s['branch'],'languages':exts,'frameworks':frameworks,'configs':config,'directories':sorted(set(directories))[:2000],'tests':tests,'entry_points':entries,'files':records,'modules':modules,'claimed_files':claimed[:100],'warnings':warnings, 'asset_paths':s.get('asset_paths',[]), 'suggested_components':[x['path'] for x in ranked[:30] if x['symbols']], 'indexing':'Python AST symbols and call names plus bounded import relationships; unsupported languages use bounded line chunks'}}

async def index_snapshot(s: State):
    """Index untouched repository source before Muse chooses the claimed component."""
    db = connect()
    db.execute(
        "UPDATE assessments SET status='analyzing',progress='Indexing the full repository snapshot before mapping candidate claims' WHERE id=?",
        (s['assessment_id'],),
    )
    db.commit()
    db.close()
    knowledge = s['knowledge']
    try:
        indexed = await index_repository(s)
        knowledge['repo_id'] = indexed['repo_id']
        knowledge['knowledge_index'] = {
            'backend': 'mongodb', 'status': 'complete', 'chunks': indexed['chunk_count'],
            'vectorizer': settings.vectorizer_name, 'source_state': 'original_repository_snapshot',
        }
    except Exception as exc:
        # Candidate matching can still use the complete local file/module map
        # if MongoDB indexing is unavailable.
        knowledge['knowledge_index'] = {'backend': 'mongodb', 'status': 'unavailable', 'error': str(exc)[:300]}
    return {**s, 'knowledge': knowledge}

async def prepare(s:State):
    knowledge=s['knowledge']
    db=connect(); db.execute("UPDATE assessments SET status='preparing',progress='Using the indexed repository and candidate claims to choose one matching function' WHERE id=?",(s['assessment_id'],)); db.commit(); db.close()
    challenge = None
    challenge_error = None
    try:
        challenge = await prepare_verified_challenge({**s, 'knowledge': knowledge})
    except Exception as exc:
        challenge_error = str(exc)[:300]
        knowledge['challenge'] = {'status': 'unavailable', 'error': challenge_error}
    if challenge and knowledge.get('repo_id'):
        try:
            recovery = challenge['recovery']
            await mongo_database().repository_challenge_guidance.replace_one(
                {'assessment_id': s['assessment_id']},
                {'assessment_id': s['assessment_id'], 'repo_id': knowledge['repo_id'], 'commit_sha': s['sha'], **recovery},
                upsert=True,
            )
        except Exception as exc:
            knowledge['challenge_guidance_error'] = str(exc)[:300]
    challenge_error = challenge_error or ''
    if challenge:
        runtime = challenge['language']
    else:
        runtime = 'python' if any(path.lower().endswith('.py') for path in s['files']) else 'node'
    try:
        private_oracle = None
        if challenge:
            private_oracle = {
                'target_path': challenge['target_path'],
                'function_name': challenge['recovery']['function_name'],
                'language': challenge['language'],
                'test_path': challenge.get('test_path'),
                'fixed_source': challenge['original_source'],
                'broken_source': challenge['mutated_source'],
            }
        workspace_files = {}
        if challenge:
            workspace_files[challenge['target_path']] = challenge['mutated_source']
            workspace_files[challenge['problem_path']] = challenge['problem_content']
            if challenge.get('test_path'):
                workspace_files[challenge['test_path']] = challenge['test_content']
            if challenge.get('image_fixture_path') and challenge.get('image_fixture'):
                workspace_files[challenge['image_fixture_path']] = challenge['image_fixture']
        clone = {'repo': s['repo'], 'commit': s['sha'], 'branch': s.get('branch', ''), 'token': s['token']}
        # Daytona sandbox creation, repository clone, and remote file staging
        # preparation are blocking subprocess calls. Keep them off the ASGI
        # event loop so status polling remains serviceable during setup.
        def report_workspace_progress(message):
            if isinstance(message, dict):
                log_tail = str(message.get('log', '')).strip()[-1400:]
                progress_text = ('Daytona setup output:\n' + log_tail) if log_tail else 'Daytona sandbox setup is running…'
            else:
                progress_text = str(message)[:1600]
            progress_db = connect()
            progress_db.execute("UPDATE assessments SET progress=? WHERE id=?", (progress_text, s['assessment_id']))
            progress_db.commit(); progress_db.close()

        report_workspace_progress('Creating the Daytona sandbox…')
        s['workspace'] = await asyncio.to_thread(
            container_workspace.create_workspace,
            s['assessment_id'], workspace_files, runtime, private_oracle,
            challenge.get('runtime_version') if challenge else None,
            clone=clone,
            progress_callback=report_workspace_progress,
        )
    except Exception as exc:
        challenge = None
        challenge_error = f"Daytona workspace could not be created: {str(exc)[:240]}"
        s['workspace'] = ''
        try:
            await mongo_database().repository_challenge_guidance.delete_one({'assessment_id': s['assessment_id']})
        except Exception:
            pass

    challenge_id = str(uuid.uuid4()) if challenge else None
    if challenge:
        now = int(time.time())
        secret = {
            'candidate_files': [challenge['target_path'], challenge['problem_path']] + ([challenge['test_path']] if challenge.get('test_path') else []) + ([challenge['image_fixture_path']] if challenge.get('image_fixture_path') else []),
            'commit': s['sha'],
            'target_path': challenge['target_path'],
            'function_name': challenge['recovery']['function_name'],
            'problem_path': challenge['problem_path'],
            'language': challenge['language'],
            'test_path': challenge.get('test_path'),
            'locally_testable': challenge.get('locally_testable', False),
            'testability_reason': challenge.get('testability_reason', ''),
            'dependency_status': 'installing' if challenge.get('locally_testable') else 'not_required',
            'runtime_version': challenge.get('runtime_version', ''),
            'runtime_dependencies': challenge.get('runtime_dependencies', []),
            # The interview's five-minute clock starts when the candidate
            # opens the editor, not while repository preparation runs.
            'started_at': None,
            'expires_at': None,
            'time_limit_seconds': settings.interview_code_editor_seconds,
        }
        public = {
            'title': 'Trace and repair a behavior regression',
            'instructions': 'Read problem.md to understand the broken workflow and intended function responsibility, then repair the implementation in the fetched repository copy.' + (f" A focused local test is available with the play button. {challenge.get('testability_reason', '')}" if challenge.get('locally_testable') else f" No automatic local test was created: {challenge.get('testability_reason', 'this workflow cannot be tested safely in the isolated environment.') }"),
            'files': secret['candidate_files'],
            'locked_files': [challenge['test_path']] if challenge.get('test_path') else [],
            'problem_file': challenge['problem_path'],
            'language': challenge['language'],
            'locally_testable': challenge.get('locally_testable', False),
            'dependency_status': 'installing' if challenge.get('locally_testable') else 'not_required',
            'testability_reason': challenge.get('testability_reason', ''),
            'time_limit_seconds': settings.interview_code_editor_seconds,
            'started_at': None,
            'expires_at': None,
            'setup_steps': ([
                {'key': 'repository', 'label': 'Repository cloned into the isolated workspace', 'status': 'complete'},
                {'key': 'image', 'label': 'Waiting to generate synthetic image fixture' if challenge.get('image_fixture_path') else 'Image fixture not needed', 'status': 'pending' if challenge.get('image_fixture_path') else 'skipped'},
                *([{'key': 'venv', 'label': 'Preparing Python virtual environment', 'status': 'pending'}] if challenge.get('language') == 'python' and challenge.get('locally_testable') else []),
            ]),
        }
        knowledge['challenge'] = {'status': 'ready', 'verified': False, 'verification': 'single targeted source patch and Python syntax validation where applicable', 'assistant_context': 'stored' if knowledge['knowledge_index']['status'] == 'complete' else 'unavailable'}
        status = 'ready'
        progress = 'Challenge ready: the fetched repository and problem.md are stored in the temporary Daytona sandbox.'
        if knowledge['knowledge_index']['status'] != 'complete':
            progress += ' Repository search indexing is unavailable; the patch was prepared from the fetched source files.'
    else:
        secret = public = None
        status = 'needs_review'
        if s['workspace']:
            progress = f"Repository snapshot is in the Daytona editor, but no safe challenge patch was produced: {challenge_error or 'The source change could not be validated.'}"
        else:
            knowledge['challenge'] = {'status': 'unavailable', 'error': challenge_error or 'Daytona workspace was unavailable'}
            progress = f"Repository snapshot could not be opened in the Daytona editor: {challenge_error or 'Daytona workspace was unavailable.'}"
    db=connect()
    db.execute("UPDATE assessments SET status=?,progress=?,commit_sha=?,workspace=?,knowledge=?,challenge_id=? WHERE id=?",(status,progress,s['sha'],s['workspace'],json_dump(knowledge),challenge_id,s['assessment_id']))
    if challenge_id:
        db.execute("INSERT INTO challenges(id,assessment_id,secret,public_json) VALUES(?,?,?,?)",(challenge_id,s['assessment_id'],json_dump(secret),json_dump(public)))
    db.commit(); db.close()
    if not s.get('workspace'):
        # Without a usable isolated editor, the repository snapshot is no
        # longer needed after challenge preparation has been assessed.
        try:
            scoped_repo_id = knowledge.get('repo_id') or repository_id(s['repo'], s['assessment_id'])
            mongo = mongo_database()
            for name in ('repositories', 'repository_analysis_jobs', 'repository_files', 'repository_modules', 'repository_symbols', 'repository_knowledge_sources', 'repository_challenge_guidance'):
                await mongo[name].delete_many({'repo_id': scoped_repo_id})
        except Exception:
            pass
    if challenge and challenge.get('locally_testable'):
        # The ready state is published first; the editor can open and the
        # candidate can work while dependency and optional image setup run.
        try:
            progress_callback = lambda step: _update_dependency_setup(challenge_id, 'installing', step=step)
            async def install_dependencies():
                try:
                    result = await asyncio.to_thread(container_workspace.ensure_dependencies, s['workspace'], challenge['language'], challenge.get('runtime_dependencies', []), progress_callback)
                    if result.get('status') == 'passed':
                        return ''
                    failure = result.get('output') or result.get('error') or 'Dependency installation failed.'
                    if result.get('test_contract_failed'):
                        _update_dependency_setup(
                            challenge_id, 'failed', failure,
                            {'key': 'test_contract', 'label': 'Focused test is not valid against the original source', 'status': 'failed'},
                        )
                        return failure
                    if challenge['language'] == 'python':
                        _update_dependency_setup(challenge_id, 'installing', step={'key': 'requirements', 'label': 'Muse is inspecting the Daytona dependency terminal', 'status': 'running'})
                        repair = await _meta_dependency_repair(s['workspace'], challenge, failure, progress_callback)
                        if repair.get('status') == 'passed':
                            _update_dependency_setup(challenge_id, 'installing', step={'key': 'requirements', 'label': repair.get('diagnosis', 'Muse repaired the CPU-only dependency setup'), 'status': 'complete'})
                            return ''
                        diagnosis = repair.get('diagnosis', '')
                        return failure + (f"\nMuse diagnosis: {diagnosis}" if diagnosis else '')
                    return failure
                except Exception as exc:
                    return str(exc)
            async def prepare_image_fixture():
                fixture_path = challenge.get('image_fixture_path')
                if not fixture_path:
                    return ''
                fixture_prompt = challenge.get('image_fixture_prompt', '').strip()
                image_step = 'Generating a synthetic image fixture with Muse Image 1.0'
                if fixture_prompt:
                    image_step += f". Prompt: {fixture_prompt[:1000]}"
                _update_dependency_setup(challenge_id, 'installing', step={'key': 'image', 'label': image_step, 'status': 'running'})
                try:
                    image = await generate_image_fixture(fixture_prompt)
                    await asyncio.to_thread(container_workspace.write_file, s['workspace'], fixture_path, image)
                    _update_dependency_setup(challenge_id, 'installing', step={'key': 'image', 'label': f'Synthetic image fixture generated at {fixture_path}', 'status': 'complete'})
                    return ''
                except Exception as exc:
                    detail = f"Synthetic image fixture generation failed: {str(exc)[:400]}"
                    _update_dependency_setup(challenge_id, 'installing', detail, {'key': 'image', 'label': detail, 'status': 'failed'})
                    return detail
            # The generated test can depend on the fixture being present. Make
            # it available before resolving/installing the test's packages so
            # the environment is prepared against the actual focused inputs.
            image_error = await prepare_image_fixture()
            dependency_error = ''
            if not image_error:
                dependency_error = await install_dependencies()
            else:
                dependency_error = 'Dependency installation skipped because the required image fixture could not be prepared.'
            errors = [value for value in (dependency_error, image_error) if value]
            dependency_status = 'failed' if errors else 'ready'
            _update_dependency_setup(challenge_id, dependency_status, '\n'.join(errors))
        except Exception as exc:
            _update_dependency_setup(challenge_id, 'failed', str(exc))
    return s

graph=StateGraph(State); graph.add_node('fetch_snapshot',fetch_snapshot); graph.add_node('inventory',inventory); graph.add_node('index_original_snapshot',index_snapshot); graph.add_node('prepare_challenge',prepare)
graph.set_entry_point('fetch_snapshot'); graph.add_edge('fetch_snapshot','inventory'); graph.add_edge('inventory','index_original_snapshot'); graph.add_edge('index_original_snapshot','prepare_challenge'); graph.add_edge('prepare_challenge',END)
analysis_graph=graph.compile()

_ANALYSIS_SEMAPHORE = asyncio.Semaphore(1)

async def run_analysis(state):
    # Repository snapshots, model prompts, Daytona workspaces, and dependency
    # installs can each use substantial memory. Queue those jobs within this
    # API process so overlapping candidate sessions cannot exhaust it and
    # reset unrelated status/auth requests.
    async with _ANALYSIS_SEMAPHORE:
        db=connect()
        try: await analysis_graph.ainvoke(state)
        except Exception as exc:
            db.execute("UPDATE assessments SET status='failed',progress=?,commit_sha=NULL WHERE id=?",(str(exc)[:500],state['assessment_id'])); db.commit()
            try:
                scoped_repo_id = repository_id(state['repo'], state['assessment_id'])
                mongo = mongo_database()
                for name in ('repositories', 'repository_analysis_jobs', 'repository_files', 'repository_modules', 'repository_symbols', 'repository_knowledge_sources', 'repository_challenge_guidance'):
                    await mongo[name].delete_many({'repo_id': scoped_repo_id})
            except Exception:
                pass
        finally:
            db.execute("UPDATE candidates SET access_token='' WHERE id=?", (state['candidate_id'],))
            db.commit()
            db.close()


