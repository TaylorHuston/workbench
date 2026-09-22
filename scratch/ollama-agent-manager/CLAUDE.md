# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ollama Agent Manager** - "Discord for your local LLMs"

A proof-of-concept application for managing multi-agent conversations with local and cloud LLMs. Think Discord channels, but each "user" is a different AI agent (Coder, Reviewer, Planner) powered by different models (local via Ollama, cloud via OpenRouter).

**Key thesis**: Local models (Qwen3-Coder 30B) are now good enough for serious coding work. This POC validates that thesis and explores multi-agent UX patterns.

**What this is NOT**: Team collaboration tool, production software, replacement for Claude Code/Cursor.

**Portfolio value**: Demonstrates pragmatic local AI integration, clean Next.js architecture, and strategic use of hybrid local/cloud models.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + SQLite (better-sqlite3)
- **AI Integration**:
  - Ollama HTTP API for local models (Qwen3-Coder)
  - OpenRouter API for cloud models (Claude, Gemini)
  - Server-Sent Events for streaming
- **Database**: SQLite with simple schema (messages, tasks, plans, steps)

## Architecture

```
Browser (localhost:3000)
  ↓
Next.js App Router
  ├─ page.tsx (chat UI)
  └─ api/
      ├─ chat/route.ts (message handling + streaming)
      ├─ agents/route.ts (agent info)
      └─ tasks/route.ts (task/plan data)
  ↓
SQLite (./data/ollama-agent-manager.db)

External APIs:
  • Ollama: http://localhost:11434/api/chat
  • OpenRouter: https://openrouter.ai/api/v1/chat/completions
```

## Agent Configuration (Hardcoded for POC)

```typescript
// lib/agents.ts
agents = {
  coder: {
    model: 'qwen3-coder:30b',  // Local via Ollama
    provider: 'ollama',
    systemPrompt: '...'
  },
  reviewer: {
    model: 'anthropic/claude-sonnet-4',  // Cloud via OpenRouter
    provider: 'openrouter',
    systemPrompt: '...'
  }
}
```

## Development Setup

### Prerequisites

1. Node.js 20+
2. pnpm (or npm)
3. Ollama installed: `curl https://ollama.ai/install.sh | sh`
4. Model pulled: `ollama pull qwen3-coder:30b`
5. OpenRouter API key: https://openrouter.ai/keys

### Environment Variables

```bash
# .env.local (development/testing)
OPENROUTER_API_KEY=your_key_here
DATABASE_PATH=./data/dev.db

# .env.production (dogfooding - real usage)
OPENROUTER_API_KEY=your_key_here
DATABASE_PATH=./data/prod.db
```

### Dual-Database Pattern

**Purpose**: Separate experimental development from real usage (dogfooding).

```bash
data/
├── dev.db     # Testing/development - reset freely when needed
└── prod.db    # Real usage building the app - persistent, backed up
```

**Usage**:
```bash
# Development/testing
pnpm dev                                    # Uses dev.db

# Dogfooding (using the app to build itself)
DATABASE_PATH=./data/prod.db pnpm dev      # Uses prod.db
```

**Philosophy**: `dev.db` is disposable (delete anytime for fresh start). `prod.db` contains real conversations and task history from building the project.

### Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm lint           # Run ESLint
pnpm typecheck      # TypeScript check
```

## Database Schema

```sql
-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,  -- 'user', 'coder', 'reviewer'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Tasks table (single task for POC)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'active'
);

-- Plans table
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  phase_number INTEGER NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

-- Steps table
CREATE TABLE steps (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  step_number TEXT NOT NULL,  -- "1.1", "1.2"
  description TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  FOREIGN KEY(plan_id) REFERENCES plans(id)
);
```

## Key Directories

- `app/` - Next.js pages and layouts
- `app/api/` - API routes for chat, agents, tasks
- `components/` - React components (ChatInput, MessageList, PlanSidebar)
- `lib/` - Utilities (agents.ts, db.ts, ollama.ts, openrouter.ts)
- `data/` - SQLite database file (gitignored)

## Reference Documentation

**Planning docs** at `/home/taylor/src/ideas/ideas/ollama-agent-manager/`:
- `project-brief.md` - Product vision and scope
- `docs/tech-stack.md` - Detailed technical architecture
- `docs/chat-ux-design.md` - UI/UX specifications
- `docs/agent-system.md` - Agent configuration patterns

**Connection to Coordinatr**:
- See `/home/taylor/src/ideas/ideas/coordinatr/notes/2026-01-10-ollama-agent-manager-connection.md`
- Ollama Agent Manager validates multi-agent UX for future Coordinatr features
- Lessons learned here inform Coordinatr's local agent support

## Development Guidelines

### Simplicity First
This is a POC, not production software. Priorities:
1. Prove the concept works (local models + multi-agent chat)
2. Clean, readable code
3. Good enough UX (not pixel-perfect)

### Performance Expectations
- Qwen3-Coder 30B on RTX 4070 Ti Super: ~20-30 tokens/second
- Time to first token: ~200-500ms
- Total response (200 tokens): ~8-10 seconds
- This is fast enough for conversational UX

### Known Constraints
- **VRAM limitation**: Only one 30B model fits in 16GB VRAM at a time
- **Model swap tax**: 30-60 seconds to unload/load models
- **Solution**: Hybrid architecture (one local coder + cloud reviewer/planner)

### Error Handling
- Ollama offline? Show clear message, don't crash
- OpenRouter rate limit? Graceful degradation
- Model loading? Show loading state

## Next Steps (POC Implementation)

1. Initialize Next.js 15 project with TypeScript
2. Set up SQLite with schema
3. Create basic chat UI (MessageList, ChatInput)
4. Implement Ollama integration (`/api/chat` route)
5. Implement OpenRouter integration
6. Add @mention agent routing
7. Build PlanSidebar for task context
8. Test conversation flow with both agents

## Git Workflow

Standard feature branch workflow:
- `main` - Stable releases
- `feature/*` - New features
- `bugfix/*` - Bug fixes

Commit to main directly for POC work (single developer, rapid iteration).
