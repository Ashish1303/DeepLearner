'use client';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useAuth } from '../../hooks/use-auth';
import { env } from '../../lib/env';
import { createCompletionClient } from '../../lib/api/completion-client';
import {
  createCompletionController,
  type CompletionState,
  type CompletionController,
} from '../../lib/progress/completion-controller';
import { VisualizationPlayer } from '../visualizations/visualization-player';
import styles from './concept-completion.module.css';

export function ConceptCompletion({ conceptId }: { conceptId: string }) {
  const { state } = useAuth(),
    user = state.user;
  if (
    state.status !== 'authenticated' ||
    state.pending ||
    !user ||
    user.role !== 'STUDENT' ||
    user.status !== 'ACTIVE' ||
    !user.emailVerified
  )
    return null;
  return (
    <CompletionContents
      key={user.id + ':' + conceptId}
      account={user.id}
      concept={conceptId}
    />
  );
}
function CompletionContents({
  account,
  concept,
}: {
  account: string;
  concept: string;
}) {
  const { controller: auth } = useAuth();
  const [controller] = useState(() =>
    createCompletionController(
      createCompletionClient(env.NEXT_PUBLIC_API_BASE_URL),
      auth,
      account,
      concept,
    ),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.load();
    return () => controller.cancel();
  }, [controller]);
  return (
    <ConceptCompletionView
      state={state}
      controller={controller}
      account={account}
      concept={concept}
    />
  );
}
const labels = {
  READ: 'Read',
  VISUALIZE: 'Visualize',
  EXAMPLE: 'Example',
  PRACTICE: 'Practice',
  REVISE: 'Revise',
} as const;
const statuses = {
  MISSING: 'Missing',
  QUALIFIED: 'Qualified',
  STALE: 'Out of date',
  REVOKED: 'Withdrawn',
  UNSUPPORTED: 'Unavailable',
} as const;
export function ConceptCompletionView({
  state,
  controller,
  account,
  concept,
}: {
  state: CompletionState;
  controller: Pick<
    CompletionController,
    'refresh' | 'retry' | 'issue' | 'respond' | 'complete'
  >;
  account: string;
  concept: string;
}) {
  const [selection, setSelection] = useState(''),
    id = useId();
  const busy = state.status === 'loading' || state.status === 'saving';
  const data = state.data,
    challenge = state.challenge;
  const actionable = state.status === 'ready';
  const announcement = useRef<HTMLParagraphElement>(null);
  const requestedFocus = useRef(false);
  useEffect(() => {
    if (requestedFocus.current && !busy) {
      requestedFocus.current = false;
      announcement.current?.focus();
    }
  }, [busy, state]);
  const act = (operation: () => unknown) => {
    requestedFocus.current = true;
    operation();
  };
  return (
    <section
      className={styles.panel}
      aria-label="Concept completion"
      aria-busy={busy}
    >
      <h2>Concept completion</h2>
      <p className={styles.note}>
        Local development only. Completion requires current server-verified
        requirements, independently of practice activity or mastery.
      </p>
      <p
        ref={announcement}
        tabIndex={-1}
        role={
          state.status === 'error' || state.status === 'uncertain'
            ? 'alert'
            : 'status'
        }
        aria-live="polite"
      >
        {state.status === 'loading'
          ? 'Loading completion requirements.'
          : state.status === 'saving'
            ? 'Saving. Please wait for confirmation.'
            : state.status === 'unavailable'
              ? 'Completion is unavailable for this Concept. This local workflow supports approved synthetic Concepts only.'
              : state.status === 'denied'
                ? 'Completion access is unavailable for this account.'
                : state.message}
      </p>
      {(state.status === 'error' || state.status === 'uncertain') && (
        <button
          type="button"
          onClick={() => act(() => void controller.retry())}
        >
          {state.status === 'uncertain'
            ? 'Retry unchanged request'
            : 'Retry requirements'}
        </button>
      )}
      {data && (
        <>
          <h3>Required participation</h3>
          <ul className={styles.requirements}>
            {data.sections.map((item) => (
              <li key={item.section}>
                <span>
                  {labels[item.section]}: {statuses[item.status]}
                </span>
                {item.section !== 'PRACTICE' && item.status !== 'QUALIFIED' && (
                  <button
                    type="button"
                    disabled={
                      !actionable ||
                      !!challenge ||
                      item.status === 'UNSUPPORTED'
                    }
                    onClick={() => {
                      setSelection('');
                      requestedFocus.current = true;
                      void controller.issue(
                        item.section as Exclude<
                          typeof item.section,
                          'PRACTICE'
                        >,
                      );
                    }}
                  >
                    {item.section === 'VISUALIZE'
                      ? 'Request visualization checkpoint'
                      : 'Prepare ' + labels[item.section] + ' acknowledgement'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!data.requiredSections.includes('REVISE') && (
            <p>Revise is optional for this policy.</p>
          )}
          <p>
            Practice threshold: {data.practice.minimumScore}%.{' '}
            {data.practice.score === null
              ? 'No qualifying score is available.'
              : 'Original qualifying score: ' + data.practice.score + '%.'}
          </p>
          <p>
            Only the first eligible saved OUTPUT submission can qualify. Answers
            are revealed after durable submission; later reveal-assisted retries
            cannot replace that original answer.
          </p>
          <Link href={'/concepts/' + concept + '/practice'}>
            Open Practice output questions
          </Link>
          {data.blockers.length > 0 && (
            <div>
              <h3>Missing or unavailable requirements</h3>
              <ul>
                {data.blockers.map((b, index) => (
                  <li key={index}>
                    {b.section ? labels[b.section] + ': ' : ''}
                    {b.code.toLowerCase().replaceAll('_', ' ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.visualization && (
            <VisualizationPlayer
              data={data.visualization.graph}
              visualizationKey={data.visualization.id + ':' + data.viewRevision}
              accountKey={account}
              headingLevel={3}
            />
          )}
          {challenge && (
            <div className={styles.challenge}>
              <p>
                Challenge expires at{' '}
                <time dateTime={challenge.challenge.expiresAt}>
                  {challenge.challenge.expiresAt}
                </time>
                . Playback and timing are not required.
              </p>
              {challenge.section === 'VISUALIZE' ? (
                <form
                  key={challenge.challenge.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (selection)
                      act(() => void controller.respond(selection));
                  }}
                >
                  <fieldset disabled={!actionable}>
                    <legend>{challenge.challenge.prompt}</legend>
                    <p>{challenge.challenge.textAlternative}</p>
                    {challenge.challenge.choices.map((choice) => (
                      <label key={choice.id} className={styles.choice}>
                        <input
                          type="radio"
                          name={id}
                          value={choice.id}
                          checked={selection === choice.id}
                          onChange={() => setSelection(choice.id)}
                          required
                        />
                        {choice.label}
                      </label>
                    ))}
                  </fieldset>
                  <button type="submit" disabled={!actionable || !selection}>
                    Submit checkpoint response
                  </button>
                </form>
              ) : (
                <>
                  <p>
                    Acknowledging {labels[challenge.section]} records
                    participation, not comprehension. Review the section content
                    before acknowledging.
                  </p>
                  <button
                    type="button"
                    disabled={!actionable}
                    onClick={() => act(() => void controller.respond())}
                  >
                    Acknowledge {labels[challenge.section]}
                  </button>
                </>
              )}
            </div>
          )}
          <p role="status">
            {data.completion.status === 'COMPLETED'
              ? 'Concept completed. Saved at ' + data.completion.completedAt
              : data.completion.status === 'STALE' ||
                  data.completion.status === 'REVOKED'
                ? 'Previous completion is no longer current. Refresh and review requirements.'
                : data.eligibility === 'ELIGIBLE'
                  ? 'Eligible to complete this Concept.'
                  : 'This Concept is not yet eligible for completion.'}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={
                !actionable ||
                data.eligibility !== 'ELIGIBLE' ||
                data.completion.status === 'COMPLETED' ||
                !!challenge
              }
              onClick={() => act(() => void controller.complete())}
            >
              Complete Concept
            </button>
            <button
              type="button"
              disabled={!actionable}
              onClick={() => {
                setSelection('');
                act(() => void controller.refresh());
              }}
            >
              Refresh requirements
            </button>
          </div>
        </>
      )}
    </section>
  );
}
