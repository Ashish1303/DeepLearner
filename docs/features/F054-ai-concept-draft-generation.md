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
