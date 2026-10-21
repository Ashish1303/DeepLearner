import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  validateSectionEvidencePolicy as evaluate,
  sectionEvidenceRefusalCodes,
  type SectionEvidencePolicyInput,
  type SectionEvidenceRefusalCode,
} from '../src/modules/progress/section-evidence-policy.js';
import { evaluateCompletionPolicy } from '../src/modules/progress/completion-policy.js';

type Input = {
  -readonly [
    K in keyof SectionEvidencePolicyInput
  ]: SectionEvidencePolicyInput[K];
};
const objectId = 'a'.repeat(24),
  otherId = 'b'.repeat(24);
const checkpoint = {
  visualizationId: objectId,
  visualizationRevision: 'visual-v1',
  checkpointId: 'checkpoint-1',
  checkpointPolicyVersion: 1,
};
function fixture(section = 'READ'): Input {
  const scope = {
    studentId: objectId,
    conceptId: otherId,
    section,
    conceptRevision: 'concept-v1',
    sectionRevision: 'section-v1',
    policyId: 'evidence-policy',
    policyVersion: 1,
  };
  return {
    schemaVersion: 1,
    expected: {
      ...scope,
      challengeId: 'challenge-1',
      challengeState: 'AVAILABLE',
      checkpoint: section === 'VISUALIZE' ? { ...checkpoint } : null,
    },
    candidate: {
      ...scope,
      evidenceId: 'evidence-1',
      kind:
        section === 'VISUALIZE'
          ? 'CHECKPOINT_RESPONSE'
          : section === 'PRACTICE'
            ? 'PRACTICE_REFERENCE'
            : 'ACKNOWLEDGEMENT',
      origin:
        section === 'VISUALIZE'
          ? 'CHECKPOINT_SERVICE'
          : section === 'PRACTICE'
            ? 'ASSESSMENT_SERVICE'
            : 'ACKNOWLEDGEMENT_SERVICE',
      issuedAtMs: 1000,
      expiresAtMs: 2000,
      revokedAtMs: null,
      challengeId: 'challenge-1',
      checkpoint:
        section === 'VISUALIZE'
          ? { ...checkpoint, validation: 'VALIDATED' }
          : null,
      practiceLink: null,
    },
    asOfMs: 1500,
    maxAgeMs: 1000,
    observedEvidenceIds: [],
    consumedChallengeIds: [],
  };
}
function refusal(input: unknown, code: SectionEvidenceRefusalCode) {
  assert.deepEqual(evaluate(input), {
    classification: 'REFUSED',
    completionQualification: 'NOT_ESTABLISHED',
    code,
  });
}

for (const section of ['READ', 'EXAMPLE', 'REVISE', 'VISUALIZE']) {
  test(
    section + ' classifies only metadata with the exact three-field result',
    () => {
      const result = evaluate(fixture(section));
      assert.deepEqual(result, {
        classification:
          section === 'VISUALIZE'
            ? 'CHECKPOINT_CANDIDATE'
            : 'ACTIVITY_CANDIDATE',
        completionQualification: 'NOT_ESTABLISHED',
        code: null,
      });
      assert.deepEqual(Object.keys(result).sort(), [
        'classification',
        'code',
        'completionQualification',
      ]);
      assert(!JSON.stringify(result).includes(objectId));
      assert.equal(evaluateCompletionPolicy(result).eligibility, 'INELIGIBLE');
    },
  );
}
test('claimed server metadata is not authenticated or promoted to VERIFIED', () => {
  const input = fixture('VISUALIZE');
  const result = evaluate(input);
  assert.equal(result.classification, 'CHECKPOINT_CANDIDATE');
  assert.equal(result.completionQualification, 'NOT_ESTABLISHED');
  for (const word of [
    'VERIFIED',
    'ELIGIBLE',
    'COMPLETED',
    'score',
    'certificate',
  ])
    assert(!JSON.stringify(result).includes(word));
  assert.equal(
    evaluateCompletionPolicy({ ...result, verification: 'VERIFIED' })
      .eligibility,
    'INELIGIBLE',
  );
});
test('Practice references, ungraded attempts and diagnostic assessments never qualify', () => {
  for (const origin of ['ATTEMPT_SERVICE', 'ASSESSMENT_SERVICE']) {
    for (const linked of [false, true]) {
      const input = fixture('PRACTICE');
      input.candidate.origin = origin;
      input.expected.challengeId = input.candidate.challengeId = null;
      input.expected.challengeState = 'UNKNOWN';
      input.candidate.practiceLink = {
        attemptId: objectId,
        questionId: otherId,
        questionRevision: 'c'.repeat(64),
        assessmentId: linked ? objectId : null,
        assessmentPurpose: linked ? 'DIAGNOSTIC' : null,
      };
      refusal(input, 'PRACTICE_NOT_QUALIFIED');
    }
  }
  const input = fixture('PRACTICE');
  input.candidate.practiceLink = {
    attemptId: objectId,
    questionId: otherId,
    questionRevision: 'c'.repeat(64),
    assessmentId: objectId,
    assessmentPurpose: 'DIAGNOSTIC',
  };
  refusal(
    {
      ...input,
      candidate: {
        ...input.candidate,
        practiceLink: {
          ...input.candidate.practiceLink,
          assessmentPurpose: 'COMPLETION',
        },
      },
    },
    'INVALID_INPUT',
  );
});
test('viewing, playback and unauthorized metadata properties cannot shortcut the policy', () => {
  for (const section of ['READ', 'EXAMPLE', 'REVISE', 'VISUALIZE']) {
    for (const kind of ['VIEW', 'LOCAL_PLAYBACK_COMPLETE', 'SCROLL', 'TIMER']) {
      const input = fixture(section);
      input.candidate.kind = kind;
      refusal(input, 'UNSUPPORTED_EVIDENCE');
    }
    const input = fixture(section);
    input.candidate.origin = 'CLIENT';
    refusal(input, 'UNSUPPORTED_EVIDENCE');
  }
  for (const key of [
    'approved',
    'verified',
    'published',
    'owned',
    'score',
    'answer',
    'studentAnswer',
  ]) {
    const input = fixture();
    refusal(
      { ...input, candidate: { ...input.candidate, [key]: true } },
      'INVALID_INPUT',
    );
  }
});
test('every exact scope, revision and policy binding is checked', () => {
  for (const key of ['studentId', 'conceptId'] as const) {
    const input = fixture();
    input.candidate[key] = key === 'studentId' ? otherId : objectId;
    refusal(input, 'SCOPE_BINDING_MISMATCH');
  }
  const section = fixture();
  section.expected.section = 'EXAMPLE';
  refusal(section, 'SCOPE_BINDING_MISMATCH');
  for (const key of ['conceptRevision', 'sectionRevision'] as const) {
    const input = fixture();
    input.candidate[key] += '-changed';
    refusal(input, 'REVISION_MISMATCH');
  }
  const policy = fixture();
  policy.candidate.policyId += '-changed';
  refusal(policy, 'POLICY_BINDING_MISMATCH');
  const version = fixture();
  version.candidate.policyVersion++;
  refusal(version, 'POLICY_BINDING_MISMATCH');
});
test('checkpoint identity, version, validation and presence cannot be inferred', () => {
  for (const key of [
    'visualizationId',
    'visualizationRevision',
    'checkpointId',
    'checkpointPolicyVersion',
  ] as const) {
    const input = fixture('VISUALIZE');
    if (key === 'checkpointPolicyVersion') input.candidate.checkpoint![key]++;
    else
      input.candidate.checkpoint![key] =
        key === 'visualizationId' ? otherId : 'changed';
    refusal(input, 'CHECKPOINT_BINDING_INVALID');
  }
  for (const value of ['UNVALIDATED', 'UNKNOWN'] as const) {
    const input = fixture('VISUALIZE');
    input.candidate.checkpoint!.validation = value;
    refusal(input, 'CHECKPOINT_BINDING_INVALID');
  }
  for (const key of ['expected', 'candidate'] as const) {
    const input = fixture('VISUALIZE');
    input[key].checkpoint = null;
    refusal(input, 'CHECKPOINT_BINDING_INVALID');
  }
  const ack = fixture();
  ack.expected.checkpoint = { ...checkpoint };
  refusal(ack, 'CHECKPOINT_BINDING_INVALID');
  const invalid = fixture('VISUALIZE');
  refusal(
    {
      ...invalid,
      candidate: {
        ...invalid.candidate,
        checkpoint: { ...invalid.candidate.checkpoint, validation: 'APPROVED' },
      },
    },
    'INVALID_INPUT',
  );
});
test('expiry equality, exact maximum age and timestamp representation boundaries', () => {
  const input = fixture();
  input.asOfMs = input.candidate.issuedAtMs;
  assert.equal(evaluate(input).classification, 'ACTIVITY_CANDIDATE');
  input.asOfMs = input.candidate.expiresAtMs - 1;
  assert.equal(evaluate(input).classification, 'ACTIVITY_CANDIDATE');
  input.asOfMs++;
  refusal(input, 'EVIDENCE_EXPIRED');
  const zero = fixture();
  zero.candidate.issuedAtMs = zero.asOfMs = 0;
  zero.candidate.expiresAtMs = zero.maxAgeMs = 1;
  assert.equal(evaluate(zero).classification, 'ACTIVITY_CANDIDATE');
  const max = fixture();
  max.candidate.issuedAtMs = max.asOfMs = 8_640_000_000_000_000 - 1;
  max.candidate.expiresAtMs = max.asOfMs + 1;
  max.maxAgeMs = 1;
  assert.equal(evaluate(max).classification, 'ACTIVITY_CANDIDATE');
  for (const bad of [
    -1,
    0.5,
    NaN,
    Infinity,
    8_640_000_000_000_001,
    '1500',
    null,
  ])
    refusal({ ...fixture(), asOfMs: bad }, 'INVALID_INPUT');
  refusal({ ...fixture(), maxAgeMs: 0 }, 'INVALID_INPUT');
});
test('contradictory, future, expired and revoked metadata fail deterministically', () => {
  const variants: ((i: Input) => void)[] = [
    (i) => {
      i.candidate.issuedAtMs = i.asOfMs + 1;
    },
    (i) => {
      i.candidate.expiresAtMs = i.candidate.issuedAtMs;
    },
    (i) => {
      i.candidate.expiresAtMs++;
    },
    (i) => {
      i.candidate.revokedAtMs = i.candidate.issuedAtMs - 1;
    },
    (i) => {
      i.candidate.revokedAtMs = i.asOfMs + 1;
    },
  ];
  for (const mutate of variants) {
    const input = fixture();
    mutate(input);
    refusal(input, 'INVALID_LIFECYCLE');
  }
  const revoked = fixture();
  revoked.candidate.revokedAtMs = revoked.candidate.issuedAtMs;
  refusal(revoked, 'EVIDENCE_REVOKED');
  revoked.asOfMs = revoked.candidate.expiresAtMs;
  refusal(revoked, 'EVIDENCE_REVOKED');
});
test('unknown, missing, mismatched and consumed challenge metadata refuse', () => {
  const unknown = fixture();
  unknown.expected.challengeState = 'UNKNOWN';
  unknown.candidate.challengeId = null;
  refusal(unknown, 'REPLAY_STATE_UNAVAILABLE');
  for (const key of ['expected', 'candidate'] as const) {
    const input = fixture();
    input[key].challengeId = null;
    refusal(input, 'CHALLENGE_BINDING_MISMATCH');
  }
  const both = fixture();
  both.expected.challengeId = both.candidate.challengeId = null;
  refusal(both, 'CHALLENGE_BINDING_MISMATCH');
  const mismatch = fixture();
  mismatch.candidate.challengeId = 'different';
  refusal(mismatch, 'CHALLENGE_BINDING_MISMATCH');
  const consumed = fixture();
  consumed.expected.challengeState = 'CONSUMED';
  refusal(consumed, 'REPLAY_DETECTED');
  const listed = fixture();
  listed.consumedChallengeIds = ['challenge-1'];
  refusal(listed, 'REPLAY_DETECTED');
  const observed = fixture('PRACTICE');
  observed.observedEvidenceIds = [observed.candidate.evidenceId];
  refusal(observed, 'REPLAY_DETECTED');
  const practice = fixture('PRACTICE');
  practice.expected.challengeId = practice.candidate.challengeId = null;
  practice.expected.challengeState = 'CONSUMED';
  refusal(practice, 'PRACTICE_NOT_QUALIFIED');
});
test('replay snapshots are bounded, unique, dense and not an authoritative ledger', () => {
  const input = fixture();
  for (const key of ['observedEvidenceIds', 'consumedChallengeIds'] as const) {
    input[key] = Array.from({ length: 64 }, (_, n) => 'prior-' + n);
    assert.equal(evaluate(input).classification, 'ACTIVITY_CANDIDATE');
    input[key].push('extra');
    refusal(input, 'INVALID_INPUT');
    input[key] = ['same', 'same'];
    refusal(input, 'INVALID_INPUT');
    input[key] = [];
  }
  refusal({ ...input, observedEvidenceIds: Array(1) }, 'INVALID_INPUT');
  const decorated = ['x'];
  Object.defineProperty(decorated, 'extra', { value: 'y' });
  refusal({ ...input, observedEvidenceIds: decorated }, 'INVALID_INPUT');
  // No storage/consumption: repeated empty-snapshot calls remain metadata candidates.
  assert.deepEqual(evaluate(input), evaluate(input));
});
test('strict missing fields, IDs, token forms, bounds and unknown schema versions', () => {
  for (const key of Object.keys(fixture())) {
    const input = fixture() as unknown as Record<string, unknown>;
    delete input[key];
    refusal(input, 'INVALID_INPUT');
  }
  for (const key of Object.keys(fixture().candidate)) {
    const input = fixture();
    delete (input.candidate as Record<string, unknown>)[key];
    refusal(input, 'INVALID_INPUT');
  }
  for (const bad of [
    'A'.repeat(24),
    'a'.repeat(23),
    'a'.repeat(25),
    objectId + '\n',
    1,
  ])
    refusal(
      { ...fixture(), candidate: { ...fixture().candidate, studentId: bad } },
      'INVALID_INPUT',
    );
  for (const bad of ['', 'white space', 'x\n', 'é', '_bad', 'x'.repeat(129)])
    refusal(
      {
        ...fixture(),
        candidate: { ...fixture().candidate, sectionRevision: bad },
      },
      'INVALID_INPUT',
    );
  for (const bad of [0, -1, 1.1, Infinity, Number.MAX_SAFE_INTEGER + 1])
    refusal({ ...fixture(), schemaVersion: bad }, 'INVALID_INPUT');
  refusal({ ...fixture(), schemaVersion: 2 }, 'UNSUPPORTED_VERSION');
  const max = fixture();
  max.candidate.policyVersion = max.expected.policyVersion =
    Number.MAX_SAFE_INTEGER;
  max.candidate.sectionRevision = max.expected.sectionRevision = 'a'.repeat(
    128,
  );
  assert.equal(evaluate(max).classification, 'ACTIVITY_CANDIDATE');
});
test('unsafe objects, getters and proxies are rejected without invoking supplied code', () => {
  let invoked = 0;
  const getter = fixture();
  Object.defineProperty(getter.candidate, 'origin', {
    enumerable: true,
    get() {
      invoked++;
      throw Error('must not run');
    },
  });
  const proxy = new Proxy(fixture(), {
    ownKeys() {
      invoked++;
      throw Error('must not run');
    },
  });
  const nested = fixture();
  nested.observedEvidenceIds = new Proxy([], {
    get() {
      invoked++;
      throw Error('must not run');
    },
  });
  const accessorArray: string[] = [];
  Object.defineProperty(accessorArray, '0', {
    enumerable: true,
    get() {
      invoked++;
      return 'bad';
    },
  });
  for (const input of [
    getter,
    proxy,
    nested,
    { ...fixture(), observedEvidenceIds: accessorArray },
    new Date(),
    () => {},
    undefined,
    null,
    true,
  ])
    refusal(input, 'INVALID_INPUT');
  const cycle: Record<string, unknown> = {};
  cycle.loop = cycle;
  refusal(cycle, 'INVALID_INPUT');
  const hidden = fixture();
  Object.defineProperty(hidden, 'hidden', { value: 1 });
  refusal(hidden, 'INVALID_INPUT');
  const symbolic = fixture();
  Object.defineProperty(symbolic, Symbol('hidden'), { value: 1 });
  refusal(symbolic, 'INVALID_INPUT');
  refusal(Object.assign(Object.create({}), fixture()), 'INVALID_INPUT');
  refusal(
    { ...fixture(), candidate: { ...fixture().candidate, origin: undefined } },
    'INVALID_INPUT',
  );
  let deep: unknown = null;
  for (let n = 0; n < 8; n++) deep = { nested: deep };
  refusal(deep, 'INVALID_INPUT');
  assert.equal(invoked, 0);
});

const failures: ((i: Input) => void)[] = [
  (i) => {
    Object.defineProperty(i, 'extra', { value: true, enumerable: true });
  },
  (i) => {
    i.schemaVersion = 2;
  },
  (i) => {
    i.expected.section = 'FUTURE';
  },
  (i) => {
    i.candidate.origin = 'CLIENT';
  },
  (i) => {
    i.candidate.policyVersion++;
  },
  (i) => {
    i.candidate.conceptId = objectId;
  },
  (i) => {
    i.candidate.sectionRevision = 'old';
  },
  (i) => {
    i.expected.checkpoint = { ...checkpoint };
  },
  (i) => {
    // Keep this defect present when a later case changes the evaluation instant.
    i.candidate.expiresAtMs = i.candidate.issuedAtMs;
  },
  (i) => {
    i.candidate.revokedAtMs = 1100;
  },
  (i) => {
    i.asOfMs = i.candidate.expiresAtMs;
  },
  (i) => {
    i.expected.challengeState = 'UNKNOWN';
  },
  (i) => {
    i.candidate.challengeId = 'wrong';
  },
  (i) => {
    i.observedEvidenceIds = [i.candidate.evidenceId];
  },
  () => {},
];
sectionEvidenceRefusalCodes.forEach((code, n) =>
  test('exact refusal and precedence: ' + code, () => {
    const input = fixture('PRACTICE');
    failures[n]!(input);
    refusal(input, code);
    for (let later = n + 1; later < failures.length; later++) {
      const mixed = fixture('PRACTICE');
      failures[n]!(mixed);
      failures[later]!(mixed);
      refusal(mixed, code);
    }
  }),
);
test('frozen inputs remain unchanged and repeated outputs are fresh plain metadata', () => {
  const input = fixture('VISUALIZE');
  const before = JSON.stringify(input);
  function freeze(v: unknown) {
    if (v && typeof v === 'object') {
      for (const child of Object.values(v)) freeze(child);
      Object.freeze(v);
    }
  }
  freeze(input);
  const first = evaluate(input),
    second = evaluate(input);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(JSON.stringify(input), before);
});
test('source boundary excludes IO, clocks, logging and existing runtime adapters', () => {
  const source = readFileSync(
    new URL(
      '../src/modules/progress/section-evidence-policy.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.deepEqual(
    [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]),
    ['node:util', 'zod'],
  );
  assert(
    !/Date\.|performance\.|process\.|console\.|fetch\(|Math\.random|mongoose|readFile|writeFile/.test(
      source,
    ),
  );
});
