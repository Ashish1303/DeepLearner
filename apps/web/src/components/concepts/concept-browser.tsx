'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useId } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useConceptBrowser } from '../../hooks/use-concept-browser';
import {
  conceptRoute,
  difficultyLabels,
  safeHttpsUrl,
  type ConceptResource,
} from '../../lib/concepts/contracts';
import { learningRoute } from '../../lib/learning-paths/routes';
import { ConceptMarkdown } from './concept-markdown';
import { ConceptExamples } from './concept-examples';
import { ConceptRevise } from './concept-revise';
import { ConceptProgress } from './concept-progress';
import styles from './concept-browser.module.css';

export function ConceptBrowser({
  resource,
  id,
}: {
  resource: ConceptResource;
  id: string;
}) {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user?.role === 'STUDENT' ? (
    <ConceptContents
      key={`${state.user.id}:${resource}:${id}`}
      resource={resource}
      id={id}
    />
  ) : null;
}
export function ConceptContents({
  resource,
  id,
}: {
  resource: ConceptResource;
  id: string;
}) {
  const { state, controller } = useConceptBrowser(resource, id);
  const [mode, setMode] = useState<'read' | 'example' | 'revise'>('read');
  const tabId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const modes = ['read', 'example', 'revise'] as const;
  const title = useRef<HTMLHeadingElement>(null);
  const results = useRef<HTMLHeadingElement>(null);
  const focused = useRef(0);
  const detailFocused = useRef(false);
  useEffect(() => {
    if (state.focusRevision > focused.current) {
      focused.current = state.focusRevision;
      (resource === 'concept' ? title : results).current?.focus();
    } else if (
      resource === 'concept' &&
      state.status === 'ready' &&
      !detailFocused.current
    ) {
      detailFocused.current = true;
      title.current?.focus();
    }
  }, [resource, state.status, state.focusRevision]);
  const loading = state.status === 'idle' || state.status === 'loading';
  const data = state.data;
  const concept = data?.concept;
  const label = resource === 'concept' ? 'Concept Read' : 'Topic overview';
  const sourceUrl = concept ? safeHttpsUrl(concept.source.url) : undefined;
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
          <li aria-current="page">
            {concept?.title ?? data?.topic.title ?? label}
          </li>
        </ol>
      </nav>
      <header>
        <h1 ref={title} tabIndex={-1}>
          {concept?.title ?? data?.topic.title ?? label}
        </h1>
        {concept ? (
          <>
            <p className={styles.level}>
              Difficulty: {difficultyLabels[concept.difficulty]}
            </p>
            <p>{concept.read.summary}</p>
            <ConceptProgress conceptId={concept.id} />
            <Link href={`/concepts/${concept.id}/practice`}>
              Practice output questions
            </Link>
          </>
        ) : (
          data && (
            <p>
              {data.topic.description?.trim()
                ? data.topic.description
                : 'Description not available yet.'}
            </p>
          )
        )}
      </header>
      <section aria-labelledby="concept-results" aria-busy={loading}>
        <h2 id="concept-results" ref={results} tabIndex={-1}>
          {resource === 'concept' ? 'Concept content' : 'Concepts'}
        </h2>
        <p role="status" aria-live="polite">
          {loading
            ? 'Loading concepts...'
            : state.status === 'ready'
              ? concept
                ? 'Concept loaded.'
                : data && !data.items.length && state.page > data.totalPages
                  ? 'The requested page has no results.'
                  : data?.totalPages
                    ? `Page ${state.page} of ${data.totalPages}.`
                    : 'Concept catalog loaded.'
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
            <p>
              <Link href="/explore-technologies">
                Return to Explore technologies
              </Link>
            </p>
          </div>
        )}
        {state.status === 'ready' &&
          data &&
          (concept ? (
            <>
              <div
                role="tablist"
                aria-label="Concept modes"
                className={styles.tabs}
              >
                {modes.map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    id={tabId + '-' + item + '-tab'}
                    aria-controls={tabId + '-' + item + '-panel'}
                    aria-selected={mode === item}
                    tabIndex={mode === item ? 0 : -1}
                    ref={(element) => {
                      tabs.current[index] = element;
                    }}
                    onClick={() => setMode(item)}
                    onKeyDown={(event) => {
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? modes.length - 1
                            : event.key === 'ArrowLeft' ||
                                event.key === 'ArrowRight'
                              ? (index +
                                  (event.key === 'ArrowRight' ? 1 : -1) +
                                  modes.length) %
                                modes.length
                              : null;
                      if (next !== null) {
                        event.preventDefault();
                        setMode(modes[next]!);
                        tabs.current[next]?.focus();
                      }
                    }}
                  >
                    {item === 'read'
                      ? 'Read'
                      : item === 'example'
                        ? 'Example'
                        : 'Revise'}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id={tabId + '-read-panel'}
                aria-labelledby={tabId + '-read-tab'}
                hidden={mode !== 'read'}
                tabIndex={0}
              >
                {mode === 'read' && (
                  <>
                    <h2>Read</h2>
                    <article
                      className={styles.read}
                      aria-label="Concept explanation"
                    >
                      <ConceptMarkdown body={concept.read.bodyMarkdown} />
                    </article>
                  </>
                )}
              </div>
              <div
                role="tabpanel"
                id={tabId + '-example-panel'}
                aria-labelledby={tabId + '-example-tab'}
                hidden={mode !== 'example'}
                tabIndex={0}
              >
                {mode === 'example' && (
                  <ConceptExamples examples={concept.examples} />
                )}
              </div>
              <div
                role="tabpanel"
                id={tabId + '-revise-panel'}
                aria-labelledby={tabId + '-revise-tab'}
                hidden={mode !== 'revise'}
                tabIndex={0}
              >
                {mode === 'revise' && <ConceptRevise revise={concept.revise} />}
              </div>
              <footer className={styles.notice}>
                <h2>Reference</h2>
                <p>
                  {concept.source.isOfficial
                    ? 'Official source'
                    : 'Reference source'}
                </p>
                <p>
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {concept.source.label} (opens in a new tab)
                    </a>
                  ) : (
                    concept.source.label
                  )}
                </p>
                <Link href={learningRoute('topic', data.topic.id)}>
                  Back to {data.topic.title}
                </Link>
              </footer>
            </>
          ) : data.items.length === 0 ? (
            <div className={styles.notice}>
              <p>
                {state.page === 1
                  ? 'No published Concepts are available yet.'
                  : 'No Concepts are available on this page.'}
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
            <ol className={styles.list}>
              {data.items.map((item) => (
                <li key={item.id}>
                  <article className={styles.card}>
                    <h3>
                      <Link href={conceptRoute(item.id)}>{item.title}</Link>
                    </h3>
                    <p className={styles.level}>
                      Difficulty: {difficultyLabels[item.difficulty]}
                    </p>
                    <p>{item.summary}</p>
                  </article>
                </li>
              ))}
            </ol>
          ))}
      </section>
      {resource === 'topic' &&
        (state.page > 1 || (data?.totalPages ?? 0) > 1) && (
          <nav aria-label="Concepts pagination" className={styles.pagination}>
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
