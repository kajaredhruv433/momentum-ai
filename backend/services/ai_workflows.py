"""Small LangChain/LangGraph bridge for existing synchronous AI providers."""

from __future__ import annotations

from typing import Any, Callable, TypedDict

from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, START, StateGraph


class _CallState(TypedDict, total=False):
    call: Callable[[], Any]
    result: Any


def _invoke_call(state: _CallState) -> _CallState:
    # Route generation through a LangChain Runnable managed by LangGraph.
    runnable = RunnableLambda(lambda callback: callback())
    return {"result": runnable.invoke(state["call"])}


_call_graph = StateGraph(_CallState)
_call_graph.add_node("invoke_provider", _invoke_call)
_call_graph.add_edge(START, "invoke_provider")
_call_graph.add_edge("invoke_provider", END)
_compiled_call_graph = _call_graph.compile()


def run_model_call(call: Callable[[], Any]) -> Any:
    """Run an existing provider call through the shared LangChain/LangGraph flow."""
    return _compiled_call_graph.invoke({"call": call})["result"]
