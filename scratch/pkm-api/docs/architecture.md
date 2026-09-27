# Job Processing Architecture

## Boundaries

1. **HTTP delivery** validates and translates requests.
2. **Application services** own idempotency, lifecycle, query pagination, orchestration, and policy sequencing.
3. **Domain models** define JobLead, proposal, assessment, and outcome vocabulary.
4. **Infrastructure adapters** own SQLite, safe HTTPS retrieval, confined Markdown reads, and the ephemeral tool-denied Codex broker.

Dependencies point inward. FastAPI, SQLite, HTTP, and the filesystem are absent from the domain layer.

## Current runtime

The HTTP process exposes two independent capabilities:

```text
JobLead HTTP resources -> JobLeadService -> SQLite control store
JobPosting reads/stats -> JobPostingQueryService -> confined Markdown catalog
```

A lifespan-managed single-consumer worker composes the processing application core with the isolated Codex assessment adapter:

```text
claim fenced lease
  -> retrieve through validated public HTTPS destination
  -> extract bounded JobPosting proposal from schema.org or confined source markup
  -> reconcile final redirect identity and preserve source aliases
  -> compare exact identity/possible reposts against Markdown
  -> call AssessmentPort through an ephemeral tool-denied broker
  -> validate the untrusted result deterministically
  -> persist an evidence-minimized materialization candidate
  -> recheck identity and create confined Markdown records
```

The worker starts only after the control store is initialized and the isolation preflight succeeds. It immediately drains durable eligible work at startup, sleeps on an in-process wake event when idle, and is signaled after each committed submission or manual retry. A bounded poll also discovers delayed automatic retries. A processor or lease exception changes readiness to degraded, waits with bounded backoff, and retries instead of terminating the sole consumer. Shutdown signals cancellation through the processor to the active isolated Codex process and uses a bounded join. The API response remains asynchronous; SQLite and fenced lease expiry remain the recovery boundary if the process exits.

A normal local Codex thread remains prohibited because its read-only sandbox permits filesystem reads. The broker instead starts a fresh Codex app server through an inherited-environment-clearing `env -i` boundary, gives it an isolated temporary home and empty workspace, links the existing ChatGPT authentication file without copying its contents, and loads no global user configuration. On Linux only, it copies the trusted Codex executable (never credentials or configuration) into that owner-only ephemeral workspace because the sandbox re-executes Codex after denying access to the home-installed binary. Nested deny mount paths are collapsed to an ancestor deny, while the deterministic probe still verifies that every protected path is unreadable. Tool networking and home/vault/auth filesystem paths are denied. Plugins, apps, memory, multi-agent, skill discovery, browsing, computer use, and MCP servers are disabled.

An unconditional trusted `PreToolUse` hook denies every tool call. `ApprovalMode.deny_all` supplies a second control, and posting content arrives as `ExternalMessage` rather than trusted instructions. If the hook observes any tool attempt, that lead fails closed with `assessmentToolAttempt`; its output is not accepted. Every worker launch first runs a live adversarial probe that must exercise the denial hook and must not disclose random protected home content. A fixed, non-model command also runs through the same Codex permission profile and must prove that home, vault context, source/global Codex configuration, source authentication, and the broker-linked authentication path cannot be read while the empty workspace remains readable. This behavior gate catches unsupported or ignored permission settings. The worker cannot claim a lead if either probe fails.

## Queue and lease model

SQLite is a control store, not a note store.

### Tables

- `job_leads`: current resource projection.
- `job_lead_source_aliases`: canonical input and final-redirect identities mapped to one lead.
- `idempotency_records`: operation/key/request-digest mapping with expiry.
- `job_lead_attempts`: bounded attempt metadata, worker ID, lease token, outcome, and safe error code.
- `job_lead_events`: content-minimized state-transition audit.

Initialization reads `PRAGMA user_version`, applies migrations transactionally, and rejects a schema newer than the running build. It never downgrades a future database.

Claims use `BEGIN IMMEDIATE` and select the oldest eligible lead. A claim increments the resource version and total attempt count, creates a random token, and records bounded attempt/event metadata. Stage transitions, completion, failure, and redirect reconciliation require an unexpired matching token. Reclaimed expired attempts are closed as `leaseExpired`; stale workers cannot mutate current state. An expired lease at the per-generation attempt cap is failed atomically rather than reclaimed again.

Retryable failures use deterministic exponential backoff. Permanent or exhausted failures become `failed`. Manual retry requires the current ETag and its own idempotency key and starts a new retry generation with a fresh automatic-attempt budget while preserving total attempt history.

## Redirect identity

Input canonicalization prevents obvious duplicates before retrieval. Redirects can reveal stronger identity later, so extraction canonicalizes the final source URL and reconciles it in the same SQLite transaction that checks the lease:

- a new final identity becomes another alias for the current lead;
- the current projection adopts the stronger canonical URL/source key;
- an alias already owned by another lead terminates the current lead as `duplicateJobLead` before assessment;
- future submissions reuse the terminal lead already mapped to that exact input alias, while the resolved final alias continues to identify the original lead.

The write boundary must still recheck authoritative posting identity when materialization is enabled.

## Source retrieval and extraction

`SafeHttpJobSourceRetriever` requires HTTPS/443, rejects URL credentials and local names, resolves and rejects any non-global answer, connects to a validated IP while retaining TLS SNI/Host, revalidates up to three redirects, sends no caller credentials, accepts a small content-type allowlist, and enforces one 15-second end-to-end deadline across DNS plus every redirect alongside a 2 MiB response bound. It rejects malformed or negative declared lengths.

The extractor prefers schema.org `JobPosting` JSON-LD and emits bounded evidence. LinkedIn job-view pages may use a source-specific fallback that captures only the claimed posting's bounded public title, company, location, and description classes after host, path, and job-ID checks. It does not persist descriptions or invent absent facts. Unsupported pages terminate explicitly rather than falling back to arbitrary scraping.

## Controlled Markdown reads

`MarkdownJobPostingCatalog`:

- confines a configured company/jobs root beneath the vault;
- skips symlinks and resolved paths outside that root;
- bounds each frontmatter read and uses safe YAML loading;
- detects exact posting/external/source identity and conservative possible reposts;
- returns only an allowlisted summary for `/v1/job-postings`;
- derives aggregate counts for `/v1/job-stats`;
- never returns note bodies or edits files.

Markdown remains authoritative. The query API deliberately excludes archived notes.

## Assessment contract and validation

The application owns an `AssessmentPort`, a versioned policy, and deterministic validation. The isolated adapter receives only bounded proposal evidence, bounded candidate context, the policy, and supported archetypes, and must return the versioned assessment schema. Its output is untrusted.

Validation enforces schema versions, bounded identity/evidence fields, HTTPS source URL, canonical skills, supported archetype, interest range and policy caps, false network evidence for URL-only intake, bounded summary/bullets, and complete controlled salary ranges.

Read-only sandboxing alone is insufficient. The adapter combines environment stripping, temporary configuration, explicit permission denies, disabled features/network, unconditional tool denial, ephemeral threads, post-turn tool-attempt rejection, and a live startup probe. Authentication is available to the Codex app server for model requests but is denied to model-invoked tools. Each fresh broker refreshes and verifies its own account as `chatgpt` before assessment; isolated configuration exposes no alternate provider/model route. Broker prompts, raw model responses, and temporary broker state are not retained locally. The deterministic validator converts accepted fields into a bounded assessment projection used by the materializer.

## Privacy model

Persisted source data is limited to canonical URL/key, discovery channel, and a short opaque `sourceReference` grammar. Raw descriptions and unknown body properties are rejected. Processing persists lifecycle metadata, safe errors, compact outcomes, content-minimized events, and—only while materialization is pending—the bounded validated proposal and assessment projection required to render the note.

Never persist or log source bodies, extracted evidence, raw email/MIME, model prompts or raw responses, Codex credentials/paths, lease tokens through HTTP, or candidate context. Validated assessment summary/strength/gap fields are deliberately rendered into the private JobPosting and are not equivalent to retaining the raw provider response. Worker output is limited to resource IDs, lifecycle statuses, aggregate counts, and safe preflight state. Unexpected HTTP failures return sanitized Problem Details; SQLite lock contention returns retryable `503` with `Retry-After`.

## Materialization boundary

After deterministic validation, SQLite temporarily stores a versioned compact candidate containing only renderable proposal and validated assessment fields. It omits extracted evidence, source bodies, the raw model response, candidate context, and credentials, and it is cleared when the lead reaches a terminal outcome. A retryable write failure therefore resumes at `materializing` without repeating retrieval or model assessment. Older `readyForMaterialization` rows without a candidate remain untouched because they cannot be rendered safely.

`VaultJobPostingMaterializer` holds a per-vault process lock, rechecks exact identity and possible reposts, rejects symlinked destinations, reuses one compatible Company note, creates minimal missing Company records, and publishes JobPosting files with create-only atomic links. Existing exact postings are treated as resumable success so a failure after the authoritative posting write can repair the archetype-review row and processing-log row idempotently.

The JobPosting create is authoritative. The archetype-review queue and the `added` processing-log row are idempotent derived handoffs repaired on materialization retry. PostgreSQL/index refresh remains separate and is never invoked from the HTTP request path. Duplicate, skipped, and failed processing-log rows remain a follow-up.
