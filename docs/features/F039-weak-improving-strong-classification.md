# F039 - Weak / Improving / Strong Classification

**Status:** IN_PROGRESS
**Plan date:** 2026-10-21 (Asia/Calcutta)
**Planning result:** Slice 1 implementation and offline verification PASS; Slice 2 deferred.
**Authority for this gate:** Owner-approved Slice 1 implementation and offline
verification within four paths only. No Slice 2, canonical changes or Git delivery.
**Formal dependency:** F037, APPROVED_COMPLETE for LOCAL DEVELOPMENT.
**Operational reuse prerequisite:** F038's accepted LOCAL-only assessment/origin
and current-source proof contracts. F001-F038 remain APPROVED_COMPLETE locally.

## 1. Sources, existing capabilities and unresolved contracts

Inspected AGENTS.md; DEVELOPMENT_ROADMAP.md F039/F040/current pointer; PRD
Sections 14-15, 26, 90-91 and 95; SYSTEM_ARCHITECTURE.md modular-monolith,
server-authority and deferred progress decisions; API_DESIGN.md F036-F038;
DATABASE_DESIGN.md Sections 6, 8, 11-12 and later F037/F038 refinements; approved
F036/F037/F038 feature contracts and the relevant progress/assessment/Auth code.
The roadmap specifies the exact feature name and dependency, but no detailed
F039 algorithm or endpoint. No prior F039 feature ticket or classifier exists.
Marketing preview labels are static examples, not scored evidence.

PRD Section 26 defines configurable thresholds: Weak below 60, Improving from
60 to below 80, Strong from 80 through 100. It discusses weak topics/dashboard
recommendations without specifying Concept-to-Topic aggregation, score selection
or threshold administration. The owner explicitly selected Concept-level,
backend-only planning. Topic aggregation/recommendations and F040/F041 are excluded.

F036 attempts remain immutable SUBMITTED/null-score records. F037 counts saved
activity and returns exactly five public fields. F038 additionally maintains
genuine score summaries and COMPLETION_INPUT assessments only in its sealed LOCAL
synthetic subset. DIAGNOSTIC assessments remain a different purpose. Summary
first/latest/best numbers alone are not proof of current eligibility or provenance.
Do not widen scoring, expose answers or rewrite earlier attempts for F039.

Existing reusable code includes publishedConceptStages; current STUDENT checks;
AccessTokens.verify; strict assessment/attempt parsers; qualificationAuthority;
mongoCompletionStore.ready/scope/sources with fence=false; completionGrading.proof;
and bounded repository transaction/majority-read helpers. Existing source loaders
already select and verify the owned original policy-pinned attempt/assessment.
Their server-only records retain the identity/revision bindings omitted from
public DTOs. A public completion-view hash is not an assessment credential.

## 2. Numbered decisions for explicit owner reconciliation

| Decision | Proposed bounded contract / approval boundary |
| --- | --- |
| F039-P1 | Concept classification only; defaults WEAK <60, IMPROVING >=60 and <80, STRONG >=80, within 0-100. UNCLASSIFIED is a result for unavailable/invalid/untrusted evidence, never a fabricated zero. These defaults and Concept scope follow the owner's planning directions. |
| F039-P2 | An explicit strict versioned classification policy is mandatory. Initial server-owned profile is F039_DEFAULT_MASTERY/version 1 with improvingMinimum=60 and strongMinimum=80. Internal trusted configuration may supply another validated profile after owner approval; no HTTP, environment, Admin UI or stored-policy mechanism is added. Missing/invalid explicit policy refuses rather than falling back. |
| F039-P3 | Slice 2 supports only selection algorithm F038_ORIGINAL_FIRST_SUBMISSION_V1: the current reviewed Concept policy's single pinned OUTPUT question and its original eligible owned attemptNumber=1 plus exact COMPLETION_INPUT assessment. No best/latest selection, arbitrary assessment ID or historical/diagnostic promotion. This source-selection recommendation requires implementation approval. |
| F039-P4 | The pure function checks metadata consistency, not authenticity. Its VERIFIED claim cannot authorize itself. Only the internal adapter constructs trusted candidates after current server-side proof; pure outputs are never completion, authorization or comprehension certificates. |
| F039-P5 | Reuse existing authenticated account/publication/origin and bounded snapshot/fresh-majority proof mechanisms. Read-only paths use fence=false and never invoke grading, completion, challenge consumption or a write fence. A classifier result is a point-in-time read, not globally instantaneous revocation or multi-process consistency. |
| F039-P6 | Missing owned qualifying evidence may return UNCLASSIFIED. Known stale/revoked evidence cannot yield a label. Authentication, hidden ownership/origin, malformed stored data, database/index failure or uncertain proof retains sanitized refusal; an outage must not masquerade as an ordinary unassessed learner. |
| F039-P7 | Derive classification on demand without writing mastery or any other studentProgress field. Additive canonical clarification is required before Slice 2: the original persisted-mastery design remains a future target, not delivered persistence. Preserve exact F037/F038 public contracts and v1/v2 storage. |
| F039-P8 | Two independently accepted slices only, nine repository paths, no new dependencies/infrastructure/API/UI. Each slice ends at verification/review and a separately approved local commit. MongoDB execution, canonical amendments, completion and Git delivery have separate owner gates. |

Thresholds are classification policy, independent of F038's 70% completion rule.
A valid score 0 is WEAK, not missing; a valid 100 can be STRONG while required
sections are incomplete. No label marks a Concept completed. Current F038 grades
are binary 0/100: this adapter cannot produce IMPROVING or demonstrate improvement
after revision. The pure function supports intermediate validated scores, but a
future genuine scoring producer needs separate approval; do not invent averages,
partial credit or reveal-assisted grades to demonstrate transitions.

## 3. Slice 1 exact pure contract

Proposed export: evaluateMasteryPolicy(input: unknown). Synchronous, deterministic,
no imports from Auth/database/repository/service/router modules; no environment,
clock, random, network, storage, logging, mutation or hidden state. Use existing
Zod only. No dependency addition. Snapshot plain own data before validation;
reject accessors, custom prototypes, cycles, functions, symbols, sparse arrays,
unknown fields and unsupported structures without executing getters.

Root: strict object with exactly schemaVersion, expected, policy, assessment;
all root keys must exist. Envelope validation requires schemaVersion to be a
nonnegative safe integer; the only supported value is 1. Other well-formed numeric
versions reach UNSUPPORTED_VERSION, while strings/invalid numbers are INVALID_INPUT.
Bound the complete
metadata snapshot to 16 KiB UTF-8 equivalent, at most 256 properties and depth 6.
Oversize/unsafe structure is INVALID_INPUT. Numeric nonfinite score values reach
the explicit INVALID_SCORE check; never serialize them into a replacement null.

### 3.1 Canonical binding and policy schemas

Use these exact field names in both expected binding and nonnull assessment:

| Fields | Validation |
| --- | --- |
| userId, conceptId, questionId, completionPolicyId, rubricId | Exactly 24 lowercase hex characters, no coercion, trim or alternate encodings. |
| conceptRevision, questionRevision, contentFingerprint, completionPolicyFingerprint, sourceEpoch, rubricDefinitionFingerprint | Exactly 64 lowercase hex characters. Private comparison metadata, never output or logged. |
| completionPolicyVersion, rubricVersion | Positive safe integers, <= Number.MAX_SAFE_INTEGER. |

expected additionally contains selectedAttemptId and selectedAssessmentId (both
canonical IDs or both null), classificationPolicyId and classificationPolicyVersion.
The classification-policy ID is an ASCII token matching
`[A-Za-z0-9][A-Za-z0-9._:-]{0,63}` with exact end anchoring; its version is a
positive safe integer. Null selected IDs represent no selected assessment and
cannot match a nonnull candidate. IDs and revisions must match exactly, with no
case folding, Unicode normalization or implicit string/number conversion.

policy is exactly {id, version, improvingMinimum, strongMinimum}. id/version use
the above classification-policy bounds and must match expected. Thresholds are
finite integers satisfying 0 <= improvingMinimum < strongMinimum <= 100. The
initial explicit profile is {id:"F039_DEFAULT_MASTERY",version:1,
improvingMinimum:60,strongMinimum:80}. This is authored configuration accepted by
the trusted server constructor, not a client authorization claim. Presence of
configuration, author ID or an approval boolean does not authenticate a policy.

assessment is null, or a strict object containing all common binding fields plus:

| Field | Exact validation / supported value |
| --- | --- |
| attemptId, assessmentId | Canonical 24-hex IDs; match expected selected IDs. |
| verification | VERIFIED or UNVERIFIED, a consistency claim only in this utility. |
| lifecycle | CURRENT, STALE or REVOKED, derived by the future adapter. |
| type | One canonical Practice type; only OUTPUT is supported initially. |
| purpose | COMPLETION_INPUT or DIAGNOSTIC; only COMPLETION_INPUT is supported. |
| graderId | Bounded ASCII token up to 64 characters; only OUTPUT_EXACT_TEXT_COMPLETION supported. |
| graderVersion | Positive safe integer; only 1 supported. |
| attemptNumber | Positive safe integer; only 1 supported. |
| submissionProvenance | Bounded ASCII token up to 64 characters; only F036_FIRST_SUBMISSION_ATOMIC_V1 supported. |
| score | Missing/null means absent score; otherwise must be an actual finite number in [0,100]. No string coercion or invented score. |

Structural assessment validation deliberately defers score's numeric check until
the documented score stage. Malformed IDs/versions/enums are INVALID_ASSESSMENT;
well-formed unsupported type/purpose/grader/provenance is UNSUPPORTED_ASSESSMENT.
No student answer, expected answer, explanation, approval flag or arbitrary
additional metadata is accepted. Schema version, provenance and lifecycle checks
are consistency gates, not independently authenticated approval/revocation proof.

### 3.2 Exact result and refusal precedence

Always return exactly two fields:

`{ classification: "WEAK"|"IMPROVING"|"STRONG"|"UNCLASSIFIED", code: <allowlist> }`

Classified results have code NONE. Every other code has classification
UNCLASSIFIED. No score, account/record ID, private revision/fingerprint, policy
body, answer, arbitrary error text or completion field is returned. Return fresh
objects; leave caller objects unchanged. The result establishes no authenticity,
receipt, Stage A VERIFIED evidence, completion or mastery persistence.

Evaluate this precedence in order, returning the first applicable refusal:

1. INVALID_INPUT: unsafe/oversized data or invalid root/extra/missing root fields.
2. UNSUPPORTED_VERSION: structurally valid root, schemaVersion other than 1.
3. INVALID_CONTEXT: malformed expected binding or selected-ID null pairing.
4. INVALID_POLICY: missing/null/malformed supplied policy or invalid thresholds.
5. INVALID_ASSESSMENT: nonnull candidate has malformed structure/binding fields.
6. UNTRUSTED_ASSESSMENT: nonnull candidate verification is UNVERIFIED.
7. UNSUPPORTED_ASSESSMENT: well-formed unsupported source attributes above.
8. BINDING_MISMATCH: policy identity/version or any expected/candidate scope,
   revision or selected-record identity differs.
9. REVOKED_ASSESSMENT: candidate lifecycle is REVOKED.
10. STALE_ASSESSMENT: candidate lifecycle is STALE.
11. SCORE_MISSING: assessment is null or score is missing/null.
12. INVALID_SCORE: score is nonnumeric, nonfinite, <0 or >100.

After all checks, compare without rounding: score < improvingMinimum => WEAK;
otherwise score < strongMinimum => IMPROVING; otherwise STRONG. Under defaults,
0/59.999 are WEAK, 60/79.999 are IMPROVING and 80/100 are STRONG. -0 has numeric
zero semantics. Invalid input never reaches classification comparisons. The
default profile is explicit; an invalid supplied profile never activates it.

## 4. Slice 2 authenticated internal adapter and selection

Proposed createMasteryService constructor receives existing AccessTokens/config,
trusted repository dependencies and a validated server-owned classification
profile. Proposed classify command is exactly {accessToken,conceptId}; token is
a bounded <=4096-character JWT string and Concept ID canonical. No caller userId,
assessment ID, score, threshold, policy approval or freshness claim is accepted.
This is an internal method, not a route, startup job or automatic consumer.

1. Require LOCAL. Verify the token using existing Auth algorithms/configuration;
   derive owner from its verified subject, require STUDENT and recheck current
   ACTIVE/email-verified account. Never sign a token or trust a supplied role.
2. Verify the exact current Concept and complete published ancestry through the
   existing source loader, live sealed Option B origin and reviewed current
   Concept policy. Source must remain the approved synthetic subset; ordinary
   demo/imported accounts and unknown/restarted origin do not become eligible.
3. Invoke existing scope/sources with fence=false. Only the active reviewed
   policy's question, original owned attemptNumber=1 and exact schemaVersion=2
   COMPLETION_INPUT assessment with OUTPUT_EXACT_TEXT_COMPLETION/version 1 and
   F036_FIRST_SUBMISSION_ATOMIC_V1 can be selected. Existing parsers/bindings,
   current Admin author/reviewer/rubric audit provenance and owned majority proof
   remain required. No sort-by-highest/latest or arbitrary client assessment
   selector. B2 DIAGNOSTIC, unsupported, historical/ungraded or exposure-unknown
   records cannot supply a score. If the selected source fails, do not try an
   easier/older assessment or silently choose a lower-priority policy.
4. Construct pure expected/candidate metadata from these proven server records.
   completionPolicyId/version/fingerprint map from the assessment/policy bindings;
   selected IDs map from the exact owned attempt/assessment. The classification
   profile is independent of the completion threshold and never changes it.
5. Use a bounded read-only snapshot followed by fresh primary-majority source/
   owner proof. Reuse existing repository transaction/GradingRead machinery in
   mastery.service.ts through trusted dependencies; no new repository file is
   needed. Preserve original ten-second/three-body/two-second-reserve limits,
   no nested transaction, live per-operation proof timeouts and a final service
   deadline check after cleanup before returning. No deadline reset or unbounded
   retry. Revalidate token/current actor, exact selected source identity and all
   bindings/lifecycle/origin at proof and assert origin before return.
6. Return exactly {conceptId,classification,code}, using the pure result fields
   and the validated requested Concept. No score, record ID, private binding,
   authorization claim, expected choice or answer is exposed/logged. No caching.

The adapter must not require overall completion eligibility: genuine score 0
is still classifiable while below the separate 70% completion threshold. A
genuine score 100 does not complete missing sections. Existing loaders may refuse
contradictory related records; never bypass that refusal to recover a label.

Known current scope with no eligible assessment yields SCORE_MISSING. Explicitly
detected source revocation/staleness yields REVOKED_ASSESSMENT/STALE_ASSESSMENT.
Malformed persisted data, unverifiable provenance, index/dependency/transaction
uncertainty or failed owned proof yields existing sanitized 503 behavior, without
an apparently successful unclassified response. Authentication and hidden source/
ownership/origin failures preserve existing 401/403/generic 404 behavior. Map
reused internal repository errors to existing sanitized dependency errors; no
new public error/response contract is introduced.

This reader makes no audit/assessment/attempt/progress/completion writes and takes
no mutation fence. Current proof is a bounded observation, not serialization of
classification with future revocation. A consumer must refresh rather than treat
an old classification as permission. F038 grading/replay/revocation fences,
answer-disclosure ordering and completion validity remain unchanged.

## 5. Canonical compatibility and exact proposed additive wording

DATABASE_DESIGN.md Section 6 requires studentProgress.mastery; Section 11 includes
recalculate mastery during submission; Section 12 makes thresholds configurable.
The later approved F037/F038 refinements deliberately omit mastery from strict
v1/v2. Adding the field now would require schema/writer/completion-reader changes
outside this nine-path inventory. Therefore no mastery write, migration, backfill,
analytics index, cached label or GET repair is proposed. The existing canonical
summary remains studentProgress; an ephemeral result is not a second ledger.

The following additions are proposals requiring separate explicit owner approval
before Slice 2. Do not alter historical text or apply them in this planning gate.

**API_DESIGN.md - append "F039 internal LOCAL Concept classification":**

> F039 supplies an authenticated internal LOCAL-only Concept classification
> service, not a public endpoint or dashboard API. The server selects and freshly
> proves the original current policy-pinned owned F038 COMPLETION_INPUT assessment
> under the accepted synthetic-origin boundary. It returns only conceptId,
> classification and allowlisted code. Missing evidence is UNCLASSIFIED, not zero;
> stale/revoked or untrusted sources never yield a label. Server-owned versioned
> classification thresholds default to 60/80 independently of completion's 70%.
> Existing Auth, F036 disclosure, F037 five-field GET and F038 completion routes/
> DTOs remain unchanged. No client-controlled score/policy, UI, persistence or
> production qualification is introduced.

**DATABASE_DESIGN.md - append "F039 read-time classification refinement":**

> The persisted mastery field and submission-time recalculation in Sections 6/11
> remain a future target. F039's initial approved increment derives a current
> internal classification without writing mastery or changing studentProgress
> v1/v2. Score authority remains the original owned F038 qualifying assessment,
> with current policy/rubric/revision/origin proof, not historical summary numbers,
> ungraded attempts, activity or DIAGNOSTIC promotion. Configurable server-owned
> thresholds default to Weak <60, Improving >=60 and <80, Strong >=80 within
> 0-100; absent/invalid/untrusted evidence is UNCLASSIFIED. No new collection,
> index, provisioning, migration, TTL or backfill is introduced. Canonical stored
> completion, immutable attempts and existing first/latest/best provenance are
> unchanged. Persisted mastery/analytics requires separate owner approval.

These are additive/nonbreaking for existing models and consumers, but explicitly
defer part of the original target architecture. F039-P7 approval is mandatory;
do not imply stored mastery has been delivered. No PRD edit is proposed: the
Concept-level subset and excluded Topic/dashboard/revision progression must stay
explicit rather than claiming full weak-topic recommendation coverage.

## 6. Exact nine-path inventory and existence reconciliation

| Slice | Baseline operation | Exact literal path | Verified at planning |
| --- | --- | --- | --- |
| 1 | CREATE | apps/api/src/modules/progress/mastery-policy.ts | Absent. |
| 1 | CREATE | apps/api/tests/mastery-policy.test.ts | Absent. |
| 1 | CREATE | docs/features/F039-weak-improving-strong-classification.md | Absent before this authorized planning creation. |
| 1 | MODIFY | docs/DEVELOPMENT_ROADMAP.md | Exists; unchanged in this gate. |
| 2 | CREATE | apps/api/src/modules/progress/mastery.service.ts | Absent. |
| 2 | CREATE | apps/api/tests/mastery.test.ts | Absent. |
| 2 | CREATE | apps/api/tests/mastery.integration.ts | Absent. |
| 2 | MODIFY | docs/API_DESIGN.md | Exists; separate amendment approval required. |
| 2 | MODIFY | docs/DATABASE_DESIGN.md | Exists; separate amendment approval required. |

Slice 2 also modifies this feature document and the roadmap, already counted.
Baseline: nine unique paths, six creations/three modifications. This planning
gate fulfills the feature-document creation only; subsequent Slice 1 work uses
two creations/two modifications across its same four paths. Remaining cumulative
implementation inventory is five creations/four modifications across nine paths;
no second creation or extra path is implied by the document now existing.

Dependencies are existing Node/TypeScript/Zod, Auth, Mongoose/session/majority-read,
F038 source/provenance and F037 progress readiness modules only. No package,
environment, Auth/configuration, model, native helper, route, frontend or shared
package modification is needed. No changes to F036-F038 implementations/tickets.
If implementation requires any other repository file, STOP for scope approval.

## 7. Independent acceptance, verification and commit boundaries

### Slice 1 - pure classifier, four-path boundary

Accept only after strict schema/result/precedence implementation and focused
tests cover exact default/configured boundaries; 0/60/80/100 and fractional
neighbors; missing/invalid/nonfinite/out-of-range scores; strings/boxed values;
invalid/extra policy fields and no silent default; malformed/mismatched identities,
revisions and selected records; unsupported/diagnostic/untrusted/stale/revoked
metadata; combined-failure precedence; exact two-field DTO; no private-data echo;
determinism, frozen-input compatibility, no mutation/imported I/O/authentication.
Explicitly show that claimed VERIFIED metadata cannot establish real authority.

Run focused tests, relevant pure-policy/assessment/Concept/API regressions, API
build/source-test TypeScript, targeted lint/formatting, UTF-8/LF, exact scope and
diff checks. Review Critical/High/Medium/Low with actual file/line findings in a
separate source-diff pass. No MongoDB is needed. Stop on unresolved findings.
Report evidence; propose a separate owner-approved local commit, for example
feat(mastery): add pure Concept classification policy. Do not begin Slice 2 or
commit/push automatically after acceptance.

### Slice 2 - internal trusted adapter, seven-path boundary

Focused tests must cover genuine token/current-STUDENT eligibility, account
isolation, full publication/ancestry, canonical bindings, exact original selection,
0/100 and absent evidence, diagnostic/historical/unsupported refusal, policy/
rubric/reviewer revocation, private solution/source revision changes, lifecycle
loss, current policy mismatch, no best/latest fallback or score fabrication,
majority owned proof, uncertainty/cleanup/deadline refusal and safe DTO/errors.
Assert fence=false, absence of writes and preservation of attempts, scores,
studentProgress, completion decisions, receipts and answer secrecy. No automatic
mastery persistence or completion eligibility must follow classification.

Run relevant Auth, grading, attempt/FIFO/deadline, progress, completion and source
regressions; API build, source/test TypeScript, targeted lint/formatting, UTF-8/LF,
scope/secrets/diff checks and a separate Critical/High/Medium/Low review. Frontend
focused changes are not applicable; relevant existing Concept/Practice/Auth
rendering/controller compatibility regressions may run under implementation
approval, without browser execution. Do not rerun unrelated passing suites.

Prepare mastery.integration.ts as an explicit guarded entrypoint with no import
side effects. Separately obtain approval for a disposable integration invocation
before Slice 2 final acceptance/commit. Reuse genuine synthetic Auth/bootstrap
and current F038 creation/approval services; preserve original grade purpose.
Verify authenticated ownership and exact proven 0/100/absent outcomes, stale/
revoked/refused sources, repeated/concurrent read nonmutation, connection loss,
secrecy and F036/F037/F038 compatibility. Never force an IMPROVING fixture by
editing an existing assessment or bypassing its parser.

Execution prerequisites remain ordinary unelevated Windows, fresh exact owned
Job/native handles, approved UTC microsecond comparison, protected baselines,
127.0.0.1:27018/f021-test/deeplearner-f021-test, writable PRIMARY before enumeration,
exclusive empty storage/target and private genuine fixture credentials through
verified supervision. Full fixture readiness uses the existing 21-index manifest
(thirteen F038 prerequisites plus eight Auth declarations), verified exact names,
ordered keys, unique/options/partial/TTL; no new index. Provision only after a
separate explicit disposable allowlist approval. Negative-index manipulation or
additional definitions require specific authorization, not inferred approval.

Existing ignored launchers hardcode the F038 entrypoint/counters. This plan does
not assume that an interface supplies operational supervision or that F038
execution approval transfers. Any necessary temporary entrypoint adapter must be
enumerated/reviewed and separately authorized at the execution gate; no launcher
or native-helper edit is part of the nine repository paths. If the existing
safeguards cannot be reused safely, execution is BLOCKED rather than expanding
application scope. No test execution or credential collection occurs now.

After live verification, graceful owned cleanup and protected-baseline proof,
stop for a separate Slice 2 final review and local commit approval, for example
feat(mastery): classify trusted original Concept assessments. Push and feature
completion are separately authorized. At most these two implementation slices;
new scoring, persistence, APIs or dashboard work are separate scope decisions.

## 8. Browser, privacy, release and planning closure

No student-facing UI, public route or new browser case: **F039 additions zero;
all 153 existing browser scenarios remain NOT_RUN**. No F038 or earlier browser
exception transfers. No browser/Playwright, MongoDB, synthetic fixture, test or
service execution was performed in this planning gate. No staging/commit/push,
dependency/infrastructure change, paid/cloud resource, production deployment or
F040 implementation is authorized.

Store/log no new learner responses, expected answers, private fingerprints,
credentials or tokens. No retention, erasure, backup, production enrollment or
operational guarantee is created. Existing release requirements, real-failover/
multi-process limitations and LOCAL synthetic restrictions remain unchanged.

Plan readiness means the two-slice design/inventory is concrete, not that its
recommendations self-authorize implementation. Next gate: approve numbered
decisions and exact Slice 1 four-path implementation/offline scope. Before Slice 2,
explicitly approve its seven-path scope and Section 5 canonical additions;
disposable integration/temporary adapter and each local commit remain separate.
This gate creates only this feature document. Roadmap/current pointer/canonical
sources and F001-F038 statuses are preserved. **F039 remains NOT_STARTED.**

## 9. Slice 1 implementation and offline evidence — 2026-10-21

The preceding Sections 1-8 retain the historical planning record. The owner then
explicitly approved Slice 1 implementation/offline verification in exactly four
paths. Current status is **IN_PROGRESS**, not READY_FOR_REVIEW or APPROVED_COMPLETE.
No Slice 2 implementation, canonical amendment, feature completion or Git delivery
is authorized by this record.

### 9.1 Numbered owner-decision reconciliation — PASS

| Decision | Reconciled implementation boundary |
| --- | --- |
| F039-P1 | Concept-only labels; explicit default profile uses 60/80 boundaries. Missing, invalid, unsupported or untrusted input remains UNCLASSIFIED rather than a fabricated score. |
| F039-P2 | Strict explicit policy required; validated integer thresholds within 0-100 and exact policy ID/version binding. No implicit default, configuration mechanism or client approval authority. Alternate profiles are exercised as pure metadata fixtures only, not activated runtime policies. |
| F039-P3 | Only original OUTPUT/COMPLETION_INPUT/attemptNumber=1 provenance metadata can classify. No best/latest lookup or assessment selection is implemented; authoritative selection remains Slice 2. |
| F039-P4 | The function checks supplied metadata consistency only. VERIFIED does not authenticate a caller, assessment, policy, approval or evidence. No trusted certificate or completion decision is emitted. |
| F039-P5 | No source/authentication/database adapters, transactions or fences are called. Current authorization and owned majority proofs remain the future adapter's responsibility. |
| F039-P6 | Stable refusal precedence covers malformed, unsupported, untrusted, mismatched, revoked, stale, missing and invalid score metadata. Runtime service error mapping remains deferred. |
| F039-P7 | No mastery, attempt, assessment, progress or completion writes; original canonical persistence clarification remains a separate Slice 2 approval. |
| F039-P8 | Four-path Slice 1 boundary, existing dependencies only, independent offline verification/source review and a separate owner-approved Git checkpoint. |

### 9.2 Exact implementation scope and result

| Operation in this gate | Exact path |
| --- | --- |
| CREATE | apps/api/src/modules/progress/mastery-policy.ts |
| CREATE | apps/api/tests/mastery-policy.test.ts |
| MODIFY existing owner-approved untracked plan | docs/features/F039-weak-improving-strong-classification.md |
| MODIFY | docs/DEVELOPMENT_ROADMAP.md |

Implemented evaluateMasteryPolicy(input: unknown) separately from F038. It returns
exactly {classification,code}, with the schemas, enums and twelve refusal codes
in Section 3, and compares valid scores without rounding, clamping or coercion.
Snapshot inspection rejects executable/proxy/accessor/cyclic/custom-prototype
inputs before Zod reads them. The complete JSON-equivalent UTF-8 representation
is bounded at 16,384 bytes, 256 own properties and root-relative depth 6. Array
length counts as an own property; dense data arrays may be inspected but cannot
become a valid score. String escapes and multibyte characters count toward the
byte budget. Undefined values conservatively count as four bytes; absent/null/
undefined score is SCORE_MISSING. Nonfinite numbers retain their actual numeric
values for INVALID_SCORE, despite JSON-equivalent null accounting for size.
No numeric score is invented or replaced during validation.

The current roadmap pointer moves to F039 IN_PROGRESS; F001-F038 completion
statuses and historical evidence remain intact. PRD, API_DESIGN.md,
DATABASE_DESIGN.md and all F036-F038 implementations remain unchanged.

### 9.3 Offline verification actually obtained

- Focused: **30/30 PASS**, mastery-policy.test.ts. Covers default/fractional and
  configured boundaries, malformed/contradictory policy, absent/invalid/nonfinite
  scores, all identity/revision/selected-record bindings, unsupported/diagnostic
  sources, trust/lifecycle claims, all refusal stages and combined precedence,
  exact DTO/no echo, hostile input without executing hooks, exact byte/property/
  depth bounds, frozen/null-prototype input, determinism and import/I/O boundaries.
- Relevant API regressions: **159/159 PASS** across completion-policy.test.ts,
  output-grading.test.ts, section-evidence-policy.test.ts,
  visualization-checkpoint.test.ts, completion-grading.test.ts and
  completion-evidence.test.ts. **189 distinct selected tests PASS** overall.
  These are offline tests, not database or browser results.
- API build and source/test TypeScript: PASS. Targeted ESLint with zero warnings
  and Prettier on both TypeScript files: PASS. Documentation is excluded by the
  existing .prettierignore; reviewed manually rather than broadly reformatted.
- UTF-8 without BOM, LF, exact four-path scope, historical-content preservation
  and git diff --check: PASS. No new dependencies or configuration changes.
- Initial sandboxed focused invocation failed in tsx before assertions:
  ERR_SYSTEM_ERROR / uv_os_get_passwd / ENOMEM. The authorized ordinary-user
  invocation outside that sandbox passed all 30 tests; no test assertions were
  changed to address the environment failure. Regression invocation likewise ran
  under the ordinary Windows user. No services or real fixture credentials used.

### 9.4 Separate formal source-diff/security review — PASS

Reviewed the complete new classifier and tests plus both documentation changes
after implementation/testing, independently of test execution. **Critical: 0;
High: 0; Medium: 0; Low: 0; unresolved findings: 0.** No finding location exists
to report. Reviewed source anchors in mastery-policy.ts: lines 20-92 (strict
DTO/binding/policy/source schemas), 94-185 (bounded inert snapshot), 187-245
(fixed refusals/precedence/exact bindings/lifecycle), and 246-262 (actual numeric
validation and classification). Test assertions preserve exact results and source
boundaries; roadmap/feature changes are confined to approved scope/history.

The utility imports only existing Zod and Node's inert proxy-inspection helper.
It has no clock, random source, session, network, storage, logging, grading,
assessment selection, answer disclosure or mutable integration state. A forged
but consistent metadata fixture can compare successfully; this is explicitly
tested and is not approval or proof of genuine evidence. The future authenticated
adapter must establish authority, ownership, original selection, current
publication/revision and majority-owned provenance before constructing input.

### 9.5 Deferred work and next owner gate

Slice 2's authenticated internal adapter, exact assessment selection, genuine
source/ownership/current-proof enforcement and separately approved canonical
clarifications remain outstanding. Mastery persistence is not delivered. No public
API, UI, F040 work, MongoDB execution or browser execution occurred. F039 adds
**zero browser cases; all 153 existing scenarios remain NOT_RUN**. No earlier
browser exception transfers and no production readiness is claimed.

Next gate: owner review of this Slice 1 evidence and separate explicit approval
for its scoped local Git checkpoint. No staging, commit or push occurred here;
Slice 2 implementation/integration and feature completion remain separately gated.
