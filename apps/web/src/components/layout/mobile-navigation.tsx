'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import styles from './public-layout.module.css';

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div
      className={styles.mobile}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? 'Close' : 'Menu'}
      </button>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        className={styles.mobilePanel}
        hidden={!open}
      >
        {[
          ['Learn', '#learning-method'],
          ['Technologies', '#technologies'],
          ['Visual learning', '#visual-learning'],
          ['Interview prep', '#interview-prep'],
        ].map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
        <Link href="/login" onClick={() => setOpen(false)}>
          Log in
        </Link>
        <Link href="/signup" onClick={() => setOpen(false)}>
          Start Learning Free
        </Link>
        <span>Signup UI preview</span>
      </nav>
    </div>
  );
}
