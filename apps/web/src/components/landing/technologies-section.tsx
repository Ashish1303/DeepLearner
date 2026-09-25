import { technologies } from './landing-content';
import styles from './landing.module.css';
export function TechnologiesSection() {
  return (
    <section
      id="technologies"
      className={styles.band}
      aria-labelledby="tech-title"
    >
      <div className={styles.section}>
        <div className={styles.centerHeading}>
          <p className={styles.eyebrow}>BUILD YOUR TECHNICAL FOUNDATION</p>
          <h2 id="tech-title">Go deeper into the technologies you use.</h2>
          <p>
            Starting with JavaScript. Explore the direction of our future
            learning catalog.
          </p>
        </div>
        <div className={styles.techGrid}>
          {technologies.map(([mark, title, description, tag]) => (
            <article className={styles.techCard} key={title}>
              <span className={styles.techMark} aria-hidden="true">
                {mark}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className={styles.techTag}>{tag}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
