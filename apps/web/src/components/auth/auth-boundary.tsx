'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { loginDestination } from '../../lib/auth/redirect';
import styles from './auth-state.module.css';

export function AuthBoundary({ children }: { children: ReactNode }) {
  const { controller, state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    void controller.restore();
  }, [controller]);
  useEffect(() => {
    if (state.status === 'anonymous') router.replace(loginDestination);
  }, [state.status, router]);
  if (state.status === 'authenticated' && state.user?.role === 'STUDENT')
    return children;
  const loading = ['idle', 'loading', 'anonymous'].includes(state.status);
  return (
    <main className={styles.page} aria-busy={loading}>
      <section className={styles.card}>
        <Link href="/" className={styles.brand}>
          DeepLearner
        </Link>
        <h1>
          {loading
            ? 'Opening your workspace'
            : state.status === 'authenticated'
              ? 'Student area'
              : state.status === 'unsupported'
                ? 'Browser compatibility'
                : 'Unable to open your workspace'}
        </h1>
        <p role="status">
          {loading
            ? 'Checking your session and account…'
            : state.status === 'authenticated'
              ? 'This workspace is for student accounts. You can sign out below.'
              : state.message}
        </p>
        {!loading && (
          <div className={styles.actions}>
            {state.status === 'error' && (
              <button onClick={() => void controller.restore(true)}>
                Try again
              </button>
            )}
            {state.status !== 'unsupported' && (
              <button
                disabled={state.pending}
                onClick={() => void controller.logout()}
              >
                {state.pending ? 'Signing out…' : 'Sign out'}
              </button>
            )}
            <Link href="/login">Back to login</Link>
          </div>
        )}
        {state.status === 'authenticated' && state.message && (
          <p role="alert">{state.message}</p>
        )}
      </section>
    </main>
  );
}
