# ADR-001: Tech Stack Selection for POC

**Status**: Accepted
**Date**: 2026-01-10
**Decision Makers**: Taylor Huston

## Context

Ollama Agent Manager is a proof-of-concept portfolio project to validate that local LLMs (Qwen3-Coder 30B via Ollama) can deliver comparable performance to cloud solutions like Claude Code or Gemini for coding tasks. The project explores multi-agent chat UX patterns while keeping implementation time minimal.

### Key Requirements
- **Portfolio quality**: Clean, understandable architecture that demonstrates best practices
- **Fast to build**: Minimal setup, familiar tools, rapid iteration
- **Performance validation**: Must prove local models are viable for real coding work
- **Solo developer**: No team coordination, no complex deployment infrastructure
- **POC scope**: Single-user, localhost only, experimental

### Decision Drivers
1. Speed of implementation (primary)
2. Familiarity with stack (minimize learning curve)
3. Portfolio presentation (clean, modern architecture)
4. Local-first philosophy (SQLite, web app, no cloud dependencies)

## Decision

We will use **Next.js 16 + React 19 + SQLite + Vercel AI SDK** with the following components:

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 16 (App Router) + React 19 | Latest stable, Turbopack default, fast refresh, built-in API routes |
| **UI Components** | Tailwind CSS + shadcn/ui | Rapid prototyping, clean defaults |
| **Database** | SQLite (better-sqlite3) | Zero-config, file-based, portable |
| **AI Integration** | Vercel AI SDK | Handles streaming complexity, React hooks |
| **Streaming** | Server-Sent Events (SSE) | Simpler than WebSockets, sufficient for chat |
| **Local Models** | Ollama HTTP API | Direct access to Qwen3-Coder 30B |
| **Cloud Models** | OpenRouter API | Access to Claude, Gemini, etc. |

## Options Considered

### Option 1: Next.js 16 + SQLite + Vercel AI SDK (Chosen)
**Description**: Web app running on localhost:3000, leveraging Vercel AI SDK for streaming abstraction.

**Pros**:
- Fastest to implement (all familiar tools)
- Vercel AI SDK handles streaming complexity automatically
- Next.js 16 with stable Turbopack (faster builds, hot reload)
- Next.js App Router provides clean architecture
- SQLite requires zero configuration
- shadcn/ui provides instant UI polish
- No build/packaging complexity (just `pnpm dev`)

**Cons**:
- Distribution is "clone and run" (not a downloadable app)
- SQLite limits to single user (acceptable for POC)
- Vercel AI SDK adds dependency (can fallback to direct APIs if needed)
- SSE limits to unidirectional streaming

### Option 2: Electron/Tauri Desktop App
**Description**: Package as native desktop application with embedded web view.

**Pros**:
- Professional distribution (.exe, .app, .dmg)
- Better perceived "legitimacy" as portfolio piece
- Native OS integration potential

**Cons**:
- Significant packaging/build overhead
- Not evaluated - would slow POC iteration
- Overkill for validating the core thesis (local model performance)

### Option 3: Raw API Calls (No AI SDK)
**Description**: Directly call Ollama and OpenRouter APIs without abstraction layer.

**Pros**:
- Full control over streaming logic
- No extra dependencies
- Complete transparency

**Cons**:
- More boilerplate for SSE parsing
- Manual error handling and state management
- Slower to iterate on streaming UX
- Vercel AI SDK handles this complexity well

### Option 4: LangChain Integration
**Description**: Use LangChain framework for AI orchestration.

**Pros**:
- Rich ecosystem of tools
- Structured agent patterns

**Cons**:
- Overkill for simple chat streaming
- Steeper learning curve
- Not evaluated - adds unnecessary complexity for POC

## Consequences

### Positive
- **Rapid development**: Can start building immediately with familiar tools
- **Clean codebase**: Modern stack produces maintainable, portfolio-quality code
- **Flexible AI integration**: Easy to swap models or add new agents
- **Local-first**: SQLite database is portable, private, zero-ops
- **Easy streaming**: Vercel AI SDK abstracts SSE complexity with React hooks

### Negative
- **Distribution friction**: Users must clone repo and run `pnpm dev` (not one-click install)
- **Single-user only**: SQLite architecture doesn't scale to multi-user (intentional for POC)
- **Limited real-time features**: SSE is unidirectional (can't do bidirectional agent communication)
- **Dependency risk**: Vercel AI SDK might not support all Ollama features (can fallback to direct APIs)

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vercel AI SDK doesn't support Ollama feature | Low | Medium | Fallback to direct API calls if needed |
| SQLite concurrent write issues | Low | Low | POC is single-user, sequential messages only |
| SSE limitations block feature | Low | Low | Can upgrade to WebSockets if truly needed |
| Performance doesn't validate thesis | Medium | High | Hardware prerequisites documented (RTX 4070 Ti Super 16GB) |

### Migration Path (Post-POC)
If the POC is successful and warrants production development:
1. **Multi-user**: Migrate SQLite → PostgreSQL with sync strategy
2. **Distribution**: Package with Tauri for native apps
3. **Real-time**: Upgrade SSE → WebSockets for bidirectional features
4. **AI SDK**: Evaluate direct APIs if fine-grained control needed

## Related Decisions
- None yet (first ADR)

## References
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Next.js 16.1 Release](https://nextjs.org/blog/next-16-1)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [OpenRouter API](https://openrouter.ai/docs)
- [Project Tech Stack](../../../ideas/ollama-agent-manager/docs/tech-stack.md)
- [Local Coding Models Research](../../../resources/research/local-coding-models-2025-2026.md)
