import Link from 'next/link';
import { ButtonLink } from '../ui/button-link';
import { MobileNavigation } from './mobile-navigation';
import styles from './public-layout.module.css';

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/">
          DeepLearner<span className={styles.beta}>BETA</span>
        </Link>
        <nav aria-label="Main navigation" className={styles.desktopNav}>
          <a href="#learning-method">Learn</a>
          <a href="#technologies">Technologies</a>
          <a href="#visual-learning">Visual Learning</a>
          <a href="#interview-prep">Interview Prep</a>
        </nav>
        <Link className={styles.loginLink} href="/login">
          Log in
        </Link>
        <div className={styles.account}>
          <ButtonLink href="/signup">Start Learning Free</ButtonLink>
          <span>Signup UI preview</span>
        </div>
        <MobileNavigation />
      </div>
    </header>
  );
}
