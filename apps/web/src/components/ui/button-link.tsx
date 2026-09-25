import type { ReactNode } from 'react';
import styles from './ui.module.css';

type Props = { children: ReactNode; variant?: 'primary' | 'secondary' } & (
  { href: string; unavailable?: never } | { href?: never; unavailable: true }
);

export function ButtonLink({
  children,
  variant = 'primary',
  href,
  unavailable,
}: Props) {
  const className = `${styles.button} ${styles[variant]}`;
  return unavailable ? (
    <button className={className} type="button" disabled>
      {children}
    </button>
  ) : (
    <a className={className} href={href}>
      {children}
    </a>
  );
}
