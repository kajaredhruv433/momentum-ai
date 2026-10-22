"""
canvas_analysis.py

Analyzes system-design canvas diagrams submitted by candidates during the interview.
Uses the shared LangChain Gemini vision model to inspect the candidate's drawing,
extracting labeled components, directional data flows / pipeline relationships, detailed architectural assessment, and suggestions.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

VISION_PROMPT = """You are a senior system design interview evaluator assessing a candidate's architectural diagram drawn on a canvas during a technical interview.

Context:
- Interview Question: {question}
- Target Role: {role}

YOUR TASKS:
1. 'components':
   - List all components, services, databases, clients, or nodes with EXPLICIT TEXT LABELS in the drawing (e.g. ["user", "backend", "database"]).
   - If shapes are completely blank or unlabeled, 'components' MUST be empty: [].

2. 'relationships' (CRITICAL - DATA FLOWS):
   - Extract every directional flow and connection between components in the format: "Source -> Destination" (e.g. "user -> backend", "backend -> database").
   - Trace arrows, lines, and sequential connections across the drawing.
   - If components are drawn with connecting arrows (e.g. user pointing to backend, backend pointing to database), you MUST list every connection in 'relationships' (e.g. ["user -> backend", "backend -> database"]).

3. 'design_notes' (DETAILED ARCHITECTURAL ASSESSMENT):
   - Write a comprehensive, multi-sentence technical evaluation of the candidate's architecture.
   - Explain what was drawn (e.g., 3-tier architecture with client, backend service, and database).
   - Evaluate communication protocols (HTTPS/REST, gRPC, DB connection pool/SQL), data flow correctness for the question, scalability bottlenecks, single points of failure, and security considerations.

4. 'suggestions' (CONCRETE IMPROVEMENTS):
   - Provide 3-4 specific architectural improvements (e.g. adding a reverse proxy / Load Balancer, Redis caching tier, message queues for async work, database replication/read-replicas, rate limiting).

Return ONLY valid JSON matching this schema:
{{
  "components": ["Component1", "Component2", "Component3"],
  "relationships": ["Component1 -> Component2", "Component2 -> Component3"],
  "design_notes": "Detailed architectural assessment of the drawing, explaining how components interact, communication protocols, bottlenecks, and scalability.",
  "suggestions": ["Actionable recommendation 1", "Actionable recommendation 2", "Actionable recommendation 3"]
}}"""


def _stringify_item(item: Any) -> str:
    """Normalize any parsed component or relationship to a clean readable string."""
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, dict):
        src = item.get("from") or item.get("source") or item.get("src")
        dst = item.get("to") or item.get("target") or item.get("dest") or item.get("destination")
        label = item.get("label") or item.get("protocol") or item.get("description")
        if src and dst:
            flow_str = f"{src} -> {dst}"
            if label:
                flow_str += f" ({label})"
            return flow_str

        parts = []
        if "name" in item:
            parts.append(str(item["name"]))
        if "type" in item and item["type"] != "service":
            parts.append(f"({item['type']})")
        if parts:
            return " ".join(parts)
        return json.dumps(item)
    return str(item).strip()


def _parse_analysis_json(raw: str) -> Dict[str, Any]:
    """Parse and normalize the LLM JSON response into a consistent structure."""
    text = raw.strip()

    # Strip markdown code blocks if present
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if match:
            text = match.group(1).strip()

    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]

    try:
        data = json.loads(text)
    except Exception as exc:
        logger.warning("Failed to parse JSON from vision response (%s). Raw: %.300s", exc, raw)
        return _empty_analysis(
            "Diagram received. Please ensure components are labeled with text and arrows show data flow."
        )

    if not isinstance(data, dict):
        return _empty_analysis("Diagram processed, but evaluation format was unexpected.")

    raw_components = (
        data.get("components")
        or data.get("nodes")
        or data.get("services")
        or data.get("elements")
        or []
    )
    if not isinstance(raw_components, list):
        raw_components = [raw_components]

    raw_relationships = (
        data.get("relationships")
        or data.get("flows")
        or data.get("data_flows")
        or data.get("dataFlows")
        or data.get("connections")
        or data.get("arrows")
        or data.get("links")
        or []
    )
    if not isinstance(raw_relationships, list):
        raw_relationships = [raw_relationships]

    raw_suggestions = (
        data.get("suggestions")
        or data.get("improvements")
        or data.get("recommendations")
        or data.get("next_steps")
        or []
    )
    if not isinstance(raw_suggestions, list):
        raw_suggestions = [raw_suggestions]

    design_notes = str(
        data.get("design_notes")
        or data.get("designNotes")
        or data.get("assessment")
        or data.get("feedback")
        or data.get("evaluation")
        or ""
    ).strip()

    components = [_stringify_item(c) for c in raw_components if c and _stringify_item(c)]
    relationships = [_stringify_item(r) for r in raw_relationships if r and _stringify_item(r)]
    suggestions = [_stringify_item(s) for s in raw_suggestions if s and _stringify_item(s)]

    # If components exist (>= 2) but relationships was not populated, guarantee flow extraction
    if len(components) >= 2 and not relationships:
        arrow_matches = re.findall(r"([A-Za-z0-9_\-\s]+)\s*(?:->|→|to|connects to|calls|sends to)\s*([A-Za-z0-9_\-\s]+)", design_notes)
        for src, dst in arrow_matches:
            src_clean = src.strip().strip("'\"")
            dst_clean = dst.strip().strip("'\"")
            if any(c.lower() == src_clean.lower() for c in components) and any(c.lower() == dst_clean.lower() for c in components):
                rel_str = f"{src_clean} -> {dst_clean}"
                if rel_str not in relationships:
                    relationships.append(rel_str)

        if not relationships:
            for i in range(len(components) - 1):
                relationships.append(f"{components[i]} -> {components[i + 1]}")

    return {
        "components": [c for c in components if c],
        "relationships": [r for r in relationships if r],
        "design_notes": design_notes or "Diagram analyzed successfully.",
        "suggestions": [s for s in suggestions if s],
    }


def _empty_analysis(reason: str) -> Dict[str, Any]:
    return {
        "components": [],
        "relationships": [],
        "design_notes": reason,
        "suggestions": [
            "Use the Text tool (T) to label every box/shape clearly (e.g. user, backend, database).",
            "Use the Arrow tool (→) to connect components and show the direction of data flow.",
            "Include key architecture tiers: clients, application servers, caches, message queues, and databases.",
        ],
    }


def analyze_canvas_diagram(
    image_data_base64: str,
    question: str,
    role: str,
) -> Dict[str, Any]:
    """
    Analyze a candidate's system-design canvas drawing using Google Gemini Vision.

    Args:
        image_data_base64: Base64-encoded PNG string (data URL or raw base64)
        question: The interview question the diagram responds to
        role: The job role being interviewed for

    Returns:
        dict with keys: components, relationships, design_notes, suggestions
    """
    if not image_data_base64:
        return _empty_analysis("No diagram image was provided.")

    if "," in image_data_base64:
        image_data_base64 = image_data_base64.split(",", 1)[1]

    image_data_base64 = image_data_base64.strip()
    if len(image_data_base64) < 50:
        return _empty_analysis("The canvas appears to be empty.")

    prompt_text = VISION_PROMPT.format(
        question=question or "System Architecture Diagram",
        role=role or "Software Engineer",
    )

    try:
        from .llm import analyze_image
        raw = analyze_image(prompt_text, image_data_base64)
        return _parse_analysis_json(raw)
    except Exception as exc:
        logger.warning("Gemini vision analysis failed; trying text fallback: %s", exc)
        return _analyze_with_gemini_text(question, role)


def _analyze_with_gemini_text(question: str, role: str) -> Dict[str, Any]:
    """Keep the previous text-only recovery path using the shared Gemini chain."""
    from .llm import ask_llm

    prompt = f"""You are a senior system design expert.

A candidate is being interviewed for the role of: {role}
They were asked: "{question}"

Visual analysis was unavailable. Return conservative reference architecture guidance for this question without claiming to have seen the candidate's drawing.

Return ONLY valid JSON:
{{
  "components": [],
  "relationships": [],
  "design_notes": "Visual analysis was unavailable. Please label diagram components and draw connecting arrows.",
  "suggestions": ["Add labeled components (e.g., API Server, Database, Cache)", "Draw arrows to indicate communication flows"]
}}"""

    try:
        return _parse_analysis_json(ask_llm(prompt))
    except Exception as exc:
        logger.error("Gemini text fallback also failed: %s", exc)
        return _empty_analysis("Analysis service unavailable.")
