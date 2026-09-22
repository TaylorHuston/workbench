#!/usr/bin/env python3
"""
JSON Handoff Persistence for Workflows.

Provides transparent persistence of workflow state between agent steps.
Each node writes a JSON "handoff" file that can be inspected, debugged,
or used to resume workflows.

Directory structure:
    workflow_runs/
    └── 2024-01-15_143022_my_workflow/
        ├── manifest.json        # Workflow metadata and status
        ├── 00_input.json        # Initial state
        ├── 01_spec.json         # First node output
        ├── 02_implement.json    # Second node output
        └── ...
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any


# =============================================================================
# CONFIGURATION
# =============================================================================

DEFAULT_RUNS_DIR = Path("workflow_runs")


# =============================================================================
# HANDOFF FILE
# =============================================================================

@dataclass
class Handoff:
    """A single handoff between workflow nodes."""
    node: str
    step: int
    timestamp: str
    input_state: dict
    output_state: dict
    duration_ms: int = 0
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> Handoff:
        return cls(**data)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)

    @classmethod
    def from_json(cls, json_str: str) -> Handoff:
        return cls.from_dict(json.loads(json_str))


# =============================================================================
# MANIFEST
# =============================================================================

@dataclass
class WorkflowManifest:
    """Metadata about a workflow run."""
    workflow_name: str
    run_id: str
    status: str  # "running", "completed", "failed", "paused"
    started_at: str
    completed_at: str | None = None
    initial_task: str = ""
    current_step: int = 0
    current_node: str = ""
    total_steps: int = 0
    final_result: dict = field(default_factory=dict)
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> WorkflowManifest:
        return cls(**data)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)

    @classmethod
    def from_json(cls, json_str: str) -> WorkflowManifest:
        return cls.from_dict(json.loads(json_str))


# =============================================================================
# WORKFLOW RUN MANAGER
# =============================================================================

class WorkflowRun:
    """Manages persistence for a single workflow run."""

    def __init__(
        self,
        workflow_name: str,
        runs_dir: Path | str = DEFAULT_RUNS_DIR,
        run_id: str | None = None,
    ):
        self.workflow_name = workflow_name
        self.runs_dir = Path(runs_dir)

        # Generate or use provided run_id
        if run_id:
            self.run_id = run_id
        else:
            timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
            self.run_id = f"{timestamp}_{workflow_name}"

        self.run_dir = self.runs_dir / self.run_id
        self.manifest: WorkflowManifest | None = None
        self._step_counter = 0

    def initialize(self, initial_state: dict) -> None:
        """Initialize a new workflow run."""
        # Create directory
        self.run_dir.mkdir(parents=True, exist_ok=True)

        # Create manifest
        self.manifest = WorkflowManifest(
            workflow_name=self.workflow_name,
            run_id=self.run_id,
            status="running",
            started_at=datetime.now().isoformat(),
            initial_task=initial_state.get("task", ""),
        )
        self._save_manifest()

        # Write initial state
        self._write_handoff(Handoff(
            node="input",
            step=0,
            timestamp=datetime.now().isoformat(),
            input_state={},
            output_state=initial_state,
        ))
        self._step_counter = 1

        print(f"📁 Workflow run: {self.run_dir}")

    def record_step(
        self,
        node: str,
        input_state: dict,
        output_state: dict,
        duration_ms: int = 0,
        error: str | None = None,
    ) -> Handoff:
        """Record a workflow step."""
        handoff = Handoff(
            node=node,
            step=self._step_counter,
            timestamp=datetime.now().isoformat(),
            input_state=input_state,
            output_state=output_state,
            duration_ms=duration_ms,
            error=error,
        )

        self._write_handoff(handoff)
        self._step_counter += 1

        # Update manifest
        if self.manifest:
            self.manifest.current_step = handoff.step
            self.manifest.current_node = node
            self.manifest.total_steps = self._step_counter
            if error:
                self.manifest.status = "failed"
                self.manifest.error = error
            self._save_manifest()

        return handoff

    def complete(self, final_state: dict) -> None:
        """Mark the workflow as completed."""
        if self.manifest:
            self.manifest.status = "completed"
            self.manifest.completed_at = datetime.now().isoformat()
            self.manifest.final_result = final_state
            self._save_manifest()

        print(f"✅ Workflow completed: {self.run_dir}")

    def fail(self, error: str) -> None:
        """Mark the workflow as failed."""
        if self.manifest:
            self.manifest.status = "failed"
            self.manifest.completed_at = datetime.now().isoformat()
            self.manifest.error = error
            self._save_manifest()

        print(f"❌ Workflow failed: {error}")

    def _write_handoff(self, handoff: Handoff) -> Path:
        """Write a handoff file."""
        filename = f"{handoff.step:02d}_{handoff.node}.json"
        filepath = self.run_dir / filename
        filepath.write_text(handoff.to_json())
        return filepath

    def _save_manifest(self) -> None:
        """Save the manifest file."""
        if self.manifest:
            manifest_path = self.run_dir / "manifest.json"
            manifest_path.write_text(self.manifest.to_json())

    # =========================================================================
    # LOADING / RESUMING
    # =========================================================================

    @classmethod
    def load(cls, run_dir: Path | str) -> WorkflowRun:
        """Load an existing workflow run."""
        run_dir = Path(run_dir)

        if not run_dir.exists():
            raise FileNotFoundError(f"Run directory not found: {run_dir}")

        manifest_path = run_dir / "manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"Manifest not found: {manifest_path}")

        manifest = WorkflowManifest.from_json(manifest_path.read_text())

        run = cls(
            workflow_name=manifest.workflow_name,
            runs_dir=run_dir.parent,
            run_id=run_dir.name,
        )
        run.manifest = manifest
        run._step_counter = manifest.total_steps

        return run

    def get_handoffs(self) -> list[Handoff]:
        """Get all handoffs in order."""
        handoffs = []
        for filepath in sorted(self.run_dir.glob("*.json")):
            if filepath.name == "manifest.json":
                continue
            try:
                handoff = Handoff.from_json(filepath.read_text())
                handoffs.append(handoff)
            except Exception:
                pass
        return handoffs

    def get_latest_state(self) -> dict:
        """Get the state from the last handoff."""
        handoffs = self.get_handoffs()
        if not handoffs:
            return {}

        # Merge all output states
        state = {}
        for handoff in handoffs:
            state.update(handoff.output_state)
        return state

    def get_last_node(self) -> str | None:
        """Get the name of the last executed node."""
        handoffs = self.get_handoffs()
        if not handoffs:
            return None
        return handoffs[-1].node


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def list_runs(runs_dir: Path | str = DEFAULT_RUNS_DIR) -> list[WorkflowManifest]:
    """List all workflow runs."""
    runs_dir = Path(runs_dir)
    if not runs_dir.exists():
        return []

    manifests = []
    for run_dir in sorted(runs_dir.iterdir(), reverse=True):
        if run_dir.is_dir():
            manifest_path = run_dir / "manifest.json"
            if manifest_path.exists():
                try:
                    manifest = WorkflowManifest.from_json(manifest_path.read_text())
                    manifests.append(manifest)
                except Exception:
                    pass
    return manifests


def get_run(run_id: str, runs_dir: Path | str = DEFAULT_RUNS_DIR) -> WorkflowRun:
    """Get a specific workflow run by ID."""
    return WorkflowRun.load(Path(runs_dir) / run_id)


def print_run_summary(run: WorkflowRun) -> None:
    """Print a summary of a workflow run."""
    if not run.manifest:
        print("No manifest found")
        return

    m = run.manifest
    print(f"\n{'='*60}")
    print(f"Workflow: {m.workflow_name}")
    print(f"Run ID:   {m.run_id}")
    print(f"Status:   {m.status}")
    print(f"Started:  {m.started_at}")
    if m.completed_at:
        print(f"Completed: {m.completed_at}")
    print(f"Task:     {m.initial_task[:50]}..." if len(m.initial_task) > 50 else f"Task:     {m.initial_task}")
    print(f"{'='*60}")

    handoffs = run.get_handoffs()
    for h in handoffs:
        status = "❌" if h.error else "✅"
        print(f"  {h.step:02d}. [{h.node}] {status} ({h.duration_ms}ms)")

    if m.error:
        print(f"\nError: {m.error}")


# =============================================================================
# CLI
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Inspect workflow runs")
    parser.add_argument("run_id", nargs="?", help="Run ID to inspect")
    parser.add_argument("-l", "--list", action="store_true", help="List all runs")
    parser.add_argument("-d", "--dir", default=DEFAULT_RUNS_DIR, help="Runs directory")
    parser.add_argument("--step", type=int, help="Show specific step")

    args = parser.parse_args()

    if args.list:
        runs = list_runs(args.dir)
        if not runs:
            print("No workflow runs found")
            return

        print(f"\n{'Status':<10} {'Workflow':<25} {'Run ID':<40}")
        print("-" * 75)
        for m in runs:
            status_icon = {"completed": "✅", "failed": "❌", "running": "🔄"}.get(m.status, "❓")
            print(f"{status_icon} {m.status:<7} {m.workflow_name:<25} {m.run_id:<40}")
        return

    if args.run_id:
        try:
            run = get_run(args.run_id, args.dir)
        except FileNotFoundError as e:
            print(f"Error: {e}")
            return

        if args.step is not None:
            handoffs = run.get_handoffs()
            for h in handoffs:
                if h.step == args.step:
                    print(h.to_json())
                    return
            print(f"Step {args.step} not found")
        else:
            print_run_summary(run)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
