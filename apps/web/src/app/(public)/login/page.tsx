import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '../../../components/login/login-form';
import { LoginProductPreview } from '../../../components/login/login-product-preview';
import { Icon } from '../../../components/ui/icon';
import styles from '../../../components/login/login.module.css';

export const metadata: Metadata = {
  title: 'Log in — DeepLearner',
  description:
    'Continue your visual learning journey with DeepLearner. Login UI preview.',
};

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#login-main">
        Skip to login
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          DeepLearner
        </Link>
        <span className={styles.headerNote}>Learning experience preview</span>
      </header>
      <main id="login-main" tabIndex={-1} className={styles.main}>
        <div className={styles.card}>
          <section className={styles.formPanel} aria-labelledby="login-heading">
            <div>
              <div className={styles.brandRow}>
                <Link href="/" className={styles.brand}>
                  DeepLearner <span className={styles.beta}>BETA</span>
                </Link>
                <Link href="/" className={styles.home}>
                  Home <Icon name="arrow" />
                </Link>
              </div>
              <h1 id="login-heading">Welcome back</h1>
              <p className={styles.introduction}>
                Continue visualizing, exploring, and mastering complex technical
                architectures.
              </p>
              <LoginForm />
            </div>
            <p className={styles.panelFootnote}>
              UI preview only. Your details are not sent or saved by this page.
            </p>
          </section>
          <LoginProductPreview />
        </div>
      </main>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} DeepLearner · Built for understanding.
      </footer>
    </div>
  );
}
