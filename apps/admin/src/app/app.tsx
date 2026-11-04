import { AdminShell } from '../components/layout/admin-shell';
import { AdminAccess } from '../components/auth/admin-access';
import { isEligibleAdminState, useAdminAuth } from '../hooks/use-admin-auth';
import { TechnologyManager } from '../components/technologies/technology-manager';
import { useEffect, useRef, useState } from 'react';
import type { AdminController } from '../lib/auth/admin-controller';
import { LearningPathManager } from '../components/learning-paths/learning-path-manager';
import styles from '../components/learning-paths/learning-path-manager.module.css';

function AdminWorkspace({
  auth,
  accountId,
}: {
  auth: AdminController;
  accountId: string;
}) {
  const [workspace, setWorkspace] = useState<'technologies' | 'learning-paths'>(
    'technologies',
  );
  const container = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const navigationGuard = useRef<((next: () => void) => void) | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalWarning, setProposalWarning] = useState(false);
  const navigate = (next: () => void) => {
    if (navigationGuard.current) navigationGuard.current(next);
    else next();
  };
  useEffect(() => {
    const sync = () => {
      const phase = auth.getProposalIntent(accountId).phase;
      setProposalBusy(phase === 'saving' || phase === 'reconciling');
      setProposalWarning(phase !== 'none');
    };
    sync();
    return auth.subscribe(sync);
  }, [auth, accountId]);
  useEffect(() => {
    if (!proposalWarning) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (auth.getProposalIntent(accountId).phase !== 'none') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [auth, accountId, proposalWarning]);
  useEffect(() => {
    if (moved.current)
      container.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [workspace]);
  return (
    <div className={styles.workspaceFrame}>
      <div
        role="group"
        aria-label="Admin workspaces"
        className={styles.workspaceNavigation}
      >
        <button
          type="button"
          aria-pressed={workspace === 'technologies'}
          disabled={proposalBusy}
          onClick={() => {
            if (workspace !== 'technologies') {
              navigate(() => {
                moved.current = true;
                setWorkspace('technologies');
              });
            }
          }}
        >
          Technology Management
        </button>
        <button
          type="button"
          aria-pressed={workspace === 'learning-paths'}
          disabled={proposalBusy}
          onClick={() => {
            if (workspace !== 'learning-paths') {
              navigate(() => {
                moved.current = true;
                setWorkspace('learning-paths');
              });
            }
          }}
        >
          Learning Paths
        </button>
      </div>
      <div ref={container}>
        {workspace === 'technologies' ? (
          <TechnologyManager auth={auth} accountId={accountId} />
        ) : (
          <LearningPathManager
            auth={auth}
            accountId={accountId}
            registerWorkspaceNavigation={(guard) => {
              navigationGuard.current = guard;
            }}
          />
        )}
      </div>
    </div>
  );
}

export function App() {
  const { state, controller, available } = useAdminAuth();
  const eligible = available && isEligibleAdminState(state);
  return (
    <AdminShell
      session={
        eligible && state.user
          ? {
              user: state.user,
              onLogout: () => {
                void controller.logout();
              },
            }
          : null
      }
    >
      {eligible && state.user ? (
        <AdminWorkspace
          key={state.user.id}
          auth={controller}
          accountId={state.user.id}
        />
      ) : (
        <AdminAccess
          state={state}
          controller={controller}
          available={available}
        />
      )}
    </AdminShell>
  );
}
