'use client';
import { useAuth } from '../../hooks/use-auth';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/icon';
import styles from './student-shell.module.css';
export function StudentHeader({ onMenu }: { onMenu: () => void }) {
  const { state } = useAuth();
  const path = usePathname();
  const onboarding = path === '/onboarding';
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuButton}
        onClick={onMenu}
        aria-label="Open student navigation"
        aria-haspopup="dialog"
        aria-controls="student-menu"
      >
        <Icon name="menu" />
      </button>
      <div>
        <span className={styles.label}>Your workspace</span>
        <p>
          {onboarding
            ? 'Student onboarding'
            : path === '/explore-technologies'
              ? 'Explore technologies'
              : 'Dashboard'}
        </p>
      </div>
      <span className={styles.headerName}>{state.user?.firstName}</span>
    </header>
  );
}
