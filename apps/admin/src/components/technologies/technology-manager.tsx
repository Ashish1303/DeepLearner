import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AdminController } from '../../lib/auth/admin-controller';
import { useTechnologies } from '../../hooks/use-technologies';
import {
  technologyCreate,
  technologyPatch,
  validateTechnologyForm,
  type Technology,
} from '../../lib/technologies/contracts';
import styles from './technology-manager.module.css';

type Fields = {
  name: string;
  slug: string;
  description: string;
  order: string;
};
type FieldErrors = Partial<Record<keyof Fields, string>>;
function TechnologyForm({
  initial,
  busy,
  onSave,
  onClose,
}: {
  initial: Technology | null;
  busy: boolean;
  onSave: (input: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<Fields>({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    description: initial?.description ?? '',
    order: String(initial?.order ?? 0),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const form = useRef<HTMLFormElement>(null),
    submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current) return;
    const invalid = validateTechnologyForm(fields, initial);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      const name = Object.keys(invalid)[0];
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${name}"]`)
        ?.focus();
      return;
    }
    const input = initial
      ? {
          revision: initial.revision,
          name: fields.name,
          description: fields.description || null,
          order: Number(fields.order),
        }
      : {
          name: fields.name,
          slug: fields.slug,
          description: fields.description || null,
          order: Number(fields.order),
        };
    const valid = (initial ? technologyPatch : technologyCreate).safeParse(
      input,
    );
    if (!valid.success) return;
    submitting.current = true;
    try {
      await onSave(valid.data);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <form
      ref={form}
      onSubmit={(e) => void submit(e)}
      noValidate
      aria-label={initial ? 'Edit draft Technology' : 'Create draft Technology'}
      className={styles.form}
    >
      <fieldset disabled={busy}>
        <legend className="visually-hidden">
          {initial ? 'Draft details' : 'New draft details'}
        </legend>
        <label htmlFor="technology-name">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id="technology-name"
          name="name"
          value={fields.name}
          onChange={(e) => setFields({ ...fields, name: e.target.value })}
          required
          maxLength={80}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'technology-name-error' : undefined}
        />
        {errors.name && (
          <p id="technology-name-error" className={styles.fieldError}>
            {errors.name}
          </p>
        )}
        <label htmlFor="technology-slug">
          Slug <span aria-hidden="true">*</span>
        </label>
        <input
          id="technology-slug"
          name="slug"
          value={fields.slug}
          onChange={(e) => setFields({ ...fields, slug: e.target.value })}
          readOnly={Boolean(initial)}
          required
          maxLength={100}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(errors.slug)}
          aria-describedby="technology-slug-help"
        />
        <p id="technology-slug-help" className={styles.help}>
          {initial
            ? 'The slug is immutable.'
            : (errors.slug ??
              'A permanent unique identifier, such as typescript.')}
        </p>
        <label htmlFor="technology-description">Description</label>
        <textarea
          id="technology-description"
          name="description"
          rows={5}
          value={fields.description}
          onChange={(e) =>
            setFields({ ...fields, description: e.target.value })
          }
          maxLength={2000}
          aria-invalid={Boolean(errors.description)}
          aria-describedby="technology-description-help"
        />
        <p id="technology-description-help" className={styles.help}>
          {errors.description ??
            'Plain text, up to 2,000 characters. Empty clears the description.'}
        </p>
        <label htmlFor="technology-order">Display order</label>
        <input
          id="technology-order"
          name="order"
          type="text"
          inputMode="numeric"
          value={fields.order}
          onChange={(e) => setFields({ ...fields, order: e.target.value })}
          maxLength={16}
          aria-invalid={Boolean(errors.order)}
          aria-describedby={
            errors.order ? 'technology-order-error' : 'technology-order-help'
          }
        />
        <p id="technology-order-help" className={styles.help}>
          Nonnegative whole number. The inventory is sorted by slug.
        </p>
        {errors.order && (
          <p id="technology-order-error" className={styles.fieldError}>
            {errors.order}
          </p>
        )}
        <div className={styles.actions}>
          <button className="primary-action" type="submit">
            {busy ? 'Saving…' : initial ? 'Save draft changes' : 'Create draft'}
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>
            Close editor
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function statusClass(status: Technology['status']) {
  return status === 'DRAFT'
    ? styles.draft
    : status === 'PUBLISHED'
      ? styles.published
      : styles.archived;
}
export function TechnologyManager({
  auth,
  accountId,
}: {
  auth: AdminController;
  accountId: string;
}) {
  const { state, controller } = useTechnologies(auth, accountId);
  const [mode, setMode] = useState<'none' | 'create' | 'detail'>('none');
  const heading = useRef<HTMLHeadingElement>(null);
  const inventoryHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (document.visibilityState === 'visible')
      inventoryHeading.current?.focus();
  }, []);
  const close = () => {
    setMode('none');
    inventoryHeading.current?.focus();
  };
  useEffect(() => {
    if (mode !== 'none') heading.current?.focus();
  }, [mode]);
  const saving = state.status === 'saving',
    busy = saving || state.status === 'loading';
  const detail = state.detail;
  const error = ['error', 'conflict', 'uncertain', 'denied'].includes(
    state.status,
  );
  const choose = (id: string) => {
    setMode('detail');
    void controller.detail(id).then(() => heading.current?.focus());
  };
  const refresh = () => {
    setMode('none');
    void controller.list(state.query.page);
  };
  async function save(input: Record<string, unknown>) {
    if (mode === 'create') {
      const p = technologyCreate.safeParse(input);
      if (p.success) await controller.create(p.data);
    } else if (detail) {
      const p = technologyPatch.safeParse(input);
      if (p.success) await controller.patch(detail.id, p.data);
    }
    if (controller.getSnapshot().status === 'success') setMode('detail');
  }
  return (
    <section
      className={styles.workspace}
      aria-labelledby="technology-title"
      aria-busy={busy}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Curriculum / Technology inventory</p>
          <h1 id="technology-title" ref={inventoryHeading} tabIndex={-1}>
            Technologies
          </h1>
          <p className={styles.intro}>
            Organize the foundations of your curriculum. Create and refine
            drafts; published and archived records are read-only.
          </p>
        </div>
        <button
          type="button"
          className="primary-action"
          disabled={
            busy || state.needsReconciliation || state.status === 'denied'
          }
          onClick={() => setMode('create')}
        >
          + Create draft
        </button>
      </header>
      <div className={styles.toolbar}>
        <div>
          <span className={styles.sectionLabel}>Technology registry</span>
          {state.page && (
            <span className={styles.count}>
              {state.page.pagination.total}{' '}
              {state.page.pagination.total === 1
                ? 'Technology'
                : 'Technologies'}
            </span>
          )}
        </div>
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => void auth.revalidate()}
        >
          Check current access
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={refresh}
        >
          Refresh inventory
        </button>
      </div>
      {state.message && (
        <p
          role={error ? 'alert' : 'status'}
          aria-live={error ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={error ? styles.error : styles.notice}
        >
          {state.message}
        </p>
      )}
      {state.needsReconciliation && (
        <div className={styles.reconcile}>
          <p>
            Do not resubmit the previous change. Reload and compare the latest
            stored record first.
          </p>
          <div className={styles.actions}>
            {state.selected && (
              <button
                type="button"
                className="secondary-action"
                disabled={busy}
                onClick={() => choose(state.selected!)}
              >
                Reload selected Technology
              </button>
            )}
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={refresh}
            >
              Reload inventory to reconcile
            </button>
          </div>
        </div>
      )}
      <div className={styles.layout}>
        <div className={styles.inventory}>
          {state.status === 'loading' && !state.page && (
            <p role="status" className={styles.empty}>
              Loading Technologies…
            </p>
          )}
          {state.page && (
            <>
              <div className={styles.tableWrap}>
                <table>
                  <caption className="visually-hidden">
                    Technology inventory, page {state.query.page}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Technology</th>
                      <th scope="col">Status</th>
                      <th scope="col">Order</th>
                      <th scope="col">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.page.items.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">
                          <button
                            type="button"
                            className={styles.name}
                            disabled={busy}
                            onClick={() => choose(row.id)}
                          >
                            {row.name}
                          </button>
                          <span className={styles.slug}>{row.slug}</span>
                        </th>
                        <td>
                          <span
                            className={`${styles.badge} ${statusClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td>{row.order}</td>
                        <td>
                          <time dateTime={row.updatedAt}>
                            {row.updatedAt.slice(0, 10)}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.page.items.length === 0 && (
                <div className={styles.empty}>
                  <h2>No Technologies on this page</h2>
                  <p>Create a draft or return to an earlier page.</p>
                </div>
              )}
              <nav className={styles.pagination} aria-label="Technology pages">
                <p>
                  Page {state.query.page}
                  {state.page.pagination.totalPages > 0
                    ? ` of ${state.page.pagination.totalPages}`
                    : ''}
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={busy || state.query.page <= 1}
                    onClick={() => {
                      setMode('none');
                      void controller.list(state.query.page - 1);
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={
                      busy ||
                      state.query.page >= state.page.pagination.totalPages ||
                      state.query.page * state.query.limit > 10000
                    }
                    onClick={() => {
                      setMode('none');
                      void controller.list(state.query.page + 1);
                    }}
                  >
                    Next
                  </button>
                </div>
              </nav>
            </>
          )}
          {state.status === 'idle' && (
            <p className={styles.empty}>
              Load the Technology inventory to get started.
            </p>
          )}
        </div>
        {mode !== 'none' && !state.needsReconciliation && (
          <aside
            className={styles.editor}
            aria-labelledby="technology-editor-title"
          >
            <div className={styles.editorHeading}>
              <div>
                <p className="eyebrow">
                  {mode === 'create' ? 'New Technology' : 'Technology detail'}
                </p>
                <h2 id="technology-editor-title" ref={heading} tabIndex={-1}>
                  {mode === 'create'
                    ? 'Create a draft'
                    : (detail?.name ?? 'Loading detail…')}
                </h2>
              </div>
              <button
                className={styles.close}
                type="button"
                aria-label="Close Technology detail"
                disabled={saving}
                onClick={close}
              >
                ×
              </button>
            </div>
            {mode === 'detail' && detail && (
              <>
                <span
                  className={`${styles.badge} ${statusClass(detail.status)}`}
                >
                  {detail.status}
                </span>
                <dl className={styles.metadata}>
                  <div>
                    <dt>Revision</dt>
                    <dd>{detail.revision}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>
                      <time dateTime={detail.createdAt}>
                        {detail.createdAt.slice(0, 10)}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>
                      <time dateTime={detail.updatedAt}>
                        {detail.updatedAt.slice(0, 10)}
                      </time>
                    </dd>
                  </div>
                </dl>
              </>
            )}
            {mode === 'detail' && detail && detail.status !== 'DRAFT' ? (
              <div className={styles.readonly}>
                <h3>Read-only Technology</h3>
                <p>Published and archived records cannot be edited here.</p>
                <dl>
                  <dt>Slug</dt>
                  <dd>{detail.slug}</dd>
                  <dt>Description</dt>
                  <dd className={styles.description}>
                    {detail.description ?? 'No description'}
                  </dd>
                  <dt>Display order</dt>
                  <dd>{detail.order}</dd>
                </dl>
              </div>
            ) : (
              (mode === 'create' || detail) && (
                <TechnologyForm
                  key={
                    mode === 'create'
                      ? 'create'
                      : `${detail!.id}:${detail!.revision}`
                  }
                  initial={mode === 'create' ? null : detail}
                  busy={saving}
                  onSave={save}
                  onClose={close}
                />
              )
            )}
          </aside>
        )}
      </div>
      {busy && (
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            controller.cancel();
            close();
          }}
        >
          Cancel {saving ? 'change request' : 'loading'}
        </button>
      )}
      <p className={styles.footnote}>
        Draft changes do not publish content. A connection loss may leave a
        change unconfirmed; it is never replayed automatically.
      </p>
    </section>
  );
}
