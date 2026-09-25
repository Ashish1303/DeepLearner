'use client';

import { useRef, useState, type FormEvent } from 'react';
import buttons from '../ui/ui.module.css';
import styles from './login.module.css';

export function LoginForm() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [notice, setNotice] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = emailRef.current;
    const password = passwordRef.current;
    if (!email || !password) return;
    const nextErrors = {
      email: !email.value.trim()
        ? 'Enter your email address.'
        : email.validity.typeMismatch
          ? 'Enter a valid email address.'
          : '',
      password: !password.value ? 'Enter your password.' : '',
    };
    setErrors(nextErrors);
    setNotice('');
    if (nextErrors.email) email.focus();
    else if (nextErrors.password) password.focus();
    else setNotice('UI preview only. Sign-in is not connected yet.');
  }

  return (
    <div>
      <button
        type="button"
        className={`${buttons.button} ${styles.google}`}
        onClick={() => setNotice('Google sign-in is not connected yet.')}
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
      <div className={styles.divider}>
        <span>Or continue with email</span>
      </div>
      <form
        noValidate
        onSubmit={submit}
        aria-label="Login preview"
        aria-describedby="login-preview-note"
      >
        <div className={styles.field}>
          <label htmlFor="login-email">Email address</label>
          <input
            ref={emailRef}
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={() => {
              setErrors((current) => ({ ...current, email: '' }));
              setNotice('');
            }}
          />
          {errors.email && (
            <p id="login-email-error" className={styles.error} role="alert">
              {errors.email}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="login-password">Password</label>
          <div className={styles.passwordControl}>
            <input
              ref={passwordRef}
              id="login-password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? 'login-password-error' : undefined
              }
              onChange={() => {
                setErrors((current) => ({ ...current, password: '' }));
                setNotice('');
              }}
            />
            <button
              type="button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-controls="login-password"
              className={styles.visibility}
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
          {errors.password && (
            <p id="login-password-error" className={styles.error} role="alert">
              {errors.password}
            </p>
          )}
        </div>
        <div className={styles.forgot}>
          <button type="button" disabled className={styles.unavailable}>
            Forgot password? <span>Coming soon</span>
          </button>
        </div>
        <button type="submit" className={`${buttons.button} ${styles.submit}`}>
          Log in
        </button>
      </form>
      <p className={styles.signup}>
        New to DeepLearner?{' '}
        <button type="button" disabled className={styles.unavailable}>
          Create an account <span>Coming soon</span>
        </button>
      </p>
      <p id="login-preview-note" className={styles.previewNote}>
        Try the form with example details. Authentication is not available in
        this preview.
      </p>
      <div
        className={notice ? styles.notice : undefined}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice}
      </div>
    </div>
  );
}
