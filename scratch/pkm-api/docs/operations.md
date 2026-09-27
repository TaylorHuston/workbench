# Local Operations

## Prerequisites

- macOS user with access to the private vault;
- Python 3.12 or later;
- `uv`.

Codex authentication is required by the subscription-backed assessment worker:

```bash
codex login
uv run pkm-api-codex-auth-check
```

The check fails closed unless the method is `chatgpt`; it never falls back to an API key. Do not copy Codex credentials into this project or any service configuration.

## Install and verify

```bash
uv sync
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run python -m compileall -q src
```

Tests use temporary state and do not touch the live vault or network.

## Run the API

```bash
PKM_API_HOST=127.0.0.1 \
PKM_API_PORT=8000 \
PKM_API_CONTROL_DB=.local/pkm-api.sqlite3 \
PKM_API_VAULT_ROOT=/Users/taylor/src/my-life/my-vault \
uv run pkm-api
```

The packaged command disables access logs and rejects non-loopback hosts while inbound authentication is absent.

```bash
curl --fail http://127.0.0.1:8000/healthz
curl --fail http://127.0.0.1:8000/readyz
curl --fail 'http://127.0.0.1:8000/v1/job-postings?status=captured'
curl --fail http://127.0.0.1:8000/v1/job-stats
```

`/healthz` proves process liveness. `/readyz` reports the current in-process worker state, tool-denied assessment capability, and confined Markdown materializer; it returns `503` while an enabled worker is degraded, failed, or stopping. With a configured vault, startup does not complete unless the isolation preflight succeeds and the worker starts. Inbound authentication remains disabled. If `PKM_API_VAULT_ROOT` is absent, JobPosting read routes return `503 jobCatalogUnavailable` with `Retry-After` while JobLead intake remains available.

## Automatic queue processing

With `PKM_API_VAULT_ROOT` configured, API startup performs the mandatory isolation preflight, starts one in-process consumer, and drains durable queued work left by an earlier process. Every successful new submission or manual retry wakes that consumer immediately. Transient retries are picked up by the worker's bounded idle poll. A transient processor or lease exception makes readiness temporarily unavailable, waits with bounded backoff, and resumes the same consumer rather than abandoning queued work. No separate command is needed during normal operation.

Run the isolation check by itself after Codex/runtime upgrades when diagnosing the environment:

```bash
PKM_API_VAULT_ROOT=/Users/taylor/src/my-life/my-vault \
  uv run pkm-api-worker --verify-isolation-only
```

For recovery or diagnostics, stop the API first and process up to 25 currently eligible leads with the standalone command:

```bash
PKM_API_VAULT_ROOT=/Users/taylor/src/my-life/my-vault \
PKM_API_CONTROL_DB=.local/pkm-api.sqlite3 \
  uv run pkm-api-worker --max-items 25
```

Every API worker startup or standalone worker launch refreshes and verifies `chatgpt` authentication, loads bounded candidate context and controlled vocabularies from confined regular files, and performs the live adversarial probe before claiming work. The probe must exercise the unconditional tool-denial hook, prove that random protected home content was not disclosed, and run a fixed command through the same named Codex permission profile to prove read denial for home, the vault candidate-context file, source/global Codex configuration, the source authentication file, and the broker-linked authentication path. Unsupported or ignored permission-profile settings make the probe fail. There is no bypass flag.

Each assessment starts a fresh ephemeral Codex app server through `env -i`, with only `HOME`, `CODEX_HOME`, `PATH`, locale, and the hook-counter path. The broker refreshes and verifies its own account as `chatgpt` before the turn; the worker exposes no provider/model override. It uses a temporary owner-only home/workspace, links rather than copies the existing `auth.json`, loads no global Codex configuration, disables plugins/apps/memory/multi-agent/search/browser/computer tools, denies tool networking and home/vault/auth filesystem paths, uses `ApprovalMode.deny_all`, and rejects the lead if any tool is attempted. Only the bounded proposal is sent as `ExternalMessage`; the versioned policy, supported archetypes, and bounded contents of `02-personal/career/strategy/career-advisor-snapshot.md` are trusted instructions. Those values are processed by the configured ChatGPT-backed model provider; arbitrary vault files are not sent. Temporary broker state is destroyed after the turn.

Shutdown signals the consumer, closes an active isolated Codex app server, and lets interrupted processing return through its fenced claim. Source retrieval is already time-bounded, and the worker uses a final bounded join.

Do not replace this with a normal local Codex thread, enable approvals, copy `auth.json`, mount credentials into Docker, add a probe bypass, or rely only on prompt instructions. Materialization must remain deterministic and confined; tests use disposable vaults and must never target the live vault.

## n8n integration

Until inbound authentication exists, n8n may submit to the loopback service only through the local Docker host bridge:

- method: `POST`;
- URL: `http://host.docker.internal:8000/v1/job-leads`;
- `Idempotency-Key`: deterministic discovery-run/item key;
- body: one `sourceUrl`, `discoveredBy`, and optional opaque `sourceReference`.

Do not send arrays, scraped descriptions, email bodies, cookies, or credentials. A committed submission automatically wakes the API's worker; n8n must not receive Codex credentials or perform assessment. Do not expose the API through Tailscale until application authentication and authorization exist.

## SQLite handling

The default control database is `.local/pkm-api.sqlite3`; it is ignored by Git. New state uses owner-only permissions where supported. SQLite contains idempotency, transient leads, source aliases, lease/retry metadata, attempts, and content-minimized events. It cannot reconstruct authoritative JobPostings.

Before maintenance:

1. stop the API and any standalone workers;
2. copy the database plus `-wal`/`-shm` together, or use SQLite backup;
3. never upload or commit the copy.

Migrations are transactional and versioned through `PRAGMA user_version`; a newer unknown version fails closed. API startup removes expired idempotency records and terminal JobLeads after the 30-day TTL. Queued/processing work is retained rather than silently deleted.

SQLite lock/busy errors return `503 controlStoreBusy` and `Retry-After: 1`. Other unexpected errors return a sanitized `500 internalError`; neither response includes exception text.

## Retry behavior

Automatic attempts default to three. Retryable failures requeue with exponential backoff; permanent or exhausted failures become `failed`.

Manual retry procedure:

1. `GET` the lead and retain its `ETag`;
2. `POST /v1/job-leads/{id}/retry` with that value in `If-Match`;
3. use a new deterministic `Idempotency-Key` for the retry intent.

Do not edit lifecycle columns manually. Lease/version fencing and alias reconciliation depend on coherent transitions.

## Troubleshooting

### `jobCatalogUnavailable`

Set `PKM_API_VAULT_ROOT` to a readable vault with the expected JobPosting tree. Do not point it at an arbitrary filesystem root.

### `controlStoreBusy`

Retry after the advertised delay. If persistent, find another process holding a long write transaction; do not delete WAL files while a process is active.

### `blockedSourceAddress`

The worker rejected a URL, redirect, port, or resolved address under SSRF policy. Do not weaken private-address or TLS checks.

### `unsupportedSource`

The worker found no usable schema.org JobPosting data. Add a tested source-specific adapter instead of storing arbitrary page text.

### `possibleRepost`

Company/role matches lacked exact identity. No write occurs; identity needs a common ATS ID or verified redirect.

## Production exclusions

This is not ready for a remote listener. Confined automatic Markdown writes are enabled for the configured local vault; keep a backup and do not change the canonical job-market layout without updating the materializer tests. Remote promotion still requires inbound auth and scopes, rate limiting, structured privacy-safe diagnostics, release packaging, and explicit repository/SDD ownership. Re-run the live isolation check after every Codex SDK/runtime or broker-policy change.
