'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { Icon } from '../ui/icon';
import styles from './student-shell.module.css';
export function StudentNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { state, controller } = useAuth();
  const user = state.user;
  const onboarding = usePathname() === '/onboarding';
  return (
    <div className={styles.navigation}>
      <Link href="/" className={styles.brand} onClick={() => onNavigate?.()}>
        DeepLearner <span>STUDENT</span>
      </Link>
      <nav aria-label="Student navigation">
        <p className={styles.label}>Workspace</p>
        <Link
          href={onboarding ? '/onboarding' : '/dashboard'}
          aria-current="page"
          className={styles.active}
          onClick={() => onNavigate?.()}
        >
          <Icon name="dashboard" /> {onboarding ? 'Onboarding' : 'Dashboard'}
        </Link>
        <p className={styles.label}>Coming later</p>
        <ul className={styles.future}>
          {[
            'My Learning',
            'Explore Technologies',
            'Practice',
            'Code Playground',
            'Interview Prep',
            'Revision',
            'Bookmarks',
            'My Notes',
          ].map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </nav>
      <div className={styles.account}>
        <span className={styles.avatar} aria-hidden="true">
          {user?.firstName.slice(0, 1)}
          {user?.lastName.slice(0, 1)}
        </span>
        <div>
          <strong>
            {user?.firstName} {user?.lastName}
          </strong>
          <small>{user?.plan === 'PREMIUM' ? 'Premium' : 'Free'} account</small>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          disabled={state.pending}
          onClick={() => void controller.logout()}
        >
          <Icon name="logout" />
        </button>
      </div>
    </div>
  );
}
