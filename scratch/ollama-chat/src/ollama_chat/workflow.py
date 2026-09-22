#!/usr/bin/env python3
"""
Workflow Framework for deterministic multi-agent pipelines.

This framework provides reusable building blocks for creating workflows where
multiple AI agents collaborate with conditional routing and feedback loops.

Example workflow (spec -> implement -> review -> loop until passing):

    workflow = (
        Workflow("code_review_loop")
        .add_node("spec", SpecWriterNode(model="claude-sonnet-4-20250514", backend="claude"))
        .add_node("implement", ImplementerNode())
        .add_node("review", ReviewerNode(pass_threshold=90))
        .add_edge("spec", "implement")
        .add_edge("implement", "review")
        .add_conditional_edge(
            "review",
            lambda state: "done" if state["passed"] else "implement"
        )
        .set_entry("spec")
        .set_finish("done")
    )

    result = workflow.run({"task": "Build a CLI calculator"})
"""

from __future__ import annotations

import json
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, TypedDict

from langgraph.graph import StateGraph, END

from .config import DEFAULT_MODEL, DEFAULT_BACKEND
from .personas import get_llm
from .tools import ALL_TOOLS
from .handoffs import WorkflowRun, list_runs, get_run, print_run_summary


# =============================================================================
# STATE DEFINITIONS
# =============================================================================

class WorkflowState(TypedDict, total=False):
    """Base state for all workflows. Extend this for custom state."""
    task: str              # The original task/request
    messages: list[dict]   # Conversation history
    iteration: int         # Current loop iteration
    max_iterations: int    # Safety limit
    error: str | None      # Error message if failed


class CodeWorkflowState(WorkflowState, total=False):
    """State for code generation workflows."""
    spec: str              # Detailed specification
    code: str              # Generated code
    feedback: str          # Review feedback
    score: int             # Review score (0-100)
    passed: bool           # Whether review passed threshold


# =============================================================================
# BASE NODE CLASS
# =============================================================================

@dataclass
class Node(ABC):
    """Base class for workflow nodes."""
    name: str = ""

    @abstractmethod
    def __call__(self, state: dict) -> dict:
        """Execute the node and return state updates."""
        pass

    def _log(self, message: str):
        """Log node activity."""
        prefix = f"[{self.name}]" if self.name else "[Node]"
        print(f"{prefix} {message}")


# =============================================================================
# LLM NODE - Base for AI-powered nodes
# =============================================================================

@dataclass
class LLMNode(Node):
    """Node that invokes an LLM with a prompt template."""
    model: str = DEFAULT_MODEL
    backend: str = DEFAULT_BACKEND
    system_prompt: str = "You are a helpful assistant."
    prompt_template: str = "{task}"
    output_key: str = "response"
    stream: bool = True

    def __call__(self, state: dict) -> dict:
        self._log(f"Invoking {self.backend}:{self.model}")

        # Build the prompt from template
        prompt = self.prompt_template.format(**state)

        # Get LLM and invoke
        llm = get_llm(self.backend, self.model)

        from langchain_core.messages import HumanMessage, SystemMessage
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=prompt),
        ]

        response = ""
        if self.stream:
            for chunk in llm.stream(messages):
                print(chunk.content, end="", flush=True)
                response += chunk.content
            print()
        else:
            result = llm.invoke(messages)
            response = result.content

        return {self.output_key: response}


# =============================================================================
# SPECIALIZED NODES
# =============================================================================

@dataclass
class SpecWriterNode(LLMNode):
    """Writes detailed specifications from a task description."""
    output_key: str = "spec"
    system_prompt: str = """You are a senior technical architect. Given a task, write a detailed specification.

Include:
1. Overview - What this should do
2. Requirements - Specific features and behaviors
3. Interface - Function signatures, inputs, outputs
4. Edge cases - Error handling, boundary conditions
5. Success criteria - How to know it's working

Be precise and comprehensive. The spec will be given to another AI to implement."""

    prompt_template: str = """Write a detailed specification for this task:

{task}"""


@dataclass
class ImplementerNode(LLMNode):
    """Implements code based on a specification."""
    output_key: str = "code"
    system_prompt: str = """You are an expert programmer. Implement code exactly according to the specification.

Rules:
- Follow the spec precisely
- Write clean, well-documented code
- Handle all edge cases mentioned
- Include example usage if appropriate
- Output ONLY the code in a single Python code block

If there's feedback from a previous review, address ALL points."""

    prompt_template: str = """Specification:
{spec}

{feedback_section}

Implement this specification. Output only the Python code in a ```python code block."""

    def __call__(self, state: dict) -> dict:
        # Add feedback section if there's feedback
        feedback = state.get("feedback", "")
        if feedback:
            state = {**state, "feedback_section": f"Previous review feedback to address:\n{feedback}"}
        else:
            state = {**state, "feedback_section": ""}

        result = super().__call__(state)

        # Extract code from markdown code block
        code = result[self.output_key]
        match = re.search(r"```python\n(.*?)```", code, re.DOTALL)
        if match:
            code = match.group(1).strip()

        # Increment iteration
        iteration = state.get("iteration", 0) + 1

        return {self.output_key: code, "iteration": iteration}


@dataclass
class ReviewerNode(LLMNode):
    """Reviews code and provides a score and feedback."""
    output_key: str = "feedback"
    pass_threshold: int = 90
    system_prompt: str = """You are a senior code reviewer. Review the code against the specification.

Evaluate:
1. Correctness - Does it meet the spec?
2. Completeness - All requirements addressed?
3. Code quality - Clean, readable, well-documented?
4. Edge cases - Properly handled?
5. Best practices - Following conventions?

Output format (MUST follow exactly):
SCORE: [0-100]
FEEDBACK:
- [Point 1]
- [Point 2]
...

Be strict but fair. Only give 90+ if the code is production-ready."""

    prompt_template: str = """Specification:
{spec}

Code to review:
```python
{code}
```

Review this code against the specification. Output SCORE and FEEDBACK."""

    def __call__(self, state: dict) -> dict:
        result = super().__call__(state)
        feedback = result[self.output_key]

        # Parse score from response
        score = 0
        score_match = re.search(r"SCORE:\s*(\d+)", feedback)
        if score_match:
            score = int(score_match.group(1))

        passed = score >= self.pass_threshold

        self._log(f"Score: {score}/100 (threshold: {self.pass_threshold}) - {'PASSED' if passed else 'NEEDS WORK'}")

        return {
            self.output_key: feedback,
            "score": score,
            "passed": passed,
        }


@dataclass
class ToolNode(Node):
    """Node that can use tools to complete tasks."""
    model: str = DEFAULT_MODEL
    backend: str = DEFAULT_BACKEND
    system_prompt: str = "You are a helpful assistant with access to tools."
    prompt_template: str = "{task}"
    output_key: str = "result"
    max_tool_iterations: int = 10

    def __call__(self, state: dict) -> dict:
        from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

        self._log(f"Invoking tool-enabled {self.backend}:{self.model}")

        llm = get_llm(self.backend, self.model)
        llm_with_tools = llm.bind_tools(ALL_TOOLS)

        prompt = self.prompt_template.format(**state)
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=prompt),
        ]

        for i in range(self.max_tool_iterations):
            response = llm_with_tools.invoke(messages)

            if response.tool_calls:
                self._log(f"Tool calls: {[tc['name'] for tc in response.tool_calls]}")

                for tool_call in response.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]

                    tool_fn = next((t for t in ALL_TOOLS if t.name == tool_name), None)
                    if tool_fn:
                        result = tool_fn.invoke(tool_args)
                        messages.append(response)
                        messages.append(ToolMessage(content=result, tool_call_id=tool_call["id"]))
            else:
                return {self.output_key: response.content}

        return {self.output_key: "Max tool iterations reached"}


# =============================================================================
# WORKFLOW BUILDER
# =============================================================================

class Workflow:
    """Builder for creating and running workflows."""

    def __init__(self, name: str, state_schema: type = CodeWorkflowState):
        self.name = name
        self.state_schema = state_schema
        self._nodes: dict[str, Node] = {}
        self._edges: list[tuple[str, str]] = []
        self._conditional_edges: list[tuple[str, Callable, dict]] = []
        self._entry: str | None = None
        self._finish_keys: set[str] = {"done", "end", "finish"}
        self._compiled = None

    def add_node(self, name: str, node: Node) -> Workflow:
        """Add a node to the workflow."""
        node.name = name
        self._nodes[name] = node
        return self

    def add_edge(self, from_node: str, to_node: str) -> Workflow:
        """Add a direct edge between nodes."""
        self._edges.append((from_node, to_node))
        return self

    def add_conditional_edge(
        self,
        from_node: str,
        condition: Callable[[dict], str],
        targets: dict[str, str] | None = None
    ) -> Workflow:
        """Add a conditional edge that routes based on state.

        Args:
            from_node: Source node
            condition: Function that takes state and returns next node name
            targets: Optional mapping of condition results to node names
        """
        self._conditional_edges.append((from_node, condition, targets or {}))
        return self

    def set_entry(self, node: str) -> Workflow:
        """Set the entry point node."""
        self._entry = node
        return self

    def set_finish(self, *keys: str) -> Workflow:
        """Set which return values from conditions indicate completion."""
        self._finish_keys = set(keys)
        return self

    def compile(self) -> StateGraph:
        """Compile the workflow into a LangGraph StateGraph."""
        if self._compiled:
            return self._compiled

        graph = StateGraph(self.state_schema)

        # Add nodes
        for name, node in self._nodes.items():
            graph.add_node(name, node)

        # Add edges
        for from_node, to_node in self._edges:
            if to_node in self._finish_keys:
                graph.add_edge(from_node, END)
            else:
                graph.add_edge(from_node, to_node)

        # Add conditional edges
        for from_node, condition, targets in self._conditional_edges:
            def make_router(cond, tgts, finish_keys):
                def router(state):
                    result = cond(state)
                    # Check if this is a finish state
                    if result in finish_keys:
                        return END
                    # Map through targets if provided
                    return tgts.get(result, result)
                return router

            graph.add_conditional_edges(
                from_node,
                make_router(condition, targets, self._finish_keys)
            )

        # Set entry
        if self._entry:
            graph.set_entry_point(self._entry)

        self._compiled = graph.compile()
        return self._compiled

    def run(
        self,
        initial_state: dict,
        config: dict | None = None,
        persist: bool = False,
        runs_dir: str | Path = "workflow_runs",
    ) -> dict:
        """Run the workflow with the given initial state.

        Args:
            initial_state: Initial state dictionary
            config: Optional LangGraph config
            persist: If True, save handoffs to disk
            runs_dir: Directory for workflow runs
        """
        print(f"\n{'='*60}")
        print(f"WORKFLOW: {self.name}")
        print(f"{'='*60}\n")

        # Set defaults
        state = {
            "iteration": 0,
            "max_iterations": 10,
            "messages": [],
            "feedback": "",
            **initial_state,
        }

        # Initialize persistence if enabled
        workflow_run: WorkflowRun | None = None
        if persist:
            workflow_run = WorkflowRun(self.name, runs_dir=runs_dir)
            workflow_run.initialize(state)

        graph = self.compile()

        # Run the graph
        final_state = None
        for step in graph.stream(state, config=config):
            # step is a dict with node_name: output
            for node_name, output in step.items():
                if output:
                    # Record handoff before updating state
                    if workflow_run:
                        start_time = time.time()
                        workflow_run.record_step(
                            node=node_name,
                            input_state={k: v for k, v in state.items() if k != "messages"},
                            output_state=output,
                            duration_ms=int((time.time() - start_time) * 1000),
                        )

                    state.update(output)
            final_state = state

            # Safety check for max iterations
            if state.get("iteration", 0) >= state.get("max_iterations", 10):
                print(f"\n⚠️  Max iterations ({state['max_iterations']}) reached")
                break

        # Complete persistence
        if workflow_run:
            workflow_run.complete(final_state or {})

        print(f"\n{'='*60}")
        print(f"WORKFLOW COMPLETE")
        print(f"{'='*60}")

        return final_state

    def visualize(self) -> str:
        """Return a text representation of the workflow."""
        lines = [f"Workflow: {self.name}", ""]

        lines.append("Nodes:")
        for name, node in self._nodes.items():
            entry_marker = " (entry)" if name == self._entry else ""
            lines.append(f"  [{name}]{entry_marker} - {node.__class__.__name__}")

        lines.append("\nEdges:")
        for from_node, to_node in self._edges:
            lines.append(f"  {from_node} -> {to_node}")

        for from_node, condition, targets in self._conditional_edges:
            targets_str = ", ".join(f"{k}->{v}" for k, v in targets.items()) if targets else "dynamic"
            lines.append(f"  {from_node} -> [{targets_str}] (conditional)")

        return "\n".join(lines)


# =============================================================================
# PRESET WORKFLOWS
# =============================================================================

def create_spec_implement_review_workflow(
    spec_model: str = "claude-sonnet-4-20250514",
    spec_backend: str = "claude",
    impl_model: str = DEFAULT_MODEL,
    impl_backend: str = DEFAULT_BACKEND,
    review_model: str = DEFAULT_MODEL,
    review_backend: str = DEFAULT_BACKEND,
    pass_threshold: int = 90,
) -> Workflow:
    """Create a workflow: spec -> implement -> review -> loop until passing.

    Args:
        spec_model: Model for writing specifications
        spec_backend: Backend for spec model
        impl_model: Model for implementation (must support tools if using ToolNode)
        impl_backend: Backend for implementation model
        review_model: Model for code review
        review_backend: Backend for review model
        pass_threshold: Score required to pass review (0-100)
    """
    return (
        Workflow("spec_implement_review")
        .add_node("spec", SpecWriterNode(
            model=spec_model,
            backend=spec_backend,
        ))
        .add_node("implement", ImplementerNode(
            model=impl_model,
            backend=impl_backend,
        ))
        .add_node("review", ReviewerNode(
            model=review_model,
            backend=review_backend,
            pass_threshold=pass_threshold,
        ))
        .add_edge("spec", "implement")
        .add_edge("implement", "review")
        .add_conditional_edge(
            "review",
            lambda state: "done" if state.get("passed", False) else "implement"
        )
        .set_entry("spec")
        .set_finish("done")
    )


# =============================================================================
# CLI
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Run AI workflows")
    parser.add_argument("task", nargs="?", help="Task for the workflow")
    parser.add_argument("-w", "--workflow", default="spec_implement_review",
                        choices=["spec_implement_review"],
                        help="Workflow to run")
    parser.add_argument("--spec-model", default=DEFAULT_MODEL,
                        help="Model for spec writing")
    parser.add_argument("--spec-backend", default=DEFAULT_BACKEND,
                        help="Backend for spec model")
    parser.add_argument("--impl-model", default=DEFAULT_MODEL,
                        help="Model for implementation")
    parser.add_argument("--review-model", default=DEFAULT_MODEL,
                        help="Model for review")
    parser.add_argument("--threshold", type=int, default=85,
                        help="Pass threshold for review (0-100)")
    parser.add_argument("--max-iter", type=int, default=5,
                        help="Max review iterations")
    parser.add_argument("--visualize", action="store_true",
                        help="Show workflow structure and exit")

    # Persistence options
    parser.add_argument("--persist", action="store_true",
                        help="Save workflow handoffs to disk")
    parser.add_argument("--runs-dir", default="workflow_runs",
                        help="Directory for workflow runs")
    parser.add_argument("--list-runs", action="store_true",
                        help="List all workflow runs")
    parser.add_argument("--inspect", metavar="RUN_ID",
                        help="Inspect a specific workflow run")

    args = parser.parse_args()

    # Handle run inspection commands
    if args.list_runs:
        runs = list_runs(args.runs_dir)
        if not runs:
            print("No workflow runs found")
            return

        print(f"\n{'Status':<10} {'Workflow':<25} {'Run ID':<45}")
        print("-" * 80)
        for m in runs:
            status_icon = {"completed": "✅", "failed": "❌", "running": "🔄"}.get(m.status, "❓")
            print(f"{status_icon} {m.status:<7} {m.workflow_name:<25} {m.run_id:<45}")
        return

    if args.inspect:
        try:
            run = get_run(args.inspect, args.runs_dir)
            print_run_summary(run)
        except FileNotFoundError as e:
            print(f"Error: {e}")
        return

    # Create workflow
    workflow = create_spec_implement_review_workflow(
        spec_model=args.spec_model,
        spec_backend=args.spec_backend,
        impl_model=args.impl_model,
        review_model=args.review_model,
        pass_threshold=args.threshold,
    )

    if args.visualize:
        print(workflow.visualize())
        return

    if not args.task:
        parser.print_help()
        return

    # Run workflow
    result = workflow.run(
        initial_state={
            "task": args.task,
            "max_iterations": args.max_iter,
        },
        persist=args.persist,
        runs_dir=args.runs_dir,
    )

    # Output results
    print(f"\n{'='*60}")
    print("FINAL OUTPUT")
    print(f"{'='*60}")
    print(f"Iterations: {result.get('iteration', 0)}")
    print(f"Final Score: {result.get('score', 'N/A')}")
    print(f"\nCode:\n{result.get('code', 'No code generated')}")


if __name__ == "__main__":
    main()
