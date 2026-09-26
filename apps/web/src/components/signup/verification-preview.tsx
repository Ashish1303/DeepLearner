import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import buttons from '../ui/ui.module.css';
import styles from './signup.module.css';

export function VerificationPreview({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className={styles.verification}>
      <span className={styles.mailIcon} aria-hidden="true">
        ✉
      </span>
      <p className={styles.eyebrow}>EMAIL VERIFICATION PREVIEW</p>
      <h1 ref={heading} tabIndex={-1}>
        Check your inbox.
      </h1>
      <p className={styles.copy}>
        In the completed signup flow, a verification link would be sent to:
        <strong className={styles.email}>{email}</strong>
      </p>
      <div className={styles.notice}>
        This is a UI preview. No account was created and no email was sent.
      </div>
      <div className={styles.explanation}>
        <p>Email verification will use a link, not a code.</p>
        <p>
          Verification links will expire after 15 minutes once authentication is
          connected.
        </p>
      </div>
      <button
        type="button"
        className={`${buttons.button} ${styles.submit}`}
        onClick={() =>
          setNotice(
            'Preview only. Resending is not connected; no email was sent.',
          )
        }
      >
        Resend verification email
      </button>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={notice ? styles.notice : undefined}
      >
        {notice}
      </div>
      <button type="button" className={styles.back} onClick={onBack}>
        Entered the wrong email? Go back
      </button>
      <p className={styles.loginLink}>
        <Link href="/login">Back to log in</Link>
      </p>
    </div>
  );
}
