'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { StudentNavigation } from './student-navigation';
import { StudentHeader } from './student-header';
import { Icon } from '../ui/icon';
import styles from './student-shell.module.css';
export function StudentShell({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDialogElement>(null);
  const { state } = useAuth();
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const close = () => {
      if (query.matches) menu.current?.close();
    };
    query.addEventListener('change', close);
    return () => query.removeEventListener('change', close);
  }, []);
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#student-main">
        Skip to main content
      </a>
      <aside className={styles.sidebar}>
        <StudentNavigation />
      </aside>
      <dialog
        id="student-menu"
        ref={menu}
        className={styles.drawer}
        aria-label="Student navigation"
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={() => menu.current?.close()}
          aria-label="Close student navigation"
        >
          <Icon name="close" />
        </button>
        {state.message && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}
        <StudentNavigation onNavigate={() => menu.current?.close()} />
      </dialog>
      <div className={styles.content}>
        <StudentHeader onMenu={() => menu.current?.showModal()} />
        <main id="student-main" tabIndex={-1} className={styles.main}>
          {state.message && (
            <p className={styles.error} role="alert">
              {state.message}
            </p>
          )}
          {state.pending && (
            <p role="status">{state.message || 'Updating your session…'}</p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
