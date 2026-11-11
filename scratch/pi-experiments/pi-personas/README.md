# pi-personas

> **Section:** Scratch
>
> **Status:** Experimental scaffold; not installed
>
> **Source:** Original Pi extension experiment

## Purpose

Explore named primary-agent profiles that can be used across Pi sessions, starting with a Markdown file containing a display name and system-prompt instructions.

## Run

```sh
node --test index.test.mjs
```

Create a Markdown file in the Pi agent directory's `personas/` (normally `~/.pi/agent/personas/`) or the current project's `.pi/personas/`, for example `writing.md`:

```markdown
---
name: Writing
---

Help develop ideas while preserving the author's voice.
```

Then explicitly load the extension and select the filename without `.md`:

```sh
pi -e /absolute/path/to/pi-personas/index.ts --persona writing
```

Persona IDs use lowercase letters, numbers, hyphens and underscores. The optional `name` must be a nonempty string; without it, the ID is used. The Markdown body is required and becomes the persona instructions. Other frontmatter fields currently have no effect.

A trusted project's persona replaces the global file of the same name; the files are not merged. Project files are ignored when the project is not trusted. If a selected project file is invalid, the global file is not used as a fallback. Missing or invalid profiles produce a warning and no persona is selected; the session continues without persona instructions. Without `--persona`, this extension adds no persona instructions.

## Limits and next step

The flag selects a profile at session startup; it is not saved to the session, so specify it again when resuming. Pi does not currently recognize `.pi/personas/` alone as a trust-requiring project resource, so do not rely on project persona trust until that detection is resolved. There is no switching command, model selection, skill or MCP scoping, agent-specific memory, task assignment, or multi-agent orchestration. No isolation or authorization boundary is provided. No services are started, and the extension is not automatically loaded.

Next, decide profile semantics for scoped skills and MCP connections before expanding the scaffold.
