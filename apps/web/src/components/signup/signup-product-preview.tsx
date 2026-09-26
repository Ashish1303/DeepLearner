import { Icon } from '../ui/icon';
import styles from './signup.module.css';

export function SignupProductPreview() {
  return (
    <section className={styles.productPanel} aria-labelledby="journey-heading">
      <p className={styles.eyebrow}>VISUAL LEARNING PREVIEW</p>
      <h2 id="journey-heading">Your learning journey, made visible.</h2>
      <p className={styles.copy}>
        Explore technologies, follow structured paths, understand concepts
        visually, and practice what you learn.
      </p>
      <figure className={styles.workspace}>
        <div className={styles.windowBar}>
          <span>
            <i aria-hidden="true">● ● ●</i> DeepLearner · Learning workspace
          </span>
          <span>Static preview</span>
        </div>
        <div className={styles.workspaceGrid}>
          <div className={styles.curriculum}>
            <p>CURRICULUM PATH</p>
            <h3>JavaScript Fundamentals</h3>
            <ol>
              {[
                'Variables',
                'Functions',
                'Scope Context',
                'Closures',
                'Promises',
                'Async / Await',
                'Event Loop',
              ].map((topic, index) => (
                <li
                  key={topic}
                  className={index === 2 ? styles.currentTopic : undefined}
                >
                  <span>{topic}</span>
                  {index < 2 ? (
                    <small>Explored</small>
                  ) : index === 2 ? (
                    <small>Current</small>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.pipeline}>
            <p>VISUAL EXECUTION PIPELINE</p>
            <div className={styles.nodes}>
              <div>
                <span>SOURCE</span>
                <strong>Code</strong>
                <small>Read the example</small>
              </div>
              <div>
                <span>FRAME</span>
                <strong>Call stack</strong>
                <small>Follow execution</small>
              </div>
              <div>
                <span>CONTEXT</span>
                <strong>Scope</strong>
                <small>Inspect bindings</small>
              </div>
            </div>
            <p className={styles.trace}>
              See how names resolve through lexical scopes.
            </p>
            <div className={styles.metrics}>
              <span>Strong: 8</span>
              <span>Improving: 4</span>
              <span>Revisit: 2</span>
            </div>
            <progress
              value={64}
              max={100}
              aria-label="Illustrative learning progress"
            />
            <p className={styles.progressLabel}>
              Sample progress <span>64% completed</span>
            </p>
          </div>
        </div>
        <figcaption>
          Illustrative curriculum and progress. No code runs and no learning
          record is loaded.
        </figcaption>
      </figure>
      <div className={styles.benefits}>
        {[
          {
            icon: 'layers',
            title: 'Visual understanding',
            text: 'Connect explanations to a clear picture of how concepts work.',
          },
          {
            icon: 'code',
            title: 'Active practice',
            text: 'Predict outcomes and reason about the code in front of you.',
          },
          {
            icon: 'check',
            title: 'Meaningful progress',
            text: 'See what you understand and what needs another look.',
          },
        ].map((item) => (
          <article key={item.title}>
            <Icon name={item.icon as 'layers' | 'code' | 'check'} />
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      <p className={styles.productFootnote}>
        A preview of the planned learning experience. Onboarding comes in a
        later feature.
      </p>
    </section>
  );
}
