import type { ReactNode } from 'react';
import type { AdminIdentity } from '../../lib/auth/contracts';

export function AdminShell({
  children,
  session = null,
}: {
  children: ReactNode;
  session?: { user: AdminIdentity; onLogout: () => void } | null;
}) {
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="admin-header">
        <span className="brand">
          DeepLearner<span className="brand-dot">.</span>
        </span>
        <span className="workspace-label">Administration</span>
        {session && (
          <div className="admin-session" aria-label="Current Admin account">
            <span>
              {session.user.firstName} {session.user.lastName}
            </span>
            <button
              type="button"
              className="secondary-action"
              onClick={session.onLogout}
            >
              Sign out of this device
            </button>
          </div>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer>DeepLearner · Administration workspace</footer>
    </div>
  );
}
