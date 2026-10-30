import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  AdminController,
  AdminState,
} from '../../lib/auth/admin-controller';
import { isEligibleAdminState } from '../../hooks/use-admin-auth';

const messages: Record<AdminState['status'], string> = {
  idle: 'Sign in with your Admin account, or explicitly restore an existing session.',
  checking: 'Checking current Admin access. Protected content is hidden.',
  eligible: 'Current Admin eligibility has been checked.',
  anonymous: 'You are signed out. Sign in or restore an existing session.',
  denied:
    'This account cannot access Admin. Use a verified, active Admin account.',
  expired: 'Your session is unavailable or expired. Sign in again.',
  unavailable:
    'The service is temporarily unavailable. Try again when it is available.',
  'rate-limited': 'Too many requests. Wait before trying again.',
  error: 'Sign-in could not be completed. Check your details and try again.',
  unsupported:
    'Safe session coordination is unavailable. Use a supported secure browser context.',
  uncertain:
    'The session request could not be confirmed. Sign in again or retry sign-out. Restoration will not be replayed.',
};
const errors = new Set<AdminState['status']>([
  'denied',
  'expired',
  'unavailable',
  'rate-limited',
  'error',
  'unsupported',
  'uncertain',
]);
function inputField(
  value: Element | RadioNodeList | null,
): HTMLInputElement | null {
  return value && 'tagName' in value && value.tagName === 'INPUT'
    ? (value as HTMLInputElement)
    : null;
}
export function AdminAccess({
  state,
  controller,
  available = true,
}: {
  state: AdminState;
  controller: AdminController;
  available?: boolean;
}) {
  const eligible = isEligibleAdminState(state) && available;
  const heading = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);
  const focusAfter = useRef(false);
  const wasEligible = useRef(eligible);
  const actionBusy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = state.pending || submitting;
  const safeStatus = !available
    ? 'unavailable'
    : state.status === 'eligible' && !eligible
      ? 'uncertain'
      : Object.hasOwn(messages, state.status)
        ? state.status
        : 'uncertain';
  const disabled = busy || !available || safeStatus === 'unsupported';
  const message =
    state.message === 'Invalid email or password.'
      ? 'Invalid email or password.'
      : messages[safeStatus];
  useEffect(() => {
    mounted.current = true;
    const form = formRef.current;
    return () => {
      mounted.current = false;
      const field = form?.elements.namedItem('password');
      const password = field ? inputField(field) : null;
      if (password) password.value = '';
    };
  }, [eligible]);
  useEffect(() => {
    if (wasEligible.current && !eligible) focusAfter.current = true;
    wasEligible.current = eligible;
    if (focusAfter.current && !busy && document.visibilityState === 'visible') {
      heading.current?.focus();
      focusAfter.current = false;
    }
  }, [eligible, busy, state.status, state.user?.id]);
  async function perform(action: () => Promise<void>) {
    if (
      actionBusy.current ||
      state.pending ||
      !available ||
      state.status === 'unsupported'
    )
      return;
    actionBusy.current = true;
    focusAfter.current = true;
    setSubmitting(true);
    try {
      await action();
    } catch {
      controller.cancel();
    } finally {
      actionBusy.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = inputField(form.elements.namedItem('email'));
    const field = inputField(form.elements.namedItem('password'));
    if (!email || !field) return;
    let password = field.value;
    // Keep the password out of React state and clear its DOM field immediately.
    field.value = '';
    try {
      await perform(() => controller.login(email.value, password));
    } finally {
      password = '';
      field.value = '';
    }
  }
  const announcement = (
    <p
      id="admin-access-status"
      className={
        errors.has(safeStatus) ? 'access-status access-error' : 'access-status'
      }
      role={errors.has(safeStatus) ? 'alert' : 'status'}
      aria-live={errors.has(safeStatus) ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {message}
    </p>
  );
  if (eligible && state.user)
    return (
      <section
        className="welcome admin-welcome"
        aria-labelledby="admin-welcome-title"
        aria-busy={busy}
      >
        <p className="eyebrow">DeepLearner Admin</p>
        <h1 id="admin-welcome-title" ref={heading} tabIndex={-1}>
          Welcome, {state.user.firstName}.
        </h1>
        {announcement}
        <p className="account-email">{state.user.email}</p>
        <p>The administration workspace is taking shape.</p>
        <p>
          Content, user management and analytics are not available in this
          scaffold.
        </p>
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => void perform(() => controller.revalidate())}
        >
          Check current access
        </button>
      </section>
    );
  return (
    <section
      className="admin-access"
      aria-labelledby="admin-signin-title"
      aria-busy={busy}
    >
      <div className="access-intro">
        <p className="eyebrow">DeepLearner Admin</p>
        <h1 id="admin-signin-title" ref={heading} tabIndex={-1}>
          Admin sign in
        </h1>
        <p>
          Use your existing Admin account. Access is checked against your
          current account.
        </p>
        {announcement}
      </div>
      <form
        ref={formRef}
        onSubmit={submit}
        aria-label="Admin sign in"
        aria-describedby="admin-access-status admin-session-note"
      >
        <fieldset disabled={disabled}>
          <legend className="visually-hidden">Admin account credentials</legend>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={10}
            maxLength={128}
          />
          <button type="submit" className="primary-action">
            {busy ? 'Checking access…' : 'Sign in'}
          </button>
        </fieldset>
      </form>
      <div className="access-actions" aria-label="Session recovery">
        <button
          type="button"
          className="secondary-action"
          disabled={disabled || safeStatus === 'uncertain'}
          onClick={() => void perform(() => controller.restore())}
        >
          Restore existing session
        </button>
        {['error', 'unavailable', 'rate-limited'].includes(safeStatus) && (
          <button
            type="button"
            className="secondary-action"
            disabled={disabled}
            onClick={() => void perform(() => controller.restore())}
          >
            Retry session check
          </button>
        )}
        {safeStatus === 'uncertain' && (
          <button
            type="button"
            className="secondary-action"
            disabled={disabled}
            onClick={() => void perform(() => controller.logout())}
          >
            Retry sign-out of this device
          </button>
        )}
        {busy && (
          <button
            type="button"
            className="secondary-action"
            onClick={() => controller.cancel()}
          >
            Cancel access check
          </button>
        )}
      </div>
      <p id="admin-session-note" className="session-note">
        Restoration is explicit. A failed or uncertain request is never replayed
        automatically. For local development, use separate Student and Admin
        browser profiles; tabs or windows in one profile do not isolate the
        shared refresh session.
      </p>
    </section>
  );
}
