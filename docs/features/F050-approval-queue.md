# F050 — Approval Queue

## Planned record — 2026-11-05

**Status: NOT_STARTED. Planning record, not an implementation-ready contract.**
This record consolidates existing approved product direction; it grants no
implementation, sequencing exception, runtime, Git or acceptance authority.
Sources: [PRD](../PRD.md), [roadmap](../DEVELOPMENT_ROADMAP.md) (original ticket and
owner-approved design reconciliation), [instructions](../../AGENTS.md).

## Approved outcome and known scope

Admin can inspect outline/lesson review work and make separately authorized exact-revision decisions or request targeted AI corrections.

Review queue for outlines/lessons, approved direction for approve/reject/targeted AI revision, with visible evidence and revision identity. Detailed action semantics and APIs are not finalized.

## Exclusions

No generation engine, automatic approval/publication, invented rejection state or decision writer/queue framework.

## Known dependencies

No explicit dependency field in the original ticket. Functional prerequisites: real immutable AI-origin candidates, F047 content/source contracts and full F049 stored decision/authorization/concurrency/audit rules. F052/F053/F054 are needed for actual AI corrections.

## Current implementation and evidence

No implemented editorial queue/API/UI. F049 P0 supplies only proposed next-state evaluation, not stored approvals or CHANGES_REQUIRED resubmission.

## Unresolved contract decisions and next step

Contract the smallest exact-revision queue/decision surface after authoritative candidates and full decision semantics are established; do not infer APIs from the three P0 actions.
Before implementation, finalize measurable acceptance criteria, exact paths,
authorization/privacy boundaries and meaningful offline/live verification scope.
This is a recommendation for contract work, not new detailed schema/API authority.
Preserve F042/F043 acceptance BLOCKED, F044/F045 incomplete acceptance, all
unexecuted verification groups and historical UNKNOWN; production NOT_VERIFIED.
