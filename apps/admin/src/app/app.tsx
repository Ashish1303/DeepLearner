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
          onClick={() => {
            if (workspace !== 'technologies') {
              moved.current = true;
              setWorkspace('technologies');
            }
          }}
        >
          Technology Management
        </button>
        <button
          type="button"
          aria-pressed={workspace === 'learning-paths'}
          onClick={() => {
            if (workspace !== 'learning-paths') {
              moved.current = true;
              setWorkspace('learning-paths');
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
          <LearningPathManager auth={auth} accountId={accountId} />
        )}
      </div>
    </div>
  );
}

export function App() {
  const { state, controller, available } = useAdminAuth();
  const eligible = available && isEligibleAdminState(state);
  // AdminAccess unmounts in the workspace. Retain access-loss focus history
  // here so a completed refusal/logout can return keyboard focus safely.
  const wasEligible = useRef(eligible);
  const focusAfterAccessLoss = useRef(false);
  useEffect(() => {
    if (wasEligible.current && !eligible) focusAfterAccessLoss.current = true;
    wasEligible.current = eligible;
    if (eligible) focusAfterAccessLoss.current = false;
    else if (
      focusAfterAccessLoss.current &&
      !state.pending &&
      document.visibilityState === 'visible'
    ) {
      document.getElementById('admin-signin-title')?.focus();
      focusAfterAccessLoss.current = false;
    }
  }, [eligible, state.pending, state.status]);
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
