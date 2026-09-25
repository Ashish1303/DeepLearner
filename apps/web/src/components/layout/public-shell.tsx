import type { ReactNode } from 'react';
import Link from 'next/link';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';

export function PublicShell({
  children,
  landing = false,
}: {
  children: ReactNode;
  landing?: boolean;
}) {
  if (landing) {
    return (
      <div className="site-shell">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <PublicHeader />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <PublicFooter />
      </div>
    );
  }
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
