# ollama-chat

Python CLI tools for chatting with Ollama models and experimenting with multi-AI collaboration.

## Features

- **Session-Based Conversation** - Natural chat that persists, with spec extraction and workflow triggering
- **Workflow Framework** - Deterministic multi-agent pipelines with feedback loops and audit trails
- **Tool-Calling Agent** - AI agent that can read/write files and run commands
- **Multi-Persona Collaboration** - Two AI personas working together on tasks
- **Interactive Chat Room** - @ mention multiple personas in real-time
- **Batch Processing** - Process markdown files and generate code

## Quick Start

```bash
# Launch the REPL
python3 cli.py

# You'll see:
# ╔═══════════════════════════════════════╗
# ║           ollama-chat                 ║
# ║     Multi-agent AI workflows          ║
# ╚═══════════════════════════════════════╝
# [gemma3:1b]>

# Then use slash commands:
/help                        # Show all commands
/session                     # List all sessions
/session my-project          # Start/resume session
/workflow "Build a cache"    # Run workflow
/agent "List files"          # Tool-calling agent
/chat                        # Simple chat mode
/collab "Design API"         # Two-persona collaboration
/room                        # Multi-persona chat room
/models                      # List available models
/quit                        # Exit
```

You can also run commands directly:
```bash
python3 cli.py session
python3 cli.py models
```

## Setup

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.ai/) running locally (default port 11434)
- For Claude personas: `ANTHROPIC_API_KEY` environment variable set

### Installation

```bash
# Clone the repo
git clone https://github.com/TaylorHuston/ollama-chat.git
cd ollama-chat

# Install dependencies
pip install -r requirements.txt

# Pull recommended models
ollama pull llama3.2:3b    # Required for tool-calling agent
ollama pull gemma3:1b      # Good for fast chat/collaboration
ollama pull qwen2.5:0.5b   # Ultra-lightweight option
```

#### Optional: Install as CLI command

```bash
# Install as editable package (in a venv)
python -m venv .venv
source .venv/bin/activate
pip install -e .

# Now you can use:
ollama-chat conv my-project
oc workflow "Build X"  # 'oc' is a short alias
```

### Dependencies

- `langchain-core` - Base LangChain abstractions
- `langchain-ollama` - Ollama integration
- `langchain-anthropic` - Claude integration
- `langgraph` - Workflow state graphs
- `rich` - Terminal formatting
- `requests` - HTTP client

## Commands

Launch the REPL with `python3 cli.py` and use these slash commands. Each feature can also be accessed via the standalone Python scripts.

### 1. Sessions (`/session`)

**The primary tool for interactive design work.** Named, persistent conversations that can extract specs and trigger implementation workflows.

```bash
# In the REPL:
/session                      # List all sessions
/session my-project           # Start or resume a session
/session my-project --new     # Force create new session
/session my-project --history # Show conversation history
/session my-project --spec    # Show extracted spec
/session my-project --delete  # Delete a session
```

**In-chat commands:**
```
/help           Show available commands
/history        Show full conversation history
/summary        Show session metadata
/summarize      Extract structured spec from conversation (AI-powered)
/spec           Show saved spec
/workflow       Run implementation workflow using saved spec
/clear          Clear conversation history
/save           Force save session
/quit           Exit
```

**Typical workflow:**
1. Launch: `python3 cli.py`
2. Start a session: `/session api-design`
3. Have a natural conversation to design your feature
4. Type `/summarize` to extract a structured spec
5. Type `/workflow` to automatically implement it
6. Resume later: `/session api-design`

---

### 2. Workflow Framework (`/workflow`)

Deterministic multi-agent pipelines with conditional routing, feedback loops, and full audit trails.

```bash
# In the REPL:
/workflow "Write a function to merge two sorted lists"
/workflow --persist "Implement quicksort"    # Save run history
/workflow --list-runs                         # List previous runs
/workflow --inspect <run-id>                  # Inspect a specific run
/workflow --visualize                         # Show workflow structure

# Set model before running:
/model gemma3:1b
/workflow "Build a cache class"
```

**Built-in workflow: spec_implement_review**
```
spec (write detailed specification)
  ↓
implement (generate code from spec)
  ↓
review (score 0-100 + feedback)
  ↓
score >= threshold? → DONE
  ↓ (no)
implement (with feedback) ← loop
```

**Creating custom workflows:**

```python
from workflow import (
    Workflow, LLMNode, SpecWriterNode,
    ImplementerNode, ReviewerNode, ToolNode
)

# Define a custom workflow
workflow = (
    Workflow("my_workflow")
    .add_node("plan", LLMNode(
        model="gemma3:1b",
        system_prompt="You are a planner...",
        prompt_template="Plan this: {task}",
        output_key="plan"
    ))
    .add_node("execute", ToolNode(
        model="llama3.2:3b",
        prompt_template="Execute this plan: {plan}"
    ))
    .add_edge("plan", "execute")
    .set_entry("plan")
)

result = workflow.run({"task": "Create a hello world file"}, persist=True)
```

**Available node types:**

| Node | Purpose |
|------|---------|
| `LLMNode` | Base node - invoke LLM with prompt template |
| `SpecWriterNode` | Write detailed specifications |
| `ImplementerNode` | Generate code from specs |
| `ReviewerNode` | Review code, output score + feedback |
| `ToolNode` | LLM with tool-calling capabilities |

---

### 3. Tool-Calling Agent (`/agent`)

An AI agent with filesystem and shell access. Can autonomously complete tasks by calling tools.

```bash
# In the REPL:
/agent "List all Python files in this directory"
/agent "Read requirements.txt and summarize the dependencies"
/agent "Create a hello.py file that prints Hello World"
/agent "What's the current git branch?"
/agent                    # Interactive mode - enter multiple tasks
```

**Available tools:**
| Tool | Description |
|------|-------------|
| `read_file(path)` | Read file contents |
| `write_file(path, content)` | Create or overwrite a file |
| `list_files(path)` | List directory contents |
| `run_command(command)` | Execute shell commands |
| `search_files(pattern, path)` | Find files by glob pattern |

**Model requirements:** The agent requires a model that supports tool/function calling:
- `llama3.2:3b` (default, recommended)
- `llama3.1`
- `mistral`

Models like `gemma3:1b` and `qwen2.5:0.5b` do NOT support tool calling.

---

### 4. Simple Chat (`/chat`)

Basic single-model chat interface.

```bash
# In the REPL:
/models                                   # List available models
/chat "What is the capital of France?"    # One-shot message
/model gemma3:1b                          # Set model
/chat                                     # Interactive chat mode
```

---

### 5. Multi-Persona Collaboration (`/collab`)

Two AI personas collaborate on a task, passing context back and forth.

```bash
# In the REPL:
/collab "Design a key-value store"        # Default: Architect + Developer
/collab --list                            # List available personas
```

---

### 6. Interactive Chat Room (`/room`)

Chat with multiple AI personas using @ mentions.

```bash
# In the REPL:
/room                     # Start with default personas (architect, developer)
```

**Chat room commands:**
```
@architect Design a REST API for a todo app
@claude What do you think of Architect's design?
@all Let's write a haiku together

/add critic       # Add a persona to the room
/remove developer # Remove a persona
/list             # Show active personas
/personas         # Show all available personas
/clear            # Clear conversation history
/quit             # Exit the chat room
```

---

### 7. Batch Processing (`/batch`)

Process markdown files with AI and extract code to runnable files.

```bash
# In the REPL:
/batch                              # Process INPUT.md -> output.py
/batch -i prompt.md -o result.py    # Custom input/output
/batch -p claude                    # Use Claude persona
```

## Architecture

```
ollama-chat/
├── cli.py           # Unified REPL entry point
├── pyproject.toml   # Package configuration
├── conversation.py  # Session-aware chat with /summarize and /workflow
├── workflow.py      # Deterministic multi-agent workflows (LangGraph)
├── agent.py         # Tool-calling autonomous agent
├── chat.py          # Simple single-model chat
├── collab.py        # Two-persona collaboration
├── chat_room.py     # Interactive multi-persona chat room
├── batch.py         # Markdown to code batch processing
├── sessions.py      # Session management CLI and library
├── handoffs.py      # JSON persistence for workflow audit trails
├── personas.py      # Shared persona/LLM utilities (LangChain)
├── tools.py         # LangChain tool definitions
├── personas.json    # Persona configuration
├── requirements.txt # Python dependencies
├── sessions/        # Persistent conversation sessions (gitignored)
│   └── {session}/
│       ├── meta.json
│       ├── history.json
│       ├── spec.md
│       └── output.py
└── workflow_runs/   # Workflow audit trails (gitignored)
    └── {timestamp}_{workflow}/
        ├── 00_input.json
        ├── 01_spec.json
        ├── 02_implement.json
        └── final.json
```

### Key Concepts

**Two Interaction Modes:**
1. **Conversational** - Natural back-and-forth to design specs (`conversation.py`)
2. **Workflow** - Deterministic execution with review gates (`workflow.py`)

**Handoff Files:**
When workflows run with `--persist`, each node writes a JSON "handoff" file containing:
- Input state it received
- Output state it produced
- Timestamp and duration
- Any errors

This creates a full audit trail for debugging and reproducibility.

### LangChain Integration

The project uses LangChain for:
- **Unified API** - Same code works with Ollama and Claude
- **Streaming** - Real-time response output
- **Tool Calling** - Structured function calls for the agent
- **Message Management** - Proper conversation history handling

### LangGraph Integration

Workflows use LangGraph for:
- **State Graphs** - Define nodes and edges declaratively
- **Conditional Routing** - Branch based on state (e.g., review score)
- **Iteration Control** - Built-in loop management

## Configuration

### Personas (`personas.json`)

All personas are defined in `personas.json`. You can add, modify, or remove personas by editing this file.

```json
{
  "architect": {
    "name": "Architect",
    "model": "gemma3:1b",
    "backend": "ollama",
    "system_prompt": "You are a senior software architect..."
  },
  "claude": {
    "name": "Claude",
    "model": "claude-sonnet-4-20250514",
    "backend": "claude",
    "system_prompt": "You are Claude, an AI assistant by Anthropic..."
  }
}
```

**Fields:**
- `name` - Display name for the persona
- `model` - Model identifier (Ollama model name or Claude model ID)
- `backend` - Either `ollama` or `claude`
- `system_prompt` - Instructions that define the persona's behavior

### Available Personas

| Persona | Backend | Model | Role |
|---------|---------|-------|------|
| `architect` | Ollama | gemma3:1b | High-level system design |
| `developer` | Ollama | gemma3:1b | Implementation focus |
| `critic` | Ollama | gemma3:1b | Find flaws, suggest improvements |
| `creative` | Ollama | gemma3:1b | Novel and creative approaches |
| `claude` | Claude | claude-sonnet-4-20250514 | General-purpose assistant |

## Troubleshooting

### "Connection refused" errors
Make sure Ollama is running:
```bash
ollama serve
```

### "Model not found"
Pull the required model:
```bash
ollama pull gemma3:1b
```

### "does not support tools" error
The agent requires a tool-capable model. Use `llama3.2:3b` or `llama3.1`:
```bash
ollama pull llama3.2:3b
python3 agent.py -m llama3.2:3b "your task"
```

### Claude authentication errors
Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

### Out of VRAM
Use smaller models:
- `qwen2.5:0.5b` (397 MB)
- `gemma3:1b` (815 MB)
- `llama3.2:3b` (2.0 GB)

## License

MIT
