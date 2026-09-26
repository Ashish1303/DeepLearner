import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from '../../../components/signup/signup-form';
import { SignupProductPreview } from '../../../components/signup/signup-product-preview';
import { Icon } from '../../../components/ui/icon';
import styles from '../../../components/signup/signup.module.css';

export const metadata: Metadata = {
  title: 'Sign up — DeepLearner',
  description:
    'Explore the DeepLearner signup and email verification UI preview.',
};

export default function SignupPage() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#signup-main">
        Skip to signup
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          DeepLearner
        </Link>
        <span>Learning experience preview</span>
      </header>
      <main id="signup-main" tabIndex={-1} className={styles.main}>
        <div className={styles.card}>
          <section
            className={styles.formPanel}
            aria-label="Signup and verification preview"
          >
            <div>
              <div className={styles.brandRow}>
                <Link href="/" className={styles.brand}>
                  DeepLearner <span className={styles.beta}>BETA</span>
                </Link>
                <Link href="/" className={styles.home}>
                  Home <Icon name="arrow" />
                </Link>
              </div>
              <SignupForm />
            </div>
            <p className={styles.footnote}>
              UI preview only. No account is created and no email is sent.
            </p>
          </section>
          <SignupProductPreview />
        </div>
      </main>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} DeepLearner · Built for understanding.
      </footer>
    </div>
  );
}
