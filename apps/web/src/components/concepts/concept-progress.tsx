'use client';
import { useAuth } from '../../hooks/use-auth';
import { useConceptProgress } from '../../hooks/use-concept-progress';
import type {
  ProgressState,
  ProgressController,
} from '../../lib/progress/progress-controller';
import styles from './concept-progress.module.css';
export function ConceptProgress({ conceptId }: { conceptId: string }) {
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
    <ProgressContents
      key={user.id + ':' + conceptId}
      accountId={user.id}
      conceptId={conceptId}
    />
  );
}
function ProgressContents({
  accountId,
  conceptId,
}: {
  accountId: string;
  conceptId: string;
}) {
  const { state, controller } = useConceptProgress(accountId, conceptId);
  return (
    <ConceptProgressView state={state} retry={() => void controller.retry()} />
  );
}
export function ConceptProgressView({
  state,
  retry,
}: {
  state: ProgressState;
  retry: () => void | ReturnType<ProgressController['retry']>;
}) {
  const data = state.data;
  return (
    <section
      className={styles.panel}
      aria-label="Saved practice activity"
      aria-busy={state.status === 'loading'}
    >
      <h2>Saved practice activity</h2>
      {state.status === 'loading' && (
        <p role="status">Loading saved practice activity.</p>
      )}
      {state.status === 'error' && (
        <>
          <p role="status">Activity is temporarily unavailable.</p>
          <button type="button" onClick={retry}>
            Retry activity
          </button>
        </>
      )}
      {state.status === 'ready' && data && (
        <>
          <p role="status">
            {data.status === 'NOT_STARTED'
              ? 'No saved attempts for this Concept.'
              : 'In progress. ' +
                data.attemptCount +
                ' saved practice ' +
                (data.attemptCount === 1 ? 'attempt.' : 'attempts.')}
          </p>
          {data.startedAt && data.lastActivityAt && (
            <dl>
              <div>
                <dt>First saved attempt</dt>
                <dd>
                  <time dateTime={data.startedAt}>{data.startedAt}</time>
                </dd>
              </div>
              <div>
                <dt>Latest saved attempt</dt>
                <dd>
                  <time dateTime={data.lastActivityAt}>
                    {data.lastActivityAt}
                  </time>
                </dd>
              </div>
            </dl>
          )}
        </>
      )}
      <p className={styles.note}>
        Practice activity does not mark this Concept complete.
      </p>
    </section>
  );
}
