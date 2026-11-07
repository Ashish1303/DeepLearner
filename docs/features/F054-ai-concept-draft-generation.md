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
