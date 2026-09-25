import type { ReactNode } from 'react';

export function AdminShell({ children }: { children: ReactNode }) {
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
      </header>
      <main id="main-content">{children}</main>
      <footer>DeepLearner · Administration workspace</footer>
    </div>
  );
}
