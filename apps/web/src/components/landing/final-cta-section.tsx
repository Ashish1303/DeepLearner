import { ButtonLink } from '../ui/button-link';
import styles from './landing.module.css';
export function FinalCtaSection() {
  return (
    <section className={styles.section} aria-labelledby="cta-title">
      <div className={styles.finalCta}>
        <p className={styles.eyebrow}>BUILD UNDERSTANDING THAT LASTS</p>
        <h2 id="cta-title">
          Stop memorizing concepts.
          <br />
          Start understanding them.
        </h2>
        <p>A clearer way to learn how software works, one concept at a time.</p>
        <div className={styles.actions}>
          <ButtonLink href="/signup">Start Learning Free</ButtonLink>
          <ButtonLink href="#technologies" variant="secondary">
            Explore Technologies
          </ButtonLink>
        </div>
        <small>
          Explore the signup UI preview. Account creation is not connected yet.
        </small>
      </div>
    </section>
  );
}
