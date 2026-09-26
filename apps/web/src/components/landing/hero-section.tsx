import { ButtonLink } from '../ui/button-link';
import { EventLoopPreview } from './event-loop-preview';
import styles from './landing.module.css';
export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={styles.badge}>● Visual-first technical learning</p>
        <h1 id="hero-title">
          See it.
          <br />
          Understand it.
          <br />
          Remember it.
        </h1>
        <p className={styles.lead}>
          Make sense of difficult programming and software-engineering concepts
          through visual explanations, code examples, practice, and revision.
        </p>
        <div className={styles.actions}>
          <ButtonLink href="/signup">Start Learning Free</ButtonLink>
          <ButtonLink variant="secondary" href="#visual-learning">
            Explore Visual Learning
          </ButtonLink>
        </div>
        <p className={styles.hint}>
          Explore the signup UI preview. Account creation is not connected yet.
        </p>
        <div className={styles.heroNote}>
          <span>BUILT FOR DEVELOPERS &amp; INTERVIEW PREP</span>
          <p>
            Understand the why.<b> Connect the dots.</b>
          </p>
        </div>
      </div>
      <EventLoopPreview />
    </section>
  );
}
