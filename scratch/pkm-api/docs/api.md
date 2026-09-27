# Job API Contract

The generated OpenAPI 3.1 document at `/openapi.json` is authoritative for field schemas. This guide explains semantics that clients must preserve.

## Conventions

- Base compatibility boundary: `/v1`.
- Media type: `application/json` for successful resources.
- Errors: `application/problem+json` using RFC 9457 fields plus stable `code`.
- Property names: camelCase.
- Timestamps: RFC 3339 UTC.
- Resource versions: strong `ETag` headers.
- Retryable mutations: required `Idempotency-Key`.
- Collection order: `(createdAt DESC, id DESC)`.
- Collection pagination: opaque cursor, never offset.

## Read JobPostings and current stats

```http
GET /v1/job-postings?status=captured&limit=25
GET /v1/job-stats
```

`/v1/job-postings` exposes an allowlisted summary of non-archived authoritative Markdown records. `status` is optional/repeatable, `limit` is 1–100, and `cursor` is opaque. Order is `(capturedDate DESC, path DESC)`. Responses include identity, company, role, lifecycle, interest, source URL, captured date, archetype, work type, seniority, and vault-relative path—never note bodies.

`/v1/job-stats` returns total records plus counts by lifecycle status, role archetype, work type, and seniority. Both routes are read-only. If the vault catalog is not configured/readable they return `503 jobCatalogUnavailable`.

## Submit a JobLead

```http
POST /v1/job-leads
Content-Type: application/json
Idempotency-Key: n8n:run-123:linkedin:4470613618

{
  "sourceUrl": "https://www.linkedin.com/jobs/view/4470613618/",
  "discoveredBy": "n8n",
  "sourceReference": "apify:run-123:4470613618"
}
```

The payload accepts exactly one URL. Arrays, raw descriptions, normalized posting fields, and unknown properties are rejected.

### URL rules

- HTTPS is mandatory.
- Embedded credentials are rejected.
- LinkedIn slug and tracking variants normalize to `https://www.linkedin.com/jobs/view/<id>/`.
- Known tracking query parameters are removed from generic URLs before identity hashing.
- Fragments are removed.
- The canonical source identity deduplicates overlapping callers independently of idempotency keys.

### Idempotency semantics

An idempotency record is scoped to the operation and retained for seven days.

| Situation | Result |
| --- | --- |
| New key, new canonical source | `201 Created` |
| New key, existing canonical source | `200 OK`, existing resource |
| Existing key, same semantic request | `200 OK`, `Idempotency-Replayed: true` |
| Existing key, changed semantic request | `409 idempotencyKeyConflict` |

The request digest uses canonical URL, `discoveredBy`, and `sourceReference`; JSON formatting and object-key order do not affect it.

Successful responses include:

```http
Location: /v1/job-leads/<uuid>
ETag: "job-lead:<uuid>:v1"
Idempotency-Replayed: false
```

`sourceReference` is an opaque identifier of at most 200 characters matching `[A-Za-z0-9][A-Za-z0-9._:/-]*`. Newlines, whitespace, prose, email bodies, descriptions, credentials, and arbitrary tracking payloads are rejected.

## Read a JobLead

```http
GET /v1/job-leads/<uuid>
If-None-Match: "job-lead:<uuid>:v3"
```

A current conditional request returns `304 Not Modified` with no body. Every lifecycle mutation increments `version` and changes the ETag.

Representative response:

```json
{
  "id": "8fa85f64-5717-4562-b3fc-2c963f66afa6",
  "version": 3,
  "sourceUrl": "https://www.linkedin.com/jobs/view/4470613618/",
  "source": "linkedin",
  "postingKey": "linkedin:4470613618",
  "discoveredBy": "n8n",
  "sourceReference": "apify:run-123:4470613618",
  "status": "processing",
  "stage": "assessing",
  "attemptCount": 1,
  "retryCount": 0,
  "maxAttempts": 3,
  "nextAttemptAt": null,
  "lastError": null,
  "outcome": null,
  "createdAt": "2026-09-23T12:00:00Z",
  "updatedAt": "2026-09-23T12:01:00Z",
  "expiresAt": "2026-10-23T12:00:00Z",
  "links": {
    "self": "/v1/job-leads/8fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
}
```

The response never includes fetched source bodies, extracted descriptions, model prompts, raw model output, lease owners, or lease tokens.

## List JobLeads

```http
GET /v1/job-leads?status=queued&status=failed&limit=25
```

- `status` is optional and repeatable.
- `limit` ranges from 1 through 100; default 25.
- `cursor` is the opaque value returned as `nextCursor`.
- Items are newest first with UUID as the deterministic tie-breaker.

Clients should follow `links.next` unchanged rather than decoding or constructing cursors.

## Retry a failed JobLead

```http
POST /v1/job-leads/<uuid>/retry
If-Match: "job-lead:<uuid>:v7"
Idempotency-Key: n8n:retry:run-456:<uuid>
```

The operation has no request body.

- Missing `If-Match` returns `428 preconditionRequired`.
- A malformed, cross-resource, or stale ETag returns `412 preconditionFailed`.
- A current non-failed resource returns `409 jobLeadNotRetryable`.
- Success clears the safe error, increments `retryCount`, and returns the resource as `queued`.
- Replaying the same retry key is safe even though the original ETag is now stale.

## Lifecycle statuses

| Status | Terminal for current attempt? | Meaning |
| --- | --- | --- |
| `queued` | No | Eligible at `nextAttemptAt` |
| `processing` | No | Held by an internal fenced lease |
| `readyForMaterialization` | Yes | Validated candidate retained by an older or deliberately disabled materializer; candidates with persisted render data are resumable |
| `alreadyTracked` | Yes | Exact authoritative identity exists |
| `possibleRepost` | Yes | Company/title match lacks identity proof |
| `skipped` | Yes | Unsupported or intentionally out of scope |
| `materialized` | Yes | Authoritative Company/JobPosting Markdown exists; `outcome.postingPath` identifies the posting |
| `failed` | Yes | Permanent failure or retry budget exhausted |

## Automatic worker semantics

When the API has a configured vault, startup verifies refreshable ChatGPT authentication, passes the live adversarial tool/filesystem-isolation check, and starts one in-process queue consumer. Startup also drains eligible durable work left by an earlier process. A successful `POST /v1/job-leads` or manual retry signals that consumer immediately after the SQLite transaction commits; the HTTP response remains asynchronous and does not wait for retrieval or assessment.

The consumer claims eligible leads through fenced SQLite leases and polls for delayed automatic retries while idle. Transient processor/lease exceptions trigger bounded backoff and another drain attempt; `/readyz` returns `503` while the enabled consumer is degraded, failed, or stopping. Shutdown cancels an active isolated assessor and preserves recoverability through the fenced claim. After validation, the worker persists an evidence-minimized candidate, rechecks identity, and creates or reconciles confined Company/JobPosting Markdown. A write retry resumes from that candidate without another source request or model assessment. `pkm-api-worker` remains a recovery/diagnostic command and should run only while the API is stopped.

Assessment infrastructure failures use safe internal codes such as `assessmentUnavailable`. Invalid structured output uses `invalidAssessment`. Any attempted model tool call uses non-retryable `assessmentToolAttempt`. These codes may appear in a JobLead's `lastError`, but prompts, source bodies, extracted evidence, candidate context, raw model responses, tool payloads, credentials, and exception text never do. A bounded validated assessment projection is temporarily retained for write recovery and rendered into the private JobPosting.

## Error shape

```json
{
  "type": "urn:pkm-api:problem:idempotencyKeyConflict",
  "title": "Idempotency key conflict",
  "status": 409,
  "detail": "The Idempotency-Key was already used with different input.",
  "instance": "/v1/job-leads",
  "code": "idempotencyKeyConflict"
}
```

Validation responses add an `errors` array with field pointers. Provider exceptions and raw external content are not returned.

| HTTP | Stable code | Typical cause |
| --- | --- | --- |
| 404 | `jobLeadNotFound` | Unknown UUID |
| 409 | `idempotencyKeyConflict` | Key reused with different input |
| 409 | `jobLeadNotRetryable` | Retry requested outside `failed` |
| 412 | `preconditionFailed` | Stale or mismatched ETag |
| 422 | `validationFailed` | Invalid body, header, enum, UUID, or limit |
| 422 | `invalidCursor` | Malformed pagination cursor |
| 422 | `invalidSourceUrl` | Application-layer URL rejection |
| 428 | `preconditionRequired` | Missing `If-Match` |
| 500 | `internalError` | Sanitized unexpected failure |
| 503 | `controlStoreBusy` | Transient SQLite contention; includes `Retry-After` |
| 503 | `jobCatalogUnavailable` | Vault catalog absent or unreadable |

The OpenAPI response content for all documented failures is exclusively `application/problem+json`.

## Compatibility

Breaking request, response, lifecycle, or semantic changes require a new API version. Additive optional fields and new Problem Details codes may be introduced within `/v1`. Clients must ignore response fields they do not understand but should treat unknown lifecycle statuses conservatively.
