# F047 — Admin Concept Management

## Admin completion reconciliation and G1 review — 2026-11-06

**Full-feature status: NOT_STARTED. Acceptance: INCOMPLETE; no final owner acceptance.**
Checkpoint readiness/delivery is separate from the official feature status.

| Evidence field                                 | Current verified record                                                                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intended user outcome / implemented capability | Existing Concept catalogue/Student modes are available foundations; no authoritative private Admin Concept/mode revision/admission service exists.                                                   |
| Checkpoint and delivery                        | Not started; no authoring or acceptance authority. Planning record in PR #4/dffbdc7100518769bb638c209aac8763a92a65d7, merged a16a67c08b95d16ee832270e3fc55e02c49f88bd; no implementation checkpoint. |
| Remaining product work / verification debt     | Private immutable AI-origin Concept/mode/source contracts, hierarchy mapping and controlled admission/authoring services.                                                                            |
| Real dependencies                              | No explicit ticket field; functional F043–F046 identity mapping/source authority. F048 and full F049 explicitly depend on F047.                                                                      |
| Exact next action                              | Resolve the exact AI-origin bootstrap/admission order, then contract the bounded revision/source scope. Do not mark F047 satisfied by P0/O1/G1.                                                      |

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

## Planned record — 2026-11-05

**Status: NOT_STARTED. Planning record, not an implementation-ready contract.**
This record consolidates existing approved product direction; it grants no
implementation, sequencing exception, runtime, Git or acceptance authority.
Sources: [PRD](../PRD.md), [roadmap](../DEVELOPMENT_ROADMAP.md) (original ticket and
owner-approved design reconciliation), [instructions](../../AGENTS.md).

## Approved outcome and known scope

Admin manages private Concept/mode revisions with source evidence for controlled review of AI-created learning content.

Private Concept/mode revision structures, source evidence and controlled authoring services under the approved AI-led workflow. Existing Student catalog data is not private editorial authority.

## Exclusions

No newly approved manual lesson/Topic authoring, generation, editorial decisions, publication or Student contract changes.

## Known dependencies

The original ticket has no explicit dependency field. Functional prerequisites: established Technology/Path/Module/Topic mapping (F043–F046), actual immutable AI-origin content/source contracts and F042 authority. F049 and F048 explicitly depend on F047; do not reverse that formal dependency merely because P0 exists.

## Current implementation and evidence

F021 Concept catalog model/API and Student modes exist. Private Admin revision/admission/source services are not implemented; no acceptance or live evidence is claimed.

## Unresolved contract decisions and next step

Finalize a bounded private AI-origin revision/source contract and resolve its generation bootstrap order before implementation. F049 P0 bypasses F047 only for pure offline policy, not real content.
Before implementation, finalize measurable acceptance criteria, exact paths,
authorization/privacy boundaries and meaningful offline/live verification scope.
This is a recommendation for contract work, not new detailed schema/API authority.
Preserve F042/F043 acceptance BLOCKED, F044/F045 incomplete acceptance, all
unexecuted verification groups and historical UNKNOWN; production NOT_VERIFIED.
