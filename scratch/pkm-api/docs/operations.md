# Local Operations

## Prerequisites

- macOS user with access to the private vault;
- Python 3.12 or later;
- `uv`.

Codex authentication is needed only to verify the intended future subscription-backed assessment identity:

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

`/healthz` proves process liveness. `/readyz` reports that the local control store is ready while worker assessment, materialization, and inbound authentication are not configured. If `PKM_API_VAULT_ROOT` is absent, JobPosting read routes return `503 jobCatalogUnavailable` with `Retry-After` while JobLead intake remains available.

## Processing security hold

There is intentionally no installed worker command. The processing application core and deterministic tests exist, but the direct local Codex adapter was removed: Codex read-only sandboxing still permits filesystem reads, so untrusted posting content could induce access to the vault or local credentials.

Do not work around this by enabling approvals, copying `auth.json`, mounting credentials into Docker, or relying on prompt instructions. The gate is a tool-free or OS-isolated assessment broker plus an adversarial integration test proving that vault and home paths are inaccessible. Live materialization has a separate disposable-vault rehearsal gate.

## n8n integration

Until inbound authentication exists, n8n may submit to the loopback service only through the local Docker host bridge:

- method: `POST`;
- URL: `http://host.docker.internal:8000/v1/job-leads`;
- `Idempotency-Key`: deterministic discovery-run/item key;
- body: one `sourceUrl`, `discoveredBy`, and optional opaque `sourceReference`.

Do not send arrays, scraped descriptions, email bodies, cookies, or credentials. The current runtime queues leads but does not process them while the assessment security hold is active. Do not expose the API through Tailscale until application authentication and authorization exist.

## SQLite handling

The default control database is `.local/pkm-api.sqlite3`; it is ignored by Git. New state uses owner-only permissions where supported. SQLite contains idempotency, transient leads, source aliases, lease/retry metadata, attempts, and content-minimized events. It cannot reconstruct authoritative JobPostings.

Before maintenance:

1. stop the API and any future workers;
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

A future worker rejected a URL, redirect, port, or resolved address under SSRF policy. Do not weaken private-address or TLS checks.

### `unsupportedSource`

A future worker found no usable schema.org JobPosting data. Add a tested source-specific adapter instead of storing arbitrary page text.

### `possibleRepost`

Company/role matches lacked exact identity. No write occurs; identity needs a common ATS ID or verified redirect.

## Production exclusions

This is not ready for a daemon, remote listener, or unattended production service. Promotion requires the isolated assessment broker, rehearsed materializer, inbound auth and scopes, rate limiting, structured privacy-safe diagnostics, release packaging, and explicit repository/SDD ownership.
