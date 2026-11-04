import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AdminController } from '../../lib/auth/admin-controller';
import type { Technology } from '../../lib/technologies/contracts';
import {
  memoryNotice,
  type ProposalDraft,
} from '../../lib/learning-path-proposals/contracts';
import { useLearningPathProposal } from '../../hooks/use-learning-path-proposal';
import styles from './learning-path-proposal-form.module.css';

export type ProposalNavigation = (next: () => void) => void;
export function LearningPathProposalForm({
  auth,
  accountId,
  parent,
  registerNavigation,
}: {
  auth: AdminController;
  accountId: string;
  parent: Technology | null;
  registerNavigation?: (guard: ProposalNavigation | null) => void;
}) {
  const { state, controller } = useLearningPathProposal(auth, accountId);
  const [navigation, setNavigation] = useState<(() => void) | null>(null);
  const [navigationMessage, setNavigationMessage] = useState('');
  const region = useRef<HTMLElement>(null),
    choice = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [rowKeys, setRowKeys] = useState(() => ({
    objectives: Array.from({ length: 20 }, (_, index) => index),
    prerequisites: Array.from({ length: 20 }, (_, index) => index),
  }));
  const pendingTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    controller.setParent(parent);
  }, [controller, parent]);
  useEffect(() => {
    registerNavigation?.((next) => {
      const current = controller.getSnapshot();
      if (controller.isBusy()) {
        setNavigationMessage(
          'Wait for the current save or outcome check to settle. Logout remains available.',
        );
        return;
      }
      if (current.dirty) {
        pendingTrigger.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setNavigation(() => next);
      } else if (controller.leave()) next();
    });
    return () => registerNavigation?.(null);
  }, [controller, registerNavigation]);
  useEffect(() => {
    if (navigation) choice.current?.focus();
  }, [navigation]);
  useEffect(() => {
    if (Object.keys(state.errors).length)
      region.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [state.errors]);
  const bound = state.parent?.id === parent?.id;
  const busy = controller.isBusy();
  const editable = bound && controller.canEdit();
  const draft = state.draft;
  const edit = (next: ProposalDraft) => controller.edit(next);
  const error = (name: string) =>
    state.errors[name] ??
    (name.startsWith('objectives.')
      ? state.errors.objectives
      : name.startsWith('prerequisites.')
        ? state.errors.prerequisites
        : undefined);
  const field = (name: string) => ({
    id: 'proposal-' + name,
    'aria-invalid': Boolean(error(name)),
    'aria-describedby':
      'proposal-fields-note' + (error(name) ? ' proposal-error-' + name : ''),
  });
  const errorText = (name: string) =>
    error(name) ? (
      <span className={styles.fieldError} id={'proposal-error-' + name}>
        {error(name)}
      </span>
    ) : null;
  const focusRow = (prefix: string, index: number) => {
    queueMicrotask(() =>
      region.current
        ?.querySelector<HTMLInputElement>(`[data-row="${prefix}-${index}"]`)
        ?.focus(),
    );
  };
  const rows = (kind: 'objectives' | 'prerequisites') => {
    const values =
      kind === 'objectives'
        ? draft.objectives
        : draft.prerequisites.map((p) => p.description);
    const keys = rowKeys[kind];
    return (
      <fieldset className={styles.rows} disabled={!editable}>
        <legend>
          {kind === 'objectives'
            ? 'Objectives (1–20, distinct, ordered)'
            : 'Prerequisites (0–20, distinct, ordered)'}
        </legend>
        {values.map((value, index) => {
          const name =
            kind === 'objectives'
              ? `objectives.${index}`
              : `prerequisites.${index}.description`;
          return (
            <div key={keys[index]} className={styles.row}>
              <div>
                <label htmlFor={'proposal-' + name}>
                  {kind === 'objectives' ? 'Objective' : 'Prerequisite'}{' '}
                  {index + 1} (required when present)
                </label>
                <input
                  {...field(name)}
                  data-row={`${kind}-${index}`}
                  value={value}
                  maxLength={240}
                  required
                  onChange={(event) => {
                    const changed = [...values];
                    changed[index] = event.currentTarget.value;
                    edit(
                      kind === 'objectives'
                        ? { ...draft, objectives: changed }
                        : {
                            ...draft,
                            prerequisites: changed.map((description) => ({
                              description,
                            })),
                          },
                    );
                  }}
                />
                {errorText(name)}
              </div>
              <button
                type="button"
                aria-label={`Remove ${kind === 'objectives' ? 'objective' : 'prerequisite'} ${index + 1}`}
                disabled={
                  !editable || (kind === 'objectives' && values.length === 1)
                }
                onClick={() => {
                  const changed = values.filter((_, i) => i !== index);
                  const reordered = [...keys];
                  const removed = reordered.splice(index, 1)[0]!;
                  reordered.push(removed);
                  setRowKeys({ ...rowKeys, [kind]: reordered });
                  edit(
                    kind === 'objectives'
                      ? { ...draft, objectives: changed }
                      : {
                          ...draft,
                          prerequisites: changed.map((description) => ({
                            description,
                          })),
                        },
                  );
                  if (changed.length)
                    focusRow(kind, Math.min(index, changed.length - 1));
                  else
                    queueMicrotask(() =>
                      region.current
                        ?.querySelector<HTMLButtonElement>(
                          `[data-add="${kind}"]`,
                        )
                        ?.focus(),
                    );
                }}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          data-add={kind}
          disabled={!editable || values.length >= 20}
          onClick={() => {
            edit(
              kind === 'objectives'
                ? { ...draft, objectives: [...values, ''] }
                : {
                    ...draft,
                    prerequisites: [
                      ...draft.prerequisites,
                      { description: '' },
                    ],
                  },
            );
            focusRow(kind, values.length);
          }}
        >
          Add {kind === 'objectives' ? 'objective' : 'prerequisite'}
        </button>
        {errorText(kind)}
      </fieldset>
    );
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void controller.save();
  };
  const hasRecovery = ['uncertain', 'unresolved', 'reconciling'].includes(
    state.status,
  );
  const sameRecovery =
    hasRecovery &&
    bound &&
    auth.getProposalIntent(accountId).phase !== 'context-lost' &&
    (() => {
      const intent = auth.getProposalIntent(accountId);
      return (
        intent.phase !== 'none' &&
        intent.phase !== 'context-lost' &&
        intent.technologyId === parent?.id
      );
    })();
  return (
    <section
      className={styles.panel}
      aria-labelledby="proposal-heading"
      aria-busy={busy}
      ref={region}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Private curriculum brief</p>
          <h2 id="proposal-heading" tabIndex={-1}>
            Private Learning Path proposal
          </h2>
        </div>
        {!state.open && (
          <button
            ref={trigger}
            type="button"
            disabled={
              !parent ||
              parent.status === 'ARCHIVED' ||
              busy ||
              auth.hasTechnologyUncertainty() ||
              state.status === 'context-lost' ||
              (hasRecovery && !sameRecovery)
            }
            onClick={() => {
              controller.open();
              queueMicrotask(() =>
                region.current
                  ?.querySelector<HTMLInputElement>('#proposal-title')
                  ?.focus(),
              );
            }}
          >
            Create private proposal
          </button>
        )}
      </header>
      <p className={styles.notice}>{memoryNotice}</p>
      {!parent && <p>Select a Technology before entering a brief.</p>}
      {auth.hasTechnologyUncertainty() && (
        <p role="alert">
          A Technology change is unconfirmed. Resolve it in Technology
          Management before creating a private proposal.
        </p>
      )}
      {parent?.status === 'ARCHIVED' && (
        <p>
          Archived Technology: creation is unavailable. Existing protected
          inventory remains read-only.
        </p>
      )}
      {navigationMessage && <p role="status">{navigationMessage}</p>}
      {navigation && (
        <div
          role="group"
          aria-labelledby="proposal-discard-heading"
          className={styles.warning}
        >
          <h3 id="proposal-discard-heading" tabIndex={-1} ref={choice}>
            Discard unsaved brief?
          </h3>
          <p>Leaving clears editable inputs. No Save will be sent.</p>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => {
                setNavigation(null);
                pendingTrigger.current?.focus();
              }}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                const next = navigation;
                setNavigation(null);
                if (controller.leave()) {
                  next();
                  queueMicrotask(() =>
                    region.current
                      ?.querySelector<HTMLElement>('#proposal-heading')
                      ?.focus(),
                  );
                }
              }}
            >
              Discard draft
            </button>
          </div>
        </div>
      )}
      <div
        role={
          [
            'refused',
            'uncertain',
            'unresolved',
            'context-lost',
            'read-error',
          ].includes(state.status)
            ? 'alert'
            : 'status'
        }
        aria-live={
          [
            'refused',
            'uncertain',
            'unresolved',
            'context-lost',
            'read-error',
          ].includes(state.status)
            ? 'assertive'
            : 'polite'
        }
        className={
          state.status === 'saved' || state.status === 'resolved'
            ? styles.success
            : styles.notice
        }
      >
        {state.message}
      </div>
      {busy && (
        <p>
          Submission is disabled while this operation settles. Logout remains
          available.
        </p>
      )}
      {sameRecovery && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void controller.recover();
          }}
        >
          Check save outcome
        </button>
      )}
      {state.open &&
        bound &&
        !state.result &&
        !hasRecovery &&
        state.status !== 'context-lost' && (
          <form
            noValidate
            onSubmit={submit}
            aria-describedby="proposal-fields-note"
          >
            <p id="proposal-fields-note">
              Required fields are labelled. Use trimmed single-line text; no
              normalization is applied. This saves privately, without approval
              or publication.
            </p>
            <fieldset disabled={!editable} className={styles.fields}>
              <legend>Brief for {parent?.name}</legend>
              <label htmlFor="proposal-title">Title (required, 1–120)</label>
              <input
                {...field('title')}
                required
                maxLength={120}
                value={draft.title}
                onChange={(e) =>
                  edit({ ...draft, title: e.currentTarget.value })
                }
              />
              {errorText('title')}
              <label htmlFor="proposal-audience">
                Audience (required, 1–500)
              </label>
              <input
                {...field('audience')}
                required
                maxLength={500}
                value={draft.audience}
                onChange={(e) =>
                  edit({ ...draft, audience: e.currentTarget.value })
                }
              />
              {errorText('audience')}
              <label htmlFor="proposal-depth">Depth (required)</label>
              <select
                {...field('depth')}
                required
                value={draft.depth}
                onChange={(e) =>
                  edit({
                    ...draft,
                    depth: e.currentTarget.value as ProposalDraft['depth'],
                  })
                }
              >
                <option value="">Select depth</option>
                {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              {errorText('depth')}
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={draft.runtime !== null}
                  onChange={(e) =>
                    edit({
                      ...draft,
                      runtime: e.currentTarget.checked
                        ? { name: '', version: null }
                        : null,
                    })
                  }
                />
                Specify runtime
              </label>
              {draft.runtime && (
                <>
                  <label htmlFor="proposal-runtime.name">
                    Runtime name (required, 1–80)
                  </label>
                  <input
                    {...field('runtime.name')}
                    maxLength={80}
                    required
                    value={draft.runtime.name}
                    onChange={(e) =>
                      edit({
                        ...draft,
                        runtime: {
                          ...draft.runtime!,
                          name: e.currentTarget.value,
                        },
                      })
                    }
                  />
                  {errorText('runtime.name')}
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={draft.runtime.version === null}
                      onChange={(e) =>
                        edit({
                          ...draft,
                          runtime: {
                            ...draft.runtime!,
                            version: e.currentTarget.checked ? null : '',
                          },
                        })
                      }
                    />
                    No runtime version
                  </label>
                  {draft.runtime.version !== null && (
                    <>
                      <label htmlFor="proposal-runtime.version">
                        Runtime version (required, 1–80)
                      </label>
                      <input
                        {...field('runtime.version')}
                        maxLength={80}
                        required
                        value={draft.runtime.version}
                        onChange={(e) =>
                          edit({
                            ...draft,
                            runtime: {
                              ...draft.runtime!,
                              version: e.currentTarget.value,
                            },
                          })
                        }
                      />
                      {errorText('runtime.version')}
                    </>
                  )}
                </>
              )}
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={draft.technologyVersion === null}
                  onChange={(e) =>
                    edit({
                      ...draft,
                      technologyVersion: e.currentTarget.checked ? null : '',
                    })
                  }
                />
                No Technology version
              </label>
              {draft.technologyVersion !== null && (
                <>
                  <label htmlFor="proposal-technologyVersion">
                    Technology version (required, 1–80)
                  </label>
                  <input
                    {...field('technologyVersion')}
                    maxLength={80}
                    required
                    value={draft.technologyVersion}
                    onChange={(e) =>
                      edit({
                        ...draft,
                        technologyVersion: e.currentTarget.value,
                      })
                    }
                  />
                  {errorText('technologyVersion')}
                </>
              )}
            </fieldset>
            {rows('objectives')}
            {rows('prerequisites')}
            <div className={styles.actions}>
              <button type="submit" disabled={!editable}>
                Save private proposal
              </button>
            </div>
          </form>
        )}
      {state.result && bound && (
        <section
          aria-labelledby="proposal-result-heading"
          className={styles.result}
        >
          <h3 id="proposal-result-heading">
            Private proposal — not approved or published
          </h3>
          <h4>{state.result.title}</h4>
          <dl>
            <dt>Audience</dt>
            <dd>{state.result.audience}</dd>
            <dt>Depth</dt>
            <dd>{state.result.depth}</dd>
            <dt>Runtime</dt>
            <dd>
              {state.result.runtime
                ? state.result.runtime.name +
                  ' · ' +
                  (state.result.runtime.version ?? 'No version specified')
                : 'Not specified'}
            </dd>
            <dt>Technology version</dt>
            <dd>{state.result.technologyVersion ?? 'Not specified'}</dd>
            <dt>Revision ID</dt>
            <dd>{state.result.id}</dd>
            <dt>Proposal family</dt>
            <dd>{state.result.proposalId}</dd>
            <dt>Technology ID</dt>
            <dd>{state.result.technologyId}</dd>
            <dt>Revision / schema</dt>
            <dd>
              {state.result.revision} / {state.result.schemaVersion}
            </dd>
            <dt>Source brief / revision</dt>
            <dd>
              {state.result.source.id} / {state.result.source.revision}
            </dd>
            <dt>Created</dt>
            <dd>
              <time dateTime={state.result.createdAt}>
                {state.result.createdAt}
              </time>
            </dd>
          </dl>
          <h4>Objectives</h4>
          <ol>
            {state.result.objectives.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ol>
          <h4>Prerequisites</h4>
          {state.result.prerequisites.length ? (
            <ol>
              {state.result.prerequisites.map((v, i) => (
                <li key={i}>{v.description}</li>
              ))}
            </ol>
          ) : (
            <p>None specified.</p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy || state.status === 'loading-detail'}
              onClick={() => {
                void controller.detail();
              }}
            >
              Refresh private result
            </button>
            <button
              type="button"
              disabled={busy || parent?.status === 'ARCHIVED'}
              onClick={() => {
                controller.leave();
                controller.open();
                queueMicrotask(() =>
                  region.current
                    ?.querySelector<HTMLInputElement>('#proposal-title')
                    ?.focus(),
                );
              }}
            >
              New private proposal
            </button>
          </div>
        </section>
      )}
      {(state.open || hasRecovery || state.result) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (state.dirty) {
              setNavigation(() => () => trigger.current?.focus());
            } else {
              controller.leave();
              queueMicrotask(() => trigger.current?.focus());
            }
          }}
        >
          Back to inventory
        </button>
      )}
    </section>
  );
}
