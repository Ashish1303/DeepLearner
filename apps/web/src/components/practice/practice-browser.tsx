'use client';
import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { usePractice } from '../../hooks/use-practice';
import { DRAFT_LENGTH, practiceId } from '../../lib/practice/contracts';
import type {
  PracticeController,
  PracticeState,
} from '../../lib/practice/practice-controller';
import { ConceptMarkdown } from '../concepts/concept-markdown';
import { difficultyLabels } from '../../lib/concepts/contracts';
import styles from './practice-browser.module.css';
export function PracticeBrowser({ conceptId }: { conceptId: string }) {
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
  return (
    <PracticeContents
      key={`${user.id}:${conceptId.toLowerCase()}`}
      accountId={user.id}
      conceptId={conceptId.toLowerCase()}
    />
  );
}
function PracticeContents({
  accountId,
  conceptId,
}: {
  accountId: string;
  conceptId: string;
}) {
  const { state, controller } = usePractice(accountId, conceptId);
  return (
    <PracticeView conceptId={conceptId} state={state} controller={controller} />
  );
}
export function PracticeView({
  conceptId,
  state,
  controller,
}: {
  conceptId: string;
  state: PracticeState;
  controller: PracticeController;
}) {
  const prefix = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const focused = useRef(-1);
  const clearButton = useRef<HTMLButtonElement>(null);
  const typeLabels = {
    OUTPUT: 'Output',
    DESCRIPTIVE: 'Descriptive',
    SCENARIO: 'Scenario',
    CODING: 'Coding',
  };
  const typeLabel = typeLabels[state.type];
  useEffect(() => {
    if (
      (state.status === 'ready' || state.status === 'error') &&
      state.focusRevision > focused.current
    ) {
      focused.current = state.focusRevision;
      heading.current?.focus();
    }
  }, [state.status, state.focusRevision]);
  const loading = state.status === 'idle' || state.status === 'loading';
  const data = state.data;
  return (
    <div className={styles.browser}>
      <header>
        {practiceId.safeParse(conceptId).success && (
          <Link href={`/concepts/${conceptId}`}>Back to Concept</Link>
        )}
        <h1 ref={heading} tabIndex={-1}>
          {typeLabel} practice
        </h1>
        <p id={prefix + '-instructions'}>
          Submit Answer saves your answer but does not grade it. Cancelling a
          request or clearing drafts does not delete a saved attempt. Revealed
          answers are kept only on this page.
        </p>
      </header>
      <div className={styles.controls} role="group" aria-label="Question type">
        {(['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const).map(
          (type) => (
            <button
              key={type}
              type="button"
              aria-pressed={state.type === type}
              onClick={() => {
                focused.current = state.focusRevision;
                void controller.selectType(type);
              }}
            >
              {typeLabels[type]}
            </button>
          ),
        )}
        <span>Selected: {typeLabel}</span>
      </div>
      <section aria-label={typeLabel + ' questions'} aria-busy={loading}>
        <p role="status">
          {loading
            ? `Loading ${typeLabel.toLowerCase()} questions...`
            : state.status === 'ready'
              ? data?.meta.totalPages
                ? `Page ${state.page} of ${data.meta.totalPages}.`
                : 'Questions loaded.'
              : ''}
        </p>
        {state.notice && <p role="status">{state.notice}</p>}
        {state.status === 'error' && (
          <div className={styles.notice}>
            <p role="alert">{state.message}</p>
            <button type="button" onClick={() => void controller.retry()}>
              Retry
            </button>
          </div>
        )}
        {state.status === 'ready' && data && (
          <>
            {data.data.length === 0 && (
              <p>
                {state.page === 1
                  ? `No published ${state.type} questions are available yet.`
                  : 'No questions are available on this page.'}
              </p>
            )}
            {data.data.map((item, index) => {
              const label = `${prefix}-${item.id}`;
              const number = (state.page - 1) * data.meta.limit + index + 1;
              const reveal =
                state.reveal?.questionId === item.id &&
                state.reveal.type === state.type
                  ? state.reveal
                  : null;
              return (
                <article
                  key={item.id}
                  className={styles.card}
                  aria-labelledby={label + '-heading'}
                >
                  <h2 id={label + '-heading'}>Question {number}</h2>
                  <p className={styles.level}>
                    Difficulty: {difficultyLabels[item.difficulty]}
                  </p>
                  <div className={styles.markdown}>
                    <ConceptMarkdown body={item.prompt} headingBase={3} />
                  </div>
                  {item.starterCode !== null && (
                    <>
                      <p>
                        {item.language === 'TYPESCRIPT'
                          ? 'TypeScript'
                          : 'JavaScript'}{' '}
                        question code (not executed)
                      </p>
                      <pre
                        tabIndex={0}
                        role="region"
                        aria-label={`Question ${number} code`}
                      >
                        <code>{item.starterCode}</code>
                      </pre>
                    </>
                  )}
                  <label htmlFor={label}>
                    Your{' '}
                    {state.type === 'OUTPUT'
                      ? 'output prediction'
                      : state.type === 'CODING'
                        ? 'code draft'
                        : `${typeLabel.toLowerCase()} answer`}{' '}
                    for Question {number}
                  </label>
                  <textarea
                    id={label}
                    rows={5}
                    maxLength={DRAFT_LENGTH}
                    value={state.drafts[item.id] ?? ''}
                    aria-describedby={
                      prefix + '-instructions ' + label + '-limit'
                    }
                    onChange={(event) =>
                      controller.setDraft(
                        item.id,
                        event.target.value,
                        state.type,
                      )
                    }
                  />
                  <p id={label + '-limit'}>
                    {(state.drafts[item.id] ?? '').length.toLocaleString()} /
                    10,000 characters. Kept only while this practice page stays
                    open.
                  </p>
                  <button
                    type="button"
                    onClick={() => controller.setDraft(item.id, '', state.type)}
                  >
                    Clear draft for Question {number}
                  </button>
                  <div aria-busy={reveal?.status === 'pending'}>
                    <button
                      type="button"
                      aria-describedby={prefix + '-instructions'}
                      disabled={!state.drafts[item.id]?.trim()}
                      aria-disabled={reveal?.status === 'pending'}
                      onClick={() =>
                        state.submissions?.[item.id] === 'refused'
                          ? controller.startNewSubmission(item.id, state.type)
                          : void controller.submitAnswer(item.id, state.type)
                      }
                    >
                      {state.submissions?.[item.id] === 'refused'
                        ? `Start a new submission for Question ${number}`
                        : state.submissions?.[item.id] === 'saved'
                          ? `Submit another attempt for Question ${number}`
                          : reveal?.status === 'error' ||
                              state.submissions?.[item.id] === 'uncertain'
                            ? `Retry answer submission for Question ${number}`
                            : `Submit Answer for Question ${number}`}
                    </button>
                    {reveal?.status === 'pending' && (
                      <p role="status">
                        Revealing answer for Question {number}...
                      </p>
                    )}
                    {reveal?.status === 'error' && (
                      <p role="alert">{reveal.message}</p>
                    )}
                    {reveal?.status === 'ready' && reveal.result && (
                      <section
                        aria-label={`Revealed answer for Question ${number}`}
                      >
                        <p role="status">
                          Answer revealed. This attempt has been saved but has
                          not been graded.
                        </p>
                        <p>
                          Saved attempt {reveal.result.attempt.attemptNumber} at{' '}
                          <time dateTime={reveal.result.attempt.submittedAt}>
                            {reveal.result.attempt.submittedAt}
                          </time>
                          .
                        </p>
                        <h3>Your Answer</h3>
                        <pre
                          tabIndex={0}
                          role="region"
                          aria-label={`Your submitted answer for Question ${number}`}
                        >
                          <code>{reveal.submittedAnswer}</code>
                        </pre>
                        <h3>Official Answer</h3>
                        <ConceptMarkdown
                          body={reveal.result.answer}
                          headingBase={4}
                        />
                        <h3>Explanation</h3>
                        {reveal.result.explanation === null ? (
                          <p>No explanation is available.</p>
                        ) : (
                          <ConceptMarkdown
                            body={reveal.result.explanation}
                            headingBase={4}
                          />
                        )}
                      </section>
                    )}
                  </div>
                </article>
              );
            })}
            {state.page > 1 && data.data.length === 0 && (
              <button
                type="button"
                onClick={() => void controller.load(1, true)}
              >
                Back to first page
              </button>
            )}
          </>
        )}
      </section>
      <div className={styles.controls}>
        <button
          ref={clearButton}
          type="button"
          onClick={() => controller.clearDrafts()}
        >
          Clear all drafts
        </button>
        {state.clearConfirmation !== null && (
          <div
            role="group"
            aria-label="Confirm clearing drafts"
            aria-describedby={prefix + '-clear'}
          >
            <p id={prefix + '-clear'}>
              Clear all drafts for this Concept across Output, Descriptive,
              Scenario and Coding? This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                controller.confirmClearDrafts(state.clearConfirmation!);
                clearButton.current?.focus();
              }}
            >
              Confirm clear all drafts
            </button>
            <button
              type="button"
              onClick={() => {
                controller.cancelClearDrafts();
                clearButton.current?.focus();
              }}
            >
              Keep drafts
            </button>
          </div>
        )}
        <nav aria-label="Practice pagination">
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
            disabled={loading || !data || state.page >= data.meta.totalPages}
            onClick={() => void controller.load(state.page + 1, true)}
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  );
}
