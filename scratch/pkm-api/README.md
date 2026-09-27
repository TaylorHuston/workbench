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
- bounded schema.org `JobPosting` extraction, a host/path-confined LinkedIn public-markup fallback, and read-only Markdown deduplication;
- an automatic single-consumer in-process worker that wakes after submissions, resumes durable queued work at startup, and applies safe retrieval, bounded extraction, redirect reconciliation, and deduplication;
- subscription-backed Codex assessment in a fresh ephemeral broker with an environment allowlist, isolated `CODEX_HOME`, denied tools, denied vault/home filesystem access, disabled tool networking, and a mandatory live adversarial isolation probe;
- strict structured assessment validation plus a temporary, evidence-minimized materialization candidate for retry-safe writes, cleared at terminal completion;
- confined create-only Company and JobPosting materialization, write-boundary identity rechecks, idempotent archetype-queue handoff, and an `added` row in the human processing log;
- controlled, cursor-paginated JobPosting summaries and aggregate job statistics;
- RFC 9457 Problem Details, sanitized `500`/retryable `503` behavior, and OpenAPI 3.1 documentation.

Remaining security holds:

- The direct local Codex-thread design remains prohibited. The worker uses only the isolated broker, marks posting content as untrusted external input, rejects any attempted tool use, strips inherited environment variables before starting Codex, and destroys broker state after each assessment. Its mandatory startup probe must observe a denied tool attempt, no disclosure from a protected home path, and deterministic Codex-sandbox read denials for home, the vault, source/global Codex configuration, and both source and broker-linked authentication paths before any lead is claimed.
- Company/JobPosting writes are enabled only when a vault-backed worker is configured. They are confined to the canonical job-market paths and were rehearsed against disposable vault fixtures; do not point an unreviewed deployment at another vault layout.
- Processing-log rows for duplicate, skipped, and failed outcomes remain a follow-up; materialized postings currently write the `added` row.
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

A new lead returns `201 Created`; an existing source or exact replay returns `200 OK`. Both include `Location`, `ETag`, and `Idempotency-Replayed` headers. When the vault is configured, the in-process worker is signaled immediately after the durable JobLead transaction commits; clients do not need to invoke a separate worker command. `sourceReference` is restricted to a short opaque identifier and cannot be used to store source prose or email content.

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
      -> readyForMaterialization # resumable candidate from a disabled/older worker
      -> materialized
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

The check refreshes the session and fails unless the active method is `chatgpt`. Never copy `~/.codex/auth.json` into this project, SQLite, environment files, logs, Docker, or n8n. The worker links the existing `auth.json` into a temporary owner-only `CODEX_HOME`; it never copies credential contents. It refreshes and re-verifies `chatgpt` authentication inside every isolated broker immediately before a probe or assessment; no provider/model override is exposed. The Codex process starts through an `env -i` allowlist, loads no global agent configuration, uses `ApprovalMode.deny_all`, runs an unconditional `PreToolUse` denial hook, and receives explicit home/vault/auth filesystem denies plus disabled tool networking.

Assessment sends the bounded extracted proposal, versioned policy, supported archetypes, and bounded contents of `02-personal/career/strategy/career-advisor-snapshot.md` to the configured ChatGPT-backed Codex service. It does not send arbitrary vault files. Do not run the worker if that private candidate context should not be processed by the model provider.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PKM_API_HOST` | `127.0.0.1` | Must be localhost or a loopback IP |
| `PKM_API_PORT` | `8000` | HTTP port |
| `PKM_API_CONTROL_DB` | `.local/pkm-api.sqlite3` | SQLite workflow state |
| `PKM_API_VAULT_ROOT` | none | Enables controlled JobPosting reads and supplies worker assessment vocabularies/context |

New control-store directories and databases are restricted to the current user where supported. Local state is gitignored.

## Architecture

```text
FastAPI + Pydantic
  -> JobLead application service -> SQLite control store
  -> JobPosting query service    -> confined Markdown catalog

Lifespan-managed in-process worker
  -> startup isolation probe -> immediate wake or startup recovery -> fenced lease
  -> safe retrieval -> bounded extraction -> redirect reconciliation
  -> catalog deduplication -> ephemeral tool-denied Codex broker
  -> deterministic validation -> persisted compact candidate
  -> confined create-only Markdown materializer
```

Domain and application modules do not depend on FastAPI. Raw source bodies, full caller descriptions, and raw model output are not persisted.

## Verification

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run python -m compileall -q src
```

Unit tests use temporary databases and vault fixtures. They do not require network access, the live vault, PostgreSQL, n8n, or a real Codex login. The explicit isolation command below is a live integration check and does use the configured ChatGPT login:

```bash
PKM_API_VAULT_ROOT=/Users/taylor/src/my-life/my-vault \
  uv run pkm-api-worker --verify-isolation-only
```

Normal API startup automatically drains eligible work and immediately wakes the worker after submissions. The standalone command remains available for recovery or diagnostics; stop the API before using it so two local consumers do not compete:

```bash
PKM_API_VAULT_ROOT=/Users/taylor/src/my-life/my-vault \
PKM_API_CONTROL_DB=.local/pkm-api.sqlite3 \
  uv run pkm-api-worker --max-items 25
```

## Promotion gates

1. Add client authentication, scoped authorization, rate limiting, and audit retention.
2. Threat-model Tailscale/LAN exposure and configure the trusted TLS boundary.
3. Add duplicate/skipped/failed processing-log rows and separately reported index reconciliation.
4. Decide maintained repository and SDD ownership.
