# F036 - Practice Attempts Persistence

**Status:** APPROVED_COMPLETE
**Plan date:** 2026-10-18
**Original planning result:** PLAN READY FOR OWNER REVIEW; superseded by the implementation approval below.
**Formal roadmap dependency:** F031. Reuse prerequisites: approved F021 and F030-F035 contracts.

**Implementation authorization (2026-10-18):** Owner approved P1-P5 and the exact
27-path implementation/offline scope. Reconciliation PASS. P4 narrows the earlier
provisioning proposal: index creation is authorized only in separately approved
disposable integration tests, never persistent development/Atlas databases. P5
authorizes private LOCAL storage without promising a retention duration or adding
deletion interfaces. Historical planning language below is retained. Offline
implementation is authorized; MongoDB/browser execution remains separately gated.
F001-F035 remain APPROVED_COMPLETE and F037 NOT_STARTED.

**Current implementation result:** OFFLINE IMPLEMENTATION PASS (Section 10),
followed by the corrected guarded MongoDB integration 10/10 PASS (Section 12).
Preserve the initial 7 PASS / 3 FAIL integration and confirmed timeout cause
(Sections 11-12).
**Current final review:** FINAL REVIEW PASS WITH F036 BROWSER EXCEPTION (Section 13).
The owner explicitly accepts the feature-specific browser deferral for LOCAL
DEVELOPMENT ONLY: eight F036 mounted scenarios and expected complete regression
133, including those eight, remain NOT_RUN. No browser PASS or production readiness
is implied. Explicit owner completion approval for LOCAL DEVELOPMENT ONLY is
recorded in Section 14. The exception does not transfer to F037.

**Historical original planning authorization:** The owner authorized creation of
this document only, using the proposed exact
27-path implementation boundary subject to inspection. No roadmap/status,
application, test, configuration or other documentation change is authorized in
this gate. F001-F035 remain APPROVED_COMPLETE for local development; F037 is not
authorized. All implementation details and decisions below are proposals requiring
the next explicit owner approval. No runtime prerequisite or test result is implied.

## 1. Sources, existing behavior and sequencing

Reviewed AGENTS.md; [roadmap](../DEVELOPMENT_ROADMAP.md) Phase I;
[PRD](../PRD.md) sections 15, 23-24 and practice acceptance;
[System Architecture](../SYSTEM_ARCHITECTURE.md) modular-monolith/persistence boundaries;
[Database Design](../DATABASE_DESIGN.md) practiceAttempts, indexes, transactions and
practice algorithm; [API Design](../API_DESIGN.md) conventions and F030-F035 additions;
completed F030-F035 feature contracts; current Practice API/UI/tests; database,
User transaction/auth and restricted Markdown reuse boundaries. The existing
Student Concept-learning Stitch screenshot/code.html and current native Practice
page remain design references. Do not copy generated scripts, add quiz scoring/XP
or redesign the page.

The roadmap names **Practice Attempts Persistence**, depends on F031, and leaves
F036 NOT_STARTED. It does not specify a new submission route or a grading engine.
F037 owns Student Concept Progress; subsequent completion/mastery features are
outside F036. The architecture's representative /practice/:questionId/attempt
example is not an implemented endpoint contract to introduce automatically.

F035 currently registers only LOCAL POST
`/api/v1/practice-questions/:questionId/unlock`, authenticates a current eligible
STUDENT, validates a nonblank answer and published content, then returns five
answer-bearing fields without storing an attempt. Its GET remains answer-free.
Its own approved contract requires F036 to replace transient disclosure with
durable owned attempts and the final prerequisite before deployment. Previously
revealed answers or memory-only drafts cannot be reconstructed as historical
attempts or used as proof that one was persisted.

The proposed increment replaces that transient POST behavior, preserving the
LOCAL-only restriction. Every successful disclosure must follow a confirmed
durable qualifying attempt, including replays. No persistence error, unsupported
database topology, missing index or uncertain commit can fall back to F035.
This closes the persistence prerequisite for the approved ungraded local workflow;
it does not implement the full PRD's scoring, history/progress or production release.

Two contract refinements require explicit approval: Database Design labels score
required while supporting ungraded SUBMITTED, and its full algorithm also updates
studentProgress. Propose score=null/result=SUBMITTED for all four question types
and no F037 summary write. The final algorithm and first-score preservation remain
binding for future graded/progress increments; do not manufacture zero/PASS scores.

## 2. Smallest complete increment and exclusions

Student: submit any of OUTPUT, DESCRIPTIVE, SCENARIO or CODING from the existing
Practice page; save one owned immutable attempt; reveal an official answer only
after commit verification; explicitly retry uncertain submissions without silently
creating a second attempt. A deliberate subsequent submission may create a new
numbered attempt. Show a saved/ungraded receipt without an attempt-history page.

Admin: no new authoring, grading, attempt browsing, editing, deletion or preview
behavior. No client-supplied userId, result, score, sequence, server revision,
timestamp or receipt can authorize disclosure. FREE/PREMIUM eligibility is unchanged.

Reuse existing GET/default OUTPUT, pagination/order, four type selectors, prompt,
inert starterCode, textarea, draft bounds, confirmed Clear all, Markdown, auth
read guard, request cancellation, security headers, error envelopes and rate limits.
Maintain route -> middleware -> controller -> service -> repository -> database.

Exclude execution, evaluation/rubrics, grading/scoring, XP, completion, F037 progress,
analytics/audit expansion, public/Admin attempt APIs, history/export, automatic
erasure, new dependencies/environment variables, automatic index creation, database
reconfiguration, cloud/VM/hosted execution and production deployment. No new
PracticeQuestion field/index or shared-auth/publication strategy is proposed.

## 3. Proposed durable model, revisions and indexes

### 3.1 Exact record

Collection: `practiceAttempts`, using the existing isolated mongoose instance.
Strict schema with autoCreate=false, autoIndex=false and bufferCommands=false.
Reject unknown fields, unsupported types, coercion, invalid dates and accessors
using the established strict model-input convention. All business fields are set
once at insertion. No automatic updatedAt field or mutable lifecycle is needed.

| Stored field | Proposed contract |
| --- | --- |
| _id | Server-generated ObjectId; immutable attempt identity |
| userId | Required ObjectId from authenticated subject/current eligible account, never request input |
| questionId / conceptId | Required ObjectIds, validated against fresh published ancestry and consistent references |
| type | Required server-derived OUTPUT, DESCRIPTIVE, SCENARIO or CODING |
| questionRevision | Required lowercase 64-hex public-content digest defined below; verified against displayed question input |
| contentFingerprint | Required lowercase 64-hex private authored-content/reference digest; never returned/logged |
| attemptNumber | Required positive safe integer, server-assigned within userId+questionId, starting at 1 |
| studentAnswer | Required verbatim nonblank string, 1-10,000 UTF-16 code units; preserve indentation, whitespace and newlines |
| submittedAt | Required valid UTC instant generated by the server for the logical insertion; never trusted from a client |
| result | Required literal SUBMITTED; no PASS/FAIL in this increment |
| score | Required literal null; no fabricated numeric score |
| idempotencyKeyHash | Required lowercase 64-hex SHA-256 of the canonical random key; internal only |
| requestFingerprint | Required lowercase 64-hex digest binding the exact logical submission; internal only |
| schemaVersion | Required literal 1 |

No arbitrary metadata/Mixed/Map, official answer/explanation snapshot, token, IP,
email, device identity, grading data or raw idempotency key is stored. Digests are
binding/comparison data, not authorization or anonymization of the private answer.
Do not expose even low-entropy answer fingerprints to a student.

The requested SUBMITTED status uses Database Design's canonical `result` field;
do not introduce a second status field with conflicting lifecycle semantics.
Model validation and insertion-only repository operations must reject subsequent
document saves, update/replace/upsert/delete/bulk mutation paths through the
supported application model boundary. Reads are explicitly projected. No attempt
update/delete route is introduced. Test the mutation guards rather than relying
on the word immutable or only on immutable:true. Privileged raw MongoDB access
can bypass application guards; no claim of database-level WORM or new database
roles is made. Any future correction/evaluation must preserve this record and
receive its own append-only policy; do not overwrite null score later by default.

### 3.2 Revision and request identity, proposed P3 policy

Avoid adding an eighth GET field, new GET metadata or a PracticeQuestion version
field. Compute a public content-addressed revision from UTF-8 JSON serialization
of this exact ordered array after existing safe DTO normalization:

    ["F036-public-v1", id, conceptId, type, difficulty, prompt, starterCode, language]

Use SHA-256 lowercase hex. Optional starterCode/language use existing DTO null
normalization. No Unicode normalization, trimming, property-order dependence or
locale-sensitive serialization. The browser uses existing Web Crypto, the API
uses existing node:crypto; matching golden vectors must prove the same bytes,
including non-ASCII/unpaired-surrogate cases. This digest contains no correct
answer and is not a secret, credential, signature or proof of ownership.

The POST supplies this `questionRevision`. It binds an answer to what was shown
without changing GET's exact seven-field DTO. The server recomputes it from its
qualified current read. Mismatch is 409 PRACTICE_QUESTION_CHANGED, no attempt
insertion by this request and no official answer.

For private binding, compute SHA-256 over the exact ordered array:

    ["F036-content-v1", questionRevision, topicId, moduleId, learningPathId,
     technologyId, schemaVersion, answer, explanation]

IDs are normalized lowercase hex; answer/explanation are validated with the F035
authored DTO rules and absent explanation becomes null. Derive references from
the same qualified question/Concept ancestry read. The internal projection may
carry these extra fields but they never enter an outward DTO. This detects
answer/explanation-only
changes even when the displayed revision is unchanged. No unvalidated answer is
cached/stored for replay. Published ancestry is checked separately every time.

Request fingerprint: SHA-256 of the ordered array

    ["F036-request-v1", userId, questionId, conceptId, questionRevision, studentAnswer]

No normalization of studentAnswer beyond validating its nonblank/length rules.
Idempotency hash is scoped by userId in its unique index, not by question alone.
Compare stored request fields as well as the digest; a digest/identity disagreement
is a fail-closed integrity error, never permission to reveal.

This is content identity, not a monotonic editorial revision history: content
changed A -> B -> identical A has the same digest. Neither updatedAt nor __v is
promised as a version when raw writers may bypass them. A strictly monotonic
revision or publisher/submission locking would require a separately approved
Question/publication model/workflow change outside this inventory; stop if required.

### 3.3 Indexes and provisioning prerequisites

| Exact keys | Options / purpose |
| --- | --- |
| userId:1, questionId:1, attemptNumber:1 | unique, named uq_practice_attempt_sequence; atomic sequence collision protection |
| userId:1, idempotencyKeyHash:1 | unique, named uq_practice_attempt_idempotency; one logical key across the account's questions |
| userId:1, conceptId:1, submittedAt:-1 | standard, named ix_practice_attempt_owner_concept_time; existing design's history access pattern |
| conceptId:1, submittedAt:-1 | standard, named ix_practice_attempt_concept_time; preserve approved design |

The built-in _id index remains. Unique indexes must be full, non-sparse,
non-partial, with simple comparison semantics; no TTL. Validate key ordering,
uniqueness and relevant options against actual index metadata before accepting
submissions. Do not treat schema.index() declarations as indexes already installed.
Within the small LOCAL workload, perform a bounded readiness inspection per POST
instead of an unapproved stale global readiness cache. Missing/mismatched indexes
return sanitized 503 DEPENDENCY_UNAVAILABLE before writes or answer disclosure.

P4 recommendation: declare indexes now; create collection/indexes only during a
separately approved, ownership-verified operation against a specifically approved
local application database. Do not select demo/production/Atlas implicitly and do
not build or repair indexes during an HTTP request/startup. Disposable integration
may create them only inside its independently verified fresh test DB. Existing
data requires duplicate inspection and separate migration approval; never drop
data/indexes automatically. A new permanent provisioner script is not in scope.

## 4. Persistence, concurrency and disclosure algorithm

### 4.1 Preconditions and composition

Keep the current server-side APP_ENV=LOCAL registration guard. Reuse signed bearer
auth, fresh account eligibility and all five published levels: Concept, Topic,
Module, Learning Path and Technology, including each carried reference. Retain
PUBLISHED/schemaVersion-1 question/type and Concept/Topic/Technology consistency.
No new provenance/author-policy shortcut, public unlock or receipt-only endpoint.

Use the new attempt repository for the durable workflow. Existing practice.repository
provides session-aware qualified content reads/explicit safe DTO construction and
unchanged GET behavior; service orchestrates eligibility and calls persistence.
Remove any reachable transient-only service unlock path when migrating. Reuse
publishedConceptStages; do not copy a second conflicting publication policy.
Pass ClientSession explicitly to every operation intended to share a transaction.
No raw document or answer-bearing intermediate leaves the service response boundary.

Transactions need an existing compatible writable replica-set PRIMARY (or already
approved compatible sharded environment), supported sessions/transactions and
majority commit capability. No standalone fallback. Protected port-27017 topology
has NOT been inspected for this feature and must not be assumed suitable or
reconfigured. The disposable f021-test replica is separately gated; its historical
success does not provision the user's persistent application database.

### 4.2 Proposed operation order

1. Validate environment, authentication, current eligible STUDENT, media/body/query,
   key syntax and input bounds; apply existing IP and dedicated subject limits.
   Inspect transaction/index prerequisites without mutating configuration.
2. Start the bounded persistence workflow. Inside a snapshot transaction on the
   PRIMARY, read qualified published question/ancestry and validate the requested
   public revision and full authored DTO. No official answer is sent yet.
3. Read attempt by authenticated userId+idempotencyKeyHash. If present, verify all
   owned identity/request fields and request fingerprint. Different question,
   Concept, revision or answer is a generic idempotency conflict. An exact prior
   attempt is a replay candidate, not automatic answer authorization.
4. For an absent key, read the largest attemptNumber for this userId+questionId
   using the unique sequence index; assign the next safe integer, or 1. Insert
   one fully validated immutable document with the current private fingerprint.
   There is no mutable counter, separate receipt collection or progress write.
5. Commit with writeConcern majority and j:true, readConcern snapshot and
   readPreference primary. Await confirmed commit success. A callback returning
   an answer-bearing candidate is not permission to write an HTTP success.
6. Outside the transaction, perform a fresh bounded PRIMARY majority read of the
   exact attempt by _id+userId+key hash, retaining causal session consistency after
   its own commit. Verify immutable identity, sequence, result/null score, both
   revisions/fingerprints and exact request fields. Never trust an insert return
   value, request receipt or process memory alone as committed proof.
7. Revalidate current account eligibility and freshly published question/complete
   ancestry/references before disclosure. Require public and private content
   fingerprints to equal the committed attempt. If publication, revision, account
   or ownership changed, refuse disclosure even if the attempt already committed.
8. Return only the five answer fields plus the allowlisted minimal receipt below.
   Always end sessions and release resources in finally; retain/report failures
   safely. An unresolved verification/cleanup failure cannot be labeled success.

For existing exact attempts, use the same fresh commit-proof/account/publication/
revision checks; do not create another row or return a cached historical answer.
No external network call, UI update or HTTP response occurs inside a transaction
callback that the driver may invoke again.

Snapshot reads do not lock unchanged Question/ancestor documents against Admin
publication. A post-read change before network delivery is still possible; this
plan authorizes content at the final successful validation point, not linearizable
revocation at the instant bytes arrive. If content changes during submission,
post-commit checks refuse disclosure when observed; the committed attempt remains.
Unpublished content is never replayed merely because it was previously published.
Strict simultaneous publisher/submission serialization is a P3 alternative requiring
additional scope. Already observed answers cannot be recalled.

### 4.3 Exact bounded conflict policy

Installed source inspected: Mongoose 9.10.2 and MongoDB driver 7.6.0. The driver's
withTransaction supports timeoutMS; its default retry window can otherwise be
120 seconds. This is source evidence only, not runtime verification. Do not rely
on an unbounded callback loop or blindly copy existing transactions without options.

Propose a shared monotonic **10,000ms persistence-workflow budget**, including
index/topology reads, transactional conflicts, commit proof and final content
recheck. Use native driver CSOT for readiness/proof operations and explicit
session propagation for transactional operations. Each withTransaction receives
the remaining budget and maxCommitTimeMS=min(2,000ms, remaining). Reserve at least
2,000ms for verification; do not start another transaction below that reserve.

Permit at most **three transaction-body executions total**, counting driver
callback re-entry and outer unique-index collision retries. Enforce a shared
counter; exhaustion throws a non-retryable application failure. No parallel
operations on one session, arbitrary sleeps or unbounded max+1 loop. The installed
driver's internal command retries remain bounded by its CSOT, not claimed to be
exactly one wire command. Client POST retains its existing 15-second timeout and
no automatic resend. Existing authentication transport waits are separate; this
is not a hard wall-clock guarantee for the entire HTTP lifecycle or OS stalls.

Abort a failed transaction before inspecting duplicates. Classify duplicate-key
errors by the exact known sequence/idempotency index; unknown index conflicts
are sanitized dependency failures. For a sequence collision, restart with a fresh
snapshot if budget/counter permits. For same-key collision, read the majority-
committed winner and compare its owned request, or retry within the same bounds
if the winner is not yet observable. Never turn any E11000 into unconditional PASS.

If commit remains uncertain after bounded driver handling, return sanitized 503
PRACTICE_COMMIT_UNCONFIRMED with no answer/receipt. Do not start another insertion
for that logical key in that request. A later explicit same-key request may
resolve the outcome from verified committed data and fresh authorization. Missing
or ambiguous evidence stays unconfirmed; no absence-based success. Cleanup must
not overwrite the original outcome or log private driver payloads. Awaited session
cleanup is required; exceptional kernel/driver stalls cannot be absolutely bounded
by application timers and must remain reported uncertainty rather than invented PASS.

### 4.4 Required identity/replay outcomes

| Situation | Proposed outcome |
| --- | --- |
| Same account/key, exact request, unchanged eligible content | Same committed receipt/attemptNumber, fresh allowed answer; no extra attempt |
| Same account/key, changed answer/Concept/question/public revision | 409 PRACTICE_IDEMPOTENCY_CONFLICT; no new row or answer, no original request echoed |
| Same key used by another account | Separate account scope; no lookup/disclosure of the first account's row |
| Concurrent identical same-key requests | At most one row; verified winner replay or bounded 503, never two attempts |
| Concurrent same-key different submissions | At most one winner; loser conflicts without answer |
| Different keys, same user/question | Distinct attempts; unique increasing sequence assigned in successful insert order, not browser click order |
| Public content differs before transaction | 409 PRACTICE_QUESTION_CHANGED; refresh question, no insertion for this request |
| Content/publication changes during transaction | Final recheck refuses when changed; an already committed SUBMITTED record remains immutable |
| Exact replay after answer-only edit | Private fingerprint mismatch -> 409 PRACTICE_QUESTION_CHANGED; no old/current answer disclosed by that key |
| Exact replay after unpublish/delete/ancestry mismatch | Existing safe generic 404 CONCEPT_NOT_FOUND; no receipt/answer; persisted record retained |
| Same content republished later | May replay only after complete fresh eligibility and exact stored public/private content equality; content identity is not publication history |
| Client times out after commit or response loss | It may have saved; same-key explicit Retry resolves without duplication while the key is retained |
| Server commit uncertainty | No disclosure in that response; later same-key request must independently establish commit and eligibility |
| Token/account stale or changed | Existing 401/403/account error; client ignores obsolete result, server does not rebind ownership |
| Indexes/transactions/majority proof unavailable | 503, no transient fallback or answer; do not create indexes/reconfigure MongoDB |

## 5. Exact proposed implementation inventory and inspection

**27 unique paths: six creations and 21 modifications**, matching the owner-reviewed
inventory exactly. This plan is the only creation authorized now. The other five
new paths are absent; all 21 proposed modification paths exist. No discrepancy was
identified. Creation of this document does not make a future plan update a 28th path.

| # | Operation | Exact path | Planned responsibility |
| --- | --- | --- | --- |
| 1 | Create (this gate only) | docs/features/F036-practice-attempts-persistence.md | Proposed contracts, decisions, inventory and later evidence |
| 2 | Create | apps/api/src/modules/practice/practice-attempt.model.ts | Strict insert-only attempt model and declared indexes |
| 3 | Create | apps/api/src/modules/practice/practice-attempt.repository.ts | Durable identity/sequence/idempotency/transaction/proof workflow |
| 4 | Create | apps/api/tests/practice-attempt-model.test.ts | Validation, immutable mutation boundary and index definitions |
| 5 | Create | apps/api/tests/practice-attempt-repository.test.ts | Conflicts, bounded transaction/proof and fail-closed unit tests |
| 6 | Create, prepare only | tests/browser/practice-attempts.spec.ts | Eight proposed mock-only mounted cases, NOT_RUN |
| 7 | Modify later | docs/DEVELOPMENT_ROADMAP.md | Approved future status/evidence only; preserve F037 boundary |
| 8 | Modify later | docs/API_DESIGN.md | Additive F036 request/receipt/error/replay contract superseding transient POST |
| 9 | Modify later | docs/DATABASE_DESIGN.md | Exact attempt/score/revision/idempotency/index and local retention refinement |
| 10 | Modify | apps/api/src/modules/practice/practice.schema.ts | Strict POST body, revision and key validation; GET unchanged |
| 11 | Modify | apps/api/src/modules/practice/practice.dto.ts | Separate internal projection and explicit answer/receipt allowlists |
| 12 | Modify | apps/api/src/modules/practice/practice.repository.ts | Session-aware qualified content reads and revision binding; preserve GET |
| 13 | Modify | apps/api/src/modules/practice/practice.service.ts | Current eligibility, durable-only orchestration, no transient fallback |
| 14 | Modify | apps/api/src/modules/practice/practice.controller.ts | Existing envelope plus minimal verified attempt metadata |
| 15 | Modify | apps/api/src/modules/practice/practice.routes.ts | Preserve LOCAL/auth/rate/media ordering; require and validate exact key header |
| 16 | Modify | apps/api/tests/practice.test.ts | Durable service/DTO/publication/secrecy and GET compatibility |
| 17 | Modify | apps/api/tests/practice-routes.test.ts | Idempotency/revision HTTP errors, LOCAL/auth/no-store/rate/logging contracts |
| 18 | Modify | apps/api/tests/practice.integration.ts | Prepared owned real transactions, indexes, concurrency, commit proof and rollback |
| 19 | Modify | apps/web/src/lib/practice/contracts.ts | Canonical public revision, exact receipt and feature-specific failure types |
| 20 | Modify | apps/web/src/lib/api/practice-client.ts | Key/revision POST, strict receipt, safe feature errors and no automatic resend |
| 21 | Modify | apps/web/src/lib/practice/practice-controller.ts | Bounded logical submission keys, explicit retry/new attempt, receipt/isolation |
| 22 | Modify | apps/web/src/components/practice/practice-browser.tsx | Saved/ungraded/uncertain feedback; stable native controls and retained drafts |
| 23 | Modify | apps/web/tests/practice-client.test.ts | Fingerprint vectors, headers, receipt/secrecy and cancellation |
| 24 | Modify | apps/web/tests/practice-controller.test.ts | Retry identity, commit ambiguity, state races, four-type memory limits |
| 25 | Modify | apps/web/tests/practice-rendering.test.ts | Saved/uncertain semantics, accessible controls and safe rendering |
| 26 | Modify, prepare only | tests/browser/practice-answer-unlock.spec.ts | Migrate seven prepared F035 cases to durable receipt/disclaimer contract |
| 27 | Modify, static only | playwright.f024.config.ts | Add F036 spec discovery entry; no timeout/retry/ownership changes |

Existing app.ts already covers the same exact POST path before CORS/JSON errors;
no change is needed. Existing CORS reflects allowed request headers for approved
origins, so Idempotency-Key does not require a new permissive CORS policy. Existing
shared/dedicated rate budgets are reused without changing their file. New safe
Practice error handling can stay inside practice-client/contracts/controller:
use a feature-specific reason on an ApiError subclass with static local text,
not changes to the shared error-code catalog. The auth read guard accepts a
cancellable supplied operation; reuse it without adding automatic POST replay.
Existing hook/remount/CSS/Markdown support remains sufficient at source level.

No planned edit to shared types, auth-controller, user repository, Concept
repository, app.ts, PracticeQuestion model, database.ts, logger/error middleware,
local process helper, .env, dependencies or node_modules. If exact session/error/
header support or another requirement cannot fit these paths, STOP and present
the extra file/contract, alternatives and risks before editing. Do not weaken
assertions or manufacture unrelated changes to satisfy a file count.

## 6. Proposed HTTP contract and compatibility

### Request

Keep only LOCAL POST `/api/v1/practice-questions/:questionId/unlock`.
Signed STUDENT bearer required; credentials omitted by the browser; no cookies or
client environment flag. Strict normalized 24-hex questionId/Concept ID; empty
query. Content-Type application/json; existing 256kb parser remains. Body exactly:

    {
      "conceptId": "<24 lowercase hex after normalization>",
      "studentAnswer": "<verbatim nonblank string, at most 10000 UTF-16 units>",
      "questionRevision": "<64 lowercase hex public-content digest>"
    }

Require exactly one `Idempotency-Key` HTTP header: canonical lowercase UUID v4,
36 ASCII characters, regex
`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])`.
Reject absent, repeated, comma-joined, blank, oversized, wrong-version, coercible
or unsupported values before persistence. Detect duplicate raw header occurrences;
do not let Node's normalized/joined header map silently pick one. Header names
are case-insensitive; key value normalization is not needed because only the
canonical form is accepted. It is an identifier, not an authentication credential.

Reject extra fields including type, accountId, attemptId, result, score or receipt.
Derive type from qualified content and user from authentication. No query/header
flag bypasses LOCAL, account, publication or immutable-commit checks. Do not log
the key, request fingerprint, studentAnswer or official text.

### Success and minimal receipt, P2

Use **200** for both first successful submission and authorized replay, preserving
the existing unlock status/envelope and exactly five fields in `data`:

    {
      "success": true,
      "data": {
        "id": "<questionId>", "conceptId": "<conceptId>",
        "type": "OUTPUT|DESCRIPTIVE|SCENARIO|CODING",
        "answer": "<validated authored answer>", "explanation": null
      },
      "message": null,
      "meta": {
        "requestId": "<existing request ID>",
        "attempt": {
          "id": "<committed attempt ObjectId>",
          "attemptNumber": 1,
          "result": "SUBMITTED",
          "submittedAt": "<canonical UTC ISO timestamp>"
        }
      }
    }

Explanation may be an approved nonblank authored string instead of null. Receipt
contains exactly four fields; no private submitted answer, userId, key/hash,
revision/fingerprint, grading score, evaluation, provenance or DB internals.
Client verifies strict DTO/receipt shape, safe sequence/UTC date and requested
question/Concept/type; controller binds it to its frozen request/revision/account.
The receipt is informational, never a reusable credential or GET unlock token.

This is an explicit local contract migration: old F035 POST bodies without key/
revision fail validation, and old strict clients reject the new metadata. Deploy
the matching local API/web snapshot together; refresh old pages. Do not accept a
legacy transient mode, optional receipt or compatibility flag that bypasses a
persisted attempt. Update the in-scope F035 browser mocks/assertions only; preserve
their negative security cases and historical NOT_RUN evidence. GET remains exactly
seven answer-free fields with existing metadata/default OUTPUT/pagination/order.

### Errors, caching and repeated requests

| HTTP / code | Contract |
| --- | --- |
| 400 VALIDATION_ERROR | IDs, key/header duplication, revision/body/query, blank/oversized field or malformed JSON; existing safe field messages |
| 401 existing AUTH_ACCESS_TOKEN_* | Missing, invalid or expired bearer |
| 403 existing AUTH_FORBIDDEN/account/ORIGIN_NOT_ALLOWED | Wrong role/current-account state/origin; no private data |
| 404 ROUTE_NOT_FOUND | Non-LOCAL route remains unavailable |
| 404 USER_NOT_FOUND / CONCEPT_NOT_FOUND | Existing missing-user / generic hidden or inconsistent content behavior |
| 409 PRACTICE_IDEMPOTENCY_CONFLICT | Same account/key used for different owned submission; no original fields or answer |
| 409 PRACTICE_QUESTION_CHANGED | Request or replay revision/content no longer qualifies; refresh required; no answer |
| 413 PAYLOAD_TOO_LARGE / 415 UNSUPPORTED_MEDIA_TYPE | Preserve existing early parser/media behavior |
| 429 RATE_LIMIT_EXCEEDED | Existing shared IP/dedicated unlock limit, including repeats/replays |
| 503 PRACTICE_COMMIT_UNCONFIRMED | Durable outcome or committed identity cannot be established; explicit same-key retry may resolve; no receipt/answer |
| 503 DEPENDENCY_UNAVAILABLE | Missing readiness/index/transactions, malformed eligible data or exhausted known-aborted conflict retries; sanitized |

No errors contain correct/student answers, original submissions, keys/digests,
ownership details or raw driver errors. Omit receipt on all errors, including an
already committed attempt whose final eligibility check fails. Keep exact-route
no-store on success, conflicts, auth/rate errors and applicable early CORS/parser
failures; unrelated endpoints retain their behavior. No new response cache or
answer logging. Existing 300/IP/15min and 30/unlock-subject/15min budgets remain;
GET 120/subject is unchanged. A replay consumes rate budget and reauthorizes.

## 7. Student state, privacy and lifecycle

### 7.1 UI and retry identity

Retain the existing page and native stable Submit/Retry DOM control, visible focus,
textarea labels, pending live status, scoped error and safe answer/explanation
renderer. On successful commit proof display exactly:

    Answer revealed. This attempt has been saved but has not been graded.

Show only the receipt's attempt number and saved timestamp as useful confirmation;
do not display an internal key/attempt ID unless a later UX contract requires it.
Before submitting, explain that Submit saves the answer and Clear drafts does not
delete saved attempts. While pending use existing duplicate suppression and focus
behavior; do not auto-focus the textarea or official answer. Preserve inert code,
whitespace/newlines, restricted Markdown, empty/error/loading and responsive layout.

Freeze account/Concept/type/question, exact answer and public revision into a
logical submission. Generate a native cryptographic UUID v4 once for that logical
submission. Native Web Crypto digest work is asynchronous: check cancellation,
generation, identity and frozen draft again after hashing and before fetch.
Unsupported crypto fails closed locally; no weak random/time-based fallback.

Keep at most one logical-submission memo per retained nonempty draft across all
four types, bounded by the existing **100 total drafts**, each **10,000 code
units**. The memo holds key, request identity and outcome, not official answers.
No localStorage/sessionStorage/cookie/URL/server draft persistence. At most one
pending/revealed official result remains in memory. Account/Concept disposal clears
all memos/reveals; navigation/type/page changes clear reveal and cancel obsolete
work but retain matching draft/key memos within the current account/Concept.

Explicit Retry of an unconfirmed unchanged draft/revision reuses the same key and
exact body. Never auto-retry/resubmit after timeout, refresh or network failure.
After confirmed success, a further deliberate action is labelled **Submit another
attempt for Question N** and generates a new key, even for the same answer.
Editing, clearing or changing revision ends that logical submission; a subsequent
new Submit uses a new key. Before starting anew after an uncertain outcome, show
the fixed notice that the previous attempt may already have been saved. Conflicts
require a new explicit submission/refresh; do not silently rotate a failed key.

Cancelling a request, editing a draft, changing account or navigating away does
NOT roll back a server commit. Suggested uncertainty copy:

    This attempt may have been saved. Retry the unchanged answer to confirm it.

For discarded keys after reload/disposal, do not promise same-key recovery across
that boundary; a new explicit submission can create another legitimate attempt.
Offline de-duplication by answer value alone would incorrectly merge intentional
repeated attempts. No persistence is introduced just to retain keys across reload.

Confirmed Clear all clears only the current account/Concept's four-type drafts,
memos and reveal, after existing confirmation; stale confirmations cannot clear a
new identity. It never deletes a saved attempt. Retry/cancel/success/error callbacks
must check request generation, account/Concept/question/type/revision and snapshot;
old callbacks cannot replace current reveal or mutate another submission memo.
Reuse runAuthenticatedRead's supplied operation/identity guard without automatic
token-refresh replay of this POST. Retain safe static error messages via the
Practice-specific error type; never render raw server text.

### 7.2 Concrete proposed LOCAL retention, P5

Recommendation: retain saved attempts for the current LOCAL project-development
lifetime, until a separate explicit owner-approved erasure/reset. No automatic
expiry, TTL, background purge or delete API in F036. Keys/sequence uniqueness
therefore remain valid as long as those attempts exist; no silent short retention
that turns an old retry into a duplicate submission. This means data can accumulate;
it is an explicit local retention choice, not an approved production retention term.

Store only the strict bounded fields above; no official solution snapshots or
extra personal metadata. Student answers may themselves contain personal data:
instruct local testers not to submit secrets, and protect ordinary local database
access under existing controls. Do not log submissions/answers/keys/fingerprints,
include them in telemetry, browser artifacts or fixtures with real accounts.
Use synthetic accounts/content in automated tests. No extra encryption key,
Windows ACL change or database role/security-policy change is silently introduced.

No cross-account reads, attempt lookup by supplied receipt, public history/export
or Admin browse route is exposed. Application immutability is not an erasure
ban for an authorized future privacy workflow. Before any sharing or Internet
deployment, owner must decide production retention, account erasure and lawful
backup treatment. Future erasure must verify ownership, remove only authorized
private data, address idempotency/sequence effects and never revive a deleted
receipt as authorization. It requires separate approval; do not implement it under
F036 or silently delete attempts through Clear all. P5 approval is required before
the implementation begins saving private answers to persistent development data.

## 8. Verification and formal review plan

No tests, services, MongoDB connection, Playwright discovery, synthetic process or
Git write runs in this planning gate. Proposed implementation/offline approval
must precede test execution; live integration and browser gates are separate.

### Offline acceptance tests

1. Model: exact fields/bounds/UTC/null score/SUBMITTED/safe integer/refs/fingerprint
   syntax, strict unknown/type/coercion rejection, all supported mutation guards
   and exact four declared indexes. Preserve F030 model/index behavior.
2. Repository: session propagation, snapshot/majority options, insert-only flow,
   no pre-commit disclosure, post-commit majority proof, exact owner/request/revision
   comparison, rollback, cleanup and missing readiness. Use controlled fake sessions,
   clocks and repositories without MongoDB or process startup.
3. Idempotency: identical replay, changed-body/key scope, same/different-key races,
   sequence exhaustion, duplicate index classification, at-most-three callback
   executions, shared timeout budget, uncertainty/no transient fallback and
   publication/private-fingerprint changes. Do not mock all conflicts as successes.
4. API: signed STUDENT/current eligibility, all four types, default OUTPUT GET,
   exact header/body/query/IDs and UTF-16 edges; strict five-field answer plus
   four-field receipt/meta; no-store including early parser/CORS errors, existing
   limits/envelopes, no sensitive logs/errors and non-LOCAL unavailability.
5. Frontend: canonical digest golden vectors, native key generation/inheritance
   through explicit retries (not process inheritance), strict request/receipt,
   no automatic resend, errors/timeouts/cancel while hashing or parsing, confirmed
   new-attempt action, account/Concept/type/question/revision isolation and stale
   callbacks. Test shared draft/memo bounds and Clear all not deleting attempts.
6. Rendering: saved/ungraded and uncertainty copy, stable keyboard-native controls,
   visible focus structure, escaped submitted text, restricted official Markdown,
   inert code, absence of scoring/execution controls and retained four-type states.

Run focused model/repository/Practice API/web checks, then relevant API auth/User/
Concept/model and frontend regressions without unnecessary repeats. Inspect package
scripts first so offline execution never invokes integration/Playwright. Root
build, lint, TypeScript, formatting, browser-spec compile-only, exact scope,
UTF-8/LF and whitespace/security checks are required. Do not increase existing
timeouts, weaken unrelated tests or add dependencies. A failing assertion stops
for bounded diagnosis/correction approval as required by scope/security rules.

### Separately approved disposable MongoDB verification

Use fresh owned disposable storage, exact 127.0.0.1:27018, replica f021-test,
database deeplearner-f021-test. Verify ordinary unelevated process identity,
retained handle/creation identity, owner/executable/parent/exact Job/listener;
preserve raw native/CIM timestamps and the approved common-microsecond comparison
only where needed, not a broad tolerance. Protect persistent MongoDB/demo/storage.
Initialize replica, bounded writable PRIMARY, then verify empty target before
creating fixtures/indexes. Do not assume port readiness is PRIMARY readiness.

Prepare the existing integration file for the new model's owned collection/index
creation and transaction tests; old no-attempt assertions apply only to GET and
failed/pre-commit paths, not to successful F036 submissions. Verify real concurrent
same-key/different-key results, unique indexes, sequence numbers, unchanged existing
attempts/question snapshots, rollback, majority commit proof, missing-index refusal,
fresh publication/reference/auth checks, exact receipts/secrecy and no progress/
grading collections. Commit uncertainty needs controlled repository/driver fault
injection; do not damage shared processes/storage or imply a mock proves failover.

One approved invocation, zero retries; record actual discovered parent/child counts
rather than reusing F035's nine. Close test connections, drop only verified owned
fixtures, graceful shutdown first; owned-Job fallback only if needed. Verify Job
empty, port free, handles/storage released and protected baselines unchanged;
record forced cleanup, errors or UNKNOWN honestly. Do not alter the established
helper, TLS policy or persistent MongoDB topology.

### Prepared browser coverage and exact expected accounting

Propose **eight new F036 mounted declarations**, subject to future actual discovery:

| New case | Planned scope |
| --- | --- |
| 1 | Desktop all-four save/receipt/reveal; GET remains answer-free and empty Coding draft remains separate from starterCode |
| 2 | Response lost after mocked save; explicit same-key unchanged Retry returns one receipt; deliberate new attempt uses a new key |
| 3 | Idempotency/revision conflict, auth/rate/dependency errors with safe feedback and no official text on rejection |
| 4 | Account/Concept/question/type identity changes suppress held success/errors and isolate memos/reveals |
| 5 | Publication/revision changes and stale requests refuse disclosure while explaining a potentially saved attempt |
| 6 | Page/type draft and retry-key retention, shared limits, confirmed Clear all/cancel/stale confirmation and no saved-attempt deletion |
| 7 | Tablet/mobile containment, textarea/code/Markdown, native keyboard Submit/Retry and retained focus; measure overflow before scroll expectations |
| 8 | Pending cancellation/timeout, explicit uncertain retry, no auto-resubmit, reload memory disposal and truthful saved/ungraded UI |

The seven existing prepared F035 cases are migrated in place to the durable
request/receipt/disclaimer contract; they are not counted as seven new tests.
Existing **125 expected scenarios remain NOT_RUN**. Add eight proposed F036 cases
for **133 expected distinct scenarios NOT_RUN, INCLUDING the eight F036 cases**.
Planning counts are not discovery or passing evidence. Do not add earlier 56
outstanding cases again or erase historical F031 segmented results.

Future groups: F022/F025 27, F023 16, F024 19, F028 13, F029 7, F031 14,
F032 7, F033 7, F034 7, F035 7, F036 8, smoke 1 = 133. Preserve F024 isolation
from F028/F029, zero retries, existing assertions/timeouts, 25-minute combined
browser and five-minute initial diagnosis budgets. Require actual discovery and
owner-approved ownership-safe execution before launching anything. Browser mocks
verify mounted interactions, not actual MongoDB persistence or transaction races.

Primary-host Playwright remains prohibited. Preserve F022 EPERM/inconclusive
probing/taskkill PID-reuse risk, F024 shared-worker/browser lifecycle conflict,
F029 intermittent ArrowDown/recovery, screen-reader/background-throttling and
Windows shutdown gaps. The stopped safety prototype is untouched; do not restart
infrastructure investigation. F035's or any older exception does NOT transfer.
Any F036 local browser exception needs separate explicit approval with exact
NOT_RUN coverage, obtained evidence, accepted risks and required future checks.
Manual inspection is supplemental; production needs a separate approved browser-
regression/release-readiness decision even after durable persistence exists.

### Mandatory formal implementation-diff review

After implementation and applicable evidence, independently inspect the complete
diff and reused boundaries. Report actual **CRITICAL / HIGH / MEDIUM / LOW**
findings with file/line, trigger, impact and minimal correction; do not invent
findings or report no findings before inspection. Prioritize pre-commit answer
leaks, legacy fallback, account/attempt ownership, transaction/session/majority
proof, index readiness, key collisions, revision/publication races, private logs/
cache/errors, UI stale responses, immutability and unapproved scope. Verify GET
and F031-F035 compatibility. Critical/High findings require owner review before
unapproved corrections. No unresolved substantive finding can be waived by a
browser exception; final status/completion remain separate owner gates.

## 9. Explicit owner decisions and next gate

| Decision | Recommended option and consequence | Alternative / approval boundary |
| --- | --- | --- |
| P1 - Ungraded immutable result | Approve result=SUBMITTED and score=null for all four types, no F037 summary update. Refines the DB table's required score without inventing grading. All attempts stay immutable. | Requiring numeric scores now needs a grading/evaluation design and broader scope; do not write zero or start F037. |
| P2 - Receipt and API migration | Keep five answer fields/status 200; add exact four-field meta.attempt, require UUID-v4 key and public questionRevision. Upgrade local API/web together; old transient clients fail closed. Explicit retry retains keys; deliberate new attempt creates a key. | A separate attempt route/history UI or legacy compatibility mode is larger; no route or receipt-only bypass is authorized. |
| P3 - Revision/replay and timing | Approve content-addressed public revision plus private solution/reference fingerprint. Reauthorize/revalidate every replay, refuse changed content, disclose only against verified committed identity and the final published read. No promise of instantaneous revocation or monotonic edit history. | Strict publisher locking/monotonic revisions or returning historical solution snapshots needs Question/publication changes outside these 27 paths. Request approval/revised inventory rather than weaken this policy. |
| P4 - Transactions and indexes | Require replica-set transactions/majority confirmation, exact installed unique indexes and the bounded conflict/proof policy. Separate verified provisioning only; missing prerequisites refuse writes/answers. | No standalone/no-index fallback, request-time provisioning or topology/security changes. If the actual local DB is unsuitable, stop for a separate owner decision. |
| P5 - Private retention/erasure | Retain attempts through LOCAL development until explicit owner-approved erasure/reset, no TTL/purge/delete API. Minimize fields and protect private answers; saved attempts survive Clear drafts. Review retention/erasure/backups before sharing/deployment. | Fixed expiry/automatic erasure requires a separately reviewed lifecycle/idempotency policy; do not silently add it or authorize indefinite production retention. |

All five decisions are proposed, not presumed implementation approval. The owner
must approve their exact contracts, the 27-path boundary and offline implementation
before any code/status change. If P3's stronger alternative or a necessary extra
path is selected, STOP and revise scope under owner approval first.

This gate creates only this UTF-8/LF plan. No implementation, test, service,
database/browser/synthetic execution, Git staging/commit/push, dependency,
infrastructure or deployment operation is performed. F036 remains NOT_STARTED;
F001-F035 APPROVED_COMPLETE and F037 NOT_STARTED remain unchanged. STOP for owner
review before implementation. MongoDB execution, any browser exception/execution,
final review, completion and Git delivery are separately approved future gates.

## 10. Approved implementation and offline verification (2026-10-18)

P1-P5 reconciliation PASS. Owner approved the exact Section 5 twenty-seven-path
inventory, six planned creations (including this pre-existing plan) and 21
modifications. No model changes outside the approved new attempt model, new
dependencies, environment variables, shared-auth/publication changes or unplanned
path. The subsequent owner decisions control over historical proposals: P4 permits
index creation ONLY in separately approved disposable integration tests, never
persistent development/Atlas; P5 stores private LOCAL attempts without a promised
retention duration, automatic expiry/purge or deletion interface. No persistent
database was selected, inspected, connected, modified or provisioned in this gate.

### Delivered local contract and security boundaries

- The exact existing LOCAL-only POST now requires one raw-header-validated UUID-v4
  Idempotency-Key and strict Concept/answer/public revision body. Default OUTPUT,
  four-type GET and its exact seven answer-free fields remain unchanged. Accepted
  answer formatting is verbatim with an explicit 10,000 UTF-16-unit bound.
- New strict insert-only practiceAttempts records have server-owned references,
  sequence/time/type, canonical result=SUBMITTED and score=null, private key/request/
  solution-reference hashes and schemaVersion 1. No official solution snapshot,
  arbitrary metadata, grading, execution, history/Admin/erasure API or progress write.
- Every POST inspects transaction/topology and exact installed index readiness;
  disabled autoCreate/autoIndex remain. Missing prerequisites refuse writes and
  answers; no request/startup provisioning or standalone/transient fallback.
- Account-scoped exact replay and unique per-question sequence are protected by
  two declared unique indexes. Snapshot transactions use PRIMARY, majority+journal
  commit, at most three body executions and the shared bounded persistence budget.
  A separate majority read verifies exact committed attempt/request ownership;
  fresh content/revision and current eligible STUDENT checks precede disclosure.
  No answer or receipt is returned for unknown commit/proof, failed cleanup,
  changed/hidden content or failed authorization. This is source/offline evidence;
  actual MongoDB transaction/index behavior remains NOT_VERIFIED.
- Successful data still has exactly five answer fields; meta adds only the exact
  four-field attempt receipt alongside requestId. Keys/receipts are not credentials.
  Strict DTOs, current publication/ancestry/reference rules, dedicated/shared rate
  limits, sanitized errors, no sensitive logging and exact-route early-parser/CORS
  no-store are retained. Legacy transient requests/old strict clients fail closed.
- Browser memory holds bounded draft-scoped logical keys and one reveal, not
  persistent answers or credentials. Uncertain explicit Retry reuses the same
  key/body; a deliberate subsequent attempt uses a new key. Hashing, cancellation,
  navigation, account/Concept/type/question/revision changes and stale callbacks
  are checked before sending/accepting. Confirmed Clear all affects only current
  account/Concept memory and never deletes a saved attempt. The saved/ungraded
  receipt and cancellation-may-have-saved feedback are explicit.

### Actual offline evidence

Evidence directory: .cache/f036-offline-20261018 (generated local logs, not product
or deliverable artifacts). All HTTP tests use test-owned loopback listeners and
fake persistence; no application server, MongoDB, synthetic prototype or browser
test was launched. No tests were skipped to manufacture passing totals.

| Check | Actual result / retained evidence |
| --- | --- |
| Focused API/model/repository | 44 distinct PASS: model 4, repository 10, Practice unit 17, HTTP 13 |
| Relevant API regressions | 54 PASS: question model, Concept, authentication/access tokens, User, foundation, logging and auth/login routes |
| API total | 98 distinct tests with passing evidence; not an exhaustive API-suite or one combined-run claim |
| Focused frontend | 48 distinct PASS: client 13, controller 25, rendering 10 |
| Remaining web regressions | 168/168 PASS, excluding the three focused files |
| Frontend total | 216 distinct tests with passing evidence |
| Build | Root build PASS; final affected web rebuild also PASS after the review correction |
| TypeScript | Root workspace check PASS, including prepared integration source |
| Lint | Root PASS; final affected files also checked |
| Formatting | Root format:check PASS; one remaining model-test style issue was formatted within scope |
| Browser-spec static compilation | PASS; this does not execute/discover Playwright scenarios |
| Scope/encoding/whitespace | Exactly 27 approved paths; UTF-8/LF and read-only git diff --check verified at closure |

Passing counts reconcile retained evidence, not repeated executions counted twice:
api-focused-initial.log (42/42), api-affected-final.log (repository 10 plus HTTP
13), api-revision-final.log (one added unit vector), api-regression.log (54);
web-focused-initial.log (client 13 and controller's initial 23), controller-final.log
(25), controller-refresh-final.log (one affected path), rendering-final.log (10)
and web-regression.log (168). The initial root-context frontend invocation reported
38 PASS / 8 FAIL because JSX used the wrong root context for imported Markdown;
rerunning only rendering from the existing web workspace passed 10/10 without
changing the shared renderer or weakening assertions. Preserve that failed run.
Initial TypeScript errors were stale test/integration signatures and one generated
test-call comma; approved in-scope corrections passed. Initial lint found one
prefer-const test variable and one unused import; both were corrected. No MongoDB
or browser failure is inferred from those offline setup/static failures.

### Separate source-diff review

Reviewed production and test diff plus new model/repository files independently
of passing tests. Included LOCAL registration, exact route/header/body matching,
JWT/current-account authorization, all carried publication references, public/
private/request fingerprints, strict private data/DTOs, unique-index readiness,
session/majority proof and uncertainty, bounded conflict handling, cleanup,
logging/cache/error secrecy, supported immutability, four-type compatibility,
client memo/receipt/isolation/races, safe Markdown/code, prepared integration/
browser changes and the unchanged shared boundaries.

| Severity | Actual findings and disposition |
| --- | --- |
| CRITICAL | None found |
| HIGH | None found |
| MEDIUM | None found |
| LOW | L1 resolved: starting over after a revision refusal discarded the failed key without refreshing content, causing repeated stale submissions. apps/web/src/lib/practice/practice-controller.ts:295 now refreshes through the existing load/focus mechanism before a new explicit submit; the focused controller case verifies two loads, ready state, heading-focus revision and a new key. No automatic new POST. |
| LOW | L2 resolved in prepared test only: the F036 revision-refusal route mock also intercepted OPTIONS and returned 409, which could prevent the intended POST error branch. tests/browser/practice-attempts.spec.ts:397 now serves the approved preflight headers/204 separately. Static compilation passed; runtime behavior remains NOT_RUN. This is not a browser-executed recovery. |

No unresolved Critical/High/Medium/Low finding or unapproved correction/scope
requirement was identified. Existing safe Markdown and shared auth/publication
utilities were reused, not replaced. This is an offline implementation review,
not final feature acceptance, proof of real transactional durability or production
release approval. Final validation at a read point is not instantaneous revocation
or monotonic editorial versioning, as approved in P3.

### Prepared integration, remaining risks and next approval

Prepared the existing guarded integration source with the new owned collection,
explicit disposable-only index creation, real concurrent same-key/different-key
submissions, strict receipt/ownership persistence, unchanged question/prior attempt
snapshots, changed solution/publication refusal, missing unique-index refusal and
owned index restoration. No integration invocation or database client connection
ran. Real majority commits, conflicts/rollback and index enforcement still need
the separately approved fresh owned 27018/f021-test/deeplearner-f021-test procedure
with PRIMARY/empty-target checks and ownership-safe cleanup/protected baselines.
Do not assume the persistent local database has the prerequisites; P4 does not
authorize provisioning it. Actual driver uncertainty/failover is not proven by
the fake-session negative controls.

Eight F036 browser declarations are prepared/static-checked only; existing seven
F035 declarations were migrated in place without changing assertions, timeouts,
retries or fixture isolation infrastructure. Existing 125 expected NOT_RUN plus
eight new = **133 expected distinct browser scenarios NOT_RUN, including those
eight**. No actual Playwright discovery, mounted smoke or manual browser PASS.
No F035/earlier exception transfers. Real layout, keyboard/focus, Submit/Retry,
account/navigation races and shared compatibility remain NOT_VERIFIED. Preserve
F022/F024/F029, Windows taskkill/PID risk, screen-reader/background-throttling and
shutdown gaps; do not reopen the stopped prototype or execute primary-host browsers.

Next gate: separate owner approval for one guarded disposable MongoDB execution.
Any browser exception/safe execution and final review/completion require separate
explicit approval. F036 stays IN_PROGRESS; F001-F035 remain APPROVED_COMPLETE and
F037 NOT_STARTED. No Git staging, commit, push, production deployment or further
feature work is performed. STOP after offline verification.

## 11. Owner-authorized disposable MongoDB gate - FAIL

On 2026-10-18 the owner authorized one fresh guarded integration execution,
including the approved indexes only in the verified disposable database. Reused
the successfully verified F035 in-memory runner and unchanged LocalProcessOwner.cs;
adapted only the evidence/storage labels and the F036 source pins. In-memory
PowerShell parsing passed and all 27 offline source pins matched before startup.
No application, assertion, fixture, helper or configuration correction was made.

Evidence: `.cache/f036-integration-2026-10-18-22-19-27-d7cbe1/`, including
`context.json`, `identity-checks.json`, `combined-ownership.json`,
`initialization.stdout.log`, `integration.stdout.log`, `mongod.log`, baseline/
after snapshots and `result.json`. One startup and one suite invocation; zero
retries. Overall procedure including cleanup: **36.66 seconds**; Node reported
12,357.676 ms for the integration invocation.

### Isolation and disposable indexes

Preflight PASS in ordinary unelevated REDGOLDMARK42\Shreeji / PowerShell 7.6.7.
Test mongod PID 10376 was created through atomic owned-Job assignment. All seven
independent checks passed: retained native-handle/PID identity, creation time,
executable, parent identity, owner, exact fresh Job membership and live state.
Native UTC creation was `2026-10-18T16:49:38.5293774Z`; CIM represented the same
identity as `2026-10-18T16:49:38.5293770Z`. Identical integer truncation of both
UTC tick counts to one microsecond yielded 639279389785293770, without tolerance;
native handle-to-handle FILETIME identity remained exact. Raw evidence retained.

Fresh owned GUID storage and the exclusive 127.0.0.1:27018 listener were verified
before connecting. The runner initialized only f021-test, then verified writable
PRIMARY, single-member loopback configuration, no other application databases and
an empty deeplearner-f021-test target before fixtures. No persistent database was
selected, queried or provisioned. Protected MongoDB PID 5144 retained its original
creation identity and 127.0.0.1:27017 listener; its inaccessible executable/owner
remain UNKNOWN and it was never adopted into the test Job.

Server logs confirm creation of the four approved practiceAttempts indexes only
in deeplearner-f021-test: unique uq_practice_attempt_sequence
{userId:1,questionId:1,attemptNumber:1}; unique uq_practice_attempt_idempotency
{userId:1,idempotencyKeyHash:1}; nonunique ix_practice_attempt_owner_concept_time
{userId:1,conceptId:1,submittedAt:-1}; nonunique ix_practice_attempt_concept_time
{conceptId:1,submittedAt:-1}. Index provisioning succeeded. Successful duplicate
enforcement, sequencing and missing-index refusal were not reached in the failed
durable case and are not claimed as integration PASS.

### Actual results and bounded diagnosis

**7 PASS / 3 FAIL / 0 cancelled / 0 skipped, 10 tests including the parent.**
The nine child cases comprise seven passes and two failures; the failed parent
is the third failure, not a separate product defect. Passing children covered
OUTPUT/DESCRIPTIVE/SCENARIO/CODING safe retrieval, private qualified-content reads,
all ancestor status/absence/reference refusals and sanitized malformed content.

The durable/concurrent case failed at practice.integration.ts:580 in the first
Promise.all submission: practice.repository.ts:153 returned sanitized 503
DEPENDENCY_UNAVAILABLE while qualifying content inside withTransaction. The HTTP
child later failed at practice.integration.ts:950, receiving 503 instead of 200.
No successful durable commit, same-key convergence/replay, conflict, sequence,
majority proof or persistence-before-disclosure result is established by this run.
GET secrecy passed; the failed unlock returned no successful answer payload.
Retained offline negative controls do not replace the failed live persistence gate.

Read-only initial diagnosis identified a concrete driver-contract incompatibility:
practice-attempt.repository.ts:321 configures withTransaction timeoutMS while
practice.repository.ts:141 also supplies operation timeoutMS with that session.
Installed mongodb/src/utils.ts:549-553 rejects this combination; its sessions.ts
documentation explicitly forbids overriding timeoutMS inside that callback.
The repository sanitizes the inner exception, so the exact original runtime
driver error was not captured. This is a source-confirmed incompatibility and the
likely failure mechanism, not a recovered or rerun result. Other transaction
operations must be reviewed under the same rule before any approved correction.
No code change, additional runtime probe or automatic retry was performed.

### Cleanup and outcome

Cleanup PASS with no cleanup errors or forced termination. Initialization exited
0, integration exited 1, shutdown helper exited 0 and mongod exited 0. The suite
closed connections and removed its owned collections; the shutdown helper verified
no remaining target collections before graceful shutdown. Job active count was 0,
port 27018 was released, retained handles were released and only receipt-verified,
non-reparse disposable storage was removed. Protected MongoDB identity/listener,
persistent demo-storage metadata and all five baseline development-process
identities remained unchanged. No unrelated process termination or persistent
database/index operation occurred.

F036 remains **IN_PROGRESS** and final review is **BLOCKED** by the failed live
durability/unlock cases. Next gate requires separate owner approval for a narrowly
scoped transaction-timeout correction and subsequent guarded verification; no
correction or further test is authorized automatically. Retain API 98 and web 216
distinct passes and all prior static/review evidence as offline results. All
**133 expected browser scenarios remain NOT_RUN**; no browser exception transfers.
F001-F035 remain APPROVED_COMPLETE and F037 remains NOT_STARTED. No Git operation,
browser/synthetic execution, deployment or next-feature work was performed.

## 12. Authorized timeout correction and single guarded recovery - PASS

The owner separately approved diagnosis, a confirmed timeout correction, focused
offline checks and one conditional fresh integration rerun. Section 11's original
7 PASS / 3 FAIL result remains historical evidence; it is not rewritten as PASS.

### Confirmed cause and exact correction

The installed MongoDB driver rejects an explicit operation timeoutMS inside a
withTransaction callback that already has timeoutMS. A controlled disconnected
driver diagnostic reproduced the exact rejection at aggregate cursor construction,
before any connection or database operation. Its only logged fields were error
name MongoInvalidArgumentError, code null, category
TRANSACTION_OPERATION_TIMEOUT_CONFLICT, allowed labels [] and stage
qualified.aggregate.cursor-construction. No raw documents, answers, credentials,
URI, arbitrary error message or stack were logged by this diagnostic. The original
integration's inner error was sanitized and remains unavailable; the actual
installed-driver rejection, offending source settings and subsequent successful
recovery confirm the timeout conflict rather than a timestamp or index defect.

Only three approved files changed in this correction gate:

- apps/api/src/modules/practice/practice-attempt.repository.ts
- apps/api/tests/practice-attempt-repository.test.ts
- docs/features/F036-practice-attempts-persistence.md

Inside the callback, qualified-content reads now pass no operation timeout and
key/sequence reads no longer accept or set one. They inherit the bounded timed
transaction. The 10-second overall persistence budget, two-second proof reserve,
at most three body executions, snapshot/PRIMARY reads, majority+journal commit and
bounded commit time remain unchanged. Readiness, post-commit majority proof and
fresh publication reads retain their explicit remaining-time limits. No API,
authorization, index, hash, retry, commit-proof, disclosure or logging contract was
relaxed. practice.repository.ts itself did not need a correction: its existing
optional timeout is omitted when the callback passes undefined.

Focused tests assert that transaction reads do not override the deadline,
post-commit reads stay bounded, and each operation receives its exact expected
session. Concurrent fixtures retain separate expected sessions while sharing the
simulated persisted rows. Two proposed weaker assertion adjustments were rejected
by automatic approval review and were not applied. Existing negative controls for
unconfirmed commits, forged proof, retries, conflicts and cleanup remain intact.

### Focused offline verification and formal review

Evidence: `.cache/f036-timeout-correction-20261018/`.

- Repository tests: 11/11 PASS, including the new real-driver, no-connection
  timeout regression. Two selected HTTP boundary cases also PASS: LOCAL-only
  request-flag refusal and durable-error/GET secrecy/no-store behavior. The new
  driver case passed again after its TypeScript-only access correction: 13
  distinct focused cases, not 14.
- Targeted lint and formatting PASS; API test/source TypeScript PASS; API build
  PASS. No frontend, complete offline suite or browser rerun was needed.
- Preserve initial sandbox tsx startup failure: uv_os_get_passwd / ENOMEM before
  case execution. The supported ordinary-user execution passed. Initial new-test
  typing accessed an unexposed topology property; Reflect.get preserves the
  no-connection assertion and the final typing/test checks passed.
- Focused formal source-diff review: CRITICAL 0, HIGH 0, MEDIUM 0, LOW 0 unresolved
  findings. Reviewed inherited deadline coverage, explicit proof deadlines,
  majority commit/uncertainty, exact session ownership, retry bounds, public error
  secrecy, unchanged LOCAL/account rules and the fixture changes. No new dependency,
  architectural boundary or additional implementation path was required.

All 423 retained source hashes were checked before the rerun; only the two
approved corrected source/test paths and this historical evidence document differed
from the offline snapshot. All 27 approved delivery paths were pinned afresh for
the rerun, and zero source mismatches were found after execution. Prior API 98 and
web 216 distinct passing evidence is retained; the new driver case adds one API
test identity, without implying a fresh complete-suite run.

### Fresh disposable integration and actual coverage

Evidence: `.cache/f036-integration-rerun-2026-10-18-22-30-11-08ee72/`.
One new startup, one prepared suite invocation, zero retries. **10 PASS / 0 FAIL /
0 cancelled / 0 skipped**, including nine child tests and the parent. Overall
procedure including cleanup: **19.07 seconds**; Node invocation 6,832.3434 ms.

Ordinary unelevated user and all seven independent ownership subchecks PASS.
Fresh retained-handle test mongod PID 19900 had native UTC creation
2026-10-18T17:00:15.5962352Z and CIM 2026-10-18T17:00:15.5962350Z; identical
microsecond truncation yielded 639279396155962350 while native-handle FILETIME
identity stayed exact. Raw values are retained. Fresh owned storage, exact Job,
loopback listener and protected baselines were verified before connecting; then
f021-test writable PRIMARY and empty deeplearner-f021-test were verified before
fixtures. Only this disposable target received the four approved indexes.

The live suite passed durable commits/proof-before-disclosure, concurrent identical
key convergence on one owned row, different-payload conflict, distinct-key
sequences 2/3, installed unique-index enforcement, stored whitespace preservation,
revision/private-solution and publication binding, missing-index refusal and
restoration, unchanged prior records/questions and no studentProgress collection.
Four-type safe GET and real authenticated/current-eligibility HTTP unlock cases
passed, with exact DTOs and no-store. No scoring or code execution was introduced.
Unknown-commit/failover and unsupported-topology negative fault injection were not
performed against MongoDB; retained focused negative controls verify fail-closed
behavior and must not be described as live failover evidence.

### Cleanup and next gate

Cleanup PASS: initialization, integration, shutdown helper and mongod all exited
0. Connections closed; verified owned collections were removed before graceful
shutdown. No forced termination or cleanup error. Owned Job active count 0, port
27018 free, handles released and verified disposable storage removed. Protected
MongoDB PID 5144 identity/listener, persistent demo-storage metadata and all five
baseline development-process identities remained unchanged. No persistent index
provisioning or unrelated process/database action occurred.

F036 remains **IN_PROGRESS**, ready for a separately approved final review.
All **133 expected browser scenarios remain NOT_RUN**; no exception is assumed.
Retain the historical F022/F024/F029, Windows termination, accessibility and
compatibility limitations. F001-F035 remain APPROVED_COMPLETE; F037 NOT_STARTED.
No Git staging/commit/push, browser/synthetic execution, deployment or further
feature work occurred. STOP after this single authorized recovery gate.

## 13. Final review and owner-approved F036 browser exception

**2026-10-18: FINAL REVIEW PASS WITH F036 BROWSER EXCEPTION.** F036 is
**READY_FOR_REVIEW**, for LOCAL DEVELOPMENT ONLY, pending separate owner completion
approval. This gate authorizes neither APPROVED_COMPLETE nor Git delivery.

### Retained evidence and exact scope

Reviewed the final source diff against the approved plan, including the new model
and repository and Section 12's transaction-timeout correction. Read the completed
F030-F035 contracts and reused auth/publication/logging/rendering boundaries.
The working inventory matches Section 5 exactly: **27 unique approved paths,
six creations and 21 modifications**, with no unrelated or staged paths.
Retain API regression evidence **98 distinct PASS**, frontend **216 distinct
PASS**, correction verification **13 distinct focused PASS**, corrected MongoDB
**10 PASS / 0 FAIL including the parent**, and build, TypeScript, lint, formatting,
browser-spec static compilation and security/scope checks PASS. Counts overlap:
the focused correction evidence is not added wholesale to the original API count.
No tests, services, database clients, synthetic processes or browsers were started
in this final-review gate.

Preserve Section 11's **7 PASS / 3 FAIL**, its confirmed installed-driver timeout
conflict and Section 12's separately authorized successful correction/rerun.
Preserve both cleanups, source diagnostics and the unchanged protected baselines.
Do not describe this history as an uninterrupted clean integration execution.

### Final source/security review

| Severity | Unresolved actual findings |
| --- | --- |
| CRITICAL | None |
| HIGH | None |
| MEDIUM | None |
| LOW | None |

No new code-review defect requiring owner disposition was identified. Previously
resolved findings and rejected, unapplied weaker test proposals remain historical
evidence in Sections 10-12. Review conclusions:

- practice-attempt.repository.ts:103 checks topology/session and exact installed
  index readiness without provisioning. Missing or incompatible prerequisites
  refuse writes/disclosure. Model autoCreate/autoIndex remain disabled.
- practice-attempt.repository.ts:253 awaits the bounded snapshot transaction with
  PRIMARY and majority+journal commit. Transaction operations inherit its CSOT;
  proof/fresh reads retain remaining-time bounds. No transient F035 service
  fallback exists. Three total body executions, safe sequence allocation and
  account-scoped unique key/sequence indexes preserve bounded concurrency handling.
- practice-attempt.repository.ts:327 rereads exact owned committed identity with
  majority consistency and verifies request/public/private fingerprints, result,
  sequence and timestamp before disclosure. Unknown commits or missing/forged
  proof fail closed. Exact same-key replay revalidates; changed payload conflicts.
  A receipt/key alone never grants access to another account's attempt or answer.
- practice.service.ts rechecks current authenticated eligible STUDENT before and
  after persistence. Qualified reads reuse F021's five-level published ancestry
  and carried reference checks; private solution/reference and displayed revision
  binding are checked again before disclosure, including on replays.
- practice.dto.ts explicitly constructs seven-field GET and five-field answer
  DTOs plus the four-field receipt; persistence projections/select are not access
  authorization. Strict IDs, body/query, exact UUID-v4 key/header and 10,000 UTF-16
  answer bounds remain. No private record, evaluation, key or hash is returned.
- practice.routes.ts retains server-side LOCAL-only registration, signed auth,
  shared IP/dedicated subject limits and no-store; unchanged app.ts applies
  no-store before applicable parser/CORS errors on the exact unlock structure.
  Existing request/error logging selects safe metadata without answers, documents,
  keys or raw driver errors. Replays remain rate limited.
- The client/controller freeze submission identity and reuse the same key on an
  explicit unchanged retry, suppress stale/cancelled results and isolate memory
  by account/Concept/type/question/revision. Account/Concept disposal clears keys
  and reveal; clear-draft confirmation never deletes persisted attempts. Native
  Submit/Retry and saved/ungraded feedback reuse restricted Markdown and inert
  code. No automatic POST resend, grading, execution or F037 progress write.

These conclusions use source, focused negative controls and the real disposable
transaction/concurrency suite. Actual failover/unknown-commit fault injection and
unsupported-topology live negatives were not executed; do not claim otherwise.
Content qualifies at the final validation read point, not a linearizable lock
against simultaneous publisher changes or a monotonic editorial history.

### Explicit one-time LOCAL browser exception and accepted risks

The owner's approval in this gate satisfies AGENTS.md's feature-specific local
exception policy, conditional on the successful review above. It applies only to
F036; it does not inherit F035's exception and does not transfer to F037 or any
other feature. Primary-host Playwright remains prohibited until separately
approved ownership-safe execution is established. The stopped temporary prototype
is not a verified execution solution and was not modified, run or reopened.

- **Eight new F036 mounted browser scenarios: 8 NOT_RUN.**
- **Complete expected regression: 133 NOT_RUN, including those eight**, comprising
  the existing expected 125 plus eight new declarations. This is expected/static
  coverage, not fresh Playwright discovery or browser PASS.

The owner explicitly accepts for LOCAL DEVELOPMENT ONLY the unverified browser
Submit/Retry interactions; keyboard/focus accessibility; saved/ungraded receipt
rendering; network interruption after commit; repeated-submission/stale-response
races; account/Concept/question/revision isolation during real navigation;
compatibility with F031-F035 Practice screens; and responsive/mobile behavior.
Offline rendering/controller tests do not eliminate those real-browser risks.
Manual inspection is supplemental only; none is claimed in this gate.

Future browser verification needs separate ownership-safe execution approval,
actual discovery, the eight mounted cases and complete 133-case segmented plan.
Preserve F024 isolation, zero retries, existing assertions/timeouts, the 25-minute
browser and five-minute diagnosis budgets. Retain historical F022 EPERM and
Windows taskkill/PID-reuse risk, F024 worker/browser lifecycle conflict, unresolved
F029 ArrowDown intermittency and independent recovery, plus exhaustive screen-
reader/background-throttling and Windows shutdown gaps. Historical passing and
NOT_RUN evidence remains unchanged; this exception claims no full regression PASS.

### Privacy, runtime prerequisites and next approval

Attempts retain private submitted text and private identity digests under the
approved LOCAL-only P5 policy, without promised retention duration, TTL, purge,
history/export or erasure API. Clear drafts/cancellation never erase saved data.
Supported model operations are insert-only, not database WORM against privileged
administration. Retention, account erasure, backup treatment and any future
evaluation lifecycle require separate owner-reviewed policy before sharing or
Internet deployment. Do not log or submit real secrets in local test data.

Only disposable indexes were authorized/provisioned. Persistent local topology,
indexes and production prerequisites remain unprovisioned/unverified; runtime
readiness fails closed. LOCAL-only route availability remains enforced. F036's
durable workflow supersedes F035's transient sequencing deviation, but is not
production release approval. Before deployment, require a separate approved
browser-regression/release-readiness and privacy/infrastructure review.

Only this feature document and DEVELOPMENT_ROADMAP.md are updated in this gate,
preserving UTF-8/LF and roadmap history. Outside the F036 entry, only the matching
current-status pointer changes to READY_FOR_REVIEW. F001-F035 remain APPROVED_COMPLETE and
F037 NOT_STARTED. Next gate: explicit owner completion approval, with Git delivery
only if separately authorized. No implementation, test, configuration, dependency,
database, browser, infrastructure or next-feature change was performed. STOP.

## 14. Owner completion approval - LOCAL DEVELOPMENT ONLY

On 2026-10-18 the owner explicitly approved F036 as **APPROVED_COMPLETE for LOCAL
DEVELOPMENT ONLY**, following FINAL REVIEW PASS WITH F036 BROWSER EXCEPTION.
The owner authorized one feature-only commit of exactly the 27 Section 5 paths
and a safe non-force push to origin/dev after the required Git preflight and
staged-diff review. This section records authorization; the delivery report must
confirm the actual commit, push and local/tracking/remote identity results.

Retain API 98 distinct PASS, frontend 216 distinct PASS, correction 13 focused
PASS, MongoDB 10/10 PASS, build/lint/TypeScript/formatting/security checks PASS
and no unresolved Critical/High/Medium/Low final-review findings. Preserve the
historical MongoDB 7 PASS / 3 FAIL, confirmed timeout conflict, authorized correction
and separately successful guarded rerun with graceful ownership-safe cleanup.
Do not recast the history as an uninterrupted clean run or add overlapping counts.

The one-time F036 exception remains explicit: **eight F036 mounted scenarios
NOT_RUN; complete expected regression 133 NOT_RUN, INCLUDING those eight**.
No browser PASS, production readiness, future-feature exception or primary-host
Playwright execution approval is granted. Preserve all Section 13 accepted local
UI/accessibility/race/isolation/compatibility risks and F022/F024/F029/Windows
limitations. The temporary safety prototype remains stopped and unmodified.

Durable majority-confirmed persistence and exact owned proof precede disclosure;
no transient fallback, grading, code execution or progress mutation is approved.
Account eligibility, publication/reference and revision/private-solution binding,
account-scoped idempotency, bounded concurrency, exact DTO secrecy, no-store/rate
limits and LOCAL-only registration remain mandatory. Persistent indexes/topology
were not provisioned by this feature; missing runtime prerequisites fail closed.
Private text retention, erasure and backups, safe browser regression and release
readiness require separate decisions before deployment. Clear drafts does not
erase saved attempts, and supported insert-only operations are not database WORM.

Only this feature document and the roadmap status are finalized in this delivery
gate. No tests or services are rerun. F001-F035 remain APPROVED_COMPLETE;
F037 remains NOT_STARTED and requires separate planning approval. No deployment,
persistent provisioning, infrastructure, dependency or next-feature work is
authorized by completion. STOP after the scoped Git delivery.
