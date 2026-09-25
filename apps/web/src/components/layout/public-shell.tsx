import type { ReactNode } from 'react';
import Link from 'next/link';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" href="/">
          DeepLearner<span className="brand-dot">.</span>
        </Link>
        <span className="site-label">A clearer way to learn</span>
      </header>
      <main id="main-content" className="main-content">
        {children}
      </main>
      <footer className="site-footer">
        Understand it. Visualize it. Practice it. Remember it.
      </footer>
    </div>
  );
}
