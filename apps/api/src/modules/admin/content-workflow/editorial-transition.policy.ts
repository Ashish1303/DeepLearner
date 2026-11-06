import {
  invalidEditorialTransition,
  validateEditorialTransition,
} from './editorial-transition.schema.js';

export type EditorialNextState = 'IN_REVIEW' | 'CHANGES_REQUIRED' | 'APPROVED';

/**
 * Propose a local next state, never an authenticated/stored editorial decision.
 * Consumers must independently resolve authoritative AI-origin content, current
 * Admin authority, quality gates, transactional concurrency, audit and replay.
 */
export function proposeEditorialTransition(input: unknown): EditorialNextState {
  const { current, expected, action } = validateEditorialTransition(input);
  if (
    current.revision.id !== expected.id ||
    current.revision.revision !== expected.revision ||
    current.revision.digest !== expected.digest
  )
    throw invalidEditorialTransition();

  if (current.state === 'AI_GENERATED' && action === 'SUBMIT_FOR_REVIEW')
    return 'IN_REVIEW';
  if (current.state === 'IN_REVIEW') {
    if (action === 'REQUEST_CHANGES') return 'CHANGES_REQUIRED';
    if (action === 'APPROVE') return 'APPROVED';
  }
  throw invalidEditorialTransition();
}
