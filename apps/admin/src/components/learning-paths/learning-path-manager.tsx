import type { AdminController } from '../../lib/auth/admin-controller';
import { useLearningPaths } from '../../hooks/use-learning-paths';
import styles from './learning-path-manager.module.css';

export function LearningPathManager({
  auth,
  accountId,
}: {
  auth: AdminController;
  accountId: string;
}) {
  const { state, controller } = useLearningPaths(auth, accountId);
  const busy = state.status.startsWith('loading-');
  const parents = state.parents?.pagination;
  const paths = state.paths?.pagination;
  const canNext = (page: number, totalPages: number) =>
    page < totalPages && page * 20 <= 10000;
  return (
    <section
      className={styles.workspace}
      aria-labelledby="learning-path-heading"
      aria-busy={busy}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Curriculum inventory</p>
          <h1 id="learning-path-heading" tabIndex={-1}>
            Learning Paths
          </h1>
          <p>
            Inspect existing Learning Paths by Technology. All records are
            read-only.
          </p>
        </div>
        <button
          type="button"
          className="secondary-action"
          disabled={busy || state.status === 'denied'}
          onClick={() => {
            void controller.refresh();
          }}
        >
          Refresh
        </button>
      </header>
      <div role="status" aria-live="polite" className={styles.notice}>
        {busy
          ? state.status === 'loading-parents'
            ? 'Loading Technologies…'
            : state.status === 'loading-detail'
              ? 'Loading Learning Path detail…'
              : 'Loading Learning Paths…'
          : state.status === 'error' || state.status === 'denied'
            ? ''
            : state.message}
      </div>
      {state.status === 'denied' && (
        <p role="alert">Your Admin session is unavailable. Sign in again.</p>
      )}
      {state.status === 'error' && (
        <div role="alert" className={styles.error}>
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => {
              void controller.retry();
            }}
          >
            Retry current read
          </button>
        </div>
      )}
      <section
        className={styles.card}
        aria-labelledby="technology-chooser-heading"
        aria-busy={state.status === 'loading-parents'}
      >
        <h2 id="technology-chooser-heading">Select a Technology</h2>
        <p>
          Only the current page is loaded. Selecting another Technology clears
          previous Learning Path data.
        </p>
        <ul className={styles.choices}>
          {state.parents?.items.map((parent) => (
            <li key={parent.id}>
              <button
                type="button"
                aria-pressed={state.parent?.id === parent.id}
                onClick={() => {
                  void controller.selectTechnology(parent.id);
                }}
              >
                <span>{parent.name}</span>
                <span className={styles.badge}>{parent.status}</span>
              </button>
            </li>
          ))}
        </ul>
        {!state.parents &&
          !busy &&
          state.status !== 'error' &&
          state.status !== 'denied' && <p>No Technology selected.</p>}
        {parents && (
          <nav aria-label="Technology chooser pages" className={styles.pager}>
            <button
              type="button"
              disabled={busy || state.parentPage <= 1}
              onClick={() => {
                void controller.parents(state.parentPage - 1);
              }}
            >
              Previous Technologies
            </button>
            <span>
              Technology page {parents.page} · {parents.total} total
            </span>
            <button
              type="button"
              disabled={busy || !canNext(parents.page, parents.totalPages)}
              onClick={() => {
                void controller.parents(state.parentPage + 1);
              }}
            >
              Next Technologies
            </button>
          </nav>
        )}
      </section>
      {state.parent && (
        <section
          className={styles.card}
          aria-labelledby="path-inventory-heading"
          aria-busy={state.status === 'loading-paths'}
        >
          <p className="eyebrow">Selected Technology · last loaded metadata</p>
          <h2 id="path-inventory-heading">
            {state.parent.name} Learning Paths
          </h2>
          <span className={styles.badge}>{state.parent.status}</span>
          {state.parent.status === 'ARCHIVED' && (
            <p className={styles.notice}>
              Archived Technology: protected read-only inspection remains
              available.
            </p>
          )}
          {state.paths && (
            <>
              <div
                className={styles.scroll}
                role="region"
                aria-label="Learning Path inventory table"
                tabIndex={0}
              >
                <table>
                  <caption>Learning Path inventory, page {state.page}</caption>
                  <thead>
                    <tr>
                      {[
                        'Title',
                        'Status',
                        'Target level',
                        'Order',
                        'Updated',
                      ].map((label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.paths.items.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">
                          <button
                            type="button"
                            aria-pressed={state.selected === item.id}
                            onClick={() => {
                              void controller.detail(item.id);
                            }}
                          >
                            {item.title}
                          </button>
                        </th>
                        <td>{item.status}</td>
                        <td>{item.targetLevel ?? 'Not specified'}</td>
                        <td>{item.order}</td>
                        <td>
                          <time dateTime={item.updatedAt}>
                            {item.updatedAt.slice(0, 10)}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Learning Path pages" className={styles.pager}>
                <button
                  type="button"
                  disabled={busy || state.page <= 1}
                  onClick={() => {
                    void controller.paths(state.page - 1);
                  }}
                >
                  Previous Learning Paths
                </button>
                <span>
                  Learning Path page {paths!.page} · {paths!.total} total
                </span>
                <button
                  type="button"
                  disabled={busy || !canNext(paths!.page, paths!.totalPages)}
                  onClick={() => {
                    void controller.paths(state.page + 1);
                  }}
                >
                  Next Learning Paths
                </button>
              </nav>
            </>
          )}
          {!state.selected && !busy && state.paths?.items.length !== 0 && (
            <p>Select a Learning Path to inspect its details.</p>
          )}
        </section>
      )}
      {state.detail && (
        <section className={styles.card} aria-labelledby="path-detail-heading">
          <p className="eyebrow">Read-only Learning Path</p>
          <h2 id="path-detail-heading">{state.detail.title}</h2>
          <span className={styles.badge}>{state.detail.status}</span>
          <p className={styles.description}>
            {state.detail.description ?? 'No description provided.'}
          </p>
          <dl className={styles.metadata}>
            <div>
              <dt>Slug</dt>
              <dd>{state.detail.slug}</dd>
            </div>
            <div>
              <dt>Target level</dt>
              <dd>{state.detail.targetLevel ?? 'Not specified'}</dd>
            </div>
            <div>
              <dt>Configured completion threshold</dt>
              <dd>{state.detail.completionScore}%</dd>
            </div>
            <div>
              <dt>Display order</dt>
              <dd>{state.detail.order}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{state.detail.revision}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                <time dateTime={state.detail.createdAt}>
                  {state.detail.createdAt}
                </time>
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>
                <time dateTime={state.detail.updatedAt}>
                  {state.detail.updatedAt}
                </time>
              </dd>
            </div>
          </dl>
          <p>
            This threshold is configuration, not earned progress. Authoring and
            editorial actions are unavailable in this workspace.
          </p>
        </section>
      )}
    </section>
  );
}
