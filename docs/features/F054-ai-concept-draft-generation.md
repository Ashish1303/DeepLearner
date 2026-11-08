# F054 — AI Concept Draft Generation

## F054 O0 outline-validator — 2026-11-07

**Full F054: IN_PROGRESS, partial. O0: READY_FOR_REVIEW — offline only.
Acceptance: INCOMPLETE. Production: NOT_VERIFIED.** This current section supersedes
older NOT_STARTED/dependency snapshots below only for the exact O0 scope. The
owner explicitly approved the consolidated O0 proposal, seven paths, numeric
bounds, hierarchy, O0-only exception and a local implementation commit after
passing checks and separate source review. No push, live generation or acceptance.

### Outcome and authority

PRD13/44/105 establish AI-led bounded Technology/brief → Path/Module/Topic/Concept
outlines with separate exact-outline review. F044 supplies immutable brief
structure/integrity; F052 O1 returns untrusted JSON. Delivered F053 G1/G2.1/G2.2 are
offline foundations, not live dispatch authority. O0 fills only the missing pure
domain-validation boundary. The detailed shape and caps below are newly approved
O0 decisions, not original PRD limits or authenticated source policy.

Current users gain no UI or Generate action. A future consumer can distinguish a
structurally valid, supplied-brief-bound outline from refused data. It still must
resolve stored source/eligibility, authenticate current authority and AI origin,
apply privacy/usage controls, admit/persist/audit and independently review content.
O0 neither measures factual/semantic quality, semantic duplication or coverage nor permits
editorial approval, catalogue mutation or publication.

### Exact input, hierarchy and binding

`validateCurriculumOutline(inputJson: unknown, expectedBrief: unknown)` accepts only
a primitive JSON string and an independently supplied F044 brief record. Validate
the latter with existing F044 structural/digest rules, unchanged. This does not
prove the supplied brief is stored, eligible, authorized or authentic.

| Object       | Required exact fields                                           |
| ------------ | --------------------------------------------------------------- |
| Outline      | `schemaVersion:1`, `technologyId`, `source`, `title`, `modules` |
| Source       | `id`, `revision:1`, `digest`                                    |
| Module       | `title`, `objectives`, `topics`                                 |
| Topic        | `title`, `concepts`                                             |
| Concept stub | `title`                                                         |

Technology and source id are canonical lowercase24-hex strings; source digest is
lowercase64-hex SHA-256. Compare Technology with brief.technologyId and source
with brief._id/revision/contentDigest exactly. No ObjectId/string coercion, new
IDs, catalogue parent lookup, clocks, identity generation or outline revision/
digest machinery. Array order is the proposed learning order, never stored order.
The source brief retains goals, prerequisites, audience, depth and applicable
runtime/Technology version; output does not redundantly echo those metadata.

Unknown/operator/private fields and wrong types refuse at every level. JSON is
parsed with standard JSON.parse semantics, then exact fields are validated; O0
does not claim duplicate JSON-member-name detection. Duplicate sibling titles and
objectives have separate explicit rules below. JSON null/scalars/arrays, missing
fields, unsupported versions and malformed/binding-mismatched records refuse.

### Bounds, Unicode and duplicate rules

| Bound                 | Exact limit and rationale                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Raw input             | At most65536 UTF-8 bytes including JSON whitespace; reuses F052/C1's64KiB envelope to bound one request, not one complete curriculum. |
| Titles at every level | 1–120 UTF-16 code units, reusing C1's actual Zod string bound.                                                                        |
| Modules               | 1–8 per outline, keeping one reviewable bounded sequence.                                                                             |
| Topics                | 1–8 per Module, at most32 overall; caps both branching and aggregate work.                                                            |
| Concepts              | 1–12 per Topic, at most128 overall; title stubs only, no lessons/modes.                                                               |
| Module objectives     | 1–10 distinct strings, each1–240 UTF-16 code units, reusing C1 text/duplicate rules with a smaller per-Module array.                  |

Text must already be trimmed, nonempty, well-formed Unicode and single-line.
Reuse C1's exact control/line-separator/surrogate rules; do not silently normalize,
case-fold or truncate. Reject exact case-sensitive duplicate Module titles within
the outline, Topic titles within a Module and Concept titles within a Topic.
Identical names in different branches and case variants are not semantic duplicate
proof and remain review concerns. Objectives are distinct within each Module.
No arbitrary required/optional learning policy or editorial hierarchy is added.

### Result, safety and deferred guarantees

Return a fresh recursively frozen `{ok:true,outline}` projection or the fixed
read-only `{ok:false,code:'INVALID_OUTLINE',message:'Curriculum outline is invalid'}`.
The result carries no AI provenance, approved/admitted/dispatch flag, actor,
provider/job/operation identity or internal validation details. Catch and sanitize
parse/schema/brief failures without logging input. Inputs are never modified.

Imports/evaluation perform no I/O, provider call, database registration/connection,
runtime startup or hidden environment/time dependency. No production wiring is
added. Existing F044/F052/F053 interfaces remain unchanged. All fixtures are
SYNTHETIC / NOT_SAVED / NOT_AI_GENERATED. Structural binding is not source admission;
no result authorizes a live call, writer, review decision or publication.

### Exact seven-path implementation and local-delivery inventory

CREATE:

- `apps/api/src/modules/ai/curriculum-outline.schema.ts`
- `apps/api/src/modules/ai/curriculum-outline.validator.ts`
- `apps/api/tests/curriculum-outline.test.ts`

MODIFY:

- `AGENTS.md` — only the named O0 offline exception.
- `docs/PRD.md` — O0 scope and current user-capability boundary.
- `docs/DEVELOPMENT_ROADMAP.md` — only the new O0 section.
- `docs/features/F054-ai-concept-draft-generation.md` — this contract/evidence.

Work directly on existing primary dev from
`145927dc395399c7c4f2f629dd96f749db25b676`. Preserve three existing pending readiness
documents and every other worktree. Include only O0 roadmap additions in the local
commit; its earlier readiness diff, DATABASE_DESIGN and F053 remain uncommitted.
No new dependency, branch, push, runtime/binding/pin or recovery work.

### Measurable offline acceptance and verification plan

- Valid minimum/per-parent/aggregate maxima, one-over/empty/refused cases.
- Text lengths, Unicode/surrogates/controls, exact UTF-8 byte boundary and multibyte
  aggregate overflow; no normalization or byte/UTF-16 confusion.
- Unknown/operator/private fields, wrong types, identities/versions and exact
  Technology/source/digest binding; invalid/accessor/proxy brief refusal.
- Exact scoped duplicates, preserved order, deterministic results, no input
  mutation, recursively frozen projection and content-free errors.
- Inert import checks with network/child-process boundaries blocked; no runtime
  registration, calls or side effects represented as live qualification.
- Focused tests, full API/test TypeScript, API production build, targeted lint/
  formatting/encoding/privacy/scope/diff, then separate final source review.
- Record author-executed checks separately from reviewer inspection; resolve
  findings and rerun affected checks before READY_FOR_REVIEW/local commit.

Estimate60–75 active minutes after approval; overall task hard limit90 active
minutes, excluding owner approval wait. Actual executed evidence follows; nothing
is inferred from old checks. This is partial F054, not full acceptance.

### Executed O0 verification and source review

Author-executed focused suite: **53/53 PASS**, no skipped/cancelled cases, using
`node --import tsx --test apps/api/tests/curriculum-outline.test.ts` through the
supported command-specific noninteractive route. The initial default-sandbox
launch failed before assertions in tsx's `os.userInfo` lookup with
`uv_os_get_passwd ENOMEM`; that launch is not a test PASS. No interactive terminal
or environment investigation was used to work around it.

Full API/test TypeScript PASS via
`node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false`.
API production build/typecheck PASS via the same compiler against
`apps/api/tsconfig.json --incremental false --pretty false`. Three-source ESLint
with zero warnings, all seven paths' Prettier check, strict UTF-8/no BOM/LF/final
newline and `git diff --check` PASS. O0 documentation blocks alone were formatted;
pre-existing documentation text and the two unrelated pending files are preserved.

Fresh separate subagent `/root/f054_o0_source_review` in this assistant session
inspected the exact source/tests/contracts and inherited F044 rules: **APPROVE,
zero unresolved Critical/High/Medium/Low findings**. It performed source/document
and read-only Git inspection, not independent test execution or an authenticated
human/GitHub review. Author test evidence is distinct from that inspection.

No application runtime, database, provider, browser, authentication, admission,
physical-index, transaction/concurrency or publication check ran. O0 adds no new
integration/browser cases. All existing unexecuted groups and historical UNKNOWN
remain unchanged. Delivery still requires exact staged-hunk isolation, staged
whitespace/privacy/scope checks and the owner's already-authorized local commit;
no push. External review/static receipts are retained with the final handoff.

### Sequencing and next boundary

Only the named O0 exception in AGENTS is active. It permits this inert inventory
ahead of incomplete F047/full F049/F052/F053 acceptance, not provider execution,
orchestration, persistence, endpoints/UI, editorial work, F055–F057 or publication.
Keep existing F042/F043 acceptance BLOCKED, F044/F045/full F049 incomplete, every
unexecuted integration/browser group NOT_RUN, historical UNKNOWN and production
NOT_VERIFIED. Next product work requires a separately approved producer/admission
contract; do not connect this validator to live generation on O0 authority alone.

## Admin completion reconciliation and G1 review — 2026-11-06

**Full-feature status: NOT_STARTED. Acceptance: INCOMPLETE; no final owner acceptance.**
Checkpoint readiness/delivery is separate from the official feature status.

| Evidence field                                 | Current verified record                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intended user outcome / implemented capability | No actual outline/lesson generation, domain output validator, authenticated generated-content admission or Generate action exists. F044 private Save stores Admin-authored brief/proposal inputs, not AI output.              |
| Checkpoint and delivery                        | Not started; no generation/bootstrap exception enacted. Planning record in PR #4 plus pre-G1 pending dependency clarification; no implementation checkpoint or generation delivery.                                           |
| Remaining product work / verification debt     | Bounded outline domain/output/source contract, immutable AI-origin mapping/admission, controlled producer, explicit generation/recovery UI, Read/Example drafting after exact outline approval. F055–F057 retain other modes. |
| Real dependencies                              | No explicit ticket field; functional F044 authority, F052/F053, actual parent/source/AI-origin admission and F049/F050 decisions; bootstrap order requires separate named approval.                                           |
| Exact next action                              | After controls/domain dependency decisions, approve only a strict outline-only contract/offline dry run; do not relabel synthetic output as real generation.                                                                  |

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

## Current dependency clarification — 2026-11-06

F052 O1 is delivered and offline-reviewed, but supplies only an injected technical
port/executor, no production adapter, domain outline schema or admitted output.
[F053's contract](F053-ai-security-usage-controls.md) is proposed, implementation
NOT_STARTED; its G1 proposal is not a live usage/privacy/budget gate. F054 remains
NOT_STARTED and live generation is not authorized. Original planned requirements
below are preserved; older no-provider-module wording describes that earlier
snapshot, not absence of the now-delivered offline O1 source. F047/full F049, real
source/authority/index/transaction verification and domain review gates remain open.

## Planned record — 2026-11-05

**Status: NOT_STARTED. Planning record, not an implementation-ready contract.**
This record consolidates existing approved product direction; it grants no
implementation, sequencing exception, runtime, Git or acceptance authority.
Sources: [PRD](../PRD.md), [roadmap](../DEVELOPMENT_ROADMAP.md) (original ticket and
owner-approved design reconciliation), [instructions](../../AGENTS.md).

## Approved outcome and known scope

Admin can later generate a bounded curriculum outline from an eligible admitted brief, then selected Read/Example drafts after exact outline approval.

Keep the original title/ID. Approved reconciliation includes bounded curriculum outlines and Read/Example drafting after exact outline approval. Other five-mode features remain F055–F057; no implementation approval follows this direction.

## Exclusions

No paid/live calls, mock output represented as generated content, direct approval/publication, full five-mode implementation or generic ingestion framework.

## Known dependencies

No explicit dependency field in the original ticket. Functional prerequisites: F044 brief/source authority, F052 provider abstraction, F053 privacy/usage admission, strict domain output/AI-origin admission/parent mapping, and F049/F050 exact-revision review.

## Current implementation and evidence

F044 manual brief/private Save exists, with live guarantees unverified; preview assets and P0 do not implement generation. No provider module, generated curriculum or feature acceptance is established.

## Unresolved contract decisions and next step

Define the bounded outline domain/output/admission contract only after the approved provider/control and editorial dependency path is clear; do not jump here for an AI demo.
Before implementation, finalize measurable acceptance criteria, exact paths,
authorization/privacy boundaries and meaningful offline/live verification scope.
This is a recommendation for contract work, not new detailed schema/API authority.
Preserve F042/F043 acceptance BLOCKED, F044/F045 incomplete acceptance, all
unexecuted verification groups and historical UNKNOWN; production NOT_VERIFIED.

## Proposed F054 producer and initial outline admission — 2026-11-07

**Contract READY_FOR_REVIEW — documentation only. PROPOSED — PENDING OWNER APPROVAL. P1 NOT_STARTED.
Full F054 IN_PROGRESS; acceptance incomplete; production NOT_VERIFIED.**
O0 is already locally committed as 4cbee018bda7c775ad712ed0ac724ca016678dcc
(parent145927dc395399c7c4f2f629dd96f749db25b676), no push. Its preceding precommit
delivery wording is historical. Retain its53/53 tests/build/static and separate
source-review evidence; none is rerun here. This preparation changes no authority.

### One review unit and the missing producer

One initial immutable private outline, with its entire ordered Module → Topic →
Concept hierarchy, is the review unit. One actor-bound intent permits at most one
generation invocation and its proposed content admission. Generation, admission/
persistence, editorial decisions and publication are distinct boundaries. No
catalogue or separate private child record is materialized by this slice.

F044 supplies admitted brief/proposal structures and Save/fencing/audit patterns.
F052 supplies a bounded technical port/executor, not an authenticated completion
receipt. F053's offline service reserves/claims/accounts, but a committed claim
does not prove which provider ran or which bytes it returned. Its real resolver/
dispatch composition remains absent. The missing authority is a separately
approved server coordinator correlating an exclusively claimed invocation with
the exact F053 operation/request and exact return bytes. Arbitrary JSON, a
provider origin flag, synthetic fixture or process-local handle cannot supply
that authority. No generic ingestion or second accounting framework is proposed.

### Requested intent versus authoritative resolution

Proposed internal intent has exactly schemaVersion:1, technologyId,
brief:{id,revision:1,digest}, proposal:{id,proposalId,revision:1,digest}, operationId.
Use existing lowercase24-hex IDs,64-hex SHA-256 digests and lowercase UUID-v4
operationId. Proposal id identifies the F044 revision record; proposalId its
family; digest its existing definitionDigest. Initial scope consumes the actual
initial proposal revision1 and immutable brief revision1, never a silently
selected latest revision. All fields are requested references, not authority.

An authoritative resolver must independently load/validate the exact stored
brief, proposal, their admission/audit linkage and Technology relationship.
Do not infer equality from F044's initial allocation conventions. Actor comes
from existing current-account authorization, never the body. The new generation
operationId is distinct from the old F044 Save key; reuse it unchanged across
F053 and F054. Resolve F053's separate operation document _id as ledgerOperationId;
do not confuse that ObjectId with the actor-bound UUID operationId or claimId.

Server request construction uses a separately approved immutable template/version
and exact resolved brief. Proposed provider input allowlist is only C1 title,
objectives, audience, depth, runtime, technologyVersion and prerequisite
descriptions, in that field order. Even these fields need explicit privacy/egress
approval before real use. Do not send actor/email/session, database/source/
proposal/operation IDs, audits, secrets or extra material.

Proposed provider JSON body is exactly {title,modules}, using O0's nested content
shape. The coordinator rejects extra root identity/provenance fields; it does
not silently replace mismatched provider identities. The host constructs the O0
schemaVersion/Technology/source envelope from independently resolved records and
validates the assembled envelope with O0 unchanged. Both exact raw output and
assembled O0 JSON must fit65536 UTF-8 bytes; metadata overhead never increases
O0's ceiling or permits truncation. This binding adapter is not implemented now.

Use existing ledgerRequestDigest({instructions,inputJson}) for exact request bytes
and ledgerIntentFingerprint({actorId,command}) for F053 binding; do not replace
their canonicalization. Authoritative quote/template/profile/privacy/pricing/
spending versions and request bounds must agree before claim and before egress.
Existing limits remain instructions≤8192 bytes, input/output≤65536, output tokens
1–4096, local budget1–10000ms. Exact configured bounds/template are future trusted
inputs, not new defaults or spending permission. F052/F053 are not live dispatch
authority. No provider/model/price/token estimator is chosen by this contract.

Proposed F054 intentDigest is SHA-256 of UTF-8 compact JSON.stringify of exactly:

    ["F054_OUTLINE_INTENT",1,actorId,"SHARED_AI_TESTING",operationId,technologyId,
     [brief.id,1,brief.digest],
     [proposal.id,proposal.proposalId,1,proposal.digest],
     ledgerIntentFingerprint,templateVersion]

templateVersion is the existing quote.templateVersion UUID-v4, not quote.id.
This adds
F044 proposal binding, not a competing F053 operation identity.

### Initial candidate and exact canonical hashes

Proposed collection: curriculumOutlineCandidates. The exact revision fields are:

| Field                           | Proposed meaning                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| _id, outlineId                  | Distinct server-allocated canonical ObjectIds: revision-record and outline-family identity. Pure functions receive both; allocate neither. |
| schemaVersion, revision         | Both literal1. Initial revision only; no update/successor operation.                                                                       |
| origin                          | Literal AI_GENERATED, structurally checked but authenticated only by future authoritative producer admission; not editorial state.         |
| outline                         | Complete O0 projection, binding and hierarchy. Its text/Unicode/duplicate/count/byte limits stay unchanged.                                |
| proposal                        | Resolved F044 {id,proposalId,revision:1,digest}, not a public LearningPath reference.                                                      |
| createdBy, createdAt            | Original generation actor ObjectId and explicit server UTC Date; no copied name/email/role/session.                                        |
| producer                        | Exact immutable tuple below.                                                                                                               |
| contentDigest, definitionDigest | Canonical semantic-content and full revision-envelope SHA-256 bindings.                                                                    |

Producer is exactly {attemptId,ledgerOperationId,operationId,claimId,ownerId,
intentDigest,requestDigest,rawOutputDigest,completionDigest,templateVersion,
completedAt}. attemptId/ledgerOperationId are ObjectIds; operationId/claimId/
ownerId/templateVersion UUID-v4; digests64-hex; completedAt a UTC Date no later
than createdAt. ownerId is existing F053 claim ownership, not a new bearer token.
No duplicated quote/account/profile record or raw prompt is embedded.

For pure P1 validation and canonical JSON, all ObjectId references are lowercase
24-hex strings, not native BSON objects. UTC Dates serialize as canonical ISO
strings. This JSON representation is not a BSON storage-size claim; native
persistence mapping remains deferred.

All hash frames are compact JSON.stringify ordered arrays, UTF-8, no BOM/newline,
lowercase SHA-256. Validated strings are verbatim: no trim, Unicode normalization,
sorting, case folding or deduplication. Dates use canonical toISOString().
rawOutputDigest hashes exact successful F052 untrustedJson bytes, including
whitespace, before host envelope construction; it is not the semantic digest.
The same exact raw JSON must parse to the strict content-only body from which
the host constructs the candidate outline. Compare that constructed outline
with the candidate projection; independently valid hashes on unrelated output
and content do not establish this binding.

Define O as [outline.schemaVersion,outline.technologyId,
[outline.source.id,outline.source.revision,outline.source.digest],outline.title,
outline.modules.map(m=>[m.title,m.objectives,m.topics.map(t=>
[t.title,t.concepts.map(c=>c.title)])])].

- contentDigest hashes ["F054_OUTLINE_CONTENT",1,O].
- completionDigest hashes ["F054_OUTLINE_COMPLETION",1,attemptId,
  ledgerOperationId,createdBy,operationId,claimId,ownerId,intentDigest,
  requestDigest,rawOutputDigest,templateVersion,completedAtISO].
- definitionDigest hashes ["F054_OUTLINE_REVISION",1,_id,outlineId,1,
  "AI_GENERATED",contentDigest,
  [proposal.id,proposal.proposalId,1,proposal.digest],
  createdBy,createdAtISO,completionDigest].

Recompute every digest, including intentDigest against expected request context;
a supplied matching string is not producer authority. Completion covers all its
immutable fields except itself; definition covers completion plus every remaining
record field. Mutable admission receipts/backlinks do not enter completionDigest,
avoiding a circular hash. Proposed canonical candidate-record limit:131072 UTF-8
bytes with Dates serialized as ISO, bounding one O0 envelope plus fixed metadata.
Measure compact JSON.stringify of the exact allowlisted candidate projection in
the table's field order (expanding paired fields left to right), producer fields
in their listed order, proposal fields id/proposalId/revision/digest, and O0 keys
in schema order. Arrays retain order. Neither input property insertion order nor
extra properties may change the canonical representation or bypass its cap.
This storage cap is a new decision requiring approval; provider/O0 limits do not grow.

### Single attempt and identity mapping

Propose one F054-owned curriculumOutlineAttempts record per scope/actor/operation.
It holds immutable actor/key/intent/proposal/source, F053 operation/claim/request/
template references and preallocated candidate/family/audit identities. A one-way
CAS invocation-claimed marker must commit before egress. Process loss afterward
does not authorize another provider call. Completion evidence and terminal
admission receipt are write-once under CAS. This is content-operation evidence,
not another ledger, job queue or supervisor. Exact native attempt schemas and
writer APIs need the later persistence contract; P1 implements no attempt model.

Only the approved coordinator observing the exact invocation can attest its
completion. Resolve its retained/persisted evidence independently of output.
The authority composition does not yet exist. P1 fixture claims remain
SYNTHETIC / NOT_SAVED / NOT_AI_GENERATED even if an origin field is AI_GENERATED.

F044 brief/source, proposal family/revision, private outline family/revision,
future child family/revision and public catalogue IDs are different semantic
identities. Never infer public learningPathId/moduleId from proposalId/outlineId.
Future children need explicit allocated IDs and lineage to
{outlineId,outlineRevisionId,revision,definitionDigest,nodeKind,path}, checked
against that exact immutable outline. A typed Module[m]/Topic[t]/Concept[c] path
locates a node within that revision; it is not the sole durable child identity.
Reordering/later revisions need explicit reviewed identity mappings, never
index/title-only matching or inherited approval. Allocation, reuse, materialization
and catalogue linkage remain deferred F045/F046/F047 contracts. No manual M1.

### Pure proposal and authoritative persistence

Proposed P1 result is frozen {kind:"ADMISSION_PROPOSED",candidate} or
{kind:"REFUSED",code,message:"Curriculum outline admission is unavailable"}.
Allowlisted codes: INVALID_INPUT, SOURCE_MISMATCH, AUTHORITY_UNAVAILABLE,
TECHNOLOGY_INELIGIBLE, PRODUCER_UNVERIFIED, OPERATION_CONFLICT, OUTPUT_INVALID.
It never returns ADMITTED/COMMITTED, changes records or authenticates facts.

Expected context must bind actor/operation/ledger/claim/owner/template/request/
intent/completion/source/proposal values plus explicitly supplied current-authority,
source-admission, parent-status, producer-verification and unused-attempt facts.
Unknown/missing facts refuse; supplied booleans are pure-policy inputs, not proof.
Reuse O0/F044/F053 primitives; no generic authority registry.

Future authoritative admission requires current verified ACTIVE ADMIN/session
verification and transaction-time User-version fencing. Content admission/recovery
is bound to the original actor/key; another Admin cannot repurpose it. Validate
stored brief/proposal/audits and exact authoritative operation/claim/request/
completion. Require unused matching attempt/allocated identities and an existing
DRAFT/PUBLISHED Technology at the transaction snapshot. Stale authorization,
missing/mismatched source or malformed/archived parent refuses.

Atomic successful boundary: insert one immutable candidate; CAS the exact attempt
to its single COMMITTED receipt referencing that candidate/revision/definitionDigest;
append CURRICULUM_OUTLINE_ADMITTED audit; perform the Admin fence in the same
bounded transaction. Audit has established actor/request/time fields and only
Technology/outline/attempt/operation IDs and revision1 metadata, no content.
An eligible terminal refusal can atomically record attempt REFUSED plus
CURRICULUM_OUTLINE_ADMISSION_REFUSED audit and an allowlisted code, no candidate.
Unauthorized callers create no content-operation effects. New action/native
schemas require later approval; P1 does not change the audit model.

Reuse existing bounded snapshot/majority-journaled transaction, authorization,
commit/abort/cleanup and no-replay patterns; no deadline increases. Candidate/audit/
receipt failure cannot leave partial committed success. Provider work cannot be
rolled back by database abort. F053 reservation/claim/settlement/reconciliation
remain separately owned transactions through its service, never direct content
writes to counters. Content commit is not verified cost, zero usage or release
evidence. Physical indexes, concurrency and transactions are not qualified here.

Snapshot race: a Technology archived/deleted after the transaction snapshot may
coexist with an admitted private outline commit. This does not prevent all parent
races. No cascade or publication follows. Retain historical candidate/audit/
accounting evidence. Later generation/admission rechecks parent eligibility.
Protected inspection may allow an existing archived parent; missing/mismatched/
corrupt parent refuses ordinary detail. Content-parent loss must not block F053
accounting reconciliation. Author demotion/deletion erases neither history nor
liabilities; every new protected action still needs current authority.

### Idempotency, cancellation and uncertainty

| Situation                                                      | Proposed behavior                                                                                                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same actor/key and identical intent                            | Read validated existing attempt/result; no second reservation/invocation/insert. Pre-invocation continuation requires its explicitly defined current-authority/CAS conditions.    |
| Changed source/proposal/request/bounds/template under same key | OPERATION_CONFLICT; never overwrite or silently start a new operation.                                                                                                            |
| Invocation claimed, output absent/timed out                    | UNRESOLVED; no proof of unsent/unbilled, no automatic generation replay. Keep F053 liabilities for verified accounting reconciliation.                                            |
| Invalid or different output for same invocation                | Refuse content admission; retain first qualified completion; no arbitrary JSON replacement, last-write-wins or new-key replay.                                                    |
| Cancellation/logout/demotion                                   | Suppress late consumption; no automatic call/write replay. Provider work/billing may continue; new admission requires fresh authority.                                            |
| Identical committed receipt found                              | Validate candidate/hash/audit/attempt linkage under current actor-bound recovery; return existing COMMITTED result without writing again.                                         |
| Unknown commit/abort/cleanup/read linkage                      | OUTCOME_UNKNOWN/UNRESOLVED, not assumed rollback or retry permission. Inspect exact actor/key/Technology/receipt/candidate/audit; absence alone is insufficient proof for replay. |

Raw-byte differences conflict even if semantic O0 content is equal. Candidate IDs/
time are allocated once by the authoritative attempt, never regenerated on replay.
Content recovery does not settle costs. F053's qualified cross-actor accounting
reconciliation is not cross-actor content admission. Lost output/provenance requires
separately approved operator reconciliation; no recovery endpoint is invented.

### Private inspection, review and retention

Proposed detail DTO exactly: id, outlineId, revision, origin, outline,
contentDigest, definitionDigest, createdAt. id is revision-record _id; timestamp
canonical ISO. Fresh projection excludes createdBy, producer/claim/owner/operation/
ledger/internal-proposal fields, prompts/raw output, credentials and internal
errors. O0's embedded private brief binding remains. No Student DTO/API change.
Future protected detail needs current Admin, required Technology binding, exact
allowlist, no-store, bounded cancellation/deadline and sanitized refusal. Ordinary
detail is current-Admin access, distinct from original-actor operation recovery.

F049/F050 later decisions reference exactly {id:candidate._id,revision:1,
digest:candidate.definitionDigest}, with authoritative origin/source/quality evidence.
One decision reviews the complete outline, not separate child approvals. Initial
admission stores no editorial state. F049's AI_GENERATED transition input is not
an authenticated submission. Edits/new generation need separately identified
immutable revisions; approval never transfers. Queue, stored decisions,
CHANGES_REQUIRED resubmission and publication remain separately owned.

Real persistence/egress still requires approved access, candidate/attempt/audit/
completion-evidence retention, erasure/backups and provider retention/training/
privacy terms. No duration, TTL, deletion job or infinite retention is selected.
Recommend only the accepted bounded outline plus fixed private linkage/hashes,
not raw prompt/response archives, subject to approved evidence-retention needs.
Hashes/IDs remain linkable private data; unresolved obligations must not disappear.
These decisions block live use, not synthetic pure P1 work.

### Smallest next offline checkpoint: proposed P1

**PROPOSED — PENDING OWNER APPROVAL; NOT_STARTED.** Implement a strict immutable
candidate/digest/private-DTO boundary and pure completion-to-admission proposal.
It may locally construct the host-bound O0 envelope from strict content-only JSON
and supplied brief, but invokes no provider or authority. No model/registration,
coordinator/attempt writer, repository, API/UI, new stateful infrastructure or
live generation is included. This is a concrete bridge from untrusted content to
a reviewable structural candidate, not actual admission.

Exact proposed eight paths:

CREATE:

- apps/api/src/modules/ai/curriculum-outline-candidate.schema.ts
- apps/api/src/modules/ai/curriculum-outline-candidate.dto.ts
- apps/api/src/modules/ai/curriculum-outline-admission.policy.ts
- apps/api/tests/curriculum-outline-admission.test.ts

MODIFY after separate implementation approval:

- AGENTS.md — enact P1-only offline exception, not edited now.
- docs/features/F054-ai-concept-draft-generation.md
- docs/DATABASE_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

Acceptance: strict identity/type/unknown/operator/accessor/proxy refusals;
binding mismatches for every source/proposal/actor/claim/request/output field;
independently specified canonical-byte/hash vectors; property-order invariance
but text/array/raw-output sensitivity; unchanged O0 bounds plus proposed record cap;
all refusal codes/missing-fact refusal; deterministic immutable results; safe DTO/
errors and inert imports. Fixtures explicitly synthetic, never stored/authenticated
AI output. Run focused tests, full API/test TypeScript, API build, targeted lint/
format/encoding/privacy/scope/diff and fresh separate source review.
Estimate60–90 active minutes, hard90 for P1 only. No application checks run now.

Proposed exception, NOT ACTIVE: permit only these eight P1 paths on existing dev
ahead of unmet full F047/F049/F052/F053 acceptance for synthetic pure candidate/
digest/DTO/proposal behavior. Require stable sources/preserved pending work,
reviewed exact contract, offline checks and separate review. Authorize no real
resolver/provider/dispatch, durable attempt/admission/audit/index work, endpoint/
UI, spending, runtime/harness/pin work or dependency. No AGENTS amendment now.

Recommended owner decision: approve/revise the whole-outline record, F044 initial
revision binding, host-bound output protocol, hash frames/DTO, proposed128KiB
record cap and exact P1 inventory/exception. They reuse O0/C1 identity conventions
without premature child writers. Real privacy/retention/producer/profile/pricing/
spending choices stay open and do not authorize themselves through P1.

Later boundaries require separate exact producer/dispatch composition, native
attempt/writer/audit/index contract, real current-authority/concurrency/rollback/
uncertainty/cleanup qualification, F053 controls and separately approved provider
adapter/model/calls, then API/UI/browser evidence. No implementation or new
execution prompt follows now. Preparation is self-reviewed, not independently
approved; all existing acceptance blocks/NOT_RUN/historical UNKNOWN remain.

### Completion-pass evidence — 2026-11-07

Focused self-review completed for identity distinctions, request/output binding,
acyclic canonical coverage, the proposed JSON record representation/cap, private
DTO/refusal behavior, attempt/receipt/audit/index invariants and pure P1 versus
deferred authoritative persistence. No blocking inconsistency remains in this
proposed boundary. This is self-review, not independent approval or execution proof.

Executed documentation checks: explicit Prettier verification of these three new
blocks (separate from formatting application); two new local links and their
anchors; strict UTF-8 decoding, new-block LF/no-BOM, scoped sensitive-pattern scan,
manual privacy review, git diff --check and starting-prefix preservation. F053,
F045, AGENTS and PRD remain byte-identical to the completion-pass baseline. No
application/O0 suites were rerun; prior O0 evidence is retained, not new evidence.

The preceding preparation applied formatting and passed whitespace checking but
left the completion checks unfinished. Its approximately 75-minute overrun remains
noncompliant with that task's timebox; this pass does not repair that history.
Owner approval of all proposed decisions and the inactive P1 exception remains
required. P1 stays NOT_STARTED; no implementation authority is enacted here.

## F054 P1 implementation checkpoint — 2026-11-07

**P1 READY_FOR_REVIEW — offline implementation and separate source review.
Full F054 IN_PROGRESS; acceptance incomplete; production NOT_VERIFIED.**
The owner approved the exact independently reviewed producer/admission contract,
initial F044 binding, canonical frames, 128 KiB JSON cap, private DTO, eight paths,
P1-only exception and one verified local commit. This authority supersedes earlier
pending-approval wording only for pure P1. Later producer/attempt/writer/audit/index
and live-use designs remain design constraints, not execution authority.

Worktree E:/AI/DeepLearner, existing dev; base
4cbee018bda7c775ad712ed0ac724ca016678dcc. No new branch or dependency. Exact inventory
is the four CREATE and four MODIFY paths in the approved P1 section above; PRD,
F045, existing O0/F044/F052/F053 primitives and F053 readiness remain unchanged.

### Implemented behavior and exact pure boundary

- Candidate schema: own-data/reflection guards; no coercion, getters or proxy
  traps; exact identity/literal/field validation, O0 structure/limits, all four
  approved hash frames, complete canonical candidate byte measurement and fixed
  content-free errors. Explicit native Date inputs are copied once into ISO
  strings; exact canonical ISO projections can be revalidated. Returned frozen
  JSON projections contain no mutable Date internals. BSON storage mapping is deferred.
- Private DTO: exactly id, outlineId, revision, origin, outline, contentDigest,
  definitionDigest and ISO createdAt. Fresh frozen projection, excluding actor,
  producer, operation/claim/owner/ledger/internal-proposal and raw request/output.
- proposeOutlineAdmission receives exactly candidate, rawOutput, brief, proposal
  and context. It validates actual supplied F044 structures, recomputes existing
  F053 request/intent fingerprints, checks the requested initial source/proposal
  and every expected actor/key/claim/template/completion/allocated-ID/time binding.
  Context has actorId, intent, command, ledgerOperationId, attemptId,
  outlineRevisionId, outlineId, claimId, ownerId, templateVersion,
  completionDigest, createdAt, completedAt, currentAdmin, sourceAdmitted,
  producerVerified, attemptUnused and technologyStatus; unknown fields refuse.
- currentAdmin means the supplied current verified ACTIVE Admin/session fact;
  sourceAdmitted covers supplied brief/proposal/admission linkage; producerVerified
  means supplied exact invocation/completion verification. These booleans do not
  authenticate themselves. False/null authority facts refuse; missing/malformed
  fields refuse. Parent must be supplied DRAFT/PUBLISHED; archived/missing refuses.
- The command's inputJson must equal the ordered minimized C1 content projection,
  including description-only prerequisites and bounded runtime/version fields.
  Exact raw output must parse as content-only title/modules. The host constructs
  source/Technology identity, validates with unchanged O0, and compares that exact
  projection with the candidate. Valid but unrelated hashes cannot pass.
- Pure results are recursively frozen ADMISSION_PROPOSED or REFUSED with an
  approved safe code/message. There is no dispatch, admission, stored receipt,
  audit, settlement, approval or publication. No automatic replay or ID allocation.

The 131072-byte helper proves only a UTF-8 ceiling. Real candidate validation
measures the final strict canonical projection including digests. A valid O0
outline plus this fixed metadata cannot reach that larger cap; the exact helper
boundary test is not represented as a valid 128 KiB candidate. Raw and assembled
O0 envelopes independently retain 65536-byte ceilings.

### Executed checks and separate review

Author-executed focused suite: **62/62 PASS**, no skipped/cancelled cases, using
node --import tsx --test apps/api/tests/curriculum-outline-admission.test.ts via the
supported command-specific noninteractive route. Includes independently specified
hard-coded hashes for all four frames, byte/key/text/order sensitivity, exact
assembled O0 65536/65537 boundaries, malformed/hostile inputs, binding/refusal
branches, immutable canonical output, private DTO and observed inert boundaries.
All fixtures are SYNTHETIC / NOT_SAVED / NOT_AI_GENERATED.

Full API/test TypeScript PASS with tsconfig.test.json --noEmit --incremental false;
API production build/typecheck PASS with tsconfig.json --incremental false;
four-file ESLint --max-warnings=0 PASS. Initial use of a newer string typing was
replaced by an ES2022-compatible Unicode check. An initial import-clock double
intercepted tsx itself before assertions; it was removed from import instrumentation,
while evaluation still tests explicit-clock independence. Test-only literal typing
and unused destructuring lint issues were corrected. Failed checks are not PASS.
O0's preceding 53-test/build/review evidence is retained only, not rerun.

Fresh separate subagent /root/p1_source_review: **APPROVE; zero unresolved
Critical/High/Medium/Low findings** on final four source/test fingerprints. It did
not author the implementation or independently execute tests/compiler/build/lint.
It suggested and inspected nonempty runtime/prerequisite coverage. This is a
separate assistant source review, not an authenticated human/GitHub approval.
Final formatting, encoding, privacy, scope, preservation and staged-whitespace
receipts accompany local delivery in the external handoff.

### Delivery and remaining guarantees

Authorized delivery is one conventional local implementation commit on dev, no PR
or push. The post-commit SHA/parent, exact staged inventory, final-check receipts,
review fingerprints and actual pending disposition are recorded in:
C:/Users/Shreeji/AppData/Local/Temp/f054-p1-2026-11-07T15-10-20-945Z/delivery-handoff.md
The commit identity is recorded externally after creation rather than embedding
its own hash in its files. Earlier unrelated database/roadmap readiness hunks and
F053 remain uncommitted; no private support artifacts enter the checkpoint.

Users gain no Generate screen or new Save behavior. This foundation establishes
local structure and consistency only. Authentic source/current-account/producer/
profile authority, retained dispatch evidence, native attempt/audit/writer schemas,
physical indexes, persistence/transactions/concurrency/uncertainty/cleanup,
privacy/retention and provider/pricing/spending activation remain separate gates.
The next recommended boundary is the exact producer/completion-to-attempt
composition contract already identified above, not its implementation or a live
call. No new checkpoint is started. Preserve F053 qualification BLOCKED/NOT_RUN,
all acceptance blocks, unexecuted groups, historical UNKNOWN and production
NOT_VERIFIED. The earlier preparation overrun remains historical noncompliance.

## Proposed invocation and durable completion extension — 2026-11-07

**Contract READY_FOR_REVIEW — documentation only. PROPOSED — PENDING OWNER APPROVAL.**
Documentation only; subsequent implementation NOT_STARTED. Full F054 remains
IN_PROGRESS, acceptance incomplete, production NOT_VERIFIED. This section refines
only the earlier producer/attempt boundary; it does not change O0/P1 or activate
storage, egress, retention or a background evidence-capture exception.

Baseline: dev618303bf83184f64a07f98b3e462eaf5012b56ba, parent
4cbee018bda7c775ad712ed0ac724ca016678dcc. O0/P1 are locally committed and reviewed;
retain their evidence, no reruns or delivery here. P1 remains READY_FOR_REVIEW
on its own offline scope. Current users gain no new Generate/Save capability.

### Required authority and the coordinator that does not yet exist

Before preparing an attempt, independently resolve the current verified ACTIVE
Admin, exact authenticated actor/session, eligible Technology, immutable F044 brief
revision1 and actual initial proposal revision1, their definition/content digests,
parent/source relationships and admission audits. Reuse the approved actor-bound
new generation operationId, F053 ledger ObjectId, claim/owner/template/request and
preallocated candidate/family/terminal-audit identities. Never reuse the F044 Save
key, infer identity equality, trust caller flags or treat AI_GENERATED/hashes as
source or dispatch authority.

Missing production composition remains explicit: trusted F044 admission/source
resolver; genuine F053 profile/quote/privacy/pricing/spending/evidence resolvers;
full native operation/claim/audit reader; current-session/revocation and durable
cancellation gates; the approved observing coordinator and native attempt writer.
Existing LedgerAuthority.verify is an injected callback. Its private RECORDED DTO
omits claim/owner/request proof; RECORDED or readOperation alone is insufficient.
JWT verification in authenticate checks token claims/expiry; existing Admin access
reads User eligibility, not live Session revocation. See the
[existing JWT verifier](../../apps/api/src/modules/auth/access-token.service.ts) and
[logout transaction](../../apps/api/src/modules/auth/logout.repository.ts).
F044/F053 User-version fences
are useful but do not supply these missing capabilities. No registry is proposed.

Only the separately approved server coordinator holding the original exclusive
claim owner and uninterrupted invocation context can associate a successful F052
return with this attempt. It must use the exact resolved/template-bound request,
not caller JSON or a returned provenance flag. A process-local handle/owner UUID
is no API capability and cannot substitute for stored binding/authority checks.

### Proposed attempt shape, identity and durable states

**All detailed schemas, methods, audit action and index requirements below are
PROPOSED — PENDING OWNER APPROVAL; no model or writer exists.** Extend the already
proposed curriculumOutlineAttempts aggregate, not a new completion collection.
No prompt or inputJson is stored in it; requests are reconstructed from immutable
sources/template under approved access, then checked against existing fingerprints.

The exact proposed attempt fields are:

| Field                                                                                                 | Native representation and invariant                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _id, schemaVersion, scope                                                                             | BSON ObjectId attempt identity; literal1; SHARED_AI_TESTING.                                                                                                                                                                                   |
| actorId, sessionId, operationId                                                                       | Actor and originating Session BSON ObjectIds; existing actor-bound lowercase UUID-v4 generation key. Session binding is necessary for logout refusal, not a bearer token.                                                                      |
| technologyId, brief, proposal                                                                         | BSON Technology ObjectId; brief {id:ObjectId,revision:1,digest}; proposal {id:ObjectId,proposalId:ObjectId,revision:1,digest}. Existing F044 digests; no copied content.                                                                       |
| ledgerOperationId, ledgerIntentFingerprint, intentDigest, requestDigest, templateVersion, quoteDigest | Existing F053 ObjectId, lowercase64-hex fingerprints/digests (including unchanged P1 intentDigest) and template UUID-v4. quoteDigest is existing ledgerQuoteDigest of the exact quote; no duplicate quote/profile or new accounting identity.  |
| outlineRevisionId, outlineId, terminalAuditId, completionAuditId                                      | Preallocated BSON ObjectIds. Revision/family differ; terminal/completion audit IDs differ. The extra completionAuditId binds one metadata audit to the checkpoint, including when admission never follows.                                     |
| createdAt, bindingDigest                                                                              | Attempt preparation UTC Date and digest of its immutable binding frame below. Not candidate creation time.                                                                                                                                     |
| version                                                                                               | Exact nonnegative safe-integer BSON number, CAS-incremented; refuse overflow.                                                                                                                                                                  |
| phase                                                                                                 | PREPARED, INVOCATION_MARKED, COMPLETION_STORED, ADMITTED or REFUSED. These are F054 phases, not F053 accounting states.                                                                                                                        |
| invocation                                                                                            | Initially null; once set, exactly {claimVersion,id,ownerId,claimedAt,observeUntil,markedAt}. claimVersion is the acknowledged F053 safe-integer operation version; id/ownerId existing claim UUIDs; times UTC Dates. Never replace/reclaim it. |
| completion                                                                                            | Initially null; once set, the exact embedded checkpoint below.                                                                                                                                                                                 |
| cancelledAt                                                                                           | Initially null; a first, authorized durable cancellation UTC Date is sticky. Cancellation changes this cell/version, not historical completion or accounting.                                                                                  |
| receipt                                                                                               | Initially null; write-once {kind:COMMITTED,candidateId,revision:1,definitionDigest,auditId} or {kind:REFUSED,code,auditId}. Candidate/audit links follow the previous admission contract. No editorial state.                                  |

All fields are required, including literal null cells. Own exact fields only;
ObjectIds become lowercase24-hex and Dates canonical ISO for JSON/hash projection.
Strings/digests/UUIDs use P1/F053 rules; version increments are checked safe integers.
No arbitrary metadata map, copied account/credentials, provider envelope or TTL.
New attempts explicitly start at phase PREPARED, version0 and null invocation/
completion/cancelledAt/receipt; no schema default allocates identity, time or state.
Require attempt.createdAt <= invocation.claimedAt <= invocation.markedAt, with
markedAt < observeUntil and observeUntil exactly claimedAt plus the unchanged
F053 request budget. A completion must also have markedAt <= completedAt <=
completion.createdAt. Refuse clock rollback or inconsistent timing, not repair it.
The immutable binding fields above (through createdAt, excluding bindingDigest)
never change. Invocation/completion/receipt cells are single-assignment; phase and
version cannot move backward. PREPARED has all three cells null; INVOCATION_MARKED
has invocation only; COMPLETION_STORED has invocation/completion and no receipt;
ADMITTED has both plus COMMITTED receipt; REFUSED has a REFUSED receipt and never
a candidate. Refusal can follow INVOCATION_MARKED or COMPLETION_STORED only under
the separately defined current-authority terminal-refusal transaction. Never
persist a refusal merely because authority has already been lost. CancelledAt is
orthogonal, so a cancellation after a completion cannot rewrite that completion.

F053 CLAIM_DISPATCH is not another F054 phase. Its acknowledged committed
DISPATCH_CLAIMED record can coexist with F054 PREPARED until the marker commits.
OUTCOME_UNKNOWN/UNRESOLVED are knowledge classifications, not permission to write
an inferred phase or invent a completion/cancellation receipt after failure.

### Two acknowledgements before one invocation

1. Resolve/fence current authority and prepare the immutable F054 binding with
   known acknowledged PREPARED state; retain original process/session context.
   Use separately approved F053 reservation, not a second reservation system.
2. Call existing F053 claimDispatch once. Require its successful transaction
   acknowledgement plus independently validated full operation/claim/audit linkage:
   actor/key/Technology/source/request/bounds/quote/template, same owner/id and
   current DISPATCH_CLAIMED version. Refused, unknown, unreadable or merely private
   DTO evidence stops. Do not repeat claim because its acknowledgement is unclear.
3. With that claim, commit one F054 PREPARED-to-INVOCATION_MARKED CAS transaction.
   Predicate: exact bindingDigest/version; cancelledAt/invocation/completion/receipt
   all null; same actor/origin session; fresh User/Session fences, eligible source/
   parent and exact F053 claim snapshot. Store invocation, increment version, then
   require known successful bounded commit acknowledgement and clean transaction
   outcome. A conditional miss/conflict or unknown commit grants no call permission.
4. In that same retained coordinator, recheck cancellation, current authority,
   source/privacy/control/claim ownership and deadline immediately before exactly
   one F052 execute. Both acknowledgements must be known in this uninterrupted
   context. A recovery read finding a marker does not recreate invocation authority.

Require now before quote.expiresAtMs and claim.observeUntil and the original
period/profile/quote constraints for dispatch. Preserve original request bounds.
F052 receives at most the remaining observation/local budget (never above its
original bound or10000ms); do not extend observeUntil or replace the owner when
that leaves insufficient time. Its AbortSignal is checked before dispatch and
on cancellation; no automatic retry, alternate key or fallback provider.

No provider work occurs inside a MongoDB transaction. A final check cannot be
atomic with external I/O or prevent every revocation/state change after it.
Exclusive claim/evidence ownership and conservative read refusal are prerequisites;
F054 cannot directly mutate F053 rows to manufacture a dispatch fence. Conflicting
ownership/version before invocation stops. A marker means invocation may have
occurred, not that it certainly occurred. There is no exactly-once remote-processing,
unsent, unbilled or MongoDB/provider atomicity guarantee. Missing trusted accounting
and dispatch composition keeps all live use blocked.

### Exact observation and one private completion checkpoint

Distinguish observed provider return, technically/domain-valid output, durable
completion, admitted candidate and verified cost: none implies another. Only a
successful F052 outcome observed by the original coordinator within its original
local/claim observation window is eligible. completedAt is that coordinator's
explicit return-observation UTC time, consistent with its monotonic budget and
claimedAt <= completedAt < observeUntil; it is not a provider-declared timestamp.
Failures, cancelled/deadline outcomes and late underlying promises produce no
capturable raw content, even if the provider may continue charging.

Retain exact UTF-8 bytes of the successful F052 untrustedJson string. This is not
a claim about compressed/original HTTP transport bytes. Parse as strict
{title,modules}, reconstruct host identity/source and apply unchanged O0/P1 to the
same raw output/candidate/context. Keep both raw and assembled O0 <=65536 bytes
and the exact request output limit; keep P1's131072-byte candidate cap. No extra
identity fields, normalization, reserialization, truncation or substitute JSON.

The embedded write-once completion record has exactly:

| Field            | Meaning and rationale                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| schemaVersion    | Literal1, fixed projection version.                                                                                                                                                                                      |
| producer         | Exact P1 producer tuple, unchanged, with native BSON ObjectId references and UTC Dates; existing UUID/digest strings. Supplies immutable attempt/ledger/key/claim/owner/intent/request/template/raw/observation linkage. |
| rawOutput        | One well-formed primitive string containing the exact bounded successful content-only JSON, including whitespace and escape spelling. Necessary for unchanged P1 recovery; no other response data.                       |
| createdAt        | Explicit UTC Date assigned once for this checkpoint, >= producer.completedAt; later candidate.createdAt reuses it. This is construction time, not claimed database commit time.                                          |
| checkpointDigest | Domain-separated integrity digest covering this record and its immutable attempt/marker binding below; not authentication.                                                                                               |

Allocate candidate/family/audit IDs once at preparation, but do not predate the
candidate with the attempt's earlier createdAt: checkpoint createdAt is selected
once after observing output. Never regenerate these values after uncertain write.
The provider-return budget is not extended by a separately bounded completion
transaction; a previously on-time return may be checkpointed after observeUntil
only by the still-live original coordinator under fresh capture authority and
that transaction's unchanged bounds. No delayed background/resumed capture.

A later accounting transition may change the F053 operation version/state without
changing its preserved claim/request identity. Capture must validate that exact
historical claim and audit lineage, not require accounting to remain open or
interpret SETTLED as content success. A missing/mismatched claim history refuses.
Quote/observation expiry after an on-time return is not permission for a new call;
current content-storage privacy/authority still must permit the bounded capture.

Only one raw string plus fixed, individually bounded metadata is retained. There
is no arbitrary archive or separate enlarged output limit. The candidate cap is
not silently applied to outer JSON-escaped checkpoint text, which is a different
representation. Native BSON size/permissions must be qualified before persistence;
no storage-byte measurement or creation is asserted by this document.

Canonical frames: compact JSON.stringify ordered arrays, UTF-8/no BOM/newline,
lowercase SHA-256, ObjectIds lowercase24-hex, UTC Dates ISO, verbatim validated
strings. Existing P1 intent/content/completion/definition frames remain unchanged.
For the attempt immutable binding define:

    ["F054_OUTLINE_ATTEMPT",1,attempt._id,"SHARED_AI_TESTING",actorId,sessionId,
     operationId,technologyId,[brief.id,1,brief.digest],
     [proposal.id,proposal.proposalId,1,proposal.digest],ledgerOperationId,
     ledgerIntentFingerprint,intentDigest,requestDigest,templateVersion,quoteDigest,
     outlineRevisionId,outlineId,terminalAuditId,completionAuditId,attempt.createdAtISO]

bindingDigest hashes that frame. checkpointDigest hashes exactly:

    ["F054_OUTLINE_CHECKPOINT",1,bindingDigest,
     [invocation.claimVersion,invocation.id,invocation.ownerId,
      invocation.claimedAtISO,invocation.observeUntilISO,invocation.markedAtISO],
     completion.producer.completionDigest,completion.createdAtISO]

Recompute all bindings and unchanged P1 producer.completionDigest, including the
rawOutputDigest of exact rawOutput. That transitively covers every producer field
and raw bytes; schemaVersion is fixed by the frame tag. The new binding frame
covers allocated IDs, source/proposal/actor/session/quote/request linkage. No phase,
version, cancelledAt, admission receipt, checkpointDigest or future candidate
backlink feeds bindingDigest or P1 completionDigest; there is no hash cycle.
Integrity of mutable cells requires CAS/transaction/access controls, not hashes.
Require producer.attemptId = attempt._id and its ledgerOperationId, operationId,
intentDigest, requestDigest and templateVersion equal the immutable binding;
producer.claimId/ownerId equal invocation.id/ownerId. Recompute the existing F053
request/intent/quote digests from the exact independently resolved records.
A stored checksum alone cannot validate source, claim or observation authority.

### Conditional storage, audits and no-replay reads

One proposed capture transaction must atomically: validate the exact marker,
source/parent and authoritative completion linkage; fence current User and origin
Session; check current cancellation/loss gates; CAS the attempt with exact version,
INVOCATION_MARKED, cancelledAt/completion/receipt null; set completion and phase
COMPLETION_STORED; increment version; append one content-free
CURRICULUM_OUTLINE_COMPLETION_STORED audit under completionAuditId. Proposed audit
uses existing actor/request/time fields and fixed attempt/Technology/operation IDs
plus checkpointDigest only, no raw content/session/claim/owner or prompt. Action
schema and permission additions require later approval; no audit model is changed.

The capture work budget begins when the on-time F052 success is observed and
includes O0/P1 validation and awaited write work; do not start/reset it only after
validation. Pass remaining work to every port and retain the existing bounded
cleanup controls. No unbounded validation-to-storage delay or resumed capture.

One explicit bounded transaction/commit attempt, no callback/mutation replay,
upsert, replacement or overwrite. Reuse existing10000ms work,5000ms authorization,
2000ms commit/abort/endSession bounds and qualified same-session driver controls.
Acknowledge completion only after known commit and required cleanup outcome.
Any candidate admission is a later separately authorized/fenced transaction,
with its existing candidate/receipt/terminal-audit atomicity; not part of capture.

An identical existing complete checkpoint is read/validated, never rewritten:
compare exact raw bytes, full binding/marker/producer/digests and completion audit.
Different raw bytes conflict even if contentDigest is equal. Hash-only equality,
partial linkage, missing audit or corrupt cell refuses as UNRESOLVED/corrupt;
never repair/replace/attach missing content automatically. Proper transactions
must leave no partial checkpoint/audit, but this remains a live-verification gate.
Unknown acknowledgement, rollback, abort or cleanup is OUTCOME_UNKNOWN; subsequent
exact read may establish an already committed checkpoint or receipt. Missing rows
alone never establish no invocation/no commit or permit another capture write.
A read failure returns UNRESOLVED, no private driver error or success inference.

Internal actor-bound reads require independently current verified Admin and exact
actor/attempt/operation/Technology binding, bounded primary snapshot inspection,
no-store and approved access. A new authenticated session of the same actor may
inspect already committed evidence, but may not revive invocation/first capture
under the old session. Other Admins gain no raw completion recovery capability.
RawOutput stays server-private, not in P1 DTO, Student API, logs, URL or browser
storage. Later candidate admission can use stored evidence only after its own
fresh authorization, source/parent/P1 checks and unused-admission receipt check;
P1 attemptUnused means no initial candidate admission, not no invocation marker.
The authoritative admission gate also requires cancelledAt=null; this gate is
composed outside unchanged P1, not inferred from its supplied boolean. Native
terminal-refusal/recovery mutations remain deferred, not authorized by this shape.

### Authority loss, durable cancellation and transaction ordering

Capture requires both fresh credential verification and an authoritative live
origin Session (_id=sid, userId=actorId, revokedAt=null, unexpired), plus current
verified ACTIVE ADMIN User. Current code does not provide a combined transactional
Session fence. Proposed enforcement writes real __v increments on both User and
Session with exact observed versions/eligibility and modified-count/ack checks,
in the same attempt-CAS/checkpoint/audit transaction. Require existing valid safe
integer versions; missing/overflow refuses, never initialize/migrate silently.
The Session projection is only _id/userId/revokedAt/expiresAt/__v; the User
projection is only _id/role/status/emailVerifiedAt/__v. Do not read refresh hashes,
device/IP data or credentials into this content boundary.
Session expiry is checked at authorization and immediately before commit under
trusted time; a TTL declaration or signed sid is not proof of a live Session.

Ordinary logout already writes the Session row, whereas logoutAll also changes
User. Sharing a real Session write lets logout/revocation conflict with capture;
a User-only check/fence cannot prove logout ordering. Current demotion/deletion
fences help only where all eligibility writers serialize correctly. Sticky
mid-invocation authority loss additionally requires deauthorization to revoke the
origin sessions in its authoritative transaction (or an equally explicit bounded
contract amendment), so later promotion does not revive a cancelled invocation.
That lifecycle linkage is not established by current code; it requires separate
security review/approval before native/live composition. No global JWT policy or
logout implementation is changed by this proposal.

Proposed durable cancellation is a content-free actor-bound conditional update
of cancelledAt plus attempt.version under fresh current authority; it writes the
same attempt row as capture, never accounting or completion content. The original
actor may request it from a current session, including a new one; only the origin
session/coordinator may first capture. Acknowledgement means that cancellation
transaction committed, not merely that the browser requested abort. Cancellation
may update only PREPARED/INVOCATION_MARKED/COMPLETION_STORED; a terminal ADMITTED/
REFUSED attempt is inspected as already terminal without a new cancellation write.
No cancellation
endpoint or automatic post-loss cancellation writer is authorized here.

Decision point is the successful serialization/commit of these shared writes:
revocation/cancellation committing first must make capture fail; capture committing
first may leave legitimate existing evidence when later logout/cancel commits.
Current local AbortSignal/authority-loss observation is sticky: before write/commit
checks it forbids issuing new content writes; while commit is in flight it yields
uncertainty, not proven rollback or permission to erase/recapture. Never store late
output through another owner, session or background callback. Discard unsaved raw
content when capture is refused; retain only already committed evidence under the
future approved policy. Dropping references is not a physical-memory zeroization guarantee.
The lost caller is not authorized to persist a new failure
or diagnostic record merely to explain refusal.

This does not promise ordering by wall-clock button press, an undelivered network
abort, unseen demotion or exact expiry instant. Transaction conflicts, trusted-time
checks and sticky durable revocation are the required mechanisms; absolute
real-time cross-system revocation is not supplied by a pre-write check. If the
owner requires stronger ordering than this explicit transaction order, native/live
implementation remains blocked pending that decision. Parent eligibility retains
P1's acknowledged snapshot archive/deletion race; no cascade/publication follows.

Previously committed completion/admission/audits are not erased on logout,
demotion or source loss. Without a checkpoint, after marker/return/loss the
result is UNRESOLVED with possible provider effects, not new durable success/refusal.
F053 independently retains/reconciles liabilities under its authority/evidence
rules. Content return/checkpoint/admission is neither final-cost evidence nor a
DEFINITELY_UNSENT receipt, and cannot release reservations. Content-parent/session
loss must not block independently authorized accounting reconciliation.

### Interruption and read-recovery matrix

| Cut or uncertainty                             | Established facts / possible external effects                                                       | Permitted action and refusal; forbidden replay                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before F053 claim is sent                      | Prepared intent/reservation may exist; this coordinator has not invoked.                            | Fresh exact reads; do not create another reservation/key. Any F053 definitely-unsent decision needs its own qualified evidence.                                |
| Claim sent, before known claim ACK             | Claim may have committed; no call permitted.                                                        | Stop dispatch, read exact actor/key/claim/audit. Missing/RECORDED DTO alone is insufficient; no repeated claim or inferred release.                            |
| Known claim ACK, before marker write           | Exact claim known; F054 PREPARED. No invocation by this uninterrupted owner yet.                    | Only original live authorized owner may perform first marker CAS while all gates pass; recovery after interruption is read-only, not claim/marker replay.      |
| Marker write sent, before known marker ACK     | Marker may have committed; no invocation is permitted by ambiguous ACK.                             | Read marker/claim; finding it does not restore invocation authority. No marker retry or automatic execute.                                                     |
| Known marker ACK, before external call         | Both ACKs known only to retained live owner; marker now means possible invocation to other readers. | Original owner may perform one final gate and one execute; cancellation/expiry/lost context stops. Recovery never executes again.                              |
| Awaiting provider / deadline / process loss    | Call may have reached provider or continue remotely; output/cost unknown.                           | Cancel local consumption, read exact records; no alternate key/owner, redispatch or assumed no-charge.                                                         |
| Return observed / validating                   | Only bounded local output, not durable content or admission.                                        | Original still-authorized coordinator may validate and attempt first capture; invalid/late/lost authority drops raw content. No repair/replacement generation. |
| Authority/cancellation lost before capture     | Revocation/cancellation may already be durable; no new capture permission.                          | Stop new content writes; inspect existing evidence only after fresh read authority. Do not write a failure marker from the lost context.                       |
| Capture transaction sent / before ACK          | Checkpoint+audit may both commit; no durable-success claim yet.                                     | OUTCOME_UNKNOWN until exact valid reads; no insert/commit/capture retry from absence. In-flight abort does not prove rollback.                                 |
| Known capture ACK / before admission           | Exact completion and audit, but no admitted candidate or verified cost.                             | Current authorized actor can inspect; later admission requires separate fresh fences/receipt/P1 checks. Never call provider again.                             |
| Admission transaction sent / ACK unknown       | Candidate/receipt/terminal audit may commit atomically.                                             | Read all exact links; return resolved prior result or UNRESOLVED. No mutation/admission replay merely from missing rows.                                       |
| Known admission ACK / later logout or demotion | Candidate/receipt/audits already committed; accounting remains independent.                         | Preserve evidence and access rules; no erase, regeneration, inherited editorial approval or release inference.                                                 |

### Smallest subsequent implementation proposal and remaining decisions

**PROPOSED — PENDING OWNER APPROVAL; NOT_STARTED.** Recommend one internal,
offline producer-ordering coordinator with injected existing F052 executor/F053
service and explicit bounded authority/attempt-read-write ports. It orchestrates
this sequence and reuses O0/P1; it is not another domain validator, model, queue,
supervisor, provider registry or production resolver. Test ports are synthetic and
cannot establish acknowledgement, authority or database guarantees in production.

Exact proposed six paths, no dependency:

CREATE:

- apps/api/src/modules/ai/curriculum-outline-producer.service.ts
- apps/api/tests/curriculum-outline-producer.test.ts

MODIFY only after approval:

- AGENTS.md — named offline coordinator-only exception.
- docs/features/F054-ai-concept-draft-generation.md
- docs/DATABASE_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

Acceptance: inert imports; strict reuse of existing identities/requests/P1;
ordered claim ACK then marker ACK before at most one execute; every ambiguous/
refused/conflicting/expired gate makes zero execute calls; no claim/marker/capture
retry; late/cancelled/authority-lost outputs make zero new capture calls; capture
uses the exact bytes/frames and fixed IDs/time; identical reads versus conflicts/
corruption/incomplete audit; all matrix cuts; races under explicit port doubles;
safe errors/no raw data in results; input immutability; no accounting release.
Use fake executor/clock/ports only, meaningful unit tests, full API/test compiler,
API build, targeted lint/format/encoding/privacy/scope/diff and fresh separate
source review. Estimate60–90 active minutes, hard90 for this one offline scope.
No vendor/model/key decision is needed for it.

Proposed exception, NOT ACTIVE: permit only those six files ahead of unmet full
F047/F049/F052/F053 acceptance for offline coordinator/double verification after
separate owner authorization. No actual provider/native repository/model/index,
resolver activation, session/auth writer, API/UI, persistence, spending, background
capture, runtime/harness/pin work or Git delivery. Existing AGENTS is unchanged.

Before real persistence/egress separately approve and implement native attempt/
completion/audit schemas and restricted immutable permissions, Session/User/cancel
serialization plus deauthorization-session linkage, trusted source/profile/claim/
producer composition, exact indexes and real concurrency/rollback/unknown-outcome
qualification. Access to raw completion, retention period, erasure/backups, audit
retention and provider privacy/training/egress terms remain undecided. No TTL,
deletion job, unlimited retention or default production capture is selected.
The narrow raw-content checkpoint is a proposed retention exception to the earlier
recommendation against raw archives, not current permission to retain real data.

Owner review must accept/revise the exact new attempt/checkpoint frames and
fields, one metadata audit, transaction-order revocation semantics, retention/
access decisions before real use, and the six-path offline implementation boundary.
No required live prerequisite is portrayed as implemented. All existing acceptance
blocks, F053 qualification BLOCKED/NOT_RUN, historical UNKNOWN and production
NOT_VERIFIED remain. This preparation is self-reviewed only; new check evidence
is recorded below after execution, not inferred from O0/P1 PASS.

### Documentation completion evidence — 2026-11-07

Focused consistency/security self-review completed: identity/native projections,
state/cancellation/receipt invariants, two-ACK ordering, exact raw output versus
unchanged O0/P1, complete acyclic hash coverage, authority-loss/session races,
metadata audit, no-replay recovery and the12 interruption rows agree. No known
blocking internal inconsistency remains; this is not independent approval.

Executed new checks: explicit Prettier verification of the three appended blocks;
four new local links/targets/anchors; strict UTF-8/no-BOM/LF/final newline; scoped
sensitive-pattern scan and manual privacy review; git diff --check; exact prefix
preservation and unchanged protected-file hashes. The external checker initially
compared a UTF-16 character offset with a UTF-8 byte count; corrected it and reran
the affected checks. That failed checker run is not a verification PASS.

All eight starting P1 fingerprints match its retained final evidence. No O0/P1
approval/review/test/build/delivery was repeated. Sources/tests, AGENTS, PRD,
F053 readiness and previous shared-document hunks remain unchanged. HEAD and
parent remain the expected local commits, index empty; pending paths are these
three documents plus untouched F053 readiness. Actual final fingerprints/check
receipts and elapsed time are saved in the timestamped external handoff.

Raw storage access/retention/erasure/backups, the proposed completion-audit/native
schema/permission requirements, Session/deauthorization amendment, trusted producer
composition and real index/transaction qualification remain future approval gates.
They are not implementation or live-use authority from this reviewable proposal.

### Offline coordinator implementation record — 2026-11-08

Checkpoint READY_FOR_REVIEW — offline only; final staged integrity is required
before the separately authorized local commit.
full F054 IN_PROGRESS, acceptance incomplete. The owner
approved exactly the six-path offline coordinator and its named sequencing
exception after the separate Desktop contract review (2026-11-08, APPROVE, exact
reviewed dev618303bf83184f64a07f98b3e462eaf5012b56ba). Earlier NOT_STARTED/proposed
implementation wording above is historical; native security/storage/egress and
retention proposals remain inactive. Only synthetic injected ports are exercised;
there is no production composition or new user-facing Generate/Save capability.

Working branch/location: existing dev at E:/AI/DeepLearner. Completion requires
the contracted ordering, exact-byte/P1 validation, no-replay inspection, meaningful
synthetic tests/static checks and separate final source review before one local
commit. Preserve pre-existing F053/database/roadmap readiness hunks unstaged.
Implemented internal capability: one retained context orders independently bound
claim ACK, marker ACK, one bounded executor invocation and one separately fenced
completion/audit request. Exact content-only bytes are reconstructed through
unchanged O0/P1. Unknown ACKs, lost authority, expired observation or invalid
content do not permit replay. Inspection retires invocation eligibility and only
validates existing actor-bound evidence; fresh-session historical inspection can
survive origin-session loss and archived parent status. No writer, admission,
accounting or production adapter is supplied. Terminal inspection uses existing
receipt/audit identity/revision/code metadata, not a new terminal digest rule.

Exact source/test paths:

- [Internal coordinator](../../apps/api/src/modules/ai/curriculum-outline-producer.service.ts).
- [Synthetic focused tests](../../apps/api/tests/curriculum-outline-producer.test.ts).

Author-executed evidence on final source: 114 tests PASS, zero fail/cancel/skip;
full API/test TypeScript and API production compilation PASS; targeted ESLint and
explicit source Prettier verification PASS. All ports/clock/executor were inert
synthetic doubles. The 12 interruption rows are local orchestration/inspection
checks; the admission-ACK-unknown row inspects completion without executing any
admission transaction. O0/P1 retained evidence was not rerun or reapproved.

Separate source review: agent /root/coordinator_source_review, final exact-hash
APPROVE at 2026-11-08 01:51:55 UTC, zero unresolved Critical/High/Medium/Low.
Reviewer read source/tests/dependencies and rehashed files; it did not execute
tests/build or authenticate a human reviewer. Author resolved final dispatch
freshness, exact F053 forwarding, inspection retirement, terminal-audit projection
and timer-setup issues, with focused regressions. Initial success-path comparison
failures (producer field order), compiler argument/type errors and an unused-helper
lint error were corrected; earlier failed runs are not counted as PASS.

Final reviewed SHA-256:

- Service: f75033d918989b975b798a54b82daddc1ebe4fde8225d359f11c7b523194e123.
- Test: 1d6af6efe8c49f06c3c1d61400f0156bc594e852d76e0de561adff10bd24c754.

Real current User/origin-Session authorization, sticky deauthorization, attempt
cancellation/CAS, trusted source/profile/quote/claim/audit readers, atomic capture,
native bounds/indexes/cleanup and provider/billing guarantees remain port
obligations and live prerequisites. Capture passes unchanged 2000ms commit/abort/
endSession limits and remaining local work; this proves no native cleanup. Raw
access/retention/erasure/backups/provider terms remain unapproved for actual use.
The in-memory service retains only content-free expected checkpoint metadata
after a capture request, not an unsaved raw-output archive. Matching hashes are
not authority; no supplied ALLOW/currentAdmin flag activates live use.

Users gain no new live Generate/Save feature. Smallest next boundary: review the
bounded User/origin-Session/cancellation security amendment and trusted-reader
composition before any separately approved native adapter. Do not start it here.
Existing F053 qualification BLOCKED/NOT_RUN, acceptance blocks, unexecuted groups,
historical UNKNOWN and production NOT_VERIFIED stay unchanged.

Local delivery SHA/parent, exact staged inventory, preservation and actual elapsed
time are recorded after commit in the external delivery-handoff.md under
C:/Users/Shreeji/AppData/Local/Temp/f054-coordinator-2026-11-08T01-32-12-515Z/.
No push or remote acceptance follows this checkpoint.

Final documentation checks PASS: explicit repository-configured Prettier checks
for all four new blocks, four local targets/anchors, strict UTF-8/LF/no-BOM/final
newline, scoped sensitive-pattern/manual privacy review, original-prefix and
F053/PRD byte preservation, source-review hash match and git diff --check. The
external checker initially used default Prettier options for source verification;
it was corrected to use repository options and rerun. That checker failure is not
source-format PASS. No application suite was repeated for documentation changes.

## Proposed completion security and trusted-reader amendment — 2026-11-08

**PROPOSED — PENDING OWNER APPROVAL. Design READY_FOR_REVIEW — documentation only;
source-based self-review only, not independent approval.** This append-only review
uses dev a1bd3ca22296e2a20099a0a882b8870d5d398c24, parent
618303bf83184f64a07f98b3e462eaf5012b56ba. The delivered offline coordinator remains
READY_FOR_REVIEW on its existing scope; full F054 stays IN_PROGRESS, acceptance
incomplete. No security policy, native adapter, Session writer, storage permission
or sequencing extension is activated here. Earlier contracts/evidence remain
historical and unchanged. Users gain no new live generation or Save capability.

### Observed writers and participation

The inventory covers tracked application paths actually inspected, plus relevant
integration-only counterexamples. It does not certify uninspected external
administrative/database writers. Such writers must be controlled before live use.
`__v` is Mongoose's existing default version key, not an implemented revocation
epoch, and query updates do not automatically increment it.

| Actual writer/source                                                                                                                                                                                                                                                      | Record, transaction and explicit version behavior                                                                                                                                                                                                                                                                                                              | Effect on the proposed fence                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Registration](../../apps/api/src/modules/auth/registration.repository.ts), register:88, verify:121, resend:164                                                                                                                                                           | Registration creates a STUDENT/PENDING_VERIFICATION User in a Mongoose transaction; initial model version is supplied by Mongoose. Verification sets ACTIVE/emailVerifiedAt and increments User.__v; resend increments User.__v. Neither revokes Sessions.                                                                                                     | Real User writes conflict with a same-transaction User fence. These are admission/verification, not implemented Admin deauthorization. No restoration may un-revoke an old Session.                                         |
| [Password login](../../apps/api/src/modules/auth/login.repository.ts):136–211                                                                                                                                                                                             | Transaction rechecks credentials/eligibility, writes User status/lastLoginAt and increments __v with modifiedCount=1, then creates a fresh Session and audit. Expired suspension can reactivate.                                                                                                                                                               | User write conflicts; newly created sid does not transfer an earlier attempt's origin binding. It does not cancel old attempts or implement sticky demotion.                                                                |
| [Refresh](../../apps/api/src/modules/auth/login.repository.ts):212–310                                                                                                                                                                                                    | Transaction checks Session hash/revocation/expiry and current User. Success increments User.__v, may reactivate an expired suspension, rotates Session hash/lastUsedAt with modifiedCount=1, but does not explicitly increment Session.__v or extend expiresAt. Reuse writes Session.revokedAt/reason and audit without an explicit Session version increment. | Both real Session updates conflict with a Session write. Successful same-sid rotation alone is not deauthorization. Reuse revocation must defeat later capture; replaying refresh is not a capture recovery mechanism.      |
| [Google login/link](../../apps/api/src/modules/auth/google-auth.repository.ts):69–245                                                                                                                                                                                     | Transaction creates a STUDENT/ACTIVE User, or updates an existing User including possible expired-suspension restoration and increments User.__v with modifiedCount=1; creates a fresh Session/audit.                                                                                                                                                          | Same User conflict and distinct-session rule. No role-demotion/deletion/session-revocation writer is established by account linking.                                                                                        |
| [Ordinary logout](../../apps/api/src/modules/auth/logout.repository.ts):33–61                                                                                                                                                                                             | Transaction writes matching Session.revokedAt/reason, requires modifiedCount=1, appends audit. No User write or explicit Session.__v increment. Missing/already revoked/hash mismatch returns without that mutation.                                                                                                                                           | A real write to this same Session can serialize against capture; User-only fencing cannot. A browser logout request or invalid/stale refresh cookie is not proof of a committed revocation.                                 |
| [Logout-all](../../apps/api/src/modules/auth/logout.repository.ts):63–94                                                                                                                                                                                                  | Transaction increments User.__v, then revokes currently unrevoked/unexpired Sessions and records count/audit. User result is not an exact-version/matched-count guard; Session updateMany does not explicitly increment __v.                                                                                                                                   | Shared User/Session writes participate in conflicts, but do not substitute for F054's stricter predicates/acknowledgements. Expired Sessions are refused by time even if not updated.                                       |
| [Password recovery](../../apps/api/src/modules/auth/password-recovery.repository.ts):97–196, 230–283                                                                                                                                                                      | Forgot increments User.__v without revocation. Reset changes password/increments User.__v and revokes all unrevoked Sessions in the same transaction. Change-password changes User/increments __v, requires a live current-Session write incrementing Session.__v, and revokes other Sessions; the current Session remains valid.                              | Preserve these existing distinctions. Reset/other-session revocations defeat capture. Do not silently redefine password change to revoke its retained current Session. No credentials enter F054's projection.              |
| [Profile patch](../../apps/api/src/modules/users/user.repository.ts):73–109                                                                                                                                                                                               | withTransaction updates only allowlisted profile/name fields and increments User.__v; modifiedCount=1 plus audit. No Session write.                                                                                                                                                                                                                            | Can cause an ordinary transaction/version conflict; not every User version change is permanent authority loss. No automatic replay follows a conflict.                                                                      |
| [F043](../../apps/api/src/modules/admin/technologies/admin-technology.repository.ts):172; [F044](../../apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.repository.ts):257; [F053](../../apps/api/src/modules/ai/ai-usage-ledger.repository.ts):503 | Native transaction predicates require ADMIN/ACTIVE/exact verifiedAt/User.__v and increment User.__v. F053 checks acknowledgement/matched/modified; F044/F043 return matched/modified. None supplies an origin-Session fence.                                                                                                                                   | Reusable User-write pattern, not proof of logout serialization or durable sticky session loss. No change to those features is applied here.                                                                                 |
| [Session schema/TTL](../../apps/api/src/modules/auth/session.model.ts):18–48                                                                                                                                                                                              | Native Session fields include userId/expiresAt/revokedAt; autoCreate/autoIndex disabled. TTL on expiresAt is declared, not physically verified here. TTL deletion, if active, is a server deletion of the Session, not an application transaction or __v increment.                                                                                            | Row absence refuses. Deletion of the same document participates in write conflicts; delayed TTL never extends eligibility beyond the trusted-time checks. Physical behavior remains unqualified.                            |
| Role/status disable/suspend, verification removal, User deletion/restoration                                                                                                                                                                                              | No production Admin role/status/deletion endpoint or repository writer was found in the inspected application source. [F043 integration fixtures](../../apps/api/tests/admin-technology.integration.ts):475/493/556/629 include direct demotion/deletion; these are test-only mutators, not a production lifecycle contract.                                   | Sticky deauthorization is missing. Before live use every real eligibility-loss writer must atomically revoke affected origin Sessions with its User mutation/deletion. A test's User-only change cannot prove that linkage. |
| Attempt cancellation                                                                                                                                                                                                                                                      | Only the proposed cancelledAt/version contract and the coordinator's injected loss signal exist; no native attempt cancellation writer/API is implemented.                                                                                                                                                                                                     | Local abort is sticky only in that retained context. A future cancellation must write the same attempt row as capture; supplied flags or a resolved Promise are not a durable cancellation receipt.                         |

JWT [verification](../../apps/api/src/modules/auth/access-token.service.ts):39
and [middleware](../../apps/api/src/middleware/authenticate.ts):4 validate signed
claims/lifetime, not current Session existence/revocation. The current
[Admin lookup](../../apps/api/src/modules/admin/admin-access.repository.ts):23
projects User eligibility, without Session or __v. Password recovery already has
a narrow live-Session write; that is a useful existing pattern, not a global
authentication amendment. No new requirement is imposed on unrelated endpoints.

### Proposed guarantee and exact transaction conditions

The guarantee is successful shared-write serialization, with bounded trusted-time
checks. It is not browser button order, an instantaneous expiry boundary or
atomic ordering with a provider. Present code does not enforce the combined gate.

For first marker and first completion capture, the future transaction must:

1. Freshly verify the actual server-held authenticated context. sub/sid must match
   the attempt's actorId/origin sessionId; require current ADMIN claim and actual
   ACTIVE/verified ADMIN User. Do not authenticate a binding object, UUID, hash or
   coordinator boolean. Check local sticky loss before/after every await and before
   mutation/commit. Keep the existing 5000ms authorization and 10000ms work bounds;
   capture work starts at the on-time observation, not after validation.
2. In the same native session/snapshot read only User {_id,role,status,
   emailVerifiedAt,__v} and Session {_id,userId,revokedAt,expiresAt,__v}. Require
   exact native identities, canonical non-null verification/expiry dates, live
   Session ownership, revokedAt=null and expiresAt > trusted now. Both versions
   must be existing nonnegative safe integers below MAX_SAFE_INTEGER. Refuse
   absent/malformed/overflow versions; no repair, defaults or secret projection.
3. Issue real writes in fixed order User, originating Session, attempt. User
   predicate is {_id,role:ADMIN,status:ACTIVE,emailVerifiedAt:observed,__v:observed};
   update only $inc:{__v:1}. Session predicate is {_id:originSid,userId:actorId,
   revokedAt:null,expiresAt:{$eq:observedExpiresAt,$gt:freshTrustedNow},__v:observed};
   update only $inc:{__v:1}. For both require
   acknowledged=true, matchedCount=1, modifiedCount=1. These writes must share the
   actual transaction containing the attempt CAS and metadata audit, never an
   earlier independent authorization transaction. They cannot refresh expiry,
   rotate credentials, reactivate a Session or change account eligibility.
4. Marker CAS uses exact immutable binding/version, PREPARED and all null cells,
   then assigns the exact claim snapshot once and increments the checked version.
   Capture CAS uses exact binding/marker/version, INVOCATION_MARKED and
   cancelledAt/completion/receipt null; assigns the exact one completion and audit
   under the allocated ID, increments version once. No upsert/replacement or
   retry. Native attempt/audit schemas and permissions remain separately required.
5. Validate source/parent/historical claim relationships within the transaction.
   Recheck actual credential verification, local loss, trusted time and the fenced
   Session's expiry immediately before commit. No no-op fence or snapshot read
   alone suffices. Preserve bounded snapshot/primary/majority-journaled writes,
   2000ms commit/abort/endSession and existing same-session controls. Required
   commit and cleanup must be known before reporting recorded success.

Logout/reuse/reset/other-session password revocation committing first must defeat
the Session write, even though several existing writers do not increment __v:
the eligibility predicate and MongoDB same-document write conflict both matter.
Incrementing __v in every logout writer is not required merely to obtain a write
conflict. Conversely version equality alone does not prove no lifecycle change.
An unrelated User/refresh write can create a safe conflict/refusal without being
classified as permanent deauthorization. No automatic transaction callback replay
is allowed in the new boundary; existing auth repositories' Mongoose transaction
behavior is not silently replaced by this design.

Demotion/disable/suspension/unverification/deletion committing first must similarly
defeat the User write. For permanent loss across later restoration, their future
authoritative transaction must also revoke all unrevoked origin Sessions for that
User; deletion first fences User, then revokes Sessions, then conditionally removes
that exact fenced User in the same transaction. This preserves User-first ordering.
Require
acknowledged writes and validated finite counts/versions, fail the whole transaction
on any required failure, and keep existing audit obligations. Do not resurrect a
revoked row or reuse User/Session identities. Restoring role/status permits a fresh
login/new attempt after its own checks, not first capture for an old origin sid.
No such production eligibility-loss writer is implemented here; defining/closing
that writer set and separately approving its session-impact policy is a live gate.
This requirement concerns accounts that can originate F054 operations; it does not
silently replace unrelated Student-only lifecycle policy.

If capture serializes/commits first, later logout/demotion/cancellation may retain
legitimate prior completion/audit; they do not erase it. If TTL deletion wins, the
row is missing/conflicting and capture refuses. If expiry passes after the last
time check while commit is in flight, this contract cannot promise an exact
server-commit-before-expiry instant. Check/commit latency and external-call races
remain explicit. Stronger ordering would require a separately reviewed decision,
not a longer timeout or claimed guarantee from a precheck.

### Sticky loss, cancellation and acknowledgement distinctions

- Local observed loss irreversibly retires the invocation context. Later supplied
  eligibility or role restoration cannot restart it. This establishes only local
  suppression; unseen loss needs durable lifecycle linkage.
- Durably committed Session revocation stays revoked, including after promotion,
  expired-suspension restoration, refresh or new login. Current-sid password change
  and successful same-sid refresh remain valid under existing policy unless some
  other loss is observed/committed. User.__v is not a sticky-loss epoch.
- Proposed durable cancellation uses fresh current authorization for the original
  actor and the requesting live Session (which may be new), with User/requesting-
  Session writes plus exact actor/attempt/binding/version CAS in one transaction.
  Set cancelledAt once/increment version for PREPARED, INVOCATION_MARKED or
  COMPLETION_STORED; preserve existing content. Terminal ADMITTED/REFUSED is read
  as terminal without a cancellation write. No current parent authoring/dispatch
  eligibility is inferred or granted by metadata cancellation. No API is proposed
  as implemented. Native cancellation schema/ack/error contract still needs approval.
- Cancellation committing before capture defeats its cancelledAt=null/version
  predicate. Capture committing first can leave a checkpoint which later cancellation
  makes ineligible for admission. Admission requires its own fresh null-cancel gate.
- Unknown commit/abort/cleanup, including loss while a write is in flight, is
  OUTCOME_UNKNOWN, not rollback. Bounded exact actor-bound reads may establish
  already committed evidence; missing rows/read linkage yield UNRESOLVED and never
  authorize a repeated claim, marker, capture, cancellation or provider call.
  Losing authority does not grant a background failure/diagnostic write.

Previously committed records remain evidence under approved access. A fresh
session of the same current Admin may inspect but cannot first-capture an old
attempt. Another Admin gains no operation/raw-output recovery right. F053
liabilities persist independently; neither loss, content success, a new month,
missing parent nor failed inspection means zero cost or released reservation.

### Exact trusted-port composition map

The interfaces are in [OutlineProducerPorts](../../apps/api/src/modules/ai/curriculum-outline-producer.service.ts):65.
The binding is private linkage, never a bearer capability. Future production ports
must close over a genuine server-authenticated request/coordinator context, not
derive authority from their input. A fresh-session read needs a fresh verified
request context; passing a new sessionId to an old object's inspect method does
not authenticate it. Do not cache the last check as a reusable authorization ticket.

| Port                               | Authoritative facts and exact bindings                                                                                                                                                                                                                                                        | Existing coverage and missing composition                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authority.check(CLAIM/MARK/INVOKE) | Credential sub/sid; current User/live origin Session; admitted F044 brief/initial proposal plus audits; Technology; actor-bound new generation key; exact minimized request/template; F053 control/period/profile/quote/privacy/pricing/spending and ownership/deadline.                      | JWT/Admin User primitives and F044/F053 validators/readers exist. No combined live-Session/source/control resolver is registered. currentAdmin/sourceAdmitted/controlsCurrent must be computed from those sources, not copied flags. Return the exact private projection expected by authorize:492, no credentials.                                      |
| authority.check(CAPTURE)           | Same origin actor/Session and current content-storage authority/privacy; immutable source/request/quote binding and historical claim; original on-time observation and remaining capture budget.                                                                                              | Quote expiry/month/accounting advancement after on-time return does not itself forbid capture or permit another call. controlsCurrent here means approved current storage/access controls, not a fabricated dispatchEnabled/freeze exemption. Authentic storage policy is unresolved. Fresh transaction-time authority is still required inside capture. |
| authority.check(READ)              | Fresh requesting Session/current Admin, same original actor/key/attempt/Technology, retained source/admission lineage and historical quote. Origin Session can be revoked; archived parent inspection allowed.                                                                                | The coordinator ignores dispatch-controls currentness/quote expiry for READ; use embedded historical quote, not a new price/default. Missing/mismatched/corrupt source/parent refuses as existing F044 rules require. No inheritance of origin loss, no cross-actor raw access.                                                                          |
| ledger.claimDispatch               | One existing F053 invocation with exact operationId/expectedVersion and full F052 request plus allocated claimId/ownerId. Known mutation/cleanup ACK and independently validated full native operation/dispatch audit before wrapper RECORDED.                                                | Existing [F053 service](../../apps/api/src/modules/ai/ai-usage-ledger.service.ts):765 and native repository provide bounded transaction machinery. Its private RECORDED DTO omits internal proof and cannot be relabelled as the coordinator ACK. A later read of an old claim never recreates a lost originating ACK.                                   |
| ledger.readClaim                   | Native operation _id/actor/key/Technology/source, exact request/intent/quote/bounds, immutable claim id/owner/times, dispatch version/audit lineage. Dispatch needs current DISPATCH_CLAIMED/version/last-audit equality; capture/read can inspect preserved history after UNCERTAIN/SETTLED. | [LedgerReader](../../apps/api/src/modules/ai/ai-usage-ledger.repository.ts):52 has operation(actor,key), audit(id), snapshot session support. Historical dispatch-audit lookup/proof composition is missing; do not use the accounting operation's new lastAudit as its dispatch audit. See derivation below.                                            |
| attempts.mark                      | Current User/origin Session/source controls, exact PREPARED binding/version/null cells and native F053 claim proof, one acknowledged marker CAS/clean outcome.                                                                                                                                | No native attempt schema/writer/permissions. This port is not just an insert or a boolean ACK. Real same-transaction fences remain required.                                                                                                                                                                                                             |
| attempts.capture                   | Fresh same-transaction combined fences; exact marker/cancel/version/null cells; original observer/P1/raw-byte linkage; one embedded completion and allocated metadata audit; known commit/cleanup.                                                                                            | No native attempt/completion audit action/writer/index qualification. [Audit model](../../apps/api/src/modules/audit/audit.model.ts):45 does not yet admit F054 actions. Never turn a successful synthetic port return into production durability.                                                                                                       |
| attempts.read                      | Fresh reader authorization inside its bounded primary snapshot; exact actor/attempt/key/Technology; full attempt, required completion audit, candidate/receipt/terminal audit, historical source and claim links; same raw bytes and hashes.                                                  | No native attempt reader. Existing P1 DTO deliberately omits producer/raw/internal fields and cannot supply this proof. Incomplete/corrupt proof returns UNRESOLVED; no backfill, rewrite or admission.                                                                                                                                                  |
| clock / loss / executor            | Explicit trusted UTC+monotonic time, original retained observing context and sticky delivered loss; approved F052 executor request bound to the verified template/source and F053 claim.                                                                                                      | Local clocks/signals/executor exist as injected interfaces and synthetic tests. No authenticated production producer/egress composition, durable loss delivery or genuine remote cancellation/billing evidence exists. No provider defaults/keys/vendor decision here.                                                                                   |

Each actual port must re-establish the facts needed for its own access/write.
Separate calls to F044.read and F053.read do not create one shared cross-record
snapshot. The F044 [reader](../../apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.repository.ts):217
uses separate primary/majority reads; F053's [run](../../apps/api/src/modules/ai/ai-usage-ledger.repository.ts):465
uses a native snapshot session for reads. Compose the necessary projections in one
bounded primary native snapshot per proof (or the actual write transaction), using
the same qualified database/client session, then close it with known cleanup.
Do not reuse an earlier authority result as transaction authorization. Read-only
inspection checks current authority at its actual read/return points and suppresses
locally observed loss; it does not promise instantaneous revocation of already
read data or freeze the world across the entire provider invocation.

F044 source evidence must read the immutable brief and initial proposal, validate
actual content/definition digests, revision1/family/Technology/source and equal
initial content/creation linkage, and read both exact admission/revision audits.
Reuse [admitted/captured checks](../../apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.service.ts):388–484.
The ordinary [proposal DTO](../../apps/api/src/modules/admin/learning-paths/admin-learning-path-proposal.dto.ts):30
omits private digests and admission/audit/actor evidence, so is insufficient.
Historical source author/save key are distinct from the current generation actor/
new operation key. Follow existing F044 protected source-access rules; do not
invent equality between author and generation actor or cross-actor operation
recovery. Historical admission survives author demotion/deletion; every new
operation still requires current authority.

For F053 use [validateLedgerOperation / quote / request primitives](../../apps/api/src/modules/ai/ai-usage-ledger.schema.ts)
and [validateLedgerAudit / assertLedgerAuditLink](../../apps/api/src/modules/ai/ai-usage-ledger.repository.ts):106–274.
Before dispatch, validate the actual native current operation and its current
dispatch audit. After accounting advances, locate exactly one dispatch audit by
resourceType=AI_USAGE_OPERATION, resourceId=ledgerOperationId and the stored
invocation.claimVersion, require action=AI_USAGE_DISPATCH_CLAIMED, original actor/
key/version/time and immutable quote/reservation linkage. The declared
uq_ai_usage_audit_version index supports this identity; physical proof is absent.
Current schemas do not store claimId/ownerId directly in audit metadata: the port
must derive those from the validated native preserved claim and its one-time
dispatch transition, not invent audit fields or pretend the audit signs them.
Validate the dispatch-era projection (DISPATCH_CLAIMED, held=reservation,
actual/evidence/safeCode null, updatedAt=claimedAt, exact historical version/audit),
while separately validating the current accounting row and audit. Require intact
trusted-writer immutability/permissions and exact marker linkage. Missing or
ambiguous history refuses; no audit search by latest timestamp or inferred version.
The synthetic coordinator audit object is an internal derived projection, not the
native audit schema. No native audit/schema change is selected by this derivation.
Mongoose audit hooks do not police arbitrary native/direct database writes;
approved restricted writer permissions and controlled mutation paths are required
before interpreting stored history as authoritative.

The internal completion audit projection's digest maps to the approved proposed
native checkpointDigest metadata. Native actor/requestId/time and allowed resource
IDs must come from the real server transaction context; the port must not omit
them merely because the coordinator projection is smaller. Session/claim/owner,
raw content, prompts and credentials stay out of native content audits and public
DTOs. No requestId supplied as an arbitrary binding field is authentication.

Actual profile/template/privacy/pricing/spending/evidence authorities remain
injected F053 dependencies, not registered trusted production sources. A checksum,
model enum, environment flag or test quote is no approval. Resolve the exact
approved immutable template/version, reconstruct minimized request from the F044
brief, and recompute request/intent/quote/P1 bindings. Do not obtain missing proof
by exposing internal fields through API DTOs, reading credentials, or adding a
generic authority registry. Unknown commit/read/cleanup fails closed using the
coordinator's existing safe REFUSED/UNRESOLVED/OUTCOME_UNKNOWN results; preserve
native primary/cleanup diagnostics privately without content or secrets.
READ ignoring dispatch controls is never a waiver of approved raw-read/access/
retention policy: the real read port must enforce that policy independently,
including for a new Session. That approved policy source does not yet exist in
production composition; it cannot be replaced with currentAdmin=true.

### Smallest proposed implementation boundary and approvals

Recommend a feature-local current-Admin/origin-Session read/write fence over the
existing User/Session collections, explicitly injected into a caller-owned native
transaction. No production registration/default connection, new model/epoch or
attempt writer. It can implement and offline-test exact projected reads, version/
eligibility predicates, real $inc writes, acknowledgement checks, explicit time/
loss and safe failures. It cannot by itself authenticate a supplied actor, enforce
future demotion writers, atomically store a completion or prove MongoDB races.
Its narrow operations are current-authority projected read, User/Session write
fence using the provided active native session, and a fresh precommit time/loss/
credential check for that transaction's caller. It neither owns commit/abort nor
returns a transferable capability; the caller remains responsible for the same-
transaction attempt CAS/audit and known commit/cleanup. Use native collection
operations over existing fields, not model registration or implicit version repair.

**Exact proposed seven paths; NOT_STARTED, no implementation authority:**

CREATE:

- apps/api/src/modules/ai/curriculum-outline-session-fence.ts
- apps/api/tests/curriculum-outline-session-fence.test.ts

MODIFY only after approval:

- AGENTS.md
- docs/features/F042-admin-route-protection.md
- docs/features/F054-ai-concept-draft-generation.md
- docs/DATABASE_DESIGN.md
- docs/DEVELOPMENT_ROADMAP.md

Before: F054 can only consume synthetic authority/fence assertions. After this
future offline checkpoint: an unregistered feature-local implementation can issue
the exact existing-record User/Session predicates in a provided transaction and
refuse malformed/lost authority under inert native-driver doubles. No user-facing
feature or live capture follows. Estimate60–90 minutes, hard90 including focused
tests/static checks/separate review. No additional Session model or migration is
needed merely to use its existing __v; missing stored versions remain refusal.

Measurable acceptance for that scope:

- Strict actor/origin/requesting-session binding and fresh credential reverify
  callback; no flags/old context can authorize a new session or actor. Tests use
  synthetic verifier facts; genuine credential authenticity remains a composition
  obligation, not something those tests establish.
- Null/deleted/ineligible/mismatched/revoked/expired rows, malformed/missing/overflow
  versions and unsafe clock/loss refuse; no credential fields are selected.
- Exact User then Session predicates/$inc, same provided native session and
  acknowledged/matched/modified=1, no upsert/default/expiry extension or retry.
- Inert modeled interleavings cover logout, logout-all, reuse/reset, retained versus
  other-session password change, refresh, profile conflict, demotion/deletion and
  restoration. Do not claim doubles establish durable loss linkage or real races.
- A late loss before mutation/commit prevents the next write; an in-flight unknown
  ACK never becomes success/rollback/replay. Read-only mode has no writes; historical
  inspection uses a separately verified current session without reviving origin.
- Full API/test compiler, API build, targeted lint/format/encoding/privacy/scope/
  diff and fresh separate source review. Real snapshot/write-conflict/TTL/expiry/
  unknown-commit/cleanup tests require later isolated ownership-qualified execution.

Proposed AGENTS addition, **NOT APPLIED / NOT ACTIVE**: "Permit only the seven
inventoried F054 Session-fence paths after separate implementation approval,
offline with injected native-driver doubles, ahead of incomplete full prerequisite
acceptance. No production wiring, actual database write, global JWT/session-policy
replacement, new eligibility/cancellation endpoint, provider dispatch or other
checkpoint is authorized. Existing acceptance and live-verification gates remain."

Proposed F042 addendum, **NOT APPLIED**: "F054's future content marker/capture must
independently verify and write-fence current User plus the originating live Session
in the same attempt transaction. This adds no global access-token revocation
guarantee to F042. Existing logout, refresh and current-session password-change
semantics remain; any new eligibility-loss writer must receive separately approved
atomic session-revocation/restore behavior before real composition. No F042
acceptance result changes." No F053 source/policy amendment is needed merely to
derive its existing private native history; any new read method still needs its
own inventoried approval and cannot alter accounting semantics.

Required owner decisions are acceptance of the explicit commit-order/residual-time
model and future deauthorization-to-session-revocation compatibility policy, then
separate authorization of the seven-path offline boundary. Before real capture,
raw-access/retention/erasure/backups/provider terms and native schema/permissions
also need decisions; no period or stronger guarantee is selected here. These are
distinct from missing technical prerequisites: controlled eligibility writers,
native attempt/cancel/audit definitions, trusted source/control/history composition,
physical indexes, actual transaction/conflict/cleanup qualification and genuine
observing producer. The proposed helper does not clear those gates. No vendor/
model/key or spending choice is needed for its offline implementation.

### Review evidence and preservation

Source-based design self-review complete: writer participation, User-first deletion
ordering, immutable versus current identities, exact same-transaction predicates,
origin versus fresh reader Session, stage-specific controls, native versus derived
audit projections, uncertainty/no-replay and next-scope boundaries were checked.
No known internal blocking inconsistency remains in this proposed design. This is
not new independent approval or a claim that the missing guarantees already exist.

Executed documentation checks PASS: explicit repository-configured formatting
verification of all three appended sections, 28 local targets/anchors, strict
UTF-8/LF/no-BOM/final newline, scoped privacy/manual review, exact old byte-prefix
preservation, unchanged AGENTS/F053/coordinator/test and 24 inspected source hashes
matching HEAD, expected Git identities/empty index/four pending paths and
git diff --check. Initial read-only quoting/glob/path inspection mistakes were
corrected or narrowed; those commands were not tests or environment probes and
supplied no positive evidence before correction.

Retained only: O0/P1 and delivered coordinator matching source/test fingerprints,
114 synthetic tests and separate source-review evidence. No application test,
compiler/build or prior checkpoint review was repeated. No live operation or Git
write occurred. The three new sections are F054 (this section), DATABASE_DESIGN
and roadmap; pending paths now are those three documents plus the byte-identical
F053 readiness file. Earlier readiness hunks are preserved. All other worktrees
were not operated on; no global runtime or worktree qualification is claimed.

Exact final fingerprints/results, elapsed time and decision handoff are saved in
C:/Users/Shreeji/AppData/Local/Temp/f054-completion-security-review-2026-11-08T02-38-56-328Z/handoff.md.
F053 qualification BLOCKED/NOT_RUN, existing acceptance blocks, all unexecuted
groups, historical UNKNOWN and production NOT_VERIFIED remain. No implementation,
execution prompt or active exception follows from this review.

## Offline User/Session fence implementation record — 2026-11-08

**Checkpoint: READY_FOR_REVIEW — offline only. Full F054:
IN_PROGRESS; acceptance incomplete; native completion capture: BLOCKED.** Owner
authorization `86d3c04f-b9fc-42d6-bbca-1f6905f15e4a/Pasted text.txt` approves the
exact seven-path boundary and commit-order/residual-time semantics, not real
lifecycle implementation. The preceding design-only proposal/evidence is retained
historically; the named AGENTS exception is now active only for this offline helper.
Base/parent: dev a1bd3ca22296e2a20099a0a882b8870d5d398c24 /
618303bf83184f64a07f98b3e462eaf5012b56ba, E:/AI/DeepLearner. No new branch.

### Implemented local interface and responsibilities

The unregistered `createOutlineSessionFence` accepts a strict immutable snapshot
of mode MARK/CAPTURE/READ, canonical actor/origin/requesting-session/attempt IDs,
expected binding digest/version/phase and the exact native-Date invocation for
CAPTURE. MARK requires PREPARED/version0/null invocation; CAPTURE requires
INVOCATION_MARKED/version>=1/exact invocation. Both require the requesting sid to
be the origin. READ may use a separately freshly verified sid of the same actor.

Injected collections, credential verifier, clock, loss/work signals and an already
active caller-owned native ClientSession are mandatory. Every read/write forwards
that exact session. Missing/ended/inactive sessions refuse; no transaction/session
is opened, committed, aborted or cleaned up by the helper. The caller must establish
native-session provenance, approved transaction options and genuine credentials.
Synthetic supplied facts do not establish their own authority.

`read()` performs only projected User/Session/attempt reads. `fence()` reads fresh
facts, then writes User followed by Session using the exact predicates above and
only `$inc:{__v:1}`, upsert=false. Native driver acknowledgements must have
acknowledged=true, matchedCount=modifiedCount=1, upsertedCount=0 and upsertedId=null;
unknown/extra/malformed fields fail closed. Existing versions must have increment
headroom; none is initialized or repaired. No credentials/content are projected.

The attempt projection checks exact native ID, actor/origin IDs, expected binding
digest, version/phase and, for writes, null cancellation/completion/receipt and the
exact marker or null initial invocation. READ projects only identity/state/cancel
metadata and never raw completion. This local guard is not the complete immutable
binding validator, a cancellation writer or a CAS: the caller must independently
validate full stored binding/source relationships and issue the exact attempt CAS
and audit after the User/Session writes in this same transaction. No native attempt
writer is implemented or implicitly authorized here.

`beforeCommit()` freshly reverifies the original credential, local loss, time and
fenced expiry, once after a successful fence. The caller must invoke it immediately
before its own bounded commit. Immutable CHECKED/FENCED/PRECOMMIT_CHECKED results
are local steps, never permission tickets or recorded capture. A context cannot
repeat its fence/precommit, restart after observed failure, or run concurrent calls.

Explicit clocks enforce one 5000ms authorization-read window and at most 10000ms
total local work, additionally bounded by the caller's remaining work. Every await
and positive return checks sticky loss/expiry/active session. In-flight timeout or
failure after any write is sent yields content-free OUTCOME_UNKNOWN, including
partial or malformed acknowledgements; it proves neither rollback nor replay
permission. Earlier failures yield REFUSED. Timers/listeners are released; a late
adapter result cannot start the next operation. Local timeout does not prove remote
cancellation. Commit/abort/endSession remain the caller's existing 2000ms bounds.

### Scope, evidence and remaining gates

Exact seven checkpoint paths: CREATE
`apps/api/src/modules/ai/curriculum-outline-session-fence.ts` and
`apps/api/tests/curriculum-outline-session-fence.test.ts`; MODIFY `AGENTS.md`,
`docs/features/F042-admin-route-protection.md`, this record,
`docs/DATABASE_DESIGN.md`, `docs/DEVELOPMENT_ROADMAP.md`. F042 receives only the
approved compatibility note; its JWT/logout/refresh/password policies are unchanged.
Earlier DATABASE_DESIGN/roadmap readiness hunks and F053 remain outside this commit.

Executed: 142 focused synthetic fence tests PASS; full API/test TypeScript,
production API no-emit typecheck and emitted build, targeted ESLint and source/test
Prettier verification PASS. Initial test-only mongoose import and unused argument
errors were corrected before the passing compiler/lint checks. Separate review
identified missing post-await positive-return loss validation and permissive absent
hasEnded handling; both were corrected and covered by regressions before the final
142-test run. No older suite was repeated without an affected dependency.

Fresh separate source review by Codex subagent `/root/session_fence_review`, same
shared session/team, APPROVE at 2026-11-08 03:39:03 UTC: no unresolved Critical,
High, Medium or Low findings. This is not a separately authenticated human/GitHub
review. The reviewer personally inspected design/source/tests and verified SHA-256,
but did not execute tests/compiler/build; those checks were author-executed.
Reviewed source SHA-256:
cdeb463ab6780e99967444acc4572f975060289f7b4ce160eb292d6bb58bf5f5;
test SHA-256:
ce8c74a61d78af5fd688826314abc07f2ac23db4736ef884d9cfc7d81a766b1f.
Inertness evidence is source inspection, unchanged Mongoose model/connection state
and absence of prohibited calls, not complete OS/network instrumentation. Named
logout/reset/password fixtures are supplied facts, not execution of those writers.

Final documentation formatting/links/UTF-8/LF/privacy/scope/preservation and staged
integrity results, exact locally delivered commit/parent and remaining pending
readiness inventory are recorded in
C:/Users/Shreeji/AppData/Local/Temp/f054-session-fence-20261108T033100Z/delivery-handoff.md.
No PR or push is authorized. O0/P1/coordinator evidence remains retained, not rerun
or requalified. The external handoff is the delivery identity record; this ready
offline checkpoint does not establish full-feature acceptance.

Users gain no live Generate/Save capability. Current User/Session writes could
participate in real document conflicts even when logout does not increment __v,
but synthetic scenarios do not prove those conflicts. Durable loss across unseen
demotion/restoration still requires separately approved controlled eligibility-loss
writers that revoke origin Sessions. Same-sid refresh/retained password change
remain compatible; TTL delay grants no expiry extension. Capture/revocation order,
the last-check/commit expiry race and later historical evidence remain as reviewed.

Still required before native capture: genuine authentication and trusted shared-
snapshot source/control/claim-history readers; lifecycle linkage; native attempt,
cancellation/completion/audit schemas, restricted writers and physical indexes;
qualified transaction/conflict/TTL/rollback/unknown-ACK/cleanup behavior; actual
observing producer and approved raw storage/access/retention/erasure/backups/provider
privacy policy. F053 liabilities are never released by refusal/loss. No unrelated
acceptance, NOT_RUN group, historical UNKNOWN or production NOT_VERIFIED changes.
Next boundary is separately reviewed native composition prerequisites, not automatic
wiring or another provider call. One verified local commit is authorized; no push.
