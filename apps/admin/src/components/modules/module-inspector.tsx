import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AdminController } from '../../lib/auth/admin-controller';
import {
  createModuleController,
  type ModuleState,
} from '../../lib/modules/module-controller';
import styles from '../learning-paths/learning-path-manager.module.css';

export function ModuleView({
  state,
  disabled,
  list,
  detail,
  retry,
}: {
  state: ModuleState;
  disabled: boolean;
  list: (page: number) => void;
  detail: (id: string) => void;
  retry: () => void;
}) {
  const busy = disabled || state.status === 'loading';
  const page = state.page?.pagination;
  return (
    <section
      className={styles.card}
      aria-labelledby="module-inventory-heading"
      aria-busy={state.status === 'loading'}
    >
      <h2 id="module-inventory-heading">Modules in this Learning Path</h2>
      <p>
        Read-only inventory, including drafts and archived records. No
        generation, review decision or publication is available here.
      </p>
      <button
        type="button"
        disabled={busy || state.status === 'denied'}
        onClick={() => list(page?.page ?? 1)}
      >
        {state.status === 'idle' ? 'Load Modules' : 'Refresh Modules'}
      </button>
      <p role="status" aria-live="polite">
        {state.status === 'loading' ? 'Loading Modules…' : state.message}
      </p>
      {state.status === 'denied' && (
        <p role="alert">Your Admin session is unavailable. Sign in again.</p>
      )}
      {state.status === 'error' && (
        <button type="button" disabled={disabled} onClick={retry}>
          Retry Module read
        </button>
      )}
      {state.page && (
        <>
          <ul className={styles.choices}>
            {state.page.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={state.detail?.id === item.id}
                  onClick={() => detail(item.id)}
                >
                  <span>{item.title}</span>
                  <span className={styles.badge}>{item.status}</span>
                </button>
              </li>
            ))}
          </ul>
          <nav aria-label="Module pages" className={styles.pager}>
            <button
              type="button"
              disabled={busy || !page || page.page <= 1}
              onClick={() => list(page!.page - 1)}
            >
              Previous Modules
            </button>
            <span>
              Module page {page?.page} · {page?.total} total
            </span>
            <button
              type="button"
              disabled={
                busy ||
                !page ||
                page.page >= page.totalPages ||
                page.page * 20 > 10000
              }
              onClick={() => list(page!.page + 1)}
            >
              Next Modules
            </button>
          </nav>
        </>
      )}
      {state.detail && (
        <section aria-labelledby="module-detail-heading">
          <h3 id="module-detail-heading">{state.detail.title}</h3>
          <p className={styles.badge}>{state.detail.status} · Read-only</p>
          <p className={styles.description}>
            {state.detail.description ?? 'No description provided.'}
          </p>
          <dl className={styles.metadata}>
            <div>
              <dt>Slug</dt>
              <dd>{state.detail.slug}</dd>
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
              <dt>Updated</dt>
              <dd>
                <time dateTime={state.detail.updatedAt}>
                  {state.detail.updatedAt}
                </time>
              </dd>
            </div>
          </dl>
        </section>
      )}
    </section>
  );
}
export function ModuleInspector({
  auth,
  accountId,
  technologyId,
  learningPathId,
  disabled,
}: {
  auth: AdminController;
  accountId: string;
  technologyId: string;
  learningPathId: string;
  disabled: boolean;
}) {
  const [controller] = useState(() =>
    createModuleController(auth, accountId, technologyId, learningPathId),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  useEffect(() => {
    const disconnect = controller.connect();
    return disconnect;
  }, [controller]);
  return (
    <ModuleView
      state={state}
      disabled={disabled}
      list={(page) => {
        void controller.list(page);
      }}
      detail={(id) => {
        void controller.detail(id);
      }}
      retry={() => {
        void controller.retry();
      }}
    />
  );
}
