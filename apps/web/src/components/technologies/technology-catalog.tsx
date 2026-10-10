'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useTechnologies } from '../../hooks/use-technologies';
import { Icon } from '../ui/icon';
import styles from './technology-catalog.module.css';
export function TechnologyCatalog() {
  const { state } = useAuth();
  // Key ownership prevents an account switch from reusing previous requests/state.
  return state.status === 'authenticated' && state.user?.role === 'STUDENT' ? (
    <CatalogContents key={state.user.id} />
  ) : null;
}
export function CatalogContents() {
  const { state, controller } = useTechnologies();
  const heading = useRef<HTMLHeadingElement>(null);
  const focused = useRef(0);
  useEffect(() => {
    if (state.focusRevision > focused.current) {
      focused.current = state.focusRevision;
      heading.current?.focus();
    }
  }, [state.focusRevision]);
  const loading = state.status === 'idle' || state.status === 'loading';
  return (
    <div className={styles.catalog}>
      <header>
        <h1>Explore technologies</h1>
        <p>
          Browse the published technology catalog. Learning paths and learning
          actions are not available here yet.
        </p>
      </header>
      <section aria-labelledby="catalog-results" aria-busy={loading}>
        <h2 id="catalog-results" ref={heading} tabIndex={-1}>
          Technology catalog
        </h2>
        <p role="status" aria-live="polite">
          {loading
            ? 'Loading technologies…'
            : state.status === 'ready'
              ? state.items.length === 0 && state.page > state.totalPages
                ? 'The requested page has no results.'
                : state.totalPages
                  ? `Page ${state.page} of ${state.totalPages}.`
                  : 'Catalog loaded.'
              : ''}
        </p>
        {state.status === 'error' && (
          <div className={styles.notice}>
            <p role="alert">{state.message}</p>
            <button type="button" onClick={() => void controller.retry()}>
              Retry
            </button>
            {state.invalidRequest && (
              <button
                type="button"
                onClick={() => void controller.load(1, state.page !== 1)}
              >
                Return to page 1
              </button>
            )}
          </div>
        )}
        {state.status === 'ready' && state.items.length === 0 && (
          <div className={styles.notice}>
            <p>
              {state.page === 1
                ? 'No technologies are available yet.'
                : 'No technologies are available on this page.'}
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
        )}
        {state.status === 'ready' && state.items.length > 0 && (
          <ul className={styles.grid}>
            {state.items.map((item) => (
              <li key={item.id}>
                <article className={styles.card}>
                  <span className={styles.mark} aria-hidden="true">
                    <Icon name="layers" />
                  </span>
                  <h3>{item.name}</h3>
                  <p>
                    {item.description?.trim()
                      ? item.description
                      : 'Description not available yet.'}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
      {(state.totalPages > 1 || state.page > 1) && (
        <nav
          className={styles.pagination}
          aria-label="Technology catalog pagination"
        >
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
            disabled={loading || state.page >= state.totalPages}
            onClick={() => void controller.load(state.page + 1, true)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
