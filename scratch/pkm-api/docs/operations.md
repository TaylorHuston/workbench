# Local Operations

## Prerequisites

- A host user with access to the private vault (the first live canary ran on macOS; GB10 Linux promotion is not yet verified);
- Python 3.12 or later;
- `uv` and an existing, host-local ChatGPT-backed Codex login.

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

## GB10 promotion hold (2026-09-27)

The GB10 checkout and vault mirror are present. The Python environment is **outside** Syncthing at `~/.local/share/pkm-api/venv` (`UV_PROJECT_ENVIRONMENT`); Codex authentication checked as `chatgpt`. Ubuntu's `unprivileged_userns` restriction originally blocked bubblewrap from creating an isolated loopback interface. Taylor installed the executable-specific AppArmor exception below without disabling the global restriction. On Linux, Codex's nested deny mounts and home-installed binary then blocked sandbox setup; the broker now collapses only redundant descendant denies and copies the trusted executable into its owner-only ephemeral workspace. **98 tests, Ruff, formatting, and compilation pass on GB10; the real filesystem probe denies all five protected paths.** The separate *live adversarial model probe* still fails closed: the turn completes without attempting a tool (`blockedToolAttempts=0`), so the `PreToolUse` hook cannot be confirmed. Read-only GB10 app-server diagnostics found the effective `assessment` permission profile, `readOnly` sandbox with network disabled, and one enabled `PreToolUse` hook reported as untrusted by `hooks/list`; the thread passes `bypass_hook_trust=true`. A temporary trust decision for the empty broker workspace and a one-off run with the host CLI 0.157.1 (instead of bundled 0.156.0) each still produced zero hook attempts. Neither experiment changed global Codex configuration or the pinned service binary. Terminal Codex's `my-life` trust decision does not transfer to the ephemeral broker. The API remains stopped, with no Tailscale route or n8n submission. Do not remove the zero-attempt guard or infer that the worker is ready from the deterministic probe.

Do not start the vault-backed API, install an auto-start service, configure Tailscale Serve for it, or enable n8n submission until the Linux tests and live isolation preflight **both** pass. The user-approved `deploy/gb10-bwrap.apparmor` was syntax-checked on GB10 and installed by Taylor at `/etc/apparmor.d/pkm-api-bwrap`; its root-owned installed bytes match the staged SHA-256 below. It leaves Ubuntu's global restriction enabled. AppArmor attaches by executable path: the exception is **not PKM-specific** and can affect other unconfined `/usr/bin/bwrap` executions; already-confined callers depend on their own exec-transition rules. No sudo credentials are available to the agent. **The following is the already-performed install/recovery procedure, not a request to reinstall it now.** If reinstalling after a rollback, Taylor must run this conditional chain directly on GB10, entering the password there, never in chat. The SHA-256 pins the staged bytes to the reviewed `deploy/gb10-bwrap.apparmor`. Stop and investigate any mismatch, failed step, or unexpected profile status:

```bash
staged=/home/taylor/.local/share/pkm-api/gb10-bwrap.apparmor
installed=/etc/apparmor.d/pkm-api-bwrap
printf '%s  %s\n' \
  '63ad72e0a17881ce7b7333856e3a8dcae3da7796bf4353c224dba1941ac61e96' \
  "$staged" | sha256sum --check --status && \
  sudo install -o root -g root -m 0644 "$staged" "$installed" && \
  sudo cmp -s "$staged" "$installed" && \
  sudo apparmor_parser -r "$installed" && \
  sudo grep -E '^pkm-api-bwrap \(' /sys/kernel/security/apparmor/profiles
```

If a post-copy step fails, the file in `/etc/apparmor.d/` may still load on reboot; **do not assume a failed install is rolled back**. To remove the exception after installation (or after a partial install), run the following chain. If unloading fails, preserve the file and investigate; if removal fails, the file can reload on reboot. Confirm the profile is absent before reporting rollback complete:

```bash
installed=/etc/apparmor.d/pkm-api-bwrap
sudo apparmor_parser -R "$installed" && \
  sudo rm "$installed" && \
  ! sudo grep -q -E '^pkm-api-bwrap \(' /sys/kernel/security/apparmor/profiles && \
  echo 'pkm-api-bwrap unloaded and removed'
```

A dry-run syntax check or loaded profile alone is not proof of filesystem or network confinement. The deterministic probe now passes, but the live hook test must record at least one denied model tool attempt before any vault-backed API launch. Keep the control DB outside Syncthing, verify a single automatic writer and a vault backup, and test the loopback service before adding tailnet access.

## n8n integration

The discovery workflow is manual/inactive and its JobLead submission node is disabled. Its `host.docker.internal` URL is a historical local-bridge placeholder, **not** a working path from GB10 n8n to the Mac-hosted API. Do not enable it until the GB10 service is healthy and the node has been updated and tested against the actual destination. Send one `sourceUrl`, `discoveredBy`, optional opaque `sourceReference`, and deterministic `Idempotency-Key` per item; never send arrays, descriptions, email bodies, or Codex credentials.

For this personal use, the accepted future boundary is a loopback-only API behind tailnet-only Tailscale Serve HTTPS with access limited to Taylor's trusted devices/account and Funnel disabled. An additional shared write token is optional. This is a future promotion target, not an authorization to expose the current, unverified Linux service.

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

The worker found no usable schema.org JobPosting data or supported source-specific public markup. Add a tested, host-confined adapter instead of storing arbitrary page text.

### `possibleRepost`

Company/role matches lacked exact identity. No write occurs; identity needs a common ATS ID or verified redirect.

## Exposure exclusions

Do not bind the API directly to a non-loopback interface, enable Tailscale Funnel, or publish a Docker/LAN port. Confined automatic Markdown writes require a backup and the unchanged canonical job-market layout. The GB10 Linux sandbox blocker above must be resolved and the live isolation check must pass before a tailnet-only Serve proxy is considered. Re-run that check after every Codex SDK/runtime or broker-policy change. Broader auth, scopes, and operational controls are deferred unless the personal-tailnet trust boundary expands.
