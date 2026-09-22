"""Shared agent loading and LangChain-based AI backends."""

import subprocess
from pathlib import Path

from langchain_ollama import ChatOllama
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from .config import DEFAULT_MODEL, DEFAULT_BACKEND, get_agent_config, list_agents


def get_llm(backend: str = None, model: str = None):
    """Get a LangChain chat model for the given backend."""
    backend = backend or DEFAULT_BACKEND
    model = model or DEFAULT_MODEL

    if backend == "ollama":
        return ChatOllama(model=model)
    elif backend == "claude":
        return ChatAnthropic(model_name=model)
    elif backend == "claude-code":
        # Claude Code backend is handled separately via run_claude_code()
        raise ValueError("claude-code backend must use run_claude_code() directly")
    else:
        raise ValueError(f"Unknown backend: {backend}")


def run_gemini_cli(prompt: str, system_prompt: str = None, cwd: str = None, model: str = None) -> str:
    """Run Gemini CLI in headless mode and return the response.

    Args:
        prompt: The prompt to send to Gemini CLI
        system_prompt: Optional system prompt (prepended to user prompt)
        cwd: Working directory for Gemini CLI
        model: Model to use (e.g., gemini-2.5-flash). Defaults to Gemini CLI's default.

    Returns:
        The text response from Gemini CLI
    """
    # Combine system prompt and user prompt
    full_prompt = prompt
    if system_prompt:
        full_prompt = f"{system_prompt}\n\n---\n\n{prompt}"

    cmd = ["gemini", "-p", full_prompt]
    if model:
        cmd.extend(["-m", model])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=300,  # 5 minute timeout
        )

        if result.returncode != 0:
            error_msg = result.stderr or "Unknown error"
            print(f"Error: {error_msg}")
            return f"ERROR: Gemini CLI failed: {error_msg}"

        response = result.stdout.strip()
        print(response)
        return response

    except subprocess.TimeoutExpired:
        print("Error: Gemini CLI timed out")
        return "ERROR: Gemini CLI timed out after 5 minutes"
    except FileNotFoundError:
        print("Error: Gemini CLI not found")
        return "ERROR: Gemini CLI not installed or not in PATH"


def run_claude_code(prompt: str, system_prompt: str = None, cwd: str = None, model: str = None) -> str:
    """Run Claude Code CLI in headless mode and return the response.

    Args:
        prompt: The prompt to send to Claude Code
        system_prompt: Optional system prompt (prepended to user prompt)
        cwd: Working directory for Claude Code (for file access)
        model: Model to use (opus, sonnet, haiku). Defaults to Claude Code's default.

    Returns:
        The text response from Claude Code
    """
    # Combine system prompt and user prompt
    full_prompt = prompt
    if system_prompt:
        full_prompt = f"{system_prompt}\n\n---\n\n{prompt}"

    cmd = ["claude", "--print", "-p", full_prompt]
    if model:
        cmd.extend(["--model", model])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=300,  # 5 minute timeout
        )

        if result.returncode != 0:
            error_msg = result.stderr or "Unknown error"
            print(f"Error: {error_msg}")
            return f"ERROR: Claude Code failed: {error_msg}"

        response = result.stdout.strip()
        print(response)
        return response

    except subprocess.TimeoutExpired:
        print("Error: Claude Code timed out")
        return "ERROR: Claude Code timed out after 5 minutes"
    except FileNotFoundError:
        print("Error: Claude Code CLI not found")
        return "ERROR: Claude Code CLI not installed or not in PATH"


def send_message(backend: str, model: str, system_prompt: str, messages: list[dict]) -> str:
    """Send messages using LangChain and get a response with streaming."""
    # Handle CLI backends separately
    if backend in ("claude-code", "gemini-cli"):
        # Build conversation context from messages
        # Format as clear conversation transcript for context
        if len(messages) == 1:
            # Single message, just send it directly
            prompt = messages[0]["content"]
        else:
            # Multiple messages, format as conversation history
            context_parts = []
            for msg in messages[:-1]:  # All but the last message
                role = "User" if msg["role"] == "user" else "Assistant"
                context_parts.append(f"{role}: {msg['content']}")

            history = "\n\n".join(context_parts)
            current_msg = messages[-1]["content"]
            prompt = f"""Previous conversation:
{history}

---

Now respond to: {current_msg}"""

        if backend == "claude-code":
            return run_claude_code(prompt, system_prompt, model=model)
        else:  # gemini-cli
            return run_gemini_cli(prompt, system_prompt, model=model)

    llm = get_llm(backend, model)

    # Convert to LangChain message format
    lc_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            lc_messages.append(AIMessage(content=msg["content"]))

    # Stream the response
    full_response = ""
    for chunk in llm.stream(lc_messages):
        content = chunk.content
        print(content, end="", flush=True)
        full_response += content

    print()  # newline at end
    return full_response


class Persona:
    """AI persona that can participate in chat."""
    def __init__(self, name: str, model: str, system_prompt: str, backend: str = "ollama"):
        self.name = name
        self.model = model
        self.system_prompt = system_prompt
        self.backend = backend
        self.history: list[dict] = []

    def respond(self, messages: list[dict], show_header: bool = True) -> str:
        """Generate a response to messages."""
        if show_header:
            print(f"\n{'='*60}")
            print(f"{self.name} ({self.backend}:{self.model}):")
            print(f"{'='*60}")

        return send_message(self.backend, self.model, self.system_prompt, messages)

    def respond_with_history(self, user_message: str, conversation_context: list[str]) -> str:
        """Generate a response using persona's own history for continuity."""
        print(f"\n\033[1;36m{self.name}\033[0m \033[90m({self.backend}:{self.model})\033[0m")
        print("-" * 40)

        context_str = "\n".join(conversation_context[-20:]) if conversation_context else ""

        prompt = f"""Conversation so far:
{context_str}

[You] {user_message}

Respond naturally and concisely. You are {self.name}."""

        self.history.append({"role": "user", "content": prompt})

        response = send_message(self.backend, self.model, self.system_prompt, self.history)

        self.history.append({"role": "assistant", "content": response})
        return response

    @classmethod
    def from_dict(cls, data: dict) -> "Persona":
        """Create a Persona from a dictionary."""
        return cls(
            name=data["name"],
            model=data["model"],
            system_prompt=data["system_prompt"],
            backend=data.get("backend", "ollama"),
        )


def load_personas(config_path: str | Path | None = None) -> dict[str, Persona]:
    """Load agents from config. (config_path ignored, kept for compatibility)"""
    return {name: Persona.from_dict(get_agent_config(name)) for name in list_agents()}


# Aliases for transition to "agent" terminology
Agent = Persona
load_agents = load_personas
