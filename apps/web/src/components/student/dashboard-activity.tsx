'use client';
import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useDashboard } from '../../hooks/use-dashboard';
import { conceptRoute, difficultyLabels } from '../../lib/concepts/contracts';
import {
  parseDashboardPage,
  type DashboardData,
} from '../../lib/dashboard/contracts';
import type {
  DashboardController,
  DashboardState,
} from '../../lib/dashboard/dashboard-controller';
import styles from './dashboard-activity.module.css';

type Actions = Pick<
  DashboardController,
  'refresh' | 'retry' | 'next' | 'first'
>;
const notices = {
  denied: 'Dashboard activity is not available for this account.',
  unavailable: 'Dashboard activity is temporarily unavailable.',
  'rate-limited': 'Too many requests. Please wait before retrying.',
  error: 'Dashboard activity could not be confirmed. Please retry.',
};

export function DashboardActivity() {
  const { state } = useAuth();
  const user = state.user;
  if (
    state.status !== 'authenticated' ||
    state.pending ||
    !user ||
    user.role !== 'STUDENT' ||
    user.status !== 'ACTIVE' ||
    !user.emailVerified
  )
    return null;
  return <DashboardContents key={user.id} accountId={user.id} />;
}
function DashboardContents({ accountId }: { accountId: string }) {
  const { state, controller } = useDashboard(accountId);
  return <DashboardActivityView state={state} actions={controller} />;
}
function classification(row: DashboardData['items'][number]) {
  const mastery = row.mastery;
  if (mastery.status === 'UNAVAILABLE')
    return { label: 'Classification unavailable', tone: styles.neutral };
  switch (mastery.result.classification) {
    case 'WEAK':
      return { label: 'Weak', tone: styles.weak };
    case 'IMPROVING':
      return { label: 'Improving', tone: styles.improving };
    case 'STRONG':
      return { label: 'Strong', tone: styles.strong };
    case 'UNCLASSIFIED':
      return {
        label: {
          SCORE_MISSING: 'Unclassified — no qualifying assessment',
          STALE_ASSESSMENT: 'Unclassified — assessment is out of date',
          REVOKED_ASSESSMENT: 'Unclassified — assessment has been withdrawn',
        }[mastery.result.code],
        tone: styles.neutral,
      };
  }
}

export function DashboardActivityView({
  state,
  actions,
}: {
  state: DashboardState;
  actions: Actions;
}) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusOnSuccess = useRef(false);
  let data: DashboardData | null = null;
  if (state.status === 'ready') {
    try {
      data = parseDashboardPage(state.data, state.cursor);
    } catch {
      /* Never render an unverified projection. */
    }
  }
  const status = state.status === 'ready' && !data ? 'error' : state.status;
  const loading = status === 'idle' || status === 'loading';
  const failure =
    status === 'denied' ||
    status === 'unavailable' ||
    status === 'rate-limited' ||
    status === 'error';
  useEffect(() => {
    if (status === 'ready' && focusOnSuccess.current) {
      focusOnSuccess.current = false;
      heading.current?.focus();
    } else if (!loading) focusOnSuccess.current = false;
  }, [status, loading, state.cursor, state.data]);
  const run = (action: () => Promise<void>) => {
    focusOnSuccess.current = true;
    void action();
  };
  return (
    <section
      className={styles.panel}
      aria-labelledby={headingId}
      aria-busy={loading}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Learning</span>
          <h2 id={headingId} ref={heading} tabIndex={-1}>
            Saved Concept practice
          </h2>
        </div>
        <button
          type="button"
          onClick={() => run(actions.refresh)}
          disabled={loading}
        >
          Refresh activity
        </button>
      </header>
      <p className={styles.note}>
        Saved practice and classifications are separate from Concept completion.
      </p>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.status}
      >
        {loading
          ? 'Loading saved Concept practice.'
          : status === 'ready' && data
            ? data.items.length
              ? `${data.items.length} ${data.items.length === 1 ? 'Concept' : 'Concepts'} shown.${data.pagination.nextCursor ? ' More results are available.' : ''}`
              : 'No saved Concept practice is available.'
            : ''}
      </p>
      {failure && (
        <div className={styles.notice}>
          <p role="alert">{notices[status]}</p>
          <button type="button" onClick={() => run(actions.retry)}>
            Retry activity
          </button>
        </div>
      )}
      {status === 'ready' &&
        data &&
        (data.items.length ? (
          <ul className={styles.results}>
            {data.items.map((row) => {
              const band = classification(row);
              return (
                <li key={row.concept.id}>
                  <article className={styles.record}>
                    <h3>
                      <Link
                        href={conceptRoute(row.concept.id)}
                        prefetch={false}
                      >
                        {row.concept.title}
                      </Link>
                    </h3>
                    <p className={styles.difficulty}>
                      Difficulty: {difficultyLabels[row.concept.difficulty]}
                    </p>
                    <p className={`${styles.badge} ${band.tone}`}>
                      {band.label}
                    </p>
                    <p>
                      {row.activity.attemptCount} saved practice{' '}
                      {row.activity.attemptCount === 1 ? 'attempt' : 'attempts'}
                      .
                    </p>
                    <dl>
                      <div>
                        <dt>First saved attempt (UTC)</dt>
                        <dd>
                          <time dateTime={row.activity.startedAt!}>
                            {row.activity.startedAt}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt>Latest saved attempt (UTC)</dt>
                        <dd>
                          <time dateTime={row.activity.lastActivityAt!}>
                            {row.activity.lastActivityAt}
                          </time>
                        </dd>
                      </div>
                    </dl>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>
            Explore published Concepts to find practice activities.{' '}
            <Link href="/explore-technologies" prefetch={false}>
              Explore technologies
            </Link>
          </p>
        ))}
      <nav className={styles.pagination} aria-label="Saved practice pagination">
        <button
          type="button"
          onClick={() => run(actions.first)}
          disabled={loading || state.cursor === null}
        >
          Back to first results
        </button>
        <button
          type="button"
          onClick={() => run(actions.next)}
          disabled={loading || !data?.pagination.nextCursor}
        >
          Next results
        </button>
      </nav>
    </section>
  );
}
