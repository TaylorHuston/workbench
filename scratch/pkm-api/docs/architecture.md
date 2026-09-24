# Job Processing Architecture

## Boundaries

1. **HTTP delivery** validates and translates requests.
2. **Application services** own idempotency, lifecycle, query pagination, orchestration, and policy sequencing.
3. **Domain models** define JobLead, proposal, assessment, and outcome vocabulary.
4. **Infrastructure adapters** own SQLite, safe HTTPS retrieval, and confined Markdown reads.

Dependencies point inward. FastAPI, SQLite, HTTP, and the filesystem are absent from the domain layer.

## Current runtime

The HTTP process exposes two independent capabilities:

```text
JobLead HTTP resources -> JobLeadService -> SQLite control store
JobPosting reads/stats -> JobPostingQueryService -> confined Markdown catalog
```

The processing application core is implemented and tested with in-memory/fake assessment adapters:

```text
claim fenced lease
  -> retrieve through validated public HTTPS destination
  -> extract bounded schema.org JobPosting proposal
  -> reconcile final redirect identity and preserve source aliases
  -> compare exact identity/possible reposts against Markdown
  -> call AssessmentPort
  -> validate the untrusted result deterministically
  -> invoke disabled materializer
```

It is **not operationally wired**. The obvious local Codex SDK adapter was removed because its read-only sandbox still permits filesystem reads. Untrusted posting text could therefore induce reads from the vault or user home. A future assessment broker must be tool-free or OS-isolated and must pass an adversarial filesystem-denial test.

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

`SafeHttpJobSourceRetriever` requires HTTPS/443, rejects URL credentials and local names, resolves and rejects any non-global answer, connects to a validated IP while retaining TLS SNI/Host, revalidates up to three redirects, sends no caller credentials, accepts a small content-type allowlist, and enforces a 15-second/2 MiB bound. It rejects malformed or negative declared lengths.

The extractor consumes schema.org `JobPosting` JSON-LD and emits bounded evidence. It does not persist descriptions or invent absent facts. Unsupported pages terminate explicitly rather than falling back to arbitrary scraping.

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

The application owns an `AssessmentPort`, a versioned policy, and deterministic validation. Any future adapter receives only bounded proposal evidence and must return the versioned assessment schema. Its output is untrusted.

Validation enforces schema versions, bounded identity/evidence fields, HTTPS source URL, canonical skills, supported archetype, interest range and policy caps, false network evidence for URL-only intake, bounded summary/bullets, and complete controlled salary ranges.

No adapter may be enabled merely because it is read-only. It must also prove that untrusted text cannot invoke tools or read the vault, home directory, credentials, or global agent configuration. Authentication and filesystem authority must not be co-located in a tool-capable model process.

## Privacy model

Persisted source data is limited to canonical URL/key, discovery channel, and a short opaque `sourceReference` grammar. Raw descriptions and unknown body properties are rejected. Processing persists only lifecycle metadata, safe errors, compact outcomes, and content-minimized events.

Never persist or log source bodies, raw email/MIME, model prompts/responses, Codex credentials/paths, lease tokens through HTTP, or candidate context. Unexpected HTTP failures return sanitized Problem Details; SQLite lock contention returns retryable `503` with `Retry-After`.

## Materialization boundary

`DisabledJobPostingMaterializer` is the only application-core implementation. A write adapter remains blocked until a disposable-vault rehearsal proves path/symlink confinement, minimal Company reuse, canonical rendering, identity recheck, atomic create-only writes, queue idempotency, separate index outcomes, and recovery from partial failures.

Markdown success will be authoritative; index reconciliation must remain a separately reported derived outcome.
