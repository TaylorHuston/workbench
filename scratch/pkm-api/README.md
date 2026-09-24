# PKM API

Local-first FastAPI service for controlled, composable job-tracking workflows. It exposes a durable **JobLead** control plane plus read-only, bounded views of authoritative Markdown **JobPostings**. Markdown remains authoritative; SQLite stores workflow state only.

> [!WARNING]
> Inbound authentication is not implemented. The packaged server rejects non-loopback bind addresses. Do not expose it directly to a LAN, tailnet, reverse proxy, or the public internet.

## Status

Implemented:

- one-link JobLead submission with canonical identity and redirect-alias reconciliation;
- required idempotency keys, semantic replay protection, strong ETags, conditional reads, and conditional retries;
- cursor pagination, lifecycle filtering, terminal-record retention, and content-minimized events;
- transactional SQLite migrations, future-schema rejection, fenced leases, attempts, retries, and backoff;
- SSRF-resistant HTTPS retrieval with DNS/IP validation, pinned connections, redirect revalidation, timeouts, and size/type limits;
- bounded schema.org `JobPosting` extraction and read-only Markdown deduplication;
- a framework-independent processing pipeline with strict assessment/result validation and a disabled materializer;
- controlled, cursor-paginated JobPosting summaries and aggregate job statistics;
- RFC 9457 Problem Details, sanitized `500`/retryable `503` behavior, and OpenAPI 3.1 documentation.

Security hold:

- No operational AI assessor is wired in. A direct Codex SDK thread can read local files even in its read-only sandbox, so feeding untrusted job text to it would not isolate the vault or local credentials. The application `AssessmentPort`, versioned policy, deterministic validator, and ChatGPT authentication preflight remain, but production processing is blocked until assessment runs behind a demonstrably tool-free or OS-isolated broker.
- Live Company/JobPosting writes remain disabled pending disposable-vault rehearsal.
- Inbound authentication, authorization, rate limiting, signed events, and remote exposure remain deferred.

See [`docs/api.md`](docs/api.md), [`docs/architecture.md`](docs/architecture.md), and [`docs/operations.md`](docs/operations.md).

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Process liveness |
| `GET` | `/readyz` | Current local control-plane capabilities |
| `GET` | `/v1/job-postings` | List controlled JobPosting summaries; filter with repeated `status` |
| `GET` | `/v1/job-stats` | Aggregate current non-archived JobPostings |
| `POST` | `/v1/job-leads` | Submit exactly one HTTPS job URL |
| `GET` | `/v1/job-leads` | List/filter JobLeads with cursor pagination |
| `GET` | `/v1/job-leads/{id}` | Read one JobLead and its ETag |
| `POST` | `/v1/job-leads/{id}/retry` | Requeue a failed lead conditionally |

Interactive documentation is at `/docs`; OpenAPI is at `/openapi.json`.

## Quick start

```bash
uv sync
PKM_API_VAULT_ROOT=/Users/taylor/src/my-life/my-vault uv run pkm-api
```

The server listens on `127.0.0.1:8000`.

```bash
curl --fail-with-body \
  -X POST http://127.0.0.1:8000/v1/job-leads \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: n8n:run-123:linkedin:4470613618' \
  -d '{
    "sourceUrl": "https://www.linkedin.com/jobs/view/4470613618/",
    "discoveredBy": "n8n",
    "sourceReference": "apify:run-123:4470613618"
  }'
```

A new lead returns `201 Created`; an existing source or exact replay returns `200 OK`. Both include `Location`, `ETag`, and `Idempotency-Replayed` headers. `sourceReference` is restricted to a short opaque identifier and cannot be used to store source prose or email content.

Read the captured review queue:

```bash
curl --fail-with-body \
  'http://127.0.0.1:8000/v1/job-postings?status=captured&limit=25'
```

## JobLead lifecycle

```text
queued
  -> processing
      -> alreadyTracked
      -> possibleRepost
      -> skipped
      -> readyForMaterialization
      -> materialized            # reserved; unreachable in this release
      -> queued                  # retryable failure with attempts remaining
      -> failed                  # permanent or exhausted failure

failed
  -> queued                      # explicit conditional retry
```

Stages are `pending`, `retrieving`, `extracting`, `deduplicating`, `assessing`, `validating`, `materializing`, and `completed`. Worker lease tokens and mutation operations are never exposed over HTTP.

## Codex authentication boundary

The future assessment broker is intended to use Taylor's locally cached ChatGPT login without falling back to separately billed API access. Verify that credential state with:

```bash
codex login
uv run pkm-api-codex-auth-check
```

The check refreshes the session and fails unless the active method is `chatgpt`. Never copy `~/.codex/auth.json` into this project, SQLite, environment files, logs, Docker, or n8n. Authentication readiness does **not** remove the filesystem-isolation hold described above.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PKM_API_HOST` | `127.0.0.1` | Must be localhost or a loopback IP |
| `PKM_API_PORT` | `8000` | HTTP port |
| `PKM_API_CONTROL_DB` | `.local/pkm-api.sqlite3` | SQLite workflow state |
| `PKM_API_VAULT_ROOT` | none | Enables controlled JobPosting reads |

New control-store directories and databases are restricted to the current user where supported. Local state is gitignored.

## Architecture

```text
FastAPI + Pydantic
  -> JobLead application service -> SQLite control store
  -> JobPosting query service    -> confined Markdown catalog

Processing application core (not operationally wired)
  -> fenced lease -> safe retrieval -> bounded extraction
  -> redirect identity reconciliation -> catalog deduplication
  -> AssessmentPort -> deterministic validation -> disabled materializer
```

Domain and application modules do not depend on FastAPI. Raw source bodies, full caller descriptions, and raw model output are not persisted.

## Verification

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run python -m compileall -q src
```

Tests use temporary databases and vault fixtures. They do not require network access, the live vault, PostgreSQL, n8n, or a real Codex login.

## Promotion gates

1. Put assessment behind a tool-free or OS-isolated broker and prove with an adversarial test that vault/home paths are inaccessible.
2. Rehearse atomic, confined Company and JobPosting writes against a disposable vault.
3. Add client authentication, scoped authorization, rate limiting, and audit retention.
4. Threat-model Tailscale/LAN exposure and configure the trusted TLS boundary.
5. Add archetype-queue and index reconciliation with separately reported outcomes.
6. Decide maintained repository and SDD ownership.
