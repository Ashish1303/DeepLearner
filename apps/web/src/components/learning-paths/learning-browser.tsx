'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useLearningBrowser } from '../../hooks/use-learning-browser';
import { learningRoute, type Resource } from '../../lib/learning-paths/routes';
import styles from './learning-browser.module.css';
export function LearningBrowser({
  resource,
  id,
}: {
  resource: Resource;
  id: string;
}) {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user?.role === 'STUDENT' ? (
    <LearningContents
      key={`${state.user.id}:${resource}:${id}`}
      resource={resource}
      id={id}
    />
  ) : null;
}
export function LearningContents({
  resource,
  id,
}: {
  resource: Resource;
  id: string;
}) {
  const { state, controller } = useLearningBrowser(resource, id);
  const heading = useRef<HTMLHeadingElement>(null);
  const focused = useRef(0);
  useEffect(() => {
    if (state.focusRevision > focused.current) {
      focused.current = state.focusRevision;
      heading.current?.focus();
    }
  }, [state.focusRevision]);
  const loading = state.status === 'idle' || state.status === 'loading';
  const data = state.data;
  const label =
    resource === 'technology'
      ? 'Learning paths'
      : resource === 'path'
        ? 'Modules'
        : resource === 'module'
          ? 'Topics'
          : 'Topic overview';
  const child: Resource =
    resource === 'technology'
      ? 'path'
      : resource === 'path'
        ? 'module'
        : 'topic';
  return (
    <div className={styles.browser}>
      <nav aria-label="Breadcrumb">
        <ol className={styles.breadcrumbs}>
          {(
            data?.crumbs ?? [
              { title: 'Explore technologies', href: '/explore-technologies' },
            ]
          ).map((crumb) => (
            <li key={crumb.href}>
              <Link href={crumb.href}>{crumb.title}</Link>
            </li>
          ))}
          <li aria-current="page">{data?.title ?? label}</li>
        </ol>
      </nav>
      <header>
        <h1>{data?.title ?? label}</h1>
        {data && (
          <p>
            {data.description?.trim()
              ? data.description
              : resource === 'technology'
                ? 'Browse published learning paths for this technology.'
                : 'Description not available yet.'}
          </p>
        )}
        {data?.targetLevel && (
          <p className={styles.level}>
            Level: {data.targetLevel.toLowerCase()}
          </p>
        )}
      </header>
      <section aria-labelledby="learning-results" aria-busy={loading}>
        <h2 id="learning-results" ref={heading} tabIndex={-1}>
          {label}
        </h2>
        <p role="status" aria-live="polite">
          {loading
            ? 'Loading catalog…'
            : state.status === 'ready'
              ? resource === 'topic'
                ? 'Topic loaded.'
                : data && !data.items.length && state.page > data.totalPages
                  ? 'The requested page has no results.'
                  : data?.totalPages
                    ? `Page ${state.page} of ${data.totalPages}.`
                    : 'Catalog loaded.'
              : ''}
        </p>
        {state.status === 'error' && (
          <div className={styles.notice}>
            <p role="alert">{state.message}</p>
            <button type="button" onClick={() => void controller.retry()}>
              Retry
            </button>
            {state.invalidRequest && state.page > 1 && (
              <button
                type="button"
                onClick={() => void controller.load(1, true)}
              >
                Return to page 1
              </button>
            )}
          </div>
        )}
        {state.status === 'ready' &&
          data &&
          (resource === 'topic' ? (
            <div className={styles.notice}>
              <p>Learning content is not yet available for this topic.</p>
            </div>
          ) : data.items.length === 0 ? (
            <div className={styles.notice}>
              <p>
                {state.page === 1
                  ? `No ${label.toLowerCase()} are available yet.`
                  : `No ${label.toLowerCase()} are available on this page.`}
              </p>
              {state.page > 1 && (
                <button
                  type="button"
                  onClick={() => void controller.load(1, true)}
                >
                  Return to page 1
                </button>
              )}
            </div>
          ) : (
            <ol
              className={resource === 'technology' ? styles.grid : styles.list}
            >
              {data.items.map((item) => (
                <li key={item.id}>
                  <article className={styles.card}>
                    <h3>
                      <Link href={learningRoute(child, item.id)}>
                        {item.title}
                      </Link>
                    </h3>
                    <p>
                      {item.description?.trim()
                        ? item.description
                        : 'Description not available yet.'}
                    </p>
                    {'targetLevel' in item && item.targetLevel && (
                      <p className={styles.level}>
                        Level: {item.targetLevel.toLowerCase()}
                      </p>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          ))}
      </section>
      {resource !== 'topic' &&
        (state.page > 1 || (data?.totalPages ?? 0) > 1) && (
          <nav aria-label={`${label} pagination`} className={styles.pagination}>
            <button
              type="button"
              disabled={loading || state.page <= 1}
              onClick={() => void controller.load(state.page - 1, true)}
            >
              Previous
            </button>
            <span>Page {state.page}</span>
            <button
              type="button"
              disabled={loading || !data || state.page >= data.totalPages}
              onClick={() => void controller.load(state.page + 1, true)}
            >
              Next
            </button>
          </nav>
        )}
    </div>
  );
}
