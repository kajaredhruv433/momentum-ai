import sys
import time
import subprocess
import tempfile
import os

def execute_code(language: str, code: str, test_cases: list = None) -> dict:
    lang = language.lower()
    start_time = time.time()

    if lang in ["python", "py", "python3"]:
        return run_python(code, test_cases)
    elif lang in ["javascript", "js", "node"]:
        return run_node(code, test_cases)
    else:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Language '{language}' execution not supported locally without container.",
            "executionTime": 0
        }

def run_python(code: str, test_cases: list = None) -> dict:
    start_time = time.time()
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write(code)
            temp_path = f.name

        proc = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        duration = round((time.time() - start_time) * 1000, 2)
        try:
            os.remove(temp_path)
        except Exception:
            pass

        return {
            "success": proc.returncode == 0,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "executionTime": duration,
            "status": "Accepted" if proc.returncode == 0 else "Runtime Error"
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Time Limit Exceeded (10s)",
            "executionTime": 10000,
            "status": "Time Limit Exceeded"
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "executionTime": 0,
            "status": "Error"
        }

def run_node(code: str, test_cases: list = None) -> dict:
    start_time = time.time()
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write(code)
            temp_path = f.name

        proc = subprocess.run(
            ["node", temp_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        duration = round((time.time() - start_time) * 1000, 2)
        try:
            os.remove(temp_path)
        except Exception:
            pass

        return {
            "success": proc.returncode == 0,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "executionTime": duration,
            "status": "Accepted" if proc.returncode == 0 else "Runtime Error"
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Time Limit Exceeded (10s)",
            "executionTime": 10000,
            "status": "Time Limit Exceeded"
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "executionTime": 0,
            "status": "Error"
        }
