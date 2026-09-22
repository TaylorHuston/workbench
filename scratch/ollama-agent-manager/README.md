# Ollama Agent Manager

> Discord for your local LLMs - multiple AI agents, one conversation

A proof-of-concept application for managing multi-agent conversations with local and cloud LLMs. Each agent has a different role (Coder, Reviewer, Planner) powered by different models (Qwen3-Coder locally via Ollama, Claude via OpenRouter).

**Status**: 🔨 In development - POC phase

## What This Is

- **Experimental POC** validating local coding model performance (Qwen3-Coder 30B)
- **Multi-agent chat interface** inspired by Discord's UX
- **Hybrid architecture** showcasing strategic use of local + cloud models
- **Portfolio piece** demonstrating pragmatic AI integration

## What This Is NOT

- ❌ Team collaboration tool (solo use only)
- ❌ Production software (experimental POC)
- ❌ Replacement for Claude Code or Cursor (different use case)

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + SQLite
- **AI**: Ollama (local) + OpenRouter (cloud)
- **Streaming**: Server-Sent Events

## Prerequisites

1. **Node.js 20+**
2. **Ollama** - Install: `curl https://ollama.ai/install.sh | sh`
3. **Qwen3-Coder model** - Pull: `ollama pull qwen3-coder:30b`
4. **OpenRouter API key** - Get one at https://openrouter.ai/keys
5. **GPU with 16GB+ VRAM** - RTX 4070 Ti Super or better (for 30B model)

## Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local and add your OPENROUTER_API_KEY

# Run development server
pnpm dev                                    # Uses dev.db
# OR for dogfooding (real usage)
DATABASE_PATH=./data/prod.db pnpm dev      # Uses prod.db
```

Open http://localhost:3000

## Database Strategy

**Dual-database pattern for dogfooding:**

```bash
data/
├── dev.db     # Testing/development - reset anytime
└── prod.db    # Real usage (dogfooding) - persistent
```

- `dev.db` = Experimental, disposable
- `prod.db` = Using the app to build itself, keep forever

## Project Structure

```
ollama-agent-manager/
├── app/                   # Next.js App Router
│   ├── page.tsx          # Main chat interface
│   └── api/              # API routes
├── components/           # React components
├── lib/                  # Utilities (agents, db, AI clients)
├── data/                 # SQLite database (gitignored)
└── docs/                 # Additional documentation
```

## Agent Configuration

The POC includes two agents:

- **Coder Agent** - Qwen3-Coder 30B (local via Ollama)
  - Role: Write clean, tested code
  - Performance: ~20-30 tokens/second on RTX 4070 Ti Super

- **Reviewer Agent** - Claude Sonnet 4 (cloud via OpenRouter)
  - Role: Review for security, performance, maintainability
  - Performance: Instant (no local GPU constraint)

## Performance Expectations

With Qwen3-Coder 30B on RTX 4070 Ti Super 16GB:
- Time to first token: ~200-500ms
- Generation speed: ~20-30 tokens/second
- Full response (200 tokens): ~8-10 seconds

This is fast enough for conversational UX with streaming.

## Known Limitations

- **VRAM**: Only one 30B model fits in 16GB at a time
- **Model swap tax**: 30-60s to switch between large local models
- **Solution**: Hybrid architecture (local Coder + cloud Reviewer)

## Planning & Documentation

Full planning docs in `/ideas/ollama-agent-manager/`:
- `project-brief.md` - Vision and scope
- `docs/tech-stack.md` - Technical architecture
- `docs/chat-ux-design.md` - UI/UX design
- `docs/agent-system.md` - Agent patterns

## Connection to Coordinatr

This POC validates multi-agent UX patterns and local model performance for the larger [Coordinatr](https://github.com/TaylorHuston/coordinatr) project. Lessons learned here inform Coordinatr's local agent support.

See: `/ideas/coordinatr/notes/2026-01-10-ollama-agent-manager-connection.md`

## License

MIT

## Author

Taylor Huston - [GitHub](https://github.com/TaylorHuston)
