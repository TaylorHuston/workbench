# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-01-17

### Added

- New multi-agent chat as default `oc` experience
- `@mention` syntax to talk to specific agents (e.g., `@claude hello`)
- Shared conversation history across all agents
- Gemini CLI backend (`gemini-cli`) for Google's Gemini models
- New test agents: `@claude`, `@gemini`, `@qwen`
- Slash commands: `/help`, `/history`, `/clear`, `/quit`

### Changed

- Simplified CLI from complex REPL to focused @mention chat
- Standardized response headers across all backends
- CLI backends (claude-code, gemini-cli) now support conversation context

### Technical

- Added `run_gemini_cli()` function for Gemini CLI headless mode
- Updated `send_message()` to handle multiple CLI backends
- Reduced cli.py from ~600 lines to ~120 lines

## [0.2.0] - 2025-01-16

### Added

- New `oc-build` CLI tool for PLAN.md-driven code implementation
- `plan_parser.py` module to parse PLAN.md files into structured `Phase` objects
- `executor.py` module with implement → review → iterate loop
- `review.py` module with `CodeReview` Pydantic model for structured output
- `llm.py` module with simplified LLM factory for Ollama/Claude backends
- Automatic checkbox updates in PLAN.md as phases complete
- `--dry-run` flag to preview plan without executing
- `--threshold` flag to configure minimum passing score (default: 70)
- `--max-attempts` flag to limit review iterations per phase (default: 3)
- `--no-update` flag to skip PLAN.md checkbox updates
- `--no-stream` flag to disable streaming output

### Changed

- **BREAKING**: Refactored from chat-focused tool to PLAN.md execution tool
- **BREAKING**: Removed `ollama-chat` and `oc` CLI entry points
- **BREAKING**: New package structure using `src/ollama_chat/` layout
- Simplified from ~1500 lines (14 files) to ~400 lines (5 modules)
- Reduced dependencies: removed `langgraph`, `rich`, `requests`
- Default review threshold lowered from 90 to 70

### Removed

- Interactive chat mode (`/chat` command)
- Multi-persona chat room (`/room` command)
- Two-persona collaboration (`/collab` command)
- Session management (`/session` command)
- Batch processing (`/batch` command)
- Tool-calling agent (`/agent` command)
- Workflow framework with LangGraph (`/workflow` command)
- Handoff audit trail system

### Deprecated

- Previous chat and workflow features archived to `_archive/` directory

## [0.1.0] - 2025-01-15

### Added

- Initial release with multi-agent AI workflows
- Interactive REPL with slash commands
- Session-based conversations with spec extraction
- Workflow framework using LangGraph
- Tool-calling agent with filesystem access
- Multi-persona chat room with @ mentions
- Two-persona collaboration mode
- Batch markdown processing
- Handoff persistence for workflow audit trails
- Support for Ollama and Claude backends
- Structured output with `CodeReview` Pydantic model
- Rich terminal formatting

[Unreleased]: https://github.com/TaylorHuston/ollama-chat/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/TaylorHuston/ollama-chat/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/TaylorHuston/ollama-chat/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/TaylorHuston/ollama-chat/releases/tag/v0.1.0
