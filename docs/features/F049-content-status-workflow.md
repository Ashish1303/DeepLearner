# F049 — Content Status Workflow

## Admin completion reconciliation and G1 review — 2026-11-06

**Full-feature status: IN_PROGRESS. Acceptance: INCOMPLETE; no final owner acceptance.**
Checkpoint readiness/delivery is separate from the official feature status.

| Evidence field                                 | Current verified record                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intended user outcome / implemented capability | P0 evaluates supplied exact revision/digest and AI-origin claims through three pure transitions. There is no user-visible stored approval, editing/resubmission or publication workflow.                                                                                                                                                            |
| Checkpoint and delivery                        | P0 bounded offline development/review and Git delivery criteria satisfied; full F049 acceptance incomplete. Retain121 focused tests, not131 after counting its10-case subset. P0e16232c1c2e74a49030ded961a067ace17efd67a plus reconciliationdffbdc7100518769bb638c209aac8763a92a65d7; PR #4 merged to dev a16a67c08b95d16ee832270e3fc55e02c49f88bd. |
| Remaining product work / verification debt     | Authoritative stored origin/current Admin checks, revision/concurrency, audit/idempotency/replay, AI-origin edit lineage, CHANGES_REQUIRED resubmission and stored editorial decisions.                                                                                                                                                             |
| Real dependencies                              | Explicit F047 unmet; P0-only exception does not waive full dependency. F050 presents decisions, F051 owns release.                                                                                                                                                                                                                                  |
| Exact next action                              | Contract exact stored outline decisions/edit lineage against actual admitted candidates; P0 is not current authority or completion of F047.                                                                                                                                                                                                         |

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

## P0 authority and scope — 2026-11-05

Feature IN_PROGRESS, **partial P0 offline implementation only**. Full F049 acceptance
is incomplete. The owner approved P0 and its named offline sequencing exception
ahead of unmet F047, implementation, focused tests and fresh independent review.
This supersedes the roadmap's preceding proposed P0 status for this checkpoint
only. It does not complete F047/F049 or satisfy all prerequisites of F052.

Sources: AGENTS.md; PRD13/44/46–48/110; SYSTEM_ARCHITECTURE12/32.2;
DEVELOPMENT_ROADMAP F047–F054 and dated P0 proposal; existing seven-state Concept
definition in apps/api/src/modules/concepts/concept.model.ts. Existing catalogue
schemas, public projections, F044 brief/Save and F045 read-only inspection remain
unchanged. Manual-origin Module M1 remains NOT SELECTED and unimplemented.

P0 is a deterministic local editorial rule, not a generic source authority,
registration system, stored decision, user-visible workflow or approval service.
No application registration or live consumer is added. Runtime/configuration,
database, provider, network and process dependencies are excluded.

## Exact input and output

```text
{
 current: {
   state: <one documented editorial state>,
   origin: 'AI_GENERATED',
   revision: {id, revision, digest}
 },
 expected: {id, revision, digest},
 action: 'SUBMIT_FOR_REVIEW' | 'REQUEST_CHANGES' | 'APPROVE'
}
```

The current owner authorization explicitly requires AI-origin validation and
invalid-origin tests. Accordingly, required `current.origin:'AI_GENERATED'` is
the scoped clarification to the preceding state-only proposal. It is a supplied
structural claim using existing vocabulary, **not authoritative AI provenance**,
job completion evidence or a new origin/admission workflow. An origin label or
AI_GENERATED state cannot turn an F044 manual brief into actual generated content.

Every object is exact, own enumerable data properties on Object.prototype/null
prototype only. Reject missing/unknown/operator/dotted/symbol fields, accessors,
proxies (including revoked), arrays, class instances, inherited required fields
and coercion. No user getters, methods or toString/valueOf are invoked.
Canonical IDs are24 lowercase hexadecimal characters, digests64 lowercase hex,
revision positive safe integer1–Number.MAX_SAFE_INTEGER. No trim/case conversion,
automatic IDs, clocks, hashing, lookup, actor or configuration is involved.
Both supplied reference tuples must match exactly in ID, revision AND digest.

`validateEditorialTransition(unknown)` returns a detached validated structural
copy; it does not authenticate origin or compare stored content. The policy
`proposeEditorialTransition(unknown)` validates that shape, compares the tuples
and returns only the next-state string below. No target-bearing capability,
receipt, signature or side effect is returned. All validation/mismatch/undefined-
transition failures are plain Error with fixed message `Invalid editorial
transition`, no cause, payload, issue details or caller exception text. A future
HTTP boundary must independently sanitize errors/stack traces; P0 is not an API.

## Complete P0 matrix

All rows require the supplied AI-origin claim and identical valid reference tuples.
An em dash means refusal. No unspecified action or transition is invented.

| Current state    | SUBMIT_FOR_REVIEW | REQUEST_CHANGES  | APPROVE  |
| ---------------- | ----------------- | ---------------- | -------- |
| DRAFT            | —                 | —                | —        |
| AI_GENERATED     | IN_REVIEW         | —                | —        |
| IN_REVIEW        | —                 | CHANGES_REQUIRED | APPROVED |
| CHANGES_REQUIRED | —                 | —                | —        |
| APPROVED         | —                 | —                | —        |
| PUBLISHED        | —                 | —                | —        |
| ARCHIVED         | —                 | —                | —        |

No DRAFT/manual-origin entry, direct AI-to-approved jump, publication, archive,
editing, generation, successor admission or old-revision reset is supported.
The conservative matrix is deliberately partial F049, not a complete seven-state
lifecycle implementation. Admin editing of AI-origin material needs a separately
defined lineage/revision workflow; changed content never inherits approval.

Repeated evaluation of identical input is deterministic and may yield the same
proposal. A repeat action evaluated against already advanced state refuses.
There is no replay ledger, idempotency key, concurrency check or persisted
at-most-once guarantee. Input objects, including frozen inputs, remain unchanged.

## Mandatory consumer boundary and deferred guarantees

Before applying any P0 result, future separately authorized consumers must:

- Resolve authoritative immutable content and actual AI-origin lineage, parent
  binding, revision/digest and source/quality/review requirements; do not trust
  caller labels, expected tuples or eligibility booleans as evidence.
- Verify current-account JWT/stored verified ACTIVE Admin eligibility, and enforce
  the applicable transaction-time account fencing for actual mutations.
- Read and conditionally update authoritative current editorial state/revision
  with transactional concurrency and atomic audit. No stale policy evaluation may
  replace those checks.
- Define operation identity, idempotency/replay, uncertain-commit reconciliation,
  retention and cleanup under their own contracts and real qualification.

An allowed result is neither an authenticated approval nor a stored decision or
publication capability. P0 proves none of those guarantees, nor physical indexes,
real transactions/uniqueness or database/process cleanup. F051 publication still
requires its own approved exact release/eligibility/authority/atomic-audit boundary.

## Exact checkpoint inventory

CREATE:

- apps/api/src/modules/admin/content-workflow/editorial-transition.schema.ts
- apps/api/src/modules/admin/content-workflow/editorial-transition.policy.ts
- apps/api/tests/editorial-transition.test.ts
- docs/features/F049-content-status-workflow.md

MODIFY:

- AGENTS.md
- docs/PRD.md
- docs/DEVELOPMENT_ROADMAP.md

Seven P0 paths. PRD/roadmap overlap two of the four pre-existing pending documents.
Preserve pending docs/features/F045-admin-module-management.md and
docs/DATABASE_DESIGN.md byte-for-byte. Combined pending inventory is nine paths,
not eleven. Worktree product/admin-module-inspection at
1f687bd5f6c83252ed32a0dcf9411bbd3cb9ef2b remains isolated from primary dev, PR #3,
U16's12 pending files and parked support candidates. No Git delivery is authorized.

## Offline verification and readiness

Require the independent21-cell matrix, each permitted transition's exact tuple
matches/mismatches, all identity/revision bounds, invalid origins/fields/shapes,
safe content-free errors, input immutability/detached copies, deterministic repeated
evaluations and advanced-state refusal. Inert import guards and source-import
inspection must exclude database/network/process/runtime-configuration effects.
Run focused Node tests, full API/test TypeScript, production API build/typecheck,
targeted lint/format/encoding/privacy/scope/diff checks and fresh independent source
review, resolving blocking findings and rerunning only affected checks.
Executed results are recorded below only after actual completion.

Estimate60–90 minutes; hard90-minute stop. No browser or live API/database test,
bootstrap/integration suite, dependency installation, credentials/provider/model
selection or runtime change. No acceptance, staging, commit, push or PR update.
The next dependency is a separately contracted F052 offline adapter foundation,
but P0 alone does not satisfy F052's full F049 prerequisite or authorize its work.
Full F047/private AI-origin structures, actual editorial admission/decision contracts,
appropriate sequencing approval and later F053 dispatch/privacy/budget controls
remain outstanding. No paid call is eligible from this checkpoint.

F042/F043 acceptance BLOCKED; F044/F045 acceptance incomplete; F047 unmet; F049
partial/offline only. Original F044 nine records, P five, API six and all unexecuted
browser/integration groups remain NOT_RUN, including U01–U16. Historical UNKNOWN
and failure evidence remains permanent; production readiness NOT_VERIFIED.

## P0 executed verification and review — 2026-11-05

**READY_FOR_REVIEW — offline P0 only.** Feature remains partial, acceptance incomplete.
Implemented the exact seven-state/three-action matrix, required supplied AI-origin
claim and exact revision/digest matching. No endpoint/consumer/writer is mounted.

Checks actually executed from the isolated product worktree using existing tooling:

```text
node --import tsx --test apps/api/tests/editorial-transition.test.ts
node --import tsx --test --test-name-pattern='invalid or missing AI-origin' apps/api/tests/editorial-transition.test.ts
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.test.json --noEmit --incremental false --pretty false
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --incremental false --pretty false
node node_modules/eslint/bin/eslint.js apps/api/src/modules/admin/content-workflow/editorial-transition.schema.ts apps/api/src/modules/admin/content-workflow/editorial-transition.policy.ts apps/api/tests/editorial-transition.test.ts --max-warnings=0
node node_modules/prettier/bin/prettier.cjs --check apps/api/src/modules/admin/content-workflow/editorial-transition.schema.ts apps/api/src/modules/admin/content-workflow/editorial-transition.policy.ts apps/api/tests/editorial-transition.test.ts
git -c core.autocrlf=false diff --check
```

- Initial focused run121/121 PASS. Independent source review then found one Low
  negative-test ambiguity: invalid-origin SUBMIT_FOR_REVIEW already had invalid
  IN_REVIEW state. Corrected to a positively demonstrated valid state/action for
  each negative, changing only origin.
- Self-review also removed test-name-selection dependence: guarded first imports
  now run as unconditional inert setup, and mocks are restored in finally.
- Final complete focused file121/121 PASS,0 failed/skipped/cancelled. Separate
  origin-name selection10/10 PASS confirms the ten affected cases and setup work
  under standard selection. Those ten are a subset, not131 distinct tests.
- Full API/test TypeScript PASS initially and after test-only correction. Production
  API TypeScript emit/build PASS; production source was unchanged by later test fixes.
  Targeted ESLint/Prettier PASS; affected test lint/format rerun PASS after correction.
- Inert first-import guards reject network/listener/database-transport/child-process/
  worker effects; import graph inspection permits only node:util/Zod and the local
  schema. No runtime config or database/provider module is imported by P0. These
  checks are local source/import evidence, not a live database qualification.
- Fresh independent agent review by /root/f045_scope_review covered actual source,
  tests, documentation, privacy and scope; confirmed closure of the Low finding and
  selection-independent setup. Final0 Critical/High/Medium/Low unresolved findings.
  Reviewer performed read-only inspection, no tests, edits or runtime/database/Git
  writes. The implementing agent's executed results above are separate provenance.
- New documentation sections are formatted separately; existing historical documents
  remain subject to their existing formatter exclusions. UTF-8/LF, scope/privacy,
  whitespace and preservation results are reported with the final handoff; no
  whole-repository formatter or unrelated regression rerun is claimed.

All success is offline structural/local policy evidence. Supplied facts cannot
establish actual AI origin, current Admin eligibility, stored state/revision,
source/quality, transactions/audit/idempotency/replay or publication eligibility.
No live API/database/browser/bootstrap/integration execution, runtime changes,
credentials, provider calls, provisioning or Git delivery occurred. Primary dev,
PR #2/#3, U16 and parked candidates are preserved. Estimate60–90 minutes;
actual elapsed time is recorded in the final handoff. F049 P0 remains partial;
all existing blocked acceptance/NOT_RUN/UNKNOWN and production NOT_VERIFIED remain.

## Current delivery reconciliation — 2026-11-05

The owner separately approved the retained pre-P0 four-document boundary, this
seven-path P0 checkpoint and a third documentation reconciliation, on one dependent
branch initially targeting PR #2's product/admin-module-inspection branch. Earlier
no-Git-authority wording records the implementation task, not this later scoped
delivery approval. Application/test bytes and prior independent evidence are
unchanged; no passing suite is rerun or claimed from this documentation task.
P0 remains READY_FOR_REVIEW — offline only, F049 IN_PROGRESS and acceptance
incomplete. F047/full F049 remain unmet; CHANGES_REQUIRED resubmission is missing.
F052 O1 remains proposed, NOT_STARTED, with no active exception. See the
[current roadmap](../DEVELOPMENT_ROADMAP.md#f044f054-current-product-and-delivery-ledger--2026-11-05).
