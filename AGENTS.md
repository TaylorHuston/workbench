# Workbench Agent Guide

## Scope and precedence

This repository is a public workbench, not one application or a conventional monorepo. It contains unrelated learning exercises, reusable references, and disposable experiments in one Git repository.

1. Read this file, the nearest `README.md`, and any more specific local `AGENTS.md` before acting. Also check the target directory and its ancestors for applicable `CLAUDE.md` and scoped `.github` instructions.
2. A nested `AGENTS.md` overrides this file for its subtree. Other instruction files add project context only and must not relax this guide's Git, privacy, safety, or `learning/` and `reference/` boundaries. If instructions conflict, stop and ask.
3. When older notes disagree with the current README, manifest, lockfile, or code, prefer the current artifacts and call out the discrepancy.
4. There is no root install, build, test, or release command. Work and verify from the target project's directory.

The repository is intentionally exempt from the workspace's normal SDD lifecycle, branch naming, and application architecture requirements. Do not create SDD artifacts or impose the usual `main`/`develop` workflow here unless the user explicitly asks. Normal Git safety still applies: inspect status and diffs, preserve unrelated changes, and do not commit, push, merge, or rewrite history without explicit approval.

## Classify the work first

### `learning/`

This is source-led practice from books, courses, tutorials, and videos.

- All exercise and implementation code must be written by Taylor, not by an LLM.
- Agents may inspect, explain, review, diagnose, ask guiding questions, and give feedback.
- Do not author solutions, complete exercises, or directly modify implementation code. If asked, offer review or incremental advice instead.
- Preserve the source's structure when it is useful, along with author, link, edition/version, attribution, and licensing information.
- Do not broadly modernize tutorial code merely because its dependencies or style are old.

### `reference/`

This contains narrow, readable, canonical examples.

- Reference implementation code must also be written by Taylor, not by an LLM.
- Agents may review, explain, diagnose, and recommend changes, but must not directly author or rewrite implementation examples.
- Keep each example understandable in isolation and focused on the concept it demonstrates; production-scale architecture is usually counterproductive here.
- Preserve attribution and licenses for examples derived from external material.
- A nested guide may add stricter rules. In particular, consult `reference/frameworks/NextJS/my-app/AGENTS.md` before working in that app.

For both `learning/` and `reference/`, narrowly scoped non-code maintenance such as indexes, attribution, or README corrections is allowed when explicitly requested, provided it does not supply the exercise or implementation itself.

### `scratch/`

This is the default location for new spikes, proofs of concept, and disposable investigations. Direct implementation assistance is allowed here.

- Prefer the smallest change that answers the experiment's question.
- Follow the nearest README and existing project conventions rather than applying a repository-wide stack or architecture.
- A successful experiment may be discarded, deliberately reshaped into `reference/`, or moved to a standalone repository when it becomes a durable application.

## Before changing a project

1. Confirm the target directory and inspect relevant Git status and diffs.
2. Read the nearest README, applicable instruction files, manifest, lockfile, ignore rules, and relevant source or operational docs.
3. Determine whether the material is original, source-led, or copied from an upstream project before editing it.
4. Detect the local package manager and runtime from the project's files. Do not switch package managers, regenerate lockfiles, or upgrade dependencies incidentally.
5. Use commands from the nearest README, manifest scripts, or Makefile. Treat upstream boilerplate commands as hints when they conflict with the checked-in project.

The repository contains Node/npm, pnpm, Yarn, Python/pip, Python/uv, Go, Java, Docker, and Terraform projects. Never assume a command that works for one subtree applies to another.

## Documentation and placement

- Keep projects self-contained. Add or update a local README when purpose, source, setup, or status is not obvious.
- Use `README-template.md` for project documentation: section, status, source, purpose, context, minimal run steps, notes, and intended next step.
- `README-template.md` is the repository's project template. Directories named `templates/` inside Flask/Jinja projects contain application views and are not repository scaffolding.
- Use lowercase kebab-case for new general-purpose paths unless a language, framework, or preserved upstream layout requires another convention.
- Never add paths that differ only by case.
- When adding, moving, promoting, or removing a project, update the relevant section README and the root inventory when applicable.
- Preserve source links, attribution, copyright notices, and upstream license files.

## Generated files, secrets, and local state

Do not read, print, edit, or commit real credentials or private runtime data. Treat `.env.example` files only as placeholder schemas.

Keep generated or local artifacts out of changes, including:

- `node_modules/`, virtual environments, caches, bytecode, build output, and framework-generated files;
- `.env*` values, tokens, auth files, credential stores, and private keys;
- SQLite databases and sidecars, sessions, logs, model output, and local test results;
- Terraform state, plans, provider caches, and generated cloud credentials.

Before creating local-state or secret-bearing files, verify that the closest applicable `.gitignore` excludes them. For requested `scratch/` work, add a narrowly scoped ignore rule first when needed. For `learning/` or `reference/`, propose that non-code maintenance change and wait for explicit approval.

Use the owning project's tooling to regenerate generated output. Do not hand-edit it.

## Side-effecting operations

- Inspect Docker, Make, Terraform, Kubernetes, cloud, database, and deployment commands before running them.
- Do not run provision, apply, deploy, publish, push, destructive cleanup, secret-creation, or production-data commands without an explicit request and confirmed target.
- Prefer local, read-only, or validation commands when the task does not require mutation.
- Preserve dogfooding or persistent databases such as `scratch/ollama-agent-manager/data/prod.db`; never treat them as disposable test data.
- `scratch/pkm-api` is loopback-only and can interact with the private vault and local Codex authentication. Read its README plus `docs/architecture.md` and `docs/operations.md` before running it. Never expose it to a LAN, tailnet, reverse proxy, or public interface, and do not start vault-backed workers or live isolation checks unless the user explicitly requests that side effect.

## Verification

Run only checks relevant to the changed project and report any check that could not run. Examples documented in this repository include:

- npm projects: project-defined `npm run lint`, `npm run build`, or tests;
- pnpm projects: project-defined `pnpm lint`, `pnpm typecheck`, or `pnpm build`;
- `scratch/pkm-api`: `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .`, and `uv run python -m compileall -q src`;
- Terraform examples: `terraform fmt -check` and, only with safe initialization and no unintended backend access, `terraform validate`;
- Docker course projects: the specific documented Make target rather than a repository-wide command.

Do not run deployment or live-provider checks as routine verification. For `learning/` and `reference/`, stay within the review/advice boundary even when a fix appears obvious.

## Diagrams

For Mermaid work, follow `.github/instructions/mermaid.instructions.md`. Do not manually regenerate diagrams managed by the Mermaid synchronization workflow.
