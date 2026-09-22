"""Central configuration for ollama-chat.

Loads defaults and agent definitions from agents.json.
All other modules should import from here.
"""

import json
from pathlib import Path

_CONFIG_PATH = Path(__file__).parent / "agents.json"

def _load_config() -> dict:
    """Load the configuration from agents.json."""
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config not found: {_CONFIG_PATH}")
    with open(_CONFIG_PATH) as f:
        return json.load(f)

_config = _load_config()

# Defaults - import these directly
DEFAULT_MODEL: str = _config["defaults"]["model"]
DEFAULT_BACKEND: str = _config["defaults"]["backend"]

# Raw agent definitions (use get_agent() or load_agents() instead)
_AGENTS: dict = _config["agents"]


def get_agent_config(name: str) -> dict:
    """Get agent config by name, with defaults applied.

    Returns dict with: name, model, backend, system_prompt
    """
    if name not in _AGENTS:
        raise KeyError(f"Unknown agent: {name}. Available: {list(_AGENTS.keys())}")

    agent = _AGENTS[name].copy()
    # Apply defaults for missing fields
    agent.setdefault("model", DEFAULT_MODEL)
    agent.setdefault("backend", DEFAULT_BACKEND)
    return agent


def list_agents() -> list[str]:
    """List available agent names."""
    return list(_AGENTS.keys())


def reload_config():
    """Reload configuration from disk (useful for runtime updates)."""
    global _config, DEFAULT_MODEL, DEFAULT_BACKEND, _AGENTS
    _config = _load_config()
    DEFAULT_MODEL = _config["defaults"]["model"]
    DEFAULT_BACKEND = _config["defaults"]["backend"]
    _AGENTS = _config["agents"]
