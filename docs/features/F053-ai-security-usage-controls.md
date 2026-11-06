# F053 — AI Security & Usage Controls

## F053 G2.2 offline implementation — 2026-11-06

**G2.2 READY_FOR_REVIEW — offline only. Full F053 IN_PROGRESS; acceptance incomplete; delivery pending and not authorized in this pass.** Implementation began IN_PROGRESS under owner approval `7e0a761c-9e39-40bd-8ea5-053d725b6398/Pasted text.txt`. Primary branch/worktree: `dev`, `E:\AI\DeepLearner`, unchanged HEAD `7170516f08b914594d84605bbaa7e5771576a7f7`, starting tree/index clean. Starting fingerprints and all worktree states: external `f053-g22-20261106T123319Z/before.json`. Earlier G2.1 handoff/preparation/delivery sections retain their dated historical meaning; only this bounded G2.2 source authority/readiness supersedes their no-G2.2/NOT_STARTED directions.

### G2.2 implemented capability and exact ten paths

Explicit factories implement internal actor-bound reserve, readOperation, claimDispatch, cancelUnsent, settle, markUncertain and reconcile. There is no production composition/default profile/resolver registration, route or UI. Required injected dependencies are the repository, current authenticated actor/session verifier, UTC/monotonic clocks, server IDs, authoritative intent/profile/quote and verified receipt resolvers. Missing composition refuses. Synthetic resolvers in tests are not real source, pricing, privacy, owner-spending or provider evidence authority.

CREATE:

- `apps/api/src/modules/ai/ai-usage-ledger.repository.ts`
- `apps/api/src/modules/ai/ai-usage-ledger.service.ts`
- `apps/api/tests/ai-usage-ledger-persistence.test.ts`
- `apps/api/tests/ai-usage-ledger.integration.ts`

MODIFY:

- `apps/api/src/modules/audit/audit.model.ts`
- `apps/api/tests/auth-audit.test.ts`
- `AGENTS.md`
- `docs/features/F053-ai-security-usage-controls.md`
- `docs/DATABASE_DESIGN.md`
- `docs/DEVELOPMENT_ROADMAP.md`

The service derives actor/session identity from AuthContext, verifies the same current session and stored verified ACTIVE ADMIN, and performs the conditional User-version fence for every attempted transition. Native writes CAS control/pointer, affected original period and exact actor/key/version operation; reservation inserts its immutable key/minute marker. Operation, counters and one strict append-only audit tuple share the requested primary snapshot/majority+journaled transaction. No provider adapter is imported or invoked; a stored claim is never dispatch permission.

Ordinary recovery reads use **native snapshot sessions** (`snapshot:true`, `causalConsistency:false`) with primary reads and explicit Long preservation, not write transactions. They validate actor/key, open pointer, original/current periods, held counters, actor/minute marker and latest exact audit linkage before private DTO projection. Reads do not fence, mutate, clear liabilities or imply an absent record proves abort. Identical existing reserve intent is recovered without requoting/new admission. Identical verified terminal evidence is read-only, survives the claim deadline and may be inspected by a separately qualified current reconciler after original-author deletion; original actor is never falsely described as currently authorized. Conflicts refuse.

All shared/cross-month/open/minute/budget, source/profile/quote, claim-owner/version and evidence guards reuse unchanged G1/G2.1. Unknown usage stays fully held. Accounting/reconciliation preserves original-period attribution and independent freezes; known actual overrun is recorded once and freezes rather than clamping cost. Historical sources/authors may disappear without preventing correctly authorized final accounting. Missing current-period projection or incomplete linkage yields UNRESOLVED; a mutation with no fully validated result receipt remains OUTCOME_UNKNOWN. No implicit period creation outside new admission or liability reset.

Final asynchronous profile validation precedes the last current-session verification; a synchronous explicit-time/month/minute/quote/observation guard then runs immediately before the sole application commit call. No later async resolver is inserted between that decision and commit. This is an application decision point, not atomicity with remote commit/egress; post-check authority/configuration races and remote billing remain unproven.

### G2.2 cleanup conservatism and installed driver boundary

Retain 10000ms local work, <=5000ms authorization, <=min(2000ms, remaining) commit, separate <=2000ms abort and <=2000ms endSession. Signal/closed-work checks suppress late writes/commit; cleanup is attempted in finally. These cooperative limits are not an external watchdog. No transaction callback/business/dispatch retry or fallback exists. Local tests observe one application commit call, not necessarily one wire command.

Read-only inspection of installed `mongodb` **7.6.0** `lib/sessions.js`/`src/sessions.ts` confirmed commit retry handling stays within the same session/timeout context. Public abortTransaction may suppress command failures and update local session state; promise resolution/hasEnded is **not a positive server abort ACK**. After attempted transaction writes and a precommit failure, the repository records ABORT_UNCONFIRMED and conservatively returns OUTCOME_UNKNOWN even when the inert double rolled back. No unsupported driver option, native-command bookkeeping bypass, command-monitor framework or new permission is introduced. Primary fixed error code/category and cleanup stages are retained separately without raw driver causes/private text. Read-session cleanup uncertainty remains UNRESOLVED. Successful commit plus qualified cleanup/read linkage can return RECORDED.

### G2.2 actual offline checks and source review

- `node --import tsx --test --test-reporter=tap apps/api/tests/ai-usage-ledger-persistence.test.ts apps/api/tests/auth-audit.test.ts`: **65 PASS, 0 FAIL, 0 skipped** (55 persistence/control-flow tests plus 10 affected audit regressions). In-memory native-driver/session doubles and explicit synthetic resolvers only.
- Full API/test `tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false`: **PASS** on final source.
- Production API `tsc -p apps/api/tsconfig.json --incremental false --pretty false`: **PASS** (build/typecheck).
- Targeted six-file ESLint and Prettier; affected Markdown formatting/local links; UTF-8/no BOM/LF; whitespace/privacy/exact inventory/history; `git diff --check`; delivered G1/O1/G2.1 and other-worktree preservation: **PASS**. Final hashes/commands are in external `f053-g22-20261106T123319Z` receipts; no guarded manifest/pin was refrozen.
- Fresh separate-agent source/test/documentation review: **APPROVE**, zero unresolved Critical/High/Medium/Low findings. `/root/f053_g22_source_review` is a separate subagent in this assistant session, not an authenticated human/GitHub review; it did not independently execute tests. Actual timestamped artifact: external `f053-g22-20261106T123319Z/independent-review.txt`.

Resolved separate-agent findings: Medium nonterminal audit performer/original-actor linkage and Medium terminal-replay deadline exemption; Low sanitized primary-code retention, hostile/revoked index-array handling and prepared cleanup/error preservation. Root self-review also corrected abort-ACK assumptions, uncertain prepared-intent reuse and final asynchronous authorization/time ordering; the separate reviewer inspected those fixes. Focused service/repository/audit regressions cover the executable changes. Prepared-entry failure aggregation, case ordering and owned-fixture logic were source-reviewed/typechecked only; import inertness was tested, but the guarded entry/runtime paths were not executed. Earlier in-scope TypeScript/lint/index-snapshot failures were corrected without compiler relaxation or weakened assertions; only affected checks were rerun. Delivered G2.1's 159-test evidence is retained against unchanged source, not counted as newly executed.

### G2.2 prepared real assertions — all NOT_RUN

`F053_G22_PARENT` plus eight new assertions, separate from every existing integration group:

1. `G22-I01_INDEX_AND_ATOMIC_RESERVATION`
2. `G22-I02_IDENTICAL_KEY_AND_CONFLICT`
3. `G22-I03_CLAIM_SETTLEMENT_REPLAY`
4. `G22-I04_ATOMIC_ROLLBACK`
5. `G22-I05_CONCURRENT_ADMISSION`
6. `G22-I06_ACK_LOSS_READ_RECOVERY`
7. `G22-I07_CURRENT_ADMIN_DEMOTION_REFUSAL`
8. `G22-I08_OWNED_CLEANUP_AND_BASELINE`

Import/discovery is inert. Only explicit invocation through the existing supervision capability may register the parent; no connection/provisioning/DDL/launcher or new supervisor exists here. Future prerequisites include a separately approved exact source/runtime/fixture/index/record/result manifest, exclusive disposable replica set `f053-g22-<32hex runId>`, qualified two synthetic Admins and six distinct owned intents, authoritative synthetic profile/source/receipt/time fixtures, all 11 physical indexes, protected baseline and ownership-safe cleanup plus authenticated RESULT/digest ACK. A database name alone proves no ownership. None is qualified by this implementation.

The injected postwrite rollback/UNKNOWN assertion is last, followed only by owned cleanup; its unchanged snapshot observation is not a positive abort ACK. The race case stops before further business operations if any outcome is UNKNOWN, leaving later records NOT_RUN. No losing/uncertain intent is replayed. The acknowledgement-loss case proceeds only via a complete positive committed read. These eight assertions are not claimed independently executable or a qualified all-PASS suite; fresh isolated-case/positive-outcome evidence and existing guarded execution requirements remain prerequisites. No real database assertion executed.

This is a bounded prepared subset, not the complete G2 real-acceptance suite. Cross-month admission races, concurrent User deletion/demotion fencing, real overrun/rollover accounting, immutable-evidence races and every required opening-baseline/exclusive-writer guarantee still require separately scoped fixture/assertion/manifest preparation and real execution. No new case count or PASS is invented for that unprepared work.

### G2.2 remaining gates and exact next action

Users retain existing private brief/Save functionality and gain **no live Generate capability**. No application activation, live persistence, provider/credentials/network operation, spending, DDL/provisioning, runtime/harness/pin work, new dependency, HTTP/UI, F054 or Git delivery occurred. No implementation criterion is left open within this offline checkpoint; real storage isolation/uniqueness/indexes, current-account fencing races, concurrent accounting/audit atomicity, uncertain commits/cleanup, source/pricing/evidence truth, spending/privacy/retention and external billing remain unverified. Production activation stays forbidden while those prerequisites are missing.

Preserve F042/F043 acceptance BLOCKED, F044/F045/F049/F052 incomplete acceptance, original nine integration records/P5/API6 NOT_RUN, all unexecuted browser groups including U01–U16, historical combined 225-identity evidence (not a fresh full-suite run), parked U16 and permanent Job-empty/retained-exit UNKNOWN, production NOT_VERIFIED. Full F053 stays IN_PROGRESS; no full-feature acceptance or further sequencing authority follows.

**Exact next action:** owner review and separate authorization for development-checkpoint delivery of these ten paths. Any real verification/activation or next implementation checkpoint requires its own approved scope and prerequisites; do not start it automatically.

## F053 G2.1 offline implementation — 2026-11-06

**G2.1 bounded offline development/review/delivery checklist: complete. Full F053 IN_PROGRESS; feature acceptance incomplete.** Implementation started under approval `48487282-8157-4502-a9a8-f3d3728c8266/Pasted text.txt` from the four accepted pending documents on primary `dev`, `E:\AI\DeepLearner`, base `29aa57b3395e1eaf51d5bc68af5de943d6351c61`. Starting fingerprints and historical worktree snapshots remain in external `f053-g21-20261106T101636Z/before.json`. The previously READY_FOR_REVIEW checkpoint is now delivered as recorded below.

### G2.1 verified development-checkpoint delivery — 2026-11-06

Owner approval `a1a2e11f-49ab-4fcf-9d1d-ff30db079a1a/Pasted text.txt` authorized
direct-dev scoped delivery and this factual two-document follow-up. Implementation
commit `a27721cdac7593a9118cd2c0f3b4f90abf810e6b` has parent
`29aa57b3395e1eaf51d5bc68af5de943d6351c61` and contains exactly the nine paths below.
Normal fast-forward push to `origin/dev` succeeded; local, tracking and freshly
queried remote dev all matched that implementation commit at
`2026-11-06T11:08:14.816521+00:00`. No PR exists for this direct delivery.

The bounded G2.1 implementation, offline verification, separate-agent review and
required development delivery checklist is complete. Full F053 remains
IN_PROGRESS; feature acceptance and production readiness are not approved.
The source/test bytes and reviewed evidence match the approved checkpoint:
159 focused tests PASS, full API/test TypeScript and production API build/typecheck
PASS, targeted lint/format/static checks PASS. These application checks are retained,
not rerun for delivery. Reviewer `/root/f053_g21_source_review` performed source-only
review in the same assistant session, with zero unresolved findings and no independent
test execution; actual artifact remains `f053-g21-20261106T101636Z/independent-review.txt`.

Actual delivery checks: exact fingerprint/inventory/history preservation, UTF-8/no
BOM/LF, affected formatting/local links/privacy, staged-content identity and
`git diff --cached --check` PASS; fresh approved-origin/ancestry and GitHub rules
inspection allowed direct delivery, with no applicable branch rules/protection.
No zero/pending check state is called CI PASS. All other worktrees and pending
files remain preserved. No runtime/source-pin/binding/harness change occurred.

This documentation-only follow-up is restricted to F053 and DEVELOPMENT_ROADMAP.
Its resulting commit/normal push and final local/tracking/fresh-remote reconciliation
are recorded in the external `f053-g21-delivery-20261106T110354Z` delivery receipt
and final owner handoff, rather than inventing a self-referential commit hash here.
No database/provider calls, persistence, spending, G2.2 or F054 are authorized.
Current users still have the existing private brief/Save workspace and no live
Generate capability. All deferred guarantees and acceptance/NOT_RUN/UNKNOWN limits
below remain unchanged.

### Implemented capability and exact inventory

G2.1 supplies internal strict native-record/quote/command validators, exact integer-paise/BSON Long/bigint conversion and conservative rounding, four fixed-vector fingerprints, immutable identity/quote/claim/evidence guards, private DTO projection and deterministic transition proposals. ObjectId `activeOperationId` binds the matching open operation; only matching-pointer clearing is proposed. Every proposal has `dispatchAuthorized: false`.

New files (five):

- `apps/api/src/modules/ai/ai-usage-ledger.schema.ts`
- `apps/api/src/modules/ai/ai-usage-ledger.model.ts`
- `apps/api/src/modules/ai/ai-usage-ledger.dto.ts`
- `apps/api/src/modules/ai/ai-usage-ledger.transitions.ts`
- `apps/api/tests/ai-usage-ledger.test.ts`

Accepted pre-existing pending documents (four): `AGENTS.md`, `docs/features/F053-ai-security-usage-controls.md`, `docs/DATABASE_DESIGN.md`, `docs/DEVELOPMENT_ROADMAP.md`. Only this combined nine-path inventory changes. Earlier preparation/proposed-only sections below retain their historical meaning; the enacted exception in AGENTS authorizes only this G2.1 implementation.

Frozen/prior-month liabilities refuse prohibited admission/claim but retain explicitly permitted known-evidence cancellation/accounting/reconciliation. Unknown usage remains fully held. Reconciliation updates the original period, clears only the applicable uncertainty reason and retains independent holds. Identical terminal-evidence replay is read-only; conflicts/unlisted state-action pairs refuse. Late claimed outcomes require uncertainty/reconciliation rather than normal late settlement.

Models register only through the explicit disconnected factory, with no import-time application registration, connection, buffering or automatic collection/index creation. Schema-level immutable fields plus strict native validation guard the offline models; save/update/bulk/DDL entry points refuse. Eleven required indexes are declarations, including existing dependencies, not physical evidence. Native ObjectId validation matches the installed BSON 7 representation and fails closed if that representation changes; dependency upgrades require compatibility review.

### Executed checks and review

- Focused `node --import tsx --test --test-reporter=tap apps/api/tests/ai-usage-ledger.test.ts`: **159 PASS, 0 FAIL, 0 skipped** after final source correction. Deterministic synthetic tests only; no database/provider/runtime execution.
- Full API/test `tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false`: **PASS**; no remaining errors.
- Production API `tsc -p apps/api/tsconfig.json --incremental false --pretty false`: **PASS** (build/typecheck).
- Targeted five-file ESLint and Prettier, new Markdown-fragment formatting, UTF-8/no BOM/LF, local links/anchors, privacy, exact scope/history/worktree preservation and `git diff --check`: **PASS**. External final check receipt retains exact fingerprints; it is not a guarded execution-manifest refreeze.
- Fresh separate-agent source review: **APPROVE**, zero unresolved Critical/High/Medium/Low findings. Reviewer `/root/f053_g21_source_review` is a separate agent in this assistant session, not a separately authenticated human or GitHub reviewer; it reviewed source/tests/contract and root-run evidence, and did not independently execute tests. Actual timestamped artifact: external `f053-g21-20261106T101636Z/independent-review.txt`.

Review resolved two Medium findings: explicitly refuse over-cap exposure on dispatch claim; refuse normal settlement at/after the observation deadline and require the defined uncertainty/reconciliation path. Regression tests cover both. Defensive follow-ups harden native comparison against caller hooks, require UNCERTAIN/control-reason consistency and reject contradictory/future DTO snapshots. In-scope typing/lint findings were corrected and affected checks passed; no compiler relaxation or unrelated baseline repair.

### Established limits and next action

All actor/source/profile/pricing/evidence/authorization flags are **supplied structural facts**, not authenticated truth. No result authenticates an Admin, admits a request, writes an audit event or grants dispatch. DTOs are private projections, not persisted RECORDED receipts. No repository/service/audit-model writer, HTTP/UI/config activation, connection/DDL, provisioning, spending, live profile, provider call, dependency/runtime/harness/pin change, G2.2 or F054 work occurred. Users gain no live Generate capability; the existing private brief/Save workflow is unchanged.

Stored existence, current-account/session authorization and transactional User fencing, authoritative source/pricing/evidence resolution, atomic counters/audits, idempotency/concurrency/uniqueness, actual BSON storage/indexes, missing-period service reads, commit uncertainty and real cleanup remain unverified and belong to separately approved durable work/qualification. Retention, live spending/privacy/provider decisions remain open. Local timeouts cannot establish remote cancellation or billing guarantees.

Preserve F042/F043 acceptance BLOCKED; F044/F045/F049/F052 incomplete acceptance; original nine integration records, five P assertions and six API assertions NOT_RUN. Preserve all unexecuted browser groups including U01–U16, historical combined 225-identity evidence as combined (not a fresh full-suite run), parked U16 and permanent Job-empty/retained-exit UNKNOWN. Production NOT_VERIFIED. The original implementation/review pass performed no Git delivery; the subsequent separately authorized delivery is recorded above.

**Exact next action:** owner review and separate authorization for G2.2’s bounded offline repository/service/audit-consumer checkpoint after verifying its existing exact inventory and dependencies. G2.2 remains NOT_STARTED; this completed G2.1 delivery does not authorize implementation, live verification, spending or F054.

## G2 authoritative reservation contract — 2026-11-06

### G2 preparation status and authority

**Contract: READY_FOR_REVIEW. G2 implementation: NOT_STARTED. Full F053:
IN_PROGRESS; acceptance incomplete. PROPOSED — PENDING OWNER APPROVAL.**
The owner authorized this documentation preparation, not its implementation,
persistence, provisioning, dispatch, spending or sequencing activation. Work is
directly on primary `dev`, `E:\AI\DeepLearner`, starting HEAD
`29aa57b3395e1eaf51d5bc68af5de943d6351c61`; initial tree/index were clean.
G1's bounded offline checklist and required delivery are complete through PR #6
merge `784f01e6030ae5919c950d713b1d999d517a5c69`. No G1 suite/review is repeated.

Current users can use the existing private Admin brief/Save workspace; they cannot
generate an AI outline through G1/O1. This contract adds no user capability. It
defines only an internal durable gate for the later Technology → brief → controlled
generation → private candidate → review/edit → exact-revision approval milestone.
F054 retains domain validation/generated admission; F049/F050 retain editorial
decisions and F051 publication. This is not a billing engine, job queue, scheduler,
provider registry, new authentication system or public API.

This current section governs the proposed G2 design; older next-step/proposed
wording below retains its dated meaning. Requirements inherited from PRD60–62,
delivered G1 and O1 are mandatory. The concrete storage layout, state machine,
internal signatures and checkpoint split below are engineering recommendations
submitted for approval, not previously implemented/approved mechanisms.

### G2 focused correction and re-review — 2026-11-06

The Desktop review `F053-G2-review-20261106T095809Z.md` identified G2-01 Medium
and optional G2-02 Low. This documentation-only follow-up resolves both: the
G2.1 criteria are operation-specific and test the existing permitted accounting/
uncertainty transitions; activeOperationId is precisely the operation document's
BSON ObjectId, with scope/actor/key/open linkage and matching-pointer CAS clearing.
No general transition bypass, second operation identity or broader G2.1 scope.

Focused fresh re-review: **APPROVE**, zero unresolved Critical/High/Medium/Low
findings in this correction scope. Reviewer `/root/f053_g2_focused_rereview` is a
separate subagent in this assistant session, not an authenticated human/GitHub
approval. Its timestamped external `focused-review.txt` is retained under
`f053-g2-correction-20261106T100030Z`; it records the reviewed normative candidate
fingerprints before this factual note. The initial preparation's self-review and
receipts below remain historical; their hashes do not describe the corrected text.

Affected Markdown formatting, local links/anchors, consistency, UTF-8/no BOM/LF,
whitespace, privacy and unchanged inventory/proposed-exception checks PASS.
Final applied-content/scope and `git diff --check` evidence are retained in this
correction's external receipt. No application/G1 suites or complete G2 review rerun.
The reviewer caught one candidate-only transcription typo, removed before approval.

This pass changes F053, DATABASE_DESIGN and roadmap only. AGENTS remains byte-
identical; all four pre-existing pending documents remain unstaged on dev at
`29aa57b3395e1eaf51d5bc68af5de943d6351c61`, index empty. Historical sections and
other worktrees are preserved. Users gain no new capability. G2.1 implementation
remains NOT_STARTED; the exact nine-path checkpoint is ready for owner authorization,
with its exception still PROPOSED — PENDING OWNER APPROVAL. Before coding, explicitly
reconcile these four pending documents into the owner-approved implementation
baseline; do not discard them or silently claim a clean baseline. F053 remains
IN_PROGRESS, with all existing acceptance blocks/NOT_RUN/UNKNOWN and production
NOT_VERIFIED unchanged. No implementation, runtime, database/provider/network or
Git delivery is authorized by this correction.

### G2 authoritative inputs and reuse

Reuse the F044 proposal repository/service's explicit primary/snapshot session,
majority+journaled commit, bounded authorization verification, conditional User
`__v` increment, strict audit validation and read reconciliation. Do not copy its
index matcher unchanged: G2 needs an exact partial-index comparison that F044's
non-partial manifest deliberately rejects. Existing `auditLogs` currently has no
AI-usage action/resource branch; its scoped extension is a real dependency.

| Fact           | Required authority and refusal boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actor          | Existing verified JWT/session context, both JWT and stored role ADMIN, stored ACTIVE account with verified email and valid non-exhausted `__v`. Derive actor from authentication, never a request field. Reverify the same actor/session before commit, within the existing five-second authorization ceiling.                                                                                                                                                                                                                                            |
| Mutation fence | In every protected mutation transaction reread User and conditionally increment `__v` matching `_id`, ADMIN, ACTIVE, exact `emailVerifiedAt` and version. Zero matches, malformed row, overflow, observed demotion/deletion/revocation or conflict refuses. Increment serializes with User deletion/demotion; it is not a new editorial decision. Historical usage/actor references survive deletion, with no cascade.                                                                                                                                    |
| Policy/profile | A server-owned resolver supplies an explicitly approved immutable policy/profile/pricing/privacy/spending reference. Match these against the current shared control document/version in the transaction. No request can supply an approval flag, rate, cap, alias or server time. A document/version label alone does not prove owner approval. The resolver and activation procedure do not exist yet; production composition must fail closed, with no permissive/default live profile.                                                                 |
| Source/request | A future domain consumer resolves stored brief existence, exact revision/digest, Technology binding/eligibility and minimized allowed payload before asking for admission. G2 binds these facts and exact technical request bytes; it cannot authenticate F054 output or invent a source authority. Existing F044 snapshot eligibility does not prevent every concurrent Technology archival/deletion. Recheck observed eligibility before egress; retain history, refuse later new work if parent is missing/ineligible, and never cascade-delete usage. |
| Usage          | Read control, period counters, the active operation and actor/minute admission from the same transaction snapshot; never use UI counts, O1 usage metadata or a caller's G1 proposal as stored authority. Validate every stored projection before arithmetic. Malformed/missing/contradictory records refuse, not zero.                                                                                                                                                                                                                                    |
| Time           | Trusted server UTC milliseconds captured through an injected server clock; production does not accept caller time. Derive `periodKey` with delivered `aiUsageTimeAt` and `admissionWindowKey=floor(epochMs/60000)`. Recheck both immediately before admission commit; a month/minute boundary aborts without automatic retry. Clock regression relative to the control's last admission time refuses new admission pending operator investigation. Monotonic time bounds local work.                                                                      |

All schema boundaries use exact own-data primitive fields before library parsing,
following G1's hostile-value checks. Reject accessors, proxies, symbol/operator/
unknown fields and coercion without invoking caller inspection code. Read stored
BSON through explicit projections/type checks; never stringify an arbitrary row.

### G2 identities, money, quote and fingerprints

- Scope is exactly `SHARED_AI_TESTING`, shared by all participating Studios. Initial
  purpose is only `CURRICULUM_OUTLINE`; adding Interview generation needs its own
  contract but cannot create a second testing cap. Environment is exactly `DEV`;
  G2 does not define a production budget. IDs follow existing lower-case 24-hex
  ObjectIds and canonical lower-case UUID-v4 operation/version/receipt IDs.
- Operation identity is `(scope, actorId, operationId)`. Allocate the operation UUID
  once before requesting admission and retain it for explicit recovery. It is not
  a bearer capability. Never replace it automatically after an uncertain result.
- Currency is INR; values are integer paise, never floating-point rates/amounts.
  Persist monetary fields as BSON signed `Long`, range `0..9007199254740991`;
  quote/reservation must be positive. Compute with bigint, validate all sums and
  differences before conversion, refuse overflow/underflow. Read/write Longs
  explicitly; Mongoose number/string casting is not monetary validation. G1 gets
  checked exact safe-integer numbers only. Private DTO/audit amounts are canonical
  decimal strings (`0` or no-leading-zero digits), not bigint JSON or BSON objects.
- Testing policy snapshot is cap `100000` paise, warning `80`, month timezone
  `Asia/Kolkata`, global-open limit `1`, actor-minute limit `1`. The cap/warning
  have design provenance in PRD61/G1; neither authorizes spending. G1 supports
  exactly this profile; a different policy must refuse rather than silently pass
  different constants into G1. No authorized production defaults are introduced.
- A quote is immutable, exact and server-only:
  `{id, periodKey, environment, purpose, policyVersion, profileVersion, pricingVersion,
privacyVersion, spendingApprovalRef, providerAlias, modelAlias, templateVersion,
requestDigest, requestBounds, inputTokenUpperBound, worstCasePaise,
effectiveAtMs, expiresAtMs, assumptionsDigest}`.
  Version/reference fields are UUID-v4, hashes 64 lower-case hex; aliases follow
  existing F053's 1–64 ASCII alias rule. Times use G1's supported integer range,
  `effectiveAtMs <= now < expiresAtMs`. Upper input-token bound is a positive safe
  integer additionally constrained by the approved profile's actual context limit;
  no guessed tokenizer or model limit is supplied. `requestBounds` is exactly G1's
  five fields/ceilings, including full instructions bytes, input bytes, output
  bytes/tokens and captured local budget. Quote must match every field and purpose.
- `assumptionsDigest` binds the approved immutable pricing record/resolver snapshot:
  provider/model/project alias, rate version, complete prompt/template token upper
  bound, output ceiling, all allowed charge components, FX/tax/fee and rounding
  rules. No tools/browsing/extra modalities. The immutable record must remain
  retrievable by the trusted resolver; a digest without the record is insufficient.
  This is a dependency interface, not a new pricing collection/framework. Unknown
  rates, expiry, context, components or all-in bound refuse. Rational pricing math
  uses integers, sums conservative charges and rounds upward with
  `ceil(n/d)=(n+d-1)/d` for positive integer denominator. Never down-round unknown
  cost, clamp it to the cap or treat provider token metadata as a priced invoice.

Canonical hashing uses UTF-8 `JSON.stringify` of fixed ordered arrays, no arbitrary
object-key sorting, trimming, Unicode normalization or evaluation of user methods:

1. `requestDigest = SHA256(["AI_REQUEST",1,instructions,inputJson])`.
   The notation means hash the serialized array, not concatenated strings. Preserve
   exact validated input JSON text, including whitespace; equivalent reformatted
   JSON is a different intent. Text remains in memory, never the usage ledger/audit.
2. `intentFingerprint = SHA256(["AI_INTENT",1,scope,actorId,operationId,purpose,
technologyId,sourceId,sourceRevision,sourceDigest,requestDigest,
instructionBytes,inputJsonBytes,maxOutputBytes,maxOutputTokens,budgetMs])`.
   Initial source revision is `1` for the existing immutable F044 brief family.
3. `quoteDigest = SHA256(["AI_QUOTE",1,id,periodKey,environment,purpose,policyVersion,
profileVersion,pricingVersion,privacyVersion,spendingApprovalRef,providerAlias,
modelAlias,templateVersion,requestDigest,instructionBytes,inputJsonBytes,
maxOutputBytes,maxOutputTokens,budgetMs,inputTokenUpperBound,
worstCasePaiseDecimal,effectiveAtMs,expiresAtMs,assumptionsDigest])`.
4. `reservationFingerprint = SHA256(["AI_RESERVATION",1,intentFingerprint,
periodKey,admissionWindowKey,quoteDigest])`.

Two fingerprints are necessary: an existing identical actor/key/intent returns its
recorded reservation without a fresh quote, period or admission; a new quote after
rollover/expiry must not turn recovery into a second Save. A different intent with
the same key is `OPERATION_CONFLICT`. Recovery reads require no prompt resend.
Only an uncommitted, definitely aborted admission may be explicitly reconsidered;
absence in one read after commit uncertainty is not proof of abort.

### G2 minimal storage and exact indexes

Use three small aggregates, not per-user counters/queues: shared control provides
one cross-month serialization/freeze point; monthly ledgers retain period history;
operations provide actor/minute identity and immutable accounting receipts. A
single document with indefinitely growing month/actor maps is deliberately avoided.
The [G2 database appendix](../DATABASE_DESIGN.md#f053-g2-proposed-usage-storage--2026-11-06)
is the exact storage/index companion; neither document provisions anything.

| Collection          | Exact fields and invariants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiUsageControls`   | `_id`, `schemaVersion:1`, `scope`, `version`, `policyVersion`, `policy:{capPaise,warningPercent:80,timezone:'Asia/Kolkata',maxOpen:1,maxActorMinute:1}`, nullable `profileVersion`, `pricingVersion`, `privacyVersion`, `spendingApprovalRef`, `dispatchEnabled:false` initially, `frozen`, `freezeReasons`, nullable `activeOperationId`, nullable `lastAdmissionAt`, `createdAt`, `updatedAt`. One scope row; current version CAS on every admission/transition. Explicit nonnegative safe integer versions, server UTC Dates, no implicit creation/default activation. `freezeReasons` is a sorted unique array, max5, from `ACCOUNTING_INVALID`, `OPERATOR_HOLD`, `OVERRUN`, `PRICE_UNKNOWN`, `UNCERTAIN`; `frozen` equals reasons.length>0. Independent holds cannot overwrite each other. |
| `aiUsagePeriods`    | `_id`, `schemaVersion:1`, `scope`, `periodKey`, `version`, `settledPaise`, `heldPaise`, `createdAt`, `updatedAt`. Months use exact G1 YYYY-MM/range. No separate unresolved amount: uncertainty remains in held; never double-count it. Missing current month can be inserted at zero only after proving no existing row and validating shared/history consistency, inside the admission transaction. No zero-reset of an existing period.                                                                                                                                                                                                                                                                                                                                                      |
| `aiUsageOperations` | `_id`, `schemaVersion:1`, `scope`, `actorId`, `operationId`, `purpose`, `environment:'DEV'`, `technologyId`, `source:{id,revision:1,digest}`, `requestDigest`, `requestBounds`, `intentFingerprint`, `reservationFingerprint`, immutable `quote` plus `quoteDigest`, immutable `periodKey`, `admissionWindowKey`, `admittedAt`, `reservationPaise`; mutable `version`, `state`, `open`, `heldPaise`, nullable `actualPaise`, nullable `claim`, nullable `terminalEvidence`, nullable `safeCode`, `lastAuditId`, `updatedAt`. No raw request/output, credentials, provider headers/URLs or token/session data. Immutable fields cannot be replaced through model save/update APIs. Mutations use only validated native-driver CAS.                                                               |

`activeOperationId` is null or a BSON ObjectId reference to
`aiUsageOperations._id`, never the actor-scoped UUID `operationId`. In validated
string-only projections it is exactly 24 lower-case hexadecimal characters,
converted only after ObjectId validation; do not coerce arbitrary stored values.
Resolve it by `_id` and the same `scope`; require the uniquely validated open row
to match that ObjectId, scope, stored actorId and operationId. Ordinary protected
lookups additionally bind the authenticated actor; explicit reconciliation retains
the original actor binding and separately verifies the current performer. A pointer
is not authority to adopt another actor's operation. Pointer, compound actor/key
identity and sole-open query must agree; missing/mismatched linkage refuses.
Admission sets it to the newly inserted operation document's `_id` in the same
transaction. An open-to-terminal transition clears it only by CAS matching that
exact ObjectId and control version, atomically with accounting/audit; a different
pointer is a conflict, never cleared. Reading/replaying an older terminal row
requires no pointer to that row; a newer independently qualified operation may be
active. Never require global null merely to read an old terminal receipt.

`claim` is null or exactly `{id,ownerId,claimedAt,observeUntil}`: server UUID-v4 IDs,
UTC Dates, immutable after creation. It records one local invocation owner, not a
lease permitting a replacement dispatch. `observeUntil` is the captured O1 local
budget (1–10000ms) after claim time, not a remote termination promise. No second
claim, owner takeover or lease-expiry replay. `terminalEvidence` is null or exactly
`{id,kind,evidenceDigest,actualPaise,inputTokens,outputTokens}`; kind is
`FINAL_COST` or `DEFINITELY_UNSENT`. The evidence digest is private; token counts
are null or nonnegative safe integers, not authenticated by their type. FINAL_COST
requires exact nonnegative all-in actual cost and independently trusted final
evidence; unsent requires zero cost and null counts. Missing evidence is not zero.
`safeCode` is null or one fixed code from the operation outcomes below.

All collections use explicit disconnected registration (`autoCreate:false`,
`autoIndex:false`, `bufferCommands:false`, strict schema, no implicit versionKey,
no generated accounting timestamps/default counters). Registration performs no
DDL/connection. Documents stay <=64KiB encoded; bounds follow O1's technical ceiling
and small fixed metadata, with no unbounded embedded events or private payloads.

Exact index inventory (11 total, including three new-collection `_id_` indexes
and three required existing dependencies):

| Collection / name                                 | Ordered key                                               | Required options                                      |
| ------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| `aiUsageControls / _id_`                          | `{_id:1}`                                                 | built-in unique                                       |
| `aiUsageControls / uq_ai_usage_scope`             | `{scope:1}`                                               | unique                                                |
| `aiUsagePeriods / _id_`                           | `{_id:1}`                                                 | built-in unique                                       |
| `aiUsagePeriods / uq_ai_usage_period`             | `{scope:1,periodKey:1}`                                   | unique                                                |
| `aiUsageOperations / _id_`                        | `{_id:1}`                                                 | built-in unique                                       |
| `aiUsageOperations / uq_ai_usage_actor_operation` | `{scope:1,actorId:1,operationId:1}`                       | unique                                                |
| `aiUsageOperations / uq_ai_usage_open`            | `{scope:1}`                                               | unique, partial `{open:true}`                         |
| `aiUsageOperations / uq_ai_usage_actor_minute`    | `{scope:1,actorId:1,admissionWindowKey:1}`                | unique, including terminal admitted operations        |
| `users / _id_`                                    | `{_id:1}`                                                 | existing built-in unique                              |
| `auditLogs / _id_`                                | `{_id:1}`                                                 | existing built-in unique                              |
| `auditLogs / uq_ai_usage_audit_version`           | `{resourceType:1,resourceId:1,'metadata.usageVersion':1}` | unique, partial `{resourceType:'AI_USAGE_OPERATION'}` |

All declared indexes require exact ordered keys, uniqueness and partial filters,
simple collation, not sparse/hidden/TTL. Existing unrelated indexes remain intact;
this is a required inventory, not permission to remove extras. Missing collections,
indexes or ambiguous definitions refuse. No startup index creation/repair. Declare
the new audit index only; physical setup/execution needs separate owner approval.

### G2 atomic admission and transaction boundaries

One bounded transaction uses primary snapshot reads and majority+journaled commit:

1. Validate command/authority; read the actor/key first. If committed and identical
   intent, return validated recorded state through a protected read, not a second
   mutation. A different fingerprint refuses. No new quote, window or audit event
   on an identical replay. Current account eligibility is still required.
2. Resolve/verify server-owned source, profile and immutable quote; capture time.
   Reread eligible User, control, current period, active operation and actor/minute
   marker. All control references must agree. The sole prior open operation's held
   amount remains in its original period; pass it as `unresolvedPriorPaise` to G1
   if from an earlier month. An earlier RESERVED or claimed operation is also an
   unresolved liability; a month rollover does not make it free. Contradictory
   pointer/open/held state refuses and requires explicit reconciliation.
3. Build exact G1 facts from these authoritative reads; check positive prior
   liability/freeze, shared-open, fixed-minute, cap and warning. New admissions
   consume a minute even if later cancelled. Exactly 100000 is affordable; 100001
   refuses. Warning is exposure >=80000, including a refused/frozen status read;
   no automatic cap increase. No caller-supplied `usage` is used.
4. Fence User `__v`; CAS control/version (active pointer must be null), increment
   current period held/version, insert the open RESERVED operation at version1,
   and append its version1 audit event. Record the trusted admission time. Reverify
   same session and unchanged current month/minute before committing. Every write,
   including the audit, must succeed together. Denials create no usage operation,
   admission marker, counter or successful-mutation audit.

The final precommit decision point defines the recorded admission month/minute;
commit acknowledgement may occur later. Do not claim the application clock check
is atomic with remote MongoDB commit or provider billing. Also revalidate quote
expiry and unchanged control/profile references at this point; dispatch later
requires a fresh check, including dispatchEnabled=true. Initial false is a hard
dispatch refusal, not a flag the caller can override.

Query open operations by scope/open using the partial index, bounded at2, and
require exact agreement with the singleton pointer and affected held period.
Actor/minute uses its exact unique key. This is not an unbounded history scan or
proof against arbitrary out-of-band database tampering. Before first real use,
the owner-approved opening baseline must establish all shared existing Studio
liabilities and exclusive authorized ledger writers; unknown historical/external
usage must freeze/refuse, never become a manufactured zero opening balance.

The shared control CAS serializes all admissions/transitions across months;
partial unique open and actor-minute indexes independently defend the two limits.
Unique actor/key defends idempotency. Transactions and validators alone cannot
replace physical indexes. A conflicting write or duplicate-key transaction aborts;
there is no callback/business-operation retry. Perform a separately bounded
protected read by actor/key for a committed matching result; otherwise report
`RETRY_LATER` only after a definitely aborted transaction, or `OUTCOME_UNKNOWN`
when commit/abort evidence is ambiguous. Never interpret a collision as success
without validating the full matching stored record and audit.

Reuse the existing service bounds: one 10000ms local database operation budget,
authorization reads <=5000ms and commit <=min(2000ms, remaining). Reserve explicit
cleanup bounds: abort <=2000ms, endSession <=2000ms after work stops, in finally.
These are cooperative driver/local limits, not an external hard watchdog; no
runtime/harness deadlines change. No provider call inside a transaction. Start
one transaction, attempt commit once, never replay its callback or automatically
retry dispatch. Timeout/cancellation after commit begins or failed cleanup yields
OUTCOME_UNKNOWN with only safe error codes; preserve the primary failure and
cleanup classification in sanitized evidence, not raw driver text. Late work
must check the closed/cancelled generation before any write/commit/dispatch.

One application commit call does not prove one wire command: preserve only the
installed driver's existing bounded same-session commit handling within the same
commit/deadline context, as documented for F043. Never restart a transaction,
replay business writes or dispatch because of a driver retry label. Verify those
driver bounds in G2 implementation; uncertainty after that call remains unknown.

### G2 state transitions and dispatch boundary

State is accounting state, never content/editorial status. RESERVED,
DISPATCH_CLAIMED and UNCERTAIN require `open:true`, held=original reservation,
actual=null and the shared active pointer. SETTLED/RELEASED require `open:false`,
held=0, terminal evidence and no active pointer to that terminal row; a newer
qualified operation may be active. Version increases exactly once
per committed transition. No operation/period is TTL-expired.

All unlisted state/action pairs refuse. Check version increments and timestamp/
money additions for overflow; do not wrap, clamp or silently default a missing
value. Accounted transitions do not establish authenticated generation provenance.

| From               | Action / required evidence                                                                                                                                          | To / atomic effect                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absent             | Qualified admission transaction                                                                                                                                     | RESERVED; increase held, consume actor/minute, claim=null.                                                                                                                                                                                                                                                 |
| RESERVED           | Explicit cancel by current authorized actor, or explicit internal reconciliation by another current eligible Admin; expected version and claim still null under CAS | RELEASED; definitely never dispatched, subtract held, clear pointer, record unsent evidence and audit. This also resolves an unused reservation after its author was deleted.                                                                                                                              |
| RESERVED           | Future coordinator revalidates current actor, domain/privacy/profile/quote/time and source, then fences User and commits one claim                                  | DISPATCH_CLAIMED; retain held, write immutable claim and audit. No egress until this commit and cleanup are known successful.                                                                                                                                                                              |
| DISPATCH_CLAIMED   | Matching owner supplies trusted final all-in usage/cost; current authority/fences/version and evidence checked                                                      | SETTLED; subtract held, add actual to original period settled, clear pointer, terminal evidence/audit. Actual >reservation or resulting exposure >cap also freezes shared control as OVERRUN. Never clamp an incurred overrun away.                                                                        |
| DISPATCH_CLAIMED   | Timeout, abort, cancellation, crash, malformed result, unknown usage, failed transport/claim cleanup, or observation deadline passed                                | UNCERTAIN; retain full held and active pointer, freeze control as UNCERTAIN, append audit when a safe transaction is possible. If even this write is uncertain, the persisted claim remains open and must be treated as uncertain on read.                                                                 |
| DISPATCH_CLAIMED   | Positive independently verifiable proof this exact claim never invoked any transport and cannot later do so, supplied through explicit reconciliation               | RELEASED; same atomic subtraction/pointer/audit. NOT_STARTED text, elapsed time, empty output or HTTP failure alone is insufficient. First implementation has no adapter proof; it cannot invent this evidence.                                                                                            |
| UNCERTAIN          | Explicit currently authorized reconciliation with matching operation/claim and trusted final evidence                                                               | SETTLED or RELEASED under the same accounting rules; no second egress. In this explicit transaction alone, remove this sole open operation's UNCERTAIN reason after proving final cost/no charge and valid counters; retain every other hold and add OVERRUN if needed. No background/time-based unfreeze. |
| RESERVED           | Quote expires or author/source becomes ineligible                                                                                                                   | No dispatch; remain held until an explicit authorized unsent cancellation. No expiry release/retry.                                                                                                                                                                                                        |
| SETTLED / RELEASED | Identical terminal evidence ID, digest, kind, amount and usage                                                                                                      | Return existing result; no write/counter/audit duplicate. Conflicting evidence or any other transition refuses.                                                                                                                                                                                            |

No terminal FAILED state silently charges zero. Definitely aborted admission is
REFUSED without an operation; provider failure after a claim is UNCERTAIN unless
trusted final cost/unsent proof resolves it. A pre-dispatch claim freezes the
opportunity for another invocation, not remote execution itself. Claim expiry never
authorizes takeover. Stale owner/expected-version results refuse ordinary mutation;
late evidence may be submitted only through explicit reconciliation. Only a matching
claim owner can perform normal settlement. Another current verified ACTIVE ADMIN
may reconcile historical usage through this internal service with independently
verified evidence, audited as performer distinct from original actor; there is no
new HTTP reconciliation endpoint, caller evidence flag or service-account bypass.

Reconciliation may resolve an operation even when its original author is demoted/
deleted, its source is unavailable, dispatch is disabled, or its old quote expired:
these must not make incurred liabilities impossible to account for. The current
performer and final evidence must still qualify. Preserve the historical quote;
expiry never reprices an incurred charge. UNKNOWN pricing/evidence retains held.
OVERRUN/PRICE_UNKNOWN/ACCOUNTING_INVALID/OPERATOR_HOLD cannot be removed by this
reconciliation method; restoring such a profile needs separately approved operator
maintenance, not an uncontracted clear-freeze switch. Ordinary successful settlement
does not clear an unrelated hold.

Successful claim is necessary but not sufficient for dispatch. A future coordinator
must also have separately approved live spending, a real allowlisted adapter/model,
current server profile and quote, all F053 privacy/full-prompt/context controls,
F054 domain/source authority, qualified real storage/index/auth/audit behavior and
fresh authorization immediately before egress. G1 ALLOW, O1 success or a stored
claim is never a reusable API/provider capability. O1 gets one invocation with the
captured bounds; no fallback/retry. Local timeout does not prove remote cancellation
or no billing. A demotion/deletion/config change after the last check can race
network egress; neither User fencing nor a MongoDB transaction eliminates that gap.
Uncertain claim commit forbids egress, even if a later read finds the claim.

### G2 internal operation/API contracts

No HTTP route, browser capability, router/config registration or live adapter is
part of G2. Proposed internal service signatures are:

```text
reserve(authority, {operationId, technologyId, source, instructions, inputJson,
                   requestBounds}) -> RECORDED | REFUSED | OUTCOME_UNKNOWN
readOperation(authority, {operationId}) -> RECORDED | UNRESOLVED | REFUSED
cancelUnsent(authority, {operationId, expectedVersion}) -> RECORDED | REFUSED | OUTCOME_UNKNOWN
claimDispatch(authority, {operationId, expectedVersion}, trustedContext)
  -> RECORDED | REFUSED | OUTCOME_UNKNOWN
settle(authority, {operationId, expectedVersion, claimId, ownerId}, trustedEvidence)
  -> RECORDED | REFUSED | OUTCOME_UNKNOWN
markUncertain(authority, {operationId, expectedVersion, claimId, ownerId})
  -> RECORDED | REFUSED | OUTCOME_UNKNOWN
reconcile(authority, {originalActorId, operationId, expectedVersion}, trustedEvidence)
  -> RECORDED | REFUSED | OUTCOME_UNKNOWN
```

`authority` reuses current AuthContext + bounded verify/signal and an existing
1–128 ASCII requestId (`[A-Za-z0-9_-]`), never a posted actor or bearer token copy.
`trustedContext`/`trustedEvidence` come from server-owned resolvers/adapter verification,
not parsed browser JSON. Original actor is implicit except explicit internal
reconciliation; regular reads are actor-bound. `expectedVersion` is positive safe
integer. No process-local prepared handle crosses an API boundary.

The server coordinator allocates claimId/ownerId once; `trustedContext` is exactly
`{claimId,ownerId,request}` where request is the existing bounded O1 request.
Recompute its request digest/bounds, source and quote/profile checks before the
claim; no caller's claim identity or context is accepted from HTTP. The coordinator
already holds those IDs when RECORDED is returned; it must not dispatch after
OUTCOME_UNKNOWN. Normal settlement/uncertainty requires exact claim/owner, original
actor and expected version; another Admin uses only explicit reconciliation.

Injected server-only dependencies are `resolveIntent(authority, command, tx)`,
`resolveQuote(validatedIntent, control, serverTime)` and
`verifyEvidence(operation, receiptId, kind)`. Each receives the bounded work signal/
remaining deadline; asynchronous completion after closure is discarded. Intent
resolution returns only matching Technology/source/request digest/bounds from
authoritative records; quote resolution returns the exact quote allowlist above;
evidence verification returns the exact terminalEvidence allowlist. They must never
authenticate by accepting fields unchanged from a request. No production resolver
is registered/defaulted in G2; absent resolvers refuse. G2.2 unit doubles explicitly
simulate these trust boundaries. F054 domain authority and an actual adapter/evidence
source remain missing before real use, not supplied by an interface or fake.

RECORDED allowlist: `{kind:'RECORDED', operation:{operationId,technologyId,state,
version,periodKey,reservationPaise,heldPaise,actualPaise,warning80Percent,
requiresReconciliation,admittedAt,updatedAt}}`; amounts decimal strings, actual
nullable, Dates ISO UTC. No source/request/quote fingerprints, claim owner, actor
IDs, session/key, internal price records or raw provider content. The server's
dispatch coordinator uses validated internal records separately; this DTO grants
no invocation permission. Require operation/audit/counter linkage before returning
a successful recorded result. An ordinary read never fences/writes or clears held.

Read all linked projections in one bounded primary snapshot session so mixed
versions do not create a false RECORDED result; current-account/session checks
still apply. Close the read-only session in finally. Missing/malformed linkage or
read/cleanup uncertainty returns UNRESOLVED (or a sanitized authorization refusal),
never proof that the earlier mutation aborted. A read-only cleanup failure is not
new evidence that a financial mutation occurred.

For this read DTO, requiresReconciliation is true for DISPATCH_CLAIMED/UNCERTAIN
or any shared freeze. Treat an unobserved claim outcome as uncertain without
requiring a successful uncertainty write. warning80Percent uses trusted current
month settled+held plus prior open liability, checked with bigint; it is not the
old admission's cached warning and it never grants a new reservation. A future UI
must label that current exposure separately from the operation's original period.

REFUSED: `{kind:'REFUSED',code,message:'AI usage operation cannot proceed'}`.
Exact codes: `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `SOURCE_UNAVAILABLE`,
`CONTROL_UNAVAILABLE`, `QUOTE_MISMATCH`, `QUOTE_EXPIRED`, `USAGE_FROZEN`,
`CONCURRENCY_LIMIT`, `RATE_LIMIT`, `BUDGET_EXCEEDED`, `OPERATION_CONFLICT`,
`STATE_CONFLICT`, `RETRY_LATER`. Unknown dependency/internal failures map to
CONTROL_UNAVAILABLE before mutation; no raw issue paths, driver/provider causes,
credentials, private content or arbitrary exception messages.

OUTCOME_UNKNOWN: `{kind:'OUTCOME_UNKNOWN',code:'OUTCOME_UNKNOWN',
message:'Outcome is uncertain; reconcile without replay',operationId}`.
UNRESOLVED read: `{kind:'UNRESOLVED',operationId}` when no validated complete result
is established. Neither permits automatic reserve/claim/provider replay or a new
key for the same uncertain intent. Read absence is not a negative commit receipt.
An authenticated actor/key lookup is the only ordinary recovery path; resolving a
missing/ambiguous record needs positive abort/commit evidence under explicit
operator reconciliation, not a guessed delay or absence scan. Raw errors are never
used as proof of no charge. Future HTTP wrapping must separately define statuses,
limits and no-store; G2 does not silently implement a new API_DESIGN contract.

### G2 accounting, audit, time and retention

Every transition transaction fences the current performer, CASes control+operation,
updates the affected period, and appends exactly one audit event; reservation adds
the unique operation/minute marker. Settlement replaces held with actual once;
release subtracts only held. Uncertainty keeps held unchanged. Duplicate final
evidence is read-only; partial counter/audit writes must roll back. Overflow or
invalid accounting leaves the liability open and refuses; no balance repair.

Extend existing audit category `CONTENT_MANAGEMENT`, resource `AI_USAGE_OPERATION`,
actions exactly `AI_USAGE_RESERVED`, `AI_USAGE_DISPATCH_CLAIMED`,
`AI_USAGE_UNCERTAIN`, `AI_USAGE_SETTLED`, `AI_USAGE_RELEASED`. Use independent
server ObjectId `_id`, `resourceId=operation._id`, authenticated performer `actorId`,
existing bounded requestId and server createdAt. Metadata allowlist:
`{operationId,originalActorId,usageVersion,purpose,environment,periodKey,
policyVersion,profileVersion,pricingVersion,providerAlias,modelAlias,
reservedPaise,heldPaise,actualPaise,inputTokens,outputTokens,safeCode,evidenceId,
freezeReasons}`.
All keys present; nullable fields explicit. Reference/amount/count bounds match
the operation contract; aliases/versions copied only from validated server quote.
No quote/request/content digest, raw brief/output, evidence blob, URL, token,
secret or private source text. The partial unique resource/version index prevents
duplicate transition audit; op.lastAuditId must reference the exact matching event.
Earlier events remain append-only. Direct alteration/deletion of ledger/audit
records is not a reconciliation operation.

Month = Asia/Kolkata UTC+05:30 calendar month over G1's supported range; UTC minute
uses integer division by 60000, never local locale or rolling-window heuristics.
Immutable accounting attribution is the admission month: late verified settlement
updates that original period, never moves/deletes its held liability. Earlier
open liabilities freeze all new admissions across rollover. A completed old-month
reservation does not carry an unused allowance into the new month.

**Admission-month attribution is a proposed internal ledger rule, not a claim about
a provider's invoice/FX/tax month.** The owner must approve its relationship to
actual billing before live use. If final cost/attribution is uncertain, retain held
and the global freeze. No automatic cross-period cost transfer. A local execution
budget/quote expiry cannot bound late remote charges or guarantee calendar-month
invoice totals; live dispatch must refuse without an approved conservative rule.

Retention duration/access/erasure/backups are UNDECIDED and must be approved before
real persistent use. No TTL, garbage collector or new indefinite-retention policy.
Until that policy exists, G2 must not be enabled against real application data.
Unresolved operations, their periods, keys/minute markers, quote references and
audit cannot be deleted merely by elapsed time, month rollover or author deletion.
Any later retention design must preserve obligations/idempotency before erasure.
Raw provider prompt/output retention remains off in F053; private generated content
retention is a separate F054 decision. Provider retention/training/region and lawful
privacy/access choices are still unapproved. No customer-data use permission follows.

### G2 failure and concurrency acceptance scenarios

| Scenario                                                                          | Required outcome                                                                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two actors race for shared open slot, including either side of a month boundary   | At most one committed reservation; other aborts/refuses. No double counter/audit.                                                                                    |
| Same actor, different keys in same fixed minute, first operation already released | Unique minute marker still refuses second admission. Next minute explicitly reevaluates trusted time/usage.                                                          |
| Same key, same intent races or reappears next month                               | One operation/admission/audit; protected read returns original recorded state. Different intent conflicts, never requotes/replaces old binding.                      |
| Demotion/suspension/deletion races admission/transition                           | User-version write conflicts or eligibility refuses; ordering may allow a transition committed before authority loss. No claim of cancelling earlier external work.  |
| Failure before any commit attempt, confirmed abort                                | No partial op/counter/audit; REFUSED/RETRY_LATER, no dispatch.                                                                                                       |
| Unknown reservation commit, audit failure, abort/endSession failure               | No replay; OUTCOME_UNKNOWN or known rollback classification as warranted. Read reconciliation validates complete linkage; absence remains UNRESOLVED.                |
| Crash after RESERVED commit but before claim                                      | Liability remains, only explicit known-unsent cancellation; no automatic dispatcher/retry.                                                                           |
| Crash/timeout after claim commit, before or after possible egress                 | Claimed/open is conservatively uncertain even if no provider request was observed. No owner takeover, expiry release or second invocation.                           |
| Stale worker, duplicate settlement, conflicting receipts                          | Version/claim/receipt checks reject stale/conflicting effects; identical terminal receipt returns state without duplicate counters/audit.                            |
| Output invalid/refused/truncated with known bill; usage null/unknown              | Domain failure does not erase verified cost; settle only trusted final cost. Otherwise retain full liability/freeze. O1 success with token metadata is insufficient. |
| Actual exceeds reservation/cap or pricing changes                                 | Record verified cost once and freeze; cannot undo bill. Old pricing assumptions remain immutable, new admission/claim refuses mismatch.                              |
| Midnight/month boundary or clock regression during admission                      | Abort/refuse, no callback retry, no resetting old counters/liabilities.                                                                                              |
| Missing/altered indexes, invalid stored enum/Long/counter/audit/pointer           | Fail closed; no coercion, auto-index, data repair or permissive result.                                                                                              |

### G2 exact proposed implementation inventory and completion criteria

No path below is approved for implementation by this preparation task. Proposed
combined G2 inventory is **15 paths**; no G1/O1, auth policy, config/env, app/router,
public API/UI, dependencies or runtime-support file changes:

CREATE:

1. `apps/api/src/modules/ai/ai-usage-ledger.schema.ts`
2. `apps/api/src/modules/ai/ai-usage-ledger.model.ts`
3. `apps/api/src/modules/ai/ai-usage-ledger.dto.ts`
4. `apps/api/src/modules/ai/ai-usage-ledger.transitions.ts`
5. `apps/api/tests/ai-usage-ledger.test.ts`
6. `apps/api/src/modules/ai/ai-usage-ledger.repository.ts`
7. `apps/api/src/modules/ai/ai-usage-ledger.service.ts`
8. `apps/api/tests/ai-usage-ledger-persistence.test.ts`
9. `apps/api/tests/ai-usage-ledger.integration.ts`

MODIFY:

10. `apps/api/src/modules/audit/audit.model.ts`
11. `apps/api/tests/auth-audit.test.ts`
12. `AGENTS.md`
13. `docs/features/F053-ai-security-usage-controls.md`
14. `docs/DATABASE_DESIGN.md`
15. `docs/DEVELOPMENT_ROADMAP.md`

**Smallest next checkpoint G2.1:** items1–5 and12–15 only, nine paths. Strict
record/quote/command validation, money/fingerprint vectors, private DTOs, pure
transition proposals and disconnected models/index declarations. No persistence
consumer, audit-model edit, registration at startup, provider call or writer.
Estimate60–90min, hard90 including checks/review. It is a necessary local foundation,
not a reservation engine or another generic authority framework. Approval must
explicitly accept the proposed attribution, evidence and storage semantics; no
provider/model/key selection is needed for inert synthetic tests.

**Then G2.2:** items6–11 plus12–15, ten paths, after a separate approval and stable
G2.1 source. Internal repository/service implementing these operations with injected
trusted resolvers and no live adapter; no HTTP/UI/config activation. Estimate two
bounded60–90min sessions, hard90 each, mocked transactions and prepared real DB
assertions only. Full G2 source work estimate3–4.5hours; actual real qualification
and policy/operational decisions are additional. Neither checkpoint starts here.

G2.1 offline acceptance: exact-boundary/hostile-value/unknown-field validation,
BSON Long and bigint overflow/rounding, deterministic explicit-time/month/minute,
canonical vectors for all four hashes (including quote changes and exact byte
changes), immutable identities/quotes/claims, every state/action pair and refusal,
nonmutation, safe DTO/errors, inert imports and model registration without auto
connection/DDL. Test the operation-specific rules against the existing transition
table; G2.1 evaluates supplied facts only and performs no persistence or dispatch:

- Refuse new admission or dispatch when freeze, unresolved prior-period exposure,
  quote/month mismatch, unknown required evidence or any other defined guard
  prohibits that action. Do not turn an accounting exception into dispatch authority.
- Preserve only the table's explicitly permitted accounting, uncertainty,
  cancellation, settlement and reconciliation proposals, requiring their defined
  current-performer authority facts, exact state/version/claim binding, evidence
  and accounting preconditions. G2.1 validates supplied structural facts; later
  consumers must establish their authority transactionally.
- Prior-month UNCERTAIN with UNCERTAIN and OPERATOR_HOLD reasons plus trusted
  final-cost facts may propose SETTLED in its original period through explicit
  reconciliation; clear only the applicable UNCERTAIN reason and retain
  OPERATOR_HOLD, with no egress. The same frozen/prior-liability facts do not admit
  a new reservation or dispatch.
- RESERVED under an independent hold with positively known-unsent state and the
  defined authorized cancellation/reconciliation facts may propose RELEASED;
  retain the independent hold. Invalid or unknown final-cost/unsent evidence
  refuses settlement/release and preserves the full liability.
- DISPATCH_CLAIMED with unknown usage and the required uncertainty-transition
  facts may propose UNCERTAIN, retaining all held exposure and the active pointer.
  Unknown is never zero; elapsed time/month change alone never releases a hold.
- Closed records permit only the defined identical terminal-evidence read-only
  replay, including an old expected version for that nonmutating replay; no new
  transition, counter/audit write or dispatch. Conflicting terminal evidence and
  every unlisted state/action pair refuse.
- Validate the pointer as an ObjectId reference with matching scope/actor/key/open
  linkage; reject UUID substitution and mismatches. Clear only the matching open
  row's pointer; permit historical terminal reads while another valid row is active.

G2.2 offline acceptance: mocked transactional success/rollback/audit failure,
current actor fence and changed/revoked session, operation conflict/replay, source/
quote/profile mismatch, one-open/minute/CAS collision, boundary rollover,
commit/cleanup uncertainty, missing read linkage, duplicate/conflicting settlement,
stale owner and conservative cancellation. Verify adapter is never invoked by this
service and no retry/default live configuration exists. Mocks establish control
flow, not database isolation, uniqueness, physical indexes or billing truth.

For each implementation checkpoint: focused tests, full API/test TypeScript,
production API build/typecheck, targeted lint/formatting, encoding/privacy/scope/
diff checks and fresh independent source review with findings resolved. Record
actual branch/base/paths/checks/limitations and READY_FOR_REVIEW when its own
offline criteria pass; full F053 remains IN_PROGRESS. Delivery requires separate
owner approval; no automatic next checkpoint or full-feature completion.

Separately authorized real DB acceptance must inventory new G2 cases, isolated
replica-set target, owned fixtures/index provisioning, protected baseline, bounded
execution and authenticated RESULT/ACK/cleanup under existing project rules.
Required assertions: physical index definitions/types; actor/key/open/minute
uniqueness; concurrent admissions across periods; User demotion/deletion fence;
counter+audit rollback; exact replay; uncertain commit reconciliation; settlement
once/overrun; rollover liabilities; immutable evidence and ownership-safe cleanup.
Use synthetic amounts, no provider/network dispatch. All such cases are presently
NOT_RUN/unprepared, not part of the original9/P5/API6 groups. No new count/PASS is
invented by this contract. Live provider/transport/billing/privacy/real UI acceptance
is an additional, explicitly approved stage after these DB guarantees.

### G2 decisions, dependencies and proposed sequencing

No missing vendor/model prevents G2.1's synthetic structural implementation after
contract approval. Existing G1/O1 and F044 transaction/fence patterns are available
but not accepted proof of live safety. Genuine prerequisites for durable real use:

- Owner-approved retained accounting/audit/quote evidence, access/erasure/backups
  and reconciliation performer policy; no retention duration selected here.
- Trusted profile/quote/evidence resolver and activation procedure, plus physical
  collections/indexes and qualified auth/transaction/ownership/cleanup execution.
  None exists merely because this document specifies it.
- Before egress: provider/model/project, full-prompt token/context and all-in
  pricing/FX/tax/fee proof, admission-month versus invoice attribution, source/
  privacy/provider retention/training approval and separately bounded spending.
  The INR1000/80% design is not that approval or a production default.
- F054 outline/source/domain/admitted-output contract and explicit bootstrap order;
  full F047/F049/F052 prerequisites stay unmet. P0/O1/G1 do not authenticate AI
  origin or create stored editorial approval. No new dependency cycle is hidden:
  inert G2.1/2 can be tested with explicit synthetic resolvers; live reliance waits.

Optional later enhancements are multi-provider routing, dashboards, automated
reconciliation workers, queues and retention jobs. They are not G2 prerequisites
or part of its inventory. Unknown obligations are not solved by adding a supervisor.

**Proposed G2.1-only sequencing text — PROPOSED — PENDING OWNER APPROVAL:**

> Only after separate owner approval, permit F053 G2.1's exact nine-path offline
> schema/model/DTO/pure-transition/test and evidence inventory above ahead of full
> F047/F049/F052 acceptance. Require exact clean dev baseline, stable G1/O1,
> approved G2 structural semantics, no blocking dependency security finding,
> focused offline/static/privacy checks and fresh independent review. No G2.2
> repository/service/audit-model writer, endpoint/UI, configuration activation,
> provision/DDL, database/provider/network operation, spending or F054 progression
> is permitted. Existing User/transaction/index/privacy/ownership/RESULT-ACK/cleanup
> and acceptance requirements remain mandatory; supplied facts and pure transitions
> grant no authority. No runtime/pin repair, retry, fallback or new dependency.
> Full F053 stays IN_PROGRESS; preserve every BLOCKED acceptance, NOT_RUN group,
> permanent UNKNOWN and production NOT_VERIFIED. Every later implementation,
> persistence/live/Git operation requires separate owner approval. Default sequencing
> remains unchanged outside this named future checkpoint.

The same inactive proposal is recorded in AGENTS.md; neither location enacts it.
The exact next action is owner review/approval of this contract and **G2.1 only**,
or a concrete correction to a stated policy decision, before any implementation.

### G2 documentation verification and handoff

Preparation changes exactly four documents: this record, DATABASE_DESIGN's G2
appendix, the roadmap's G2 preparation section and AGENTS' inactive proposal.
No code/test/runtime/Git mutation, network/database/provider/credential action,
other-worktree edit or Desktop-context update. Executed preparation checks:

- New Markdown fragments: existing Prettier parser/config, formatting PASS.
- New local links/heading anchors, exact proposed paths/index names and inactive
  sequencing/status consistency: PASS.
- Strict UTF-8/no BOM/LF, whitespace, sensitive-pattern scan and source/privacy
  self-review: PASS; no credentials/private binding contents read.
- Historical document bytes preserved by insertion only: PASS. Exact four-path
  primary scope, empty index/unchanged HEAD and all708 tracked-file fingerprints
  checked; the other11 worktrees' pending-file bytes/heads/index/status preserved.
- `git diff --check`: PASS. No unchanged G1 tests/build/review or live suite rerun.

Evidence is retained outside the repository in the task's
`f053-g2-contract-20261106/documentation-checks.json` and before/after snapshots;
these are local preparation receipts, not a guarded execution manifest or live
qualification. Final handoff rechecks the exact applied document content/scope.
Review provenance is this session's document/source self-review, not a fresh
independent approval. G2 contract readiness is distinct from execution readiness.

Resolved draft gaps: preserve independent freeze reasons during reconciliation;
allow a currently eligible Admin to cancel a deleted author's known-unsent hold;
bind recovery to the original quote instead of requoting; distinguish one application
commit call from bounded driver wire handling. No unresolved blocking source/design
contradiction identified in this review; the explicitly listed owner/live decisions
remain prerequisites, not cleared findings or implementation evidence.

Preserve F042/F043 acceptance BLOCKED; F044/F045/F049/F052 incomplete acceptance;
original9/P5/API6 and all other unexecuted integration groups NOT_RUN; U01–U16
NOT_RUN with U16 blocked and permanent historical final Job-empty/retained-child
exit UNKNOWN. Retain combined225 mocked-identity evidence as combined, not a fresh
full-suite run or live proof. Production readiness remains NOT_VERIFIED.

## Admin completion reconciliation and G1 review — 2026-11-06

### G1 integrated development checkpoint — 2026-11-06

**Full F053: IN_PROGRESS, partial; acceptance incomplete. G1's bounded offline
implementation, review and required Git delivery checklist is complete.** This
does not mark full F053 APPROVED_COMPLETE, authorize spending or establish live
provider/persistence guarantees. No G2 implementation or exception is enacted.

- Reviewed source checkpoint: `b6f729f92eae0642126ba2a1673f81151bb35f12` (exact19 paths).
- Factual two-document branch follow-up: `9846b959722ad09898d4865a13bd0101bd37f6a3`.
- [PR #6](https://github.com/Ashish1303/DeepLearner/pull/6) merged normally into
  `dev` as `784f01e6030ae5919c950d713b1d999d517a5c69`.
- Verified merge parents: `ef2ec242a3f7d64b1f7b6f9c1f6fd7273457fcba` and
  `9846b959722ad09898d4865a13bd0101bd37f6a3`.
- Direct owner confirmation resolved the earlier automatic-approval blocker.
  Its refused command never launched; this later approved merge executed once.
  No force push, squash, rebase, amend, branch deletion or protection bypass.

GitHub's fresh requirements check allowed a normal merge, with no applicable
protection/rules or required review/check gate. Zero checks/pending aggregate was
not reported as CI PASS. Exact source/test content and existing review evidence
were retained. Source/control changes remain pure proposals only: strict bounded
facts, bigint money/cap/warning, explicit month/minute and uncertainty refusal;
no counter/reservation is mutated and no proposal grants dispatch permission.

Retained evidence:168 focused tests PASS, source/static checks and documentation
checks PASS; full API/test TypeScript and API build PASS on matching source.
Fresh separate source/documentation review had zero unresolved findings and no
independent test execution. No unchanged technical suite was rerun for delivery.
Current actual checks are Git/fingerprint/scope/staged-whitespace, note/follow-up
formatting/UTF-8/LF/privacy and existing read-only binding inspection. All pass.

Primary `E:\AI\DeepLearner` was clean and fast-forwarded from the reviewed base
to the merge; all five bound source hashes and existing binding/lineage matched,
with zero incoming pinned-source changes. No runtime restart/shutdown, binding
repair/recreation, application/database/provider action or permission change.
The source branch/worktree remains clean at the approved PR head; unrelated
worktrees, pending files, U16 and parked candidates are preserved.

This factual delivery record is the only post-merge work: two documentation paths
on clean `dev`, under the owner's standing working-branch/single-writer rule in
AGENTS.md. Its own commit identity is obtained from Git history/final delivery
report rather than a self-referential hash. No application edits or pending feature
implementation are introduced. Final handoff verifies clean indexes/trees and
local/tracking/fresh remote dev equality after the normal follow-up push.

Earlier review-stage and branch-blocker notes below are historical; this section
supersedes their uncommitted/open/unmerged state only. Actual feature acceptance
remains separate. Preserve F042/F043 acceptance BLOCKED, other incomplete scope,
original9/P5/API6 and other unexecuted integration/U groups NOT_RUN, F042 historical
UNKNOWN counters, U16 blocked/permanent final Job-empty/retained-exit UNKNOWN,
combined225 mocked-identity evidence (not a new suite), and production NOT_VERIFIED.

Exact next proposed development task: F053 G2 authoritative reservation/operation
**contract preparation only**, HIGH/VS Code,45–60min estimate/hard75. No approval
to start/implement/activate G2 is inferred. New VS Code development resumes on
`dev`; desktop uses isolated branch/worktree with reviewed integration. Provider/
model, trusted pricing/all-in assumptions, privacy/retention and bounded spending
still require separate decisions; INR1000/80% is testing policy, not spending
permission. No next task is started by this delivery.

### G1 branch delivery update — 2026-11-06

**Full F053: IN_PROGRESS, partial. G1: READY_FOR_REVIEW — offline only.**
Source checkpoint `b6f729f92eae0642126ba2a1673f81151bb35f12` contains the exact19 approved files, including the
owner working-branch/single-writer note. Normal branch push succeeded and
[PR #6](https://github.com/Ashish1303/DeepLearner/pull/6) is open, targeting `dev` at
`ef2ec242a3f7d64b1f7b6f9c1f6fd7273457fcba`. The source checkpoint is delivered to the feature branch,
**not merged into dev or complete**. No feature acceptance or spending authority.

Merge execution was stopped by automatic approval review before the command
process launched: it did not accept authorization in the attached owner request
as sufficient visible approval for this default-branch mutation. This is an
execution-approval blocker, not a failed test or a repository-protection bypass.
Direct owner confirmation of the final exact PR head is required before another
merge request. Primary dev remains unchanged at the base; synchronization is
dependent on the unperformed merge. No alternate merge/push route is permitted.

Retain exact-source168 focused PASS, targeted checks and prior full API/test
TypeScript/API build PASS; no technical suites rerun for this delivery. Fresh
separate source/documentation review has zero unresolved findings; reviewer did
not execute tests. New workflow-note formatting, UTF-8/LF, scope and staged
whitespace checks PASS. Zero/pending GitHub checks are not CI PASS. The current
five-pin read-only binding inspection passed with no affected source; binding
maintenance or runtime changes were neither needed nor performed.

The checkpoint branch/worktree is `product/f053-control-contract` /
`f053-contract-20261106T055602Z/worktree`; the19-path source commit was verified
clean with an empty index after commit/push. This small factual follow-up changes
only `docs/DEVELOPMENT_ROADMAP.md` and the canonical F053 record, with its own
commit/PR-head identity recorded in the final delivery report. It changes no
application, scope, acceptance or provider/database behavior. Prior uncommitted
and review-stage statements below retain their as-of meaning; this update
supersedes only their delivery state.

Exact next action: obtain direct approval for normal merge of the final exact
PR head, then recheck identities/requirements and synchronize clean primary dev
only if binding gates still pass. G2 authoritative reservation/operation contract
preparation remains proposed, not activated or implemented. Provider/model,
pricing, privacy, retention and bounded spending approvals remain outstanding;
INR1000/80% is testing policy only. Preserve F042/F043 acceptance BLOCKED, all
unexecuted groups, permanent historical UNKNOWN and production NOT_VERIFIED.

**Full-feature status: IN_PROGRESS. Acceptance: INCOMPLETE; no final owner acceptance.**
Checkpoint readiness/delivery is separate from the official feature status.

| Evidence field                                 | Current verified record                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intended user outcome / implemented capability | G1 returns strict supplied-facts reservation proposals/refusals with exact integer money, explicit month/minute, one-open/one-admission limits and retained unknown liabilities. It changes no counter and grants no provider-call permission. No user-facing budget/control workflow exists. |
| Checkpoint and delivery                        | G1 READY_FOR_REVIEW — offline only; passing fresh review, not delivered or complete. G1 is uncommitted/undelivered on product/f053-control-contract at ef2ec242a3f7d64b1f7b6f9c1f6fd7273457fcba. No G1 commit or PR exists.                                                                   |
| Remaining product work / verification debt     | Trusted configuration/pricing/usage/current authority, atomic reservations/open-operation/rate counters, actor operation idempotency, audit/reconciliation/settlement, privacy and real index/transaction evidence.                                                                           |
| Real dependencies                              | Explicit F052; stable O1 satisfies only technical offline boundary, not full F052/F047/F049 or live prerequisites.                                                                                                                                                                            |
| Exact next action                              | Owner reviews the G1 delivery boundary and proposed private-outline milestone; separately approve a G2 authoritative reservation/operation contract. G2 remains PROPOSED, not implemented or sequenced.                                                                                       |

This is a read-only source/history/evidence reconciliation, not new live QA or
feature acceptance. Delivery references below are established by local Git objects,
ancestor checks and retained delivery receipts; network access was prohibited, so
current GitHub/remote state and CI were not freshly queried. Zero/pending checks
are not CI PASS. Retain every dated earlier proposal/result as historical evidence.

Current review/documentation branch: `product/f053-control-contract`, base/HEAD
`ef2ec242a3f7d64b1f7b6f9c1f6fd7273457fcba`, isolated
`f053-contract-20261106T055602Z/worktree`. No new implementation was started.
See the [current roadmap review and completion plan](../DEVELOPMENT_ROADMAP.md#admin-completion-reconciliation-and-g1-review--2026-11-06)
for the combined pending inventory, evidence, milestone and owner decisions. The
earlier “current”/uncommitted/proposed wording below is an as-of record wherever
superseded by this section. No full feature is APPROVED_COMPLETE by this update.

### Fresh G1 review evidence and provenance

Verdict **PASS — offline G1 review**, no unresolved Critical/High/Medium/Low
findings. G1 stays READY_FOR_REVIEW and undelivered; passing review is not checkpoint
completion. This task executed the existing focused Node/tsx suite: **168 PASS,
0 FAIL, 0 skipped**; source ESLint and Prettier PASS. Exact commands:

```text
node --import tsx --test --test-reporter=tap apps/api/tests/ai-usage-control.test.ts
node node_modules/eslint/bin/eslint.js apps/api/src/modules/ai/ai-usage-control.schema.ts apps/api/src/modules/ai/ai-usage-control.policy.ts apps/api/tests/ai-usage-control.test.ts --max-warnings=0
node node_modules/prettier/bin/prettier.cjs --check apps/api/src/modules/ai/ai-usage-control.schema.ts apps/api/src/modules/ai/ai-usage-control.policy.ts apps/api/tests/ai-usage-control.test.ts
```

Scoped documentation formatting (15 inserted fragments),27 relative links/anchors,
consistency, UTF-8/LF, privacy, diff and exact-scope checks PASS. Historical bodies,
the PRD and all application/test content remain unchanged. Other worktrees and
parked candidates match the pre-review snapshot. No whole historical-document
format PASS or fresh remote/CI verification is claimed.

Retained full API/test TypeScript and production API build PASS are from the G1
implementation task, **not rerun in this review**. Their final logs, recorded exit
results and source fingerprints are retained in `f053-g1-20261106/completion.json`
and the existing final check logs. The entire9-path initial inventory matched that
record before documentation edits. This task changes no application/test/config/
dependency content. No broad rerun is needed for these factual documentation edits.

Fresh separate agent `f053_g1_final_fresh_review` read all source/tests, the complete
contract and applicable instructions, reporting0/0/0/0 findings. It executed no
tests; this is independent agent source review in the same assistant session, not
a separately authenticated human or submitted GitHub review. Historical G1-R1
remains closed: primitive guards on all20 leaves prevent Zod error formatting
from inspecting hostile objects/proxies. No code correction was needed here.

Budget approval was verified from the accessible original owner documentation
approval, attachment `5093818c-061a-49af-a7ee-3907f4c2970b/Pasted text.txt`:
₹1,000 shared testing cap at line137,80% warning143 and no paid calls148.
PRD61 specifies Asia/Kolkata; the original prompt does not itself name the
timezone. The separately approved G1 contract covers explicit-time offline
evaluation. No production spending default, price/FX/tax/fee policy or call
authorization follows. Policy amounts/usage in tests are synthetic supplied facts.

F052/F054 preservation was verified against both retained pre-G1 snapshots and
G1-end hashes before this task: respectively334023487EC59AFD47D6CB24024D56A4C85B3B9253595C9159EF7FA185BCE1EC
andF7A549217038B65D30D27855B6461056B5010D3B4EBD4332533776C65DD6ED51.
This review now prepends authorized factual canonical-record updates to those
documents; their earlier pending text is retained verbatim, not described as still
byte-identical after this additional authorized work.

Pure policy evaluation establishes no authority/freshness of actor/time/quote/
usage facts, atomic reservation, real rate/concurrency limit, audit/idempotency,
usage settlement, provider cancellation/billing or dispatch permission. All
database/provider/browser/live-spending groups remain unexecuted in this task.

## Current G1 implementation authority — 2026-11-06

**F053 IN_PROGRESS — partial G1, offline only.** The owner approved the exact
seven-path schema/policy/test/evidence checkpoint, strict validation, pure
reservation proposals, one shared open operation, one admission per actor per
fixed UTC minute, explicit time and G1-only offline sequencing. This supersedes
the earlier proposed/no-implementation authority only for G1. It grants no
spending, persistent admission, provider/model selection, live call or F054 work.
F052 O1 is delivered and offline-reviewed including R5-01; full F052 remains
incomplete. Historical planning/evidence below retain their original scope.

Development location: `product/f053-control-contract`, base
`ef2ec242a3f7d64b1f7b6f9c1f6fd7273457fcba`, isolated worktree
`f053-contract-20261106T055602Z/worktree`. Four initial pending documents were
fingerprinted; F052/F054 are preserved byte-for-byte. No Git delivery is authorized.

Sources: [PRD sections 60–62](../PRD.md), especially the existing Development AI
Controls; [roadmap](../DEVELOPMENT_ROADMAP.md); [architecture](../SYSTEM_ARCHITECTURE.md);
[database design](../DATABASE_DESIGN.md); [F052](F052-ai-provider-abstraction.md);
[F054 direction](F054-ai-concept-draft-generation.md); [F044](F044-admin-learning-path-management.md);
[F049 P0](F049-content-status-workflow.md); [instructions](../../AGENTS.md).

### Existing requirements versus new recommendations

Already approved: backend-only Admin AI, bounded jobs/inputs/outputs, model
restriction, privacy, audit, atomic reservation/settlement, cancellation without
unsafe retry, and **one shared INR 1,000 monthly testing cap** for Curriculum and
Interview Studios. Calendar month is **Asia/Kolkata**; warn at **80% of settled plus
held exposure**, hard-refuse unaffordable/unbounded work, retain unknown liability
over rollover and freeze after price uncertainty/overrun. These amounts/timezone
come from PRD61; they are not new currency or budget choices in this task.

Now approved for offline G1: its pure calculation boundary, single shared open
operation and one admitted attempt per actor per fixed UTC minute for the first
outline pilot. These conservative limits reduce exposure while there is
no qualified live adapter. No daily quota, exchange rate, tax allowance, vendor,
model, retention period or production cap is silently selected. No live profile is
enabled by omission. Currency conversion and all-in billing assumptions must be
explicitly approved before any real quote/dispatch.

### Budget provenance and spending boundary

The retained owner input **“OWNER APPROVAL: PRD REDESIGN & PERSISTENT LOCAL
DEVELOPMENT DOCUMENTATION”**, expected dev `45bce961`, section 5, explicitly
specifies the shared monthly ₹1,000 testing budget (line137), 80% warning (line143),
hard stop/no automatic increases (144–145) and **no paid calls** (148). Retained
attachment identity: `5093818c-061a-49af-a7ee-3907f4c2970b/Pasted text.txt`.
PRD61 records the Asia/Kolkata calendar month in the owner-approved documentation
reconciliation; the current G1 owner approval explicitly approves this contract's
offline month calculation. The original input does not itself name a timezone.
These sources authorize product/policy design, not provider spending or production
defaults. G1 has no environment configuration/default live profile. Test quote and
usage amounts are synthetic; actual pricing/FX/tax/fee and live authority remain
unapproved. Neither an ALLOW nor this historical budget is dispatch permission.

## Full F053 control boundary before any live request

Every row below is mandatory for future live dispatch. G1 implements only the
local proposal calculation specified later; it does not claim the other rows.

| Control                 | Exact required behavior and existing boundary to reuse                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current account         | Existing access JWT and current session must be valid. JWT role and current stored role must both be ADMIN; stored account must exist, be verified and ACTIVE. Deleted, disabled, suspended, unverified, demoted or revoked/expired sessions refuse. Reuse F042's five-second bounded authorization read and current auth context; no caller-supplied approval flag.                                                                                                                                                                                                                                                                                                                           |
| Mutation-time authority | A future reservation/dispatch-claim transaction must reread current eligibility and fence the stored User version using the existing F043/F044 pattern. A request guard alone is insufficient. Recheck authority immediately before network dispatch; observed loss refuses/cancels without replay. A local database transaction cannot atomically include external HTTP: later demotion can race an already-dispatched call. Do not claim a zero-length authorization/egress race window. Historical accounting survives later actor demotion/deletion; every new protected operation requires fresh authority.                                                                               |
| Purpose and domain      | First permitted purpose is CURRICULUM_OUTLINE only. F054 must validate actual admitted brief/Technology/source binding, eligibility and exact domain payload before dispatch. No Student direct AI, arbitrary prompt endpoint, client-selected model, tools, browsing, code execution or extra generation purpose. One invocation per operation, zero automatic retries/fallbacks.                                                                                                                                                                                                                                                                                                             |
| Bounds                  | Inherit F052: instructions 1–8,192 UTF-8 bytes, input JSON object text 2–65,536 bytes, output ceiling 2–65,536 bytes, output token ceiling 1–4,096, explicit local execution budget 1–10,000 ms. No implicit budget/default widening. The future adapter must bound actual outbound encoding and response streaming, count all provider-visible prompt/template text, and reject an unbounded input-token estimate/context requirement before dispatch. No input-token ceiling or tokenizer is guessed without a selected approved model.                                                                                                                                                      |
| Configuration           | Follow existing strict server configuration/error patterns in apps/api/src/config/env.ts; no configuration code changes in G1. A future disabled-by-default profile must select exact allowlisted provider/model aliases, immutable configuration/price versions, separate DEV/PROD project/key references and supported token/context limits. Internal aliases are 1–64 lowercase ASCII letters/digits/dot/underscore/hyphen, beginning with a letter/digit; they are server identifiers, not arbitrary URLs or provider-native model selectors from clients. Actual aliases/endpoints/models remain undecided. Missing/unknown config, credentials, pricing or bounds refuses live dispatch. |
| Secrets                 | Resolve secrets only in the backend through the existing approved secret-management direction. No key in UI, request DTO, database, logs, URL, command line or returned metadata; no new env variable, key read, SDK or secret store is implemented here. No runtime fallback to another provider/project/model.                                                                                                                                                                                                                                                                                                                                                                               |
| Privacy                 | Send only domain-allowlisted necessary curriculum brief fields and separately permitted public sources. Never send Student personal data, answers, account/session data, tokens, credentials, private configuration or internal audit/error content. Canonical private brief text may be necessary domain input but is not a public source. A caller's privacy boolean or a valid JSON envelope is not privacy verification. Do not log raw prompts, input/output bodies, provider errors, headers, URLs or private digests.                                                                                                                                                                   |
| Rate and concurrency    | Proposed initial policy: at most one shared open operation and one new admission per actor per server-derived 60-second window. Count all relevant studios against the shared limit/cap; an unimplemented Interview UI is not permission to exclude its liabilities. A future durable claim must enforce both limits atomically across all workers/restarts; an in-memory counter is not that guarantee. Any additional daily quota must be owner-configured before a live profile requiring it is enabled.                                                                                                                                                                                    |
| Reservation             | Before egress, atomically require settled-current-month + held-current-month + unresolved-prior-period exposure + new worst-case all-in charge <= 100,000 paise. Use the shared Asia/Kolkata period, immutable approved quote/price/FX/tax/fee assumptions and exact request/model/limits. No floating-point money, cap override or unbounded reservation. Proposed concurrency/rate/operation identity and reservation audit must commit together.                                                                                                                                                                                                                                            |
| Uncertainty             | Local timeout/abort, null usage, crash after dispatch claim, transport/commit ambiguity or a provider ignoring cancellation is not proof of no work/charge. Keep the liability and open-operation constraint; freeze new admission until explicit reconciliation. Period rollover never deletes/releases outstanding liability. No automatic retry, replay or reservation expiry based only on elapsed time.                                                                                                                                                                                                                                                                                   |
| Settlement              | Replace held exposure with verified actual all-in cost only through a separately approved, append-only, idempotent settlement transaction. Provider-reported token counts are untrusted metadata, not sufficient billing proof by themselves. Unknown stays held/uncertain, never zero. Any overrun or price/config uncertainty freezes generation; it cannot undo an already incurred external charge. Releasing a reservation needs positive no-dispatch/no-charge evidence, not merely a failure code or NOT_STARTED label without matching persisted attempt proof.                                                                                                                        |
| Audit/accounting        | Existing auditSchema has no AI-usage action/resource branches; do not reuse unrelated AUTH or editorial actions. Before persistence, a separately approved G2 contract must add minimal reservation/dispatch/uncertainty/settlement/release events and atomic accounting records. Minimum metadata: actor/operation/request identities, purpose, environment, period, server provider/model aliases, versioned price assumptions, reserved/settled amounts, nullable usage, safe status/code and timestamp. No raw sensitive content. Audit failure blocks a new claim.                                                                                                                        |
| Output                  | The adapter/executor's JSON remains untrusted; F054 must validate domain shape/source/quality and admit a new private candidate. Generation cannot assign APPROVED/PUBLISHED or invoke F049/F050/F051 decisions. Malformed/refused/truncated/over-limit output cannot become admitted content.                                                                                                                                                                                                                                                                                                                                                                                                 |

Before live reservation, a server-owned quote must also bind environment, exact
provider/model/configuration and price versions, full request limits and an
effective-from/expiry interval in epoch milliseconds. Revalidate it at reservation
and immediately before egress; an expired or mismatched quote refuses dispatch.
G1's synthetic quote has only the arithmetic fields below and cannot satisfy this
live quote contract. A quote's expiry does not terminate remote work or erase cost.

### What local control cannot promise

F052 provides technical envelope validation, bounded local observation, cooperative
abort, suppression of late results, safe outcomes and no replay. It cannot preempt
synchronous code, terminate remote work, prevent billing, prove live transport
memory bounds or authenticate reported usage. Application admission can enforce a
conservative approved charge envelope; it cannot guarantee a provider invoice if
the provider/price assumptions are false. If no defensible worst-case all-in bound
exists, refuse dispatch. Alerts complement but never replace application controls.

The required future transaction must combine current-Admin fencing, actor-bound
operation uniqueness/payload consistency, shared period/concurrency/rate CAS,
reservation and append-only audit. Use explicit bounded transaction/commit handling,
majority durability and no unsafe callback replay as in F043/F044. A unique index
declaration is not physical enforcement. Snapshot Technology eligibility does not
prevent every concurrent archival/deletion race; domain behavior must retain the
documented F044 limitation. External dispatch happens outside the transaction.

### Future operation and recovery boundary, not a job framework

Use existing canonical UUID-v4 operation IDs bound to the authenticated actor.
Before real persistence, G2 must define a digest binding the exact domain request,
purpose, period, selected configuration/quote and limits; G1 does not invent the
missing F054 domain canonicalization. A repeated key with different payload refuses;
an identical key returns its recorded state, never re-dispatches automatically.

Minimum future accounting distinctions are reserved, dispatch claimed, uncertain,
settled and released. These are accounting facts, not editorial/content states.
Persist the dispatch claim before egress. A crash between that claim and actual
egress remains uncertain until positively reconciled; there is no claim of atomic
exactly-once remote work. Unknown MongoDB commit results require read reconciliation,
not another admission/dispatch. No generic queue, scheduler, job supervisor,
provider registry or automatic recovery worker is needed for this first gate.

Retention is **UNDECIDED**, not unlimited by default: raw prompts/output are not
retained by F053 by default; future domain output references require their own
approved private-content retention. Accounting/audit retention, erasure, access,
backups and provider-side retention/training policies need explicit owner decisions
before the corresponding live/persistent feature. No TTL, erasure job, provider
zero-retention claim or customer-content training permission is introduced here.

## Approved checkpoint G1 — pure admission proposal

**IMPLEMENTED — OFFLINE ONLY.** G1 is the smallest reusable internal numeric
control foundation. It accepts inert supplied facts and returns a reservation
proposal or a safe refusal. It has no authenticated admission, dispatch capability,
repository, model, transaction, audit writer, endpoint, UI, config/secret loader or
provider call. It does not establish the authority/freshness of input facts.

### Exact input contract

All fields below are required; root/nested objects are strict own enumerable inert
data. Reject proxies, getters/setters, symbols, unknown/operator keys, custom
prototypes, coercion, NaN/infinity/fractions and implicit defaults. Capture supplied
values once; never validate one accessor result and use another. Follow the local
F049/F052 strict-data patterns without exporting a new shared validation framework.

| Field         | Type/bound                                                                                                | Reason                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schemaVersion | Literal 1                                                                                                 | One explicit offline contract version.                                                                                                                                                                                                                                                                                                                                                                           |
| budgetScope   | Literal SHARED_AI_TESTING                                                                                 | Binds the existing shared testing cap; no production spending policy is inferred. A future trusted coordinator must verify the actual project/environment against this scope.                                                                                                                                                                                                                                    |
| actorId       | 24 lowercase hexadecimal characters                                                                       | Existing internal User identity convention; not proof of existence/Admin authority.                                                                                                                                                                                                                                                                                                                              |
| operationId   | Canonical lowercase UUID-v4, 36 characters                                                                | Existing actor-bound operation convention; not a writer/idempotency capability.                                                                                                                                                                                                                                                                                                                                  |
| purpose       | Literal CURRICULUM_OUTLINE                                                                                | Restricts the first proposed gate; no future generation selector.                                                                                                                                                                                                                                                                                                                                                |
| periodKey     | YYYY-MM; year 1970–9999, month 01–12                                                                      | Must match the Asia/Kolkata month derived from the explicit evaluatedAtMs argument. G1 cannot authenticate that time or stored snapshot freshness.                                                                                                                                                                                                                                                               |
| quote         | Exact object {id, periodKey, worstCasePaise}                                                              | id is canonical UUID-v4; periodKey has the same grammar and must equal root periodKey; worstCasePaise is a positive safe integer. Synthetic amounts are test fixtures, not selected prices. Zero/unknown/negative quotes refuse rather than imply free work.                                                                                                                                                     |
| requestBounds | Exact object {instructionBytes, inputJsonBytes, maxOutputBytes, maxOutputTokens, budgetMs}                | Integers with respective ranges 1–8192, 2–65536, 2–65536, 1–4096, 1–10000, inherited from O1. These supplied measurements are not proof of actual private payload/token/context bounds; future trusted coordinator must capture and measure the exact outgoing request.                                                                                                                                          |
| usage         | Exact object {settledPaise, reservedPaise, unresolvedPriorPaise, openOperations, actorWindowUsed, frozen} | Five counters are nonnegative safe integers; frozen is a boolean. Current-month settled, current-month held and older held liabilities must be disjoint. openOperations includes reserved/claimed/uncertain shared work; actorWindowUsed is the supplied count for the evaluated fixed UTC minute; G1 cannot authenticate its window binding. Unknown/incomplete snapshots are invalid, never defaulted to zero. |

There are no array/free-text/source/body/configuration/secret fields in G1 input.
G1 does not select a model, compute real prices/FX, read a clock/database, verify a
JWT/brief or access runtime configuration. The future trusted coordinator, not an
Admin request DTO, constructs these facts and validates their coherence in storage.

### Exact calculation and outcome

The implemented function is `proposeAiUsageReservation(input, evaluatedAtMs)`.
The request object above remains exact; time is a separate required primitive
argument, never a hidden clock/default or caller accessor. `aiUsageTimeAt(epochMs)`
returns only `{periodKey, actorWindowKey}`. Accept integer Unix milliseconds
0–253402280199999 inclusive: this covers 1970-01 through 9999-12 in Asia/Kolkata.
Derive month by the fixed UTC+05:30 offset over this supported range and fixed UTC
minute by floor(epochMs/60000), independently of locale/environment. Invalid time
is INVALID_INPUT; root/quote/evaluation-month disagreement is QUOTE_MISMATCH.

This reconciles the original draft's caller-only time derivation with the owner's
explicit-time implementation requirement. It adds no clock, fresh-window storage,
counter reset or automatic liability release. The future trusted coordinator must
derive time from its trusted clock and bind the supplied settled/held/prior and
actor counter snapshots to this period and actorWindowKey atomically. G1's shape
does not carry a counter-window identity and cannot detect a falsely relabelled
or stale count. Moving the timestamp alone never clears a nonzero counter.

Offline shared-testing policy constants: cap100,000 paise; maximum shared open
operations1; maximum actor admissions per fixed UTC minute1. Internal bigint sums
prevent unsafe-number overflow. The 80% warning threshold uses integer ceiling
`(capPaise * 80n + 99n) / 100n`, exactly80,000 here. Quote/counter inputs must already
be integer paise; reject fractional/unknown amounts rather than down-rounding,
truncating or clamping. Future trusted pricing must conservatively round the full
all-in worst-case charge upward to paise before this boundary. G1 performs no
provider-rate, token-price, currency/FX/tax/fee conversion and invents no rounding
rate or billing assumption. No bigint is serialized in the result.

Let exposureBefore = settledPaise + reservedPaise + unresolvedPriorPaise, and
exposureAfter = exposureBefore + quote.worstCasePaise. Deterministic refusal order:

1. INVALID_INPUT: any structural/identity/type/range violation.
2. QUOTE_MISMATCH: otherwise valid root/quote/evaluation month keys differ.
3. USAGE_FROZEN: frozen=true, unresolvedPriorPaise>0, or exposureBefore>100000.
   This conservative first gate blocks rollover with prior uncertainty; it never
   fabricates discharge of an old liability or rewrites a historical period.
4. CONCURRENCY_LIMIT: openOperations>=1, including current-period uncertainty.
5. RATE_LIMIT: actorWindowUsed>=1.
6. BUDGET_EXCEEDED: exposureAfter>100000. Exactly100000 is affordable, not100001.

Failure is exactly {ok:false,error:{code,message}}, with one code above and fixed
message 'AI request cannot be admitted'. No payload, validation path, stack/cause,
provider detail, quote content or arbitrary error message escapes.

Success is exactly {ok:true,proposal:{budgetScope,actorId,operationId,periodKey,quoteId,
reservationPaise,exposureAfterPaise,warning80Percent}}. reservationPaise is the
captured positive quote; warning80Percent is exposureAfter>=80000. Since success
is within100000, returned amounts are exact safe numbers. Return a detached
allowlist; never mutate inputs. An affordable proposal is **not** a reservation,
verified authorization, budget lock, audit receipt or permission to call a provider.
Repeated evaluation is deterministic, not persistent idempotency/concurrency proof.

The future control read model must warn when current shared settled-plus-held
exposure reaches80,000 paise even if admission is refused or frozen. G1's proposal
warning is not a notification service/UI and does not replace that future duty.

### Two approaches and dependency order

| Approach        | Scope/value                                                                                                                                                                                                                                                     | Cost and decision                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — recommended | G1 feature-local strict schema, pure admission arithmetic and tests. Establishes exact cap/warning/refusal semantics before a durable gate is built; no provider/model, persistence or credential dependency.                                                   | 60–90 minutes including offline checks/source review; hard stop90. Useful enabling capability, no user-visible generation yet.                                                                                                         |
| B — larger      | Full F053 durable transaction/operation coordinator, authorization fence, accounting/audit and operational inspection/reconciliation presentation. Enables enforceable multi-worker live admission after actual adapter/billing/privacy/domain contracts exist. | Multiple checkpoints, provisionally3–5 engineering days plus separately qualified live verification, not one bounded task. Needs new storage/index/audit contracts and genuine owner billing/retention decisions; not authorized here. |

Dependency order: delivered F052 O1 and existing F049 P0 patterns -> separately
approved G1 offline policy -> separately contracted G2 authoritative reservation/
accounting/audit and control configuration -> explicit model/price/privacy/retention
choices plus F054 domain/adapter contract -> qualified live verification -> separately
approved bounded generation. Full F047/F049/F052 are not declared complete. Domain
output cannot approve/publish itself. Existing unresolved F042/F043 and applicable
F044 transaction/index acceptance gates block real reliance, not this pure numeric
implementation. The documented functional AI-origin bootstrap issue is not silently
resolved; G1 stores/generates no content and creates no new dependency cycle.

### Exact approved G1 inventory — seven paths

CREATE:

- apps/api/src/modules/ai/ai-usage-control.schema.ts
- apps/api/src/modules/ai/ai-usage-control.policy.ts
- apps/api/tests/ai-usage-control.test.ts

MODIFY under the current G1 implementation approval:

- AGENTS.md — enact only the approved G1 offline exception.
- docs/PRD.md — G1 authority/evidence, preserving the existing spending decision.
- docs/DEVELOPMENT_ROADMAP.md — partial G1 progress/evidence, not acceptance.
- docs/features/F053-ai-security-usage-controls.md — this contract and actual evidence.

Do not modify O1, existing auth/audit/models/configuration, DATABASE_DESIGN, public
APIs, UI, dependencies, jobs or runtime bindings. Future G2 needs its own exact
inventory/schema/index/audit contract and approval; none is inferred from G1.

### Measurable offline acceptance and deferred checks

- Valid inert input produces only the exact detached proposal; repeated inputs
  have identical results and leave all input objects/values unchanged.
- Test all exact bounds, missing/unknown/operator fields, non-inert descriptors/
  proxies/symbols/coercible values, wrong identities/purpose/period and mismatches.
- Test exposure79999/80000 warning edge and99999/100000/100001 admission edge,
  sum precision beyond Number.MAX_SAFE_INTEGER, zero/negative/unknown quotes,
  each refusal and stable priority when multiple refusal facts apply.
- Test current held usage, positive prior liabilities/rollover refusal, frozen
  overrun, one-open-operation and per-actor-window refusal. No mock result is
  labelled atomic budget/concurrency/current-account authorization evidence.
- Reject getters without evaluation, including changing financial/limit values;
  no mutable input reference, raw error/canary, stack/cause or private DTO leak.
- Prove imports/evaluation have no clock, environment/config, file/network/DB/
  provider/child effects. No production registration or app import added.
- Focused unit tests, full API/test TypeScript, API build/typecheck, targeted
  lint/format, UTF-8/LF/privacy/scope/diff and fresh independent source review.
  Resolve findings; no unrelated passing suites or runtime/bootstrap/browser run.
- Deferred: real atomic shared-counter/operation uniqueness, current User fence,
  audit/rollback, physical indexes, period rollover under concurrency, uncertain
  commit/dispatch, true usage settlement, live transport/cancellation and billing.
  Their future qualified database/provider evidence requires separate approval;
  neither G1 mocks nor O1 PASS can clear them.

### Enacted G1-only sequencing exception — 2026-11-06

The owner explicitly approved G1 implementation and its bounded offline exception.
AGENTS.md enacts only the seven-path inventory above ahead of full F052 and unmet
F047/full F049 acceptance. Require the stable delivered O1 boundary, exact
baseline/scope, no blocking dependency security finding, meaningful offline/static/
privacy checks and fresh independent source review with findings resolved. Supplied
facts are not authority. No real reservation/admission, persistence/audit/model/
index/config change, provider/secret/network/database operation, endpoint/UI,
generic framework, runtime/ownership bypass, generation/editorial/publication or
next slice is authorized. Default sequencing and all security/verification/
acceptance gates remain. F053 is partial IN_PROGRESS only; every later
implementation/live/Git operation needs separate approval. This grants no G2.

### Genuine remaining decisions and next checkpoint

No unresolved product decision prevents the offline G1 policy. The owner-approved
concurrency/rate limits are evaluated only against supplied facts, not enforced
against a database or external provider. The budget provenance above is design
authority only, never spending authority.

Before a live/persistent successor: approve the actual provider/model/endpoint and
server project; defensible full-prompt token/context limits; immutable worst-case
all-in price/FX/tax/fee policy and settlement trust evidence; any required daily
quota; metadata/content/provider retention/erasure/access/backup policy; and the
transaction/index/audit/reconciliation contract. Until then live admission refuses.
No numeric price, FX rate, retention duration or provider zero-retention promise is
chosen here. Optional later sophistication—multi-provider routing, job queues,
automatic schedulers, advanced cost analytics and dashboards—is not required for G1.

## G1 execution evidence — 2026-11-06

**G1 READY_FOR_REVIEW — offline only.** Executed on the isolated
`product/f053-control-contract` worktree at unchanged base `ef2ec242`:

| Actual check                                                                                   | Result and scope                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused `node --import tsx --test --test-reporter=tap apps/api/tests/ai-usage-control.test.ts` | **168 PASS, 0 FAIL, 0 skipped**, final run after the review fix. Synthetic supplied facts only; no durable reservation or authentication proof.                                                                                                                                 |
| Full API/test TypeScript                                                                       | PASS: `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false`. Final corrected source checked.                                                                                                                        |
| Production API build/typecheck                                                                 | PASS: `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --incremental false --pretty false`. Ignored local build output only; no app startup.                                                                                                                     |
| Targeted ESLint and source Prettier                                                            | PASS for all three new TypeScript files; zero warnings.                                                                                                                                                                                                                         |
| Scoped Markdown, UTF-8/LF, whitespace, exact scope and privacy/source review                   | PASS. F052/F054 initial drafts preserved byte-for-byte; no startup/provider registration or secret/config access. Other worktrees and parked candidates preserved.                                                                                                              |
| Independent source/security review                                                             | Fresh separate agent `f053_g1_independent_review`, same assistant session; read-only review, no independently executed tests or separately authenticated human reviewer identity. One Medium G1-R1 resolved and re-reviewed; zero unresolved Critical/High/Medium/Low findings. |

G1-R1: malformed objects/proxies in scalar positions could reach Zod's error
formatter and execute inspection hooks. The fix checks all20 captured scalar
leaves for their required primitive type before parsing. New regressions cover
every leaf with hostile proxy traps, constructor getters and revoked proxies;
both exported validation/policy entry points refuse without caller-code execution.

Execution limitations: the default sandbox's TypeScript loader failed before test
execution (`uv_os_get_passwd ENOMEM`). The supported repository-owner command
context ran the offline checks; no Windows elevation/permission change occurred.
An initial test clock guard intercepted the loader itself and was removed from
import setup; ambient-clock refusal is tested during policy evaluation instead.
The final168-case run is current evidence, not a sum of repeated executions.

The earlier documentation-only preparation and retained F052159-test evidence are
historical, not G1 executions. No database/provider/bootstrap/browser suite, live
reservation, authentication, transaction, physical index, concurrency, audit,
actual usage settlement or dispatch has been executed or established. A proposal
is not authenticated admission. Prepared counts and historical UNKNOWN are not PASS.

Next durable checkpoint recommendation (not approved): contract G2's smallest
transaction-only authoritative shared reservation/actor-operation boundary, reusing
current-Admin version fencing, append-only audit and explicit uncertain-commit read
reconciliation. Specify exact ledger/index/idempotency/trusted configuration and
snapshot binding before implementation. No provider dispatch or settlement worker
is included by default. Real database guarantees require separately qualified
integration execution; provider/model/pricing/privacy/retention approval is still
required before eventual live egress. No automatic next-slice progression.

F053 remains partial IN_PROGRESS; F052 incomplete; F054 live generation unauthorized.
F042/F043 acceptance BLOCKED; F044/F045/F049 incomplete; all unexecuted integration
groups and U01–U16 stay NOT_RUN. Historical combined225 mocked-browser evidence
remains distinct from the16 U cases and from real API/database acceptance. U16
remains BLOCKED; historical final Job-empty/retained-child exit UNKNOWN is permanent.
Production readiness NOT_VERIFIED. No runtime/binding/credential/dependency change
or Git write is authorized/performed by this checkpoint.

## Historical planning snapshot — 2026-11-05

The following planning text is retained as-of its original date; its statement that
O1 was only proposed is superseded by the current delivery/contract notes above.

### Planned record — 2026-11-05

**Status: NOT_STARTED. Planning record, not an implementation-ready contract.**
This record consolidates existing approved product direction; it grants no
implementation, sequencing exception, runtime, Git or acceptance authority.
Sources: [PRD](../PRD.md), [roadmap](../DEVELOPMENT_ROADMAP.md) (original ticket and
owner-approved design reconciliation), [instructions](../../AGENTS.md).

### Approved outcome and known scope

Admin generation remains bounded, private, cancellable and within approved shared spending controls, with uncertain exposure visible.

Approved direction: source/privacy controls, job bounds, resumability/cancellation, concurrent reservations/settlements, shared INR 1,000 monthly cap, 80% warning and hard stop. These are product requirements, not implemented accounting or newly chosen budgets.

### Exclusions

No live dispatch/provider choice, cap override, automatic retry/fallback, new generic job framework or fabricated billing/zero-charge guarantees.

### Known dependencies

Explicit ticket dependency: F052. Functional prerequisites: approved provider metadata/uncertainty contracts, current authority, minimized domain payloads and exact reservation/settlement/privacy policy before live egress.

### Current implementation and evidence

No implemented usage/privacy/dispatch gate. F052 O1 remains a proposed fake-only interface; local timeout/cancellation cannot establish remote cancellation or cost.

### Unresolved contract decisions and next step

After an approved F052 boundary, define the smallest enforceable live-admission/reservation contract, with exact tests and uncertainty handling. No paid call is permitted by this planned record.
Before implementation, finalize measurable acceptance criteria, exact paths,
authorization/privacy boundaries and meaningful offline/live verification scope.
This is a recommendation for contract work, not new detailed schema/API authority.
Preserve F042/F043 acceptance BLOCKED, F044/F045 incomplete acceptance, all
unexecuted verification groups and historical UNKNOWN; production NOT_VERIFIED.
