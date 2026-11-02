"""Repository interpreter selection shared by challenge planning and Daytona."""
from __future__ import annotations

import re
from pathlib import Path


def resolve_python_version(files: dict[str, str], requested: str = "", preferred: str = "3.9") -> str:
    """Use repository pins first and never accept model advice outside support docs."""
    normalized = {path.replace("\\", "/"): content for path, content in files.items()}

    # Exact interpreter pins are stronger than README compatibility ranges.
    for path, value in normalized.items():
        if Path(path).name in {".python-version", ".tool-versions", "runtime.txt"}:
            match = re.search(r"(?<!\d)(3\.\d{1,2}(?:\.\d{1,2})?)(?!\d)", value)
            if match:
                return ".".join(match.group(1).split(".")[:2])
        if Path(path).name == "Pipfile":
            match = re.search(r"(?im)^\s*python_version\s*=\s*['\"](3\.\d{1,2})(?:\.\d+)?['\"]", value)
            if match:
                return match.group(1)
        if Path(path).name == "pyproject.toml":
            requires = re.search(r"(?im)^\s*requires-python\s*=\s*['\"]([^'\"]+)['\"]", value)
            if requires:
                spec = requires.group(1)
                exact = re.search(r"(?:==|~=)\s*(3\.\d{1,2})(?:\.\d+)?(?:\.\*)?", spec)
                if exact:
                    return exact.group(1)
                lower = re.search(r">=?\s*(3\.\d{1,2})", spec)
                upper = re.search(r"<\s*(3\.\d{1,2})", spec)
                if lower and upper and lower.group(1) != upper.group(1):
                    low = tuple(map(int, lower.group(1).split(".")))
                    high = tuple(map(int, upper.group(1).split(".")))
                    choice = tuple(map(int, preferred.split(".")))
                    return preferred if low <= choice < high else lower.group(1)
                if lower and not upper:
                    return lower.group(1)
        if Path(path).name == "Dockerfile":
            match = re.search(r"(?im)^\s*FROM\s+(?:[^\s/]+/)?python:(3\.\d{1,2})(?:\.\d+)?(?:[-@\s]|$)", value)
            if match:
                return match.group(1)
        if Path(path).name == "setup.cfg":
            requires = re.search(r"(?im)^\s*python_requires\s*=\s*([^\n]+)", value)
            if requires:
                versions = re.findall(r"(?<!\d)(3\.\d{1,2})(?!\d)", requires.group(1))
                if len(versions) == 1:
                    return versions[0]
                if preferred in versions:
                    return preferred
                if versions:
                    return versions[0]

    # Human-readable prerequisites are often the only declared support range.
    supported = set()
    for path, value in normalized.items():
        if Path(path).name.lower() not in {"readme.md", "installation.md", "install.md"}:
            continue
        for line in value.splitlines():
            if re.search(r"python|interpreter", line, re.I) and re.search(r"support|require|prerequisite|version|3\.\d", line, re.I):
                supported.update(re.findall(r"(?<!\d)(3\.\d{1,2})(?!\d)", line))
    requested_match = re.search(r"(?<!\d)(3\.\d{1,2})(?!\d)", requested or "")
    if supported:
        if requested_match and requested_match.group(1) in supported:
            return requested_match.group(1)
        if preferred in supported:
            return preferred
        return sorted(supported, key=lambda version: tuple(map(int, version.split("."))))[0]
    return requested_match.group(1) if requested_match else preferred
