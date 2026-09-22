#!/usr/bin/env python3
"""
Session Management for Persistent Conversations.

Provides persistent storage for chat conversations that can be:
- Resumed across sessions
- Summarized into structured specs
- Used to trigger workflows

Directory structure:
    sessions/
    └── my-project/
        ├── meta.json       # Session metadata
        ├── history.json    # Full message history
        └── spec.md         # Extracted spec (when generated)
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Literal

from .config import DEFAULT_MODEL, DEFAULT_BACKEND


# =============================================================================
# CONFIGURATION
# =============================================================================

DEFAULT_SESSIONS_DIR = Path("sessions")


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Message:
    """A single message in a conversation."""
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> Message:
        return cls(**data)


@dataclass
class SessionMeta:
    """Metadata about a session."""
    name: str
    created_at: str
    updated_at: str
    model: str = DEFAULT_MODEL
    backend: str = DEFAULT_BACKEND
    message_count: int = 0
    has_spec: bool = False
    workflow_runs: list[str] = field(default_factory=list)
    description: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> SessionMeta:
        return cls(**data)


# =============================================================================
# SESSION CLASS
# =============================================================================

class Session:
    """A persistent conversation session."""

    def __init__(
        self,
        name: str,
        sessions_dir: Path | str = DEFAULT_SESSIONS_DIR,
        model: str = DEFAULT_MODEL,
        backend: str = DEFAULT_BACKEND,
    ):
        self.name = name
        self.sessions_dir = Path(sessions_dir)
        self.session_dir = self.sessions_dir / name
        self.model = model
        self.backend = backend

        self.meta: SessionMeta | None = None
        self.messages: list[Message] = []
        self._loaded = False

    # =========================================================================
    # LIFECYCLE
    # =========================================================================

    def create(self, description: str = "") -> None:
        """Create a new session."""
        if self.session_dir.exists():
            raise FileExistsError(f"Session '{self.name}' already exists")

        self.session_dir.mkdir(parents=True, exist_ok=True)

        now = datetime.now().isoformat()
        self.meta = SessionMeta(
            name=self.name,
            created_at=now,
            updated_at=now,
            model=self.model,
            backend=self.backend,
            description=description,
        )
        self.messages = []
        self._save()
        self._loaded = True

    def load(self) -> None:
        """Load an existing session."""
        if not self.session_dir.exists():
            raise FileNotFoundError(f"Session '{self.name}' not found")

        # Load metadata
        meta_path = self.session_dir / "meta.json"
        if meta_path.exists():
            self.meta = SessionMeta.from_dict(json.loads(meta_path.read_text()))
            self.model = self.meta.model
            self.backend = self.meta.backend

        # Load history
        history_path = self.session_dir / "history.json"
        if history_path.exists():
            data = json.loads(history_path.read_text())
            self.messages = [Message.from_dict(m) for m in data]

        self._loaded = True

    def load_or_create(self, description: str = "") -> bool:
        """Load existing session or create new one. Returns True if created."""
        if self.session_dir.exists():
            self.load()
            return False
        else:
            self.create(description)
            return True

    def _save(self) -> None:
        """Save session to disk."""
        if not self.meta:
            return

        # Update metadata
        self.meta.updated_at = datetime.now().isoformat()
        self.meta.message_count = len(self.messages)
        self.meta.has_spec = (self.session_dir / "spec.md").exists()

        # Save metadata
        meta_path = self.session_dir / "meta.json"
        meta_path.write_text(json.dumps(self.meta.to_dict(), indent=2))

        # Save history
        history_path = self.session_dir / "history.json"
        history_path.write_text(json.dumps(
            [m.to_dict() for m in self.messages],
            indent=2
        ))

    # =========================================================================
    # MESSAGES
    # =========================================================================

    def add_message(self, role: str, content: str) -> Message:
        """Add a message to the conversation."""
        msg = Message(role=role, content=content)
        self.messages.append(msg)
        self._save()
        return msg

    def add_user_message(self, content: str) -> Message:
        return self.add_message("user", content)

    def add_assistant_message(self, content: str) -> Message:
        return self.add_message("assistant", content)

    def get_messages_for_llm(self) -> list[dict]:
        """Get messages in format suitable for LLM."""
        return [{"role": m.role, "content": m.content} for m in self.messages]

    def get_history_text(self, last_n: int | None = None) -> str:
        """Get conversation history as formatted text."""
        msgs = self.messages[-last_n:] if last_n else self.messages
        lines = []
        for m in msgs:
            prefix = "You" if m.role == "user" else "AI"
            lines.append(f"{prefix}: {m.content}")
        return "\n\n".join(lines)

    # =========================================================================
    # SPEC EXTRACTION
    # =========================================================================

    def save_spec(self, spec_content: str) -> Path:
        """Save extracted spec to file."""
        spec_path = self.session_dir / "spec.md"
        spec_path.write_text(spec_content)
        self._save()  # Update has_spec
        return spec_path

    def get_spec(self) -> str | None:
        """Get saved spec if exists."""
        spec_path = self.session_dir / "spec.md"
        if spec_path.exists():
            return spec_path.read_text()
        return None

    # =========================================================================
    # WORKFLOW LINKING
    # =========================================================================

    def link_workflow(self, run_id: str) -> None:
        """Link a workflow run to this session."""
        if self.meta:
            if run_id not in self.meta.workflow_runs:
                self.meta.workflow_runs.append(run_id)
            self._save()

    # =========================================================================
    # INFO
    # =========================================================================

    def summary(self) -> str:
        """Get a summary of the session."""
        if not self.meta:
            return f"Session '{self.name}' (not loaded)"

        lines = [
            f"Session: {self.name}",
            f"Model: {self.meta.backend}:{self.meta.model}",
            f"Messages: {self.meta.message_count}",
            f"Created: {self.meta.created_at}",
            f"Updated: {self.meta.updated_at}",
        ]
        if self.meta.description:
            lines.insert(1, f"Description: {self.meta.description}")
        if self.meta.has_spec:
            lines.append("Spec: saved")
        if self.meta.workflow_runs:
            lines.append(f"Workflows: {len(self.meta.workflow_runs)}")

        return "\n".join(lines)


# =============================================================================
# SESSION MANAGEMENT FUNCTIONS
# =============================================================================

def list_sessions(sessions_dir: Path | str = DEFAULT_SESSIONS_DIR) -> list[SessionMeta]:
    """List all sessions."""
    sessions_dir = Path(sessions_dir)
    if not sessions_dir.exists():
        return []

    sessions = []
    for session_path in sorted(sessions_dir.iterdir()):
        if session_path.is_dir():
            meta_path = session_path / "meta.json"
            if meta_path.exists():
                try:
                    meta = SessionMeta.from_dict(json.loads(meta_path.read_text()))
                    sessions.append(meta)
                except Exception:
                    pass
    return sessions


def get_session(
    name: str,
    sessions_dir: Path | str = DEFAULT_SESSIONS_DIR,
    model: str = DEFAULT_MODEL,
    backend: str = DEFAULT_BACKEND,
) -> Session:
    """Get or create a session."""
    session = Session(name, sessions_dir, model, backend)
    session.load_or_create()
    return session


def delete_session(name: str, sessions_dir: Path | str = DEFAULT_SESSIONS_DIR) -> bool:
    """Delete a session."""
    import shutil
    session_path = Path(sessions_dir) / name
    if session_path.exists():
        shutil.rmtree(session_path)
        return True
    return False


# =============================================================================
# CLI
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Manage chat sessions")
    parser.add_argument("session", nargs="?", help="Session name to inspect")
    parser.add_argument("-l", "--list", action="store_true", help="List all sessions")
    parser.add_argument("-d", "--dir", default=DEFAULT_SESSIONS_DIR, help="Sessions directory")
    parser.add_argument("--delete", action="store_true", help="Delete the session")
    parser.add_argument("--history", action="store_true", help="Show conversation history")
    parser.add_argument("--spec", action="store_true", help="Show extracted spec")

    args = parser.parse_args()

    if args.list:
        sessions = list_sessions(args.dir)
        if not sessions:
            print("No sessions found")
            return

        print(f"\n{'Name':<25} {'Messages':<10} {'Spec':<6} {'Updated':<20}")
        print("-" * 65)
        for s in sessions:
            spec_indicator = "✓" if s.has_spec else ""
            updated = s.updated_at[:16] if s.updated_at else ""
            print(f"{s.name:<25} {s.message_count:<10} {spec_indicator:<6} {updated:<20}")
        return

    if args.session:
        try:
            session = Session(args.session, args.dir)
            session.load()
        except FileNotFoundError:
            print(f"Session '{args.session}' not found")
            return

        if args.delete:
            if delete_session(args.session, args.dir):
                print(f"Deleted session '{args.session}'")
            return

        if args.history:
            print(session.get_history_text())
            return

        if args.spec:
            spec = session.get_spec()
            if spec:
                print(spec)
            else:
                print("No spec saved for this session")
            return

        # Default: show summary
        print(session.summary())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
