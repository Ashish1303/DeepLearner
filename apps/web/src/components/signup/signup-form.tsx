'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { VerificationPreview } from './verification-preview';
import buttons from '../ui/ui.module.css';
import styles from './signup.module.css';

type Field = 'firstName' | 'lastName' | 'email' | 'password';
const emptyErrors: Record<Field, string> = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

export function SignupForm() {
  const [details, setDetails] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [errors, setErrors] = useState(emptyErrors);
  const [visible, setVisible] = useState(false);
  const [verification, setVerification] = useState(false);
  const [notice, setNotice] = useState('');
  const firstName = useRef<HTMLInputElement>(null);
  const lastName = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const returning = useRef(false);
  useEffect(() => {
    if (!verification && returning.current) {
      email.current?.focus();
      returning.current = false;
    }
  }, [verification]);

  function clear(field: Field) {
    setErrors((current) => ({ ...current, [field]: '' }));
    setNotice('');
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.current || !password.current) return;
    const next = { ...emptyErrors };
    for (const field of ['firstName', 'lastName'] as const) {
      const length = details[field].trim().length;
      if (!length || length > 80)
        next[field] =
          `Enter a ${field === 'firstName' ? 'first' : 'last'} name of 1–80 characters.`;
    }
    if (!details.email.trim() || email.current.validity.typeMismatch)
      next.email = 'Enter a valid email address.';
    if (
      password.current.value.length < 10 ||
      password.current.value.length > 128
    )
      next.password = 'Use a password of 10–128 characters.';
    setErrors(next);
    setNotice('');
    const refs = { firstName, lastName, email, password };
    for (const field of [
      'firstName',
      'lastName',
      'email',
      'password',
    ] as const) {
      if (next[field]) {
        refs[field].current?.focus();
        return;
      }
    }
    setDetails((current) => ({
      firstName: current.firstName.trim(),
      lastName: current.lastName.trim(),
      email: current.email.trim(),
    }));
    password.current.value = '';
    setVisible(false);
    setVerification(true);
  }

  if (verification)
    return (
      <VerificationPreview
        email={details.email}
        onBack={() => {
          returning.current = true;
          setVerification(false);
          setNotice('');
        }}
      />
    );
  return (
    <div>
      <h1>Start learning differently.</h1>
      <p className={styles.copy}>
        Build real understanding through visual explanations, practice, and
        structured learning paths.
      </p>
      <button
        type="button"
        className={`${buttons.button} ${styles.google}`}
        onClick={() =>
          setNotice(
            'Google signup is not connected yet. No account was created.',
          )
        }
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4H3.1v2.6A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"
          />
          <path
            fill="#EA4335"
            d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6c.8-2.3 3-4 5.6-4Z"
          />
        </svg>
        Continue with Google
      </button>
      <div className={styles.divider}>Or create an account with email</div>
      <form
        noValidate
        onSubmit={submit}
        aria-label="Signup preview"
        aria-describedby="signup-preview-note"
      >
        <div className={styles.nameRow}>
          {(['firstName', 'lastName'] as const).map((field) => (
            <div className={styles.field} key={field}>
              <label htmlFor={`signup-${field}`}>
                {field === 'firstName' ? 'First name' : 'Last name'}
              </label>
              <input
                ref={field === 'firstName' ? firstName : lastName}
                id={`signup-${field}`}
                autoComplete={
                  field === 'firstName' ? 'given-name' : 'family-name'
                }
                placeholder={field === 'firstName' ? 'Alex' : 'Chen'}
                value={details[field]}
                required
                aria-invalid={Boolean(errors[field])}
                aria-describedby={
                  errors[field] ? `signup-${field}-error` : undefined
                }
                onChange={(event) => {
                  setDetails((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }));
                  clear(field);
                }}
              />
              {errors[field] && (
                <p
                  className={styles.error}
                  role="alert"
                  id={`signup-${field}-error`}
                >
                  {errors[field]}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-email">Email address</label>
          <input
            ref={email}
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={details.email}
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            onChange={(event) => {
              setDetails((current) => ({
                ...current,
                email: event.target.value,
              }));
              clear('email');
            }}
          />
          {errors.email && (
            <p className={styles.error} role="alert" id="signup-email-error">
              {errors.email}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-password">Password</label>
          <div className={styles.passwordControl}>
            <input
              ref={password}
              id="signup-password"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a password"
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password
                  ? 'password-hint signup-password-error'
                  : 'password-hint'
              }
              onChange={() => clear('password')}
            />
            <button
              className={styles.visibility}
              type="button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-controls="signup-password"
              onClick={() => setVisible((current) => !current)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {visible && <path d="m3 3 18 18" />}
              </svg>
            </button>
          </div>
          <p className={styles.hint} id="password-hint">
            Use 10–128 characters. No required combination of symbols or
            numbers.
          </p>
          {errors.password && (
            <p className={styles.error} role="alert" id="signup-password-error">
              {errors.password}
            </p>
          )}
        </div>
        <p className={styles.legal}>
          Preview only. Terms of Service and Privacy Policy are not available
          yet; no agreement is recorded.
        </p>
        <button type="submit" className={`${buttons.button} ${styles.submit}`}>
          Create free account →
        </button>
        <p className={styles.loginLink}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
      <p className={styles.hint} id="signup-preview-note">
        Use example details to preview email verification. Registration is not
        connected.
      </p>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={notice ? styles.notice : undefined}
      >
        {notice}
      </div>
    </div>
  );
}
