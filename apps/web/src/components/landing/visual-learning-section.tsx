import styles from './landing.module.css';
export function VisualLearningSection() {
  return (
    <section
      id="visual-learning"
      className={styles.band}
      aria-labelledby="visual-title"
    >
      <div className={styles.section}>
        <div className={styles.centerHeading}>
          <p className={styles.eyebrow}>MAKE THE INVISIBLE VISIBLE</p>
          <h2 id="visual-title">
            Don’t imagine the process.
            <br />
            Watch it happen.
          </h2>
          <p>
            See where work goes, what waits, and why execution order matters.
          </p>
        </div>
        <figure className={styles.visualDemo}>
          <div className={styles.demoTop}>
            <strong>JavaScript Event Loop</strong>
            <span className={styles.mockLabel}>Static learning preview</span>
          </div>
          <div className={styles.flowGrid}>
            <div className={styles.flowPanel}>
              <span className={styles.eyebrow}>01 / CALL STACK</span>
              <h3>Synchronous work first</h3>
              <div className={styles.stackItem}>
                console.log(&quot;End&quot;)
              </div>
              <div className={styles.stackBase}>script</div>
              <p>The current script runs to completion.</p>
            </div>
            <div className={styles.flowPanel}>
              <span className={styles.eyebrow}>02 / ASYNC QUEUES</span>
              <h3>Callbacks wait their turn</h3>
              <div className={styles.queueItem}>
                Microtasks <span>Empty</span>
              </div>
              <div className={styles.queueItem}>
                Timer task <code>log(&quot;Async&quot;)</code>
              </div>
              <p>A zero-delay timer does not interrupt the script.</p>
            </div>
            <div className={styles.flowPanel}>
              <span className={styles.eyebrow}>03 / EVENT LOOP</span>
              <div className={styles.loopSymbol} aria-hidden="true">
                ↻
              </div>
              <h3>Is the stack empty?</h3>
              <p>
                After the script and any queued microtasks finish, the timer
                task can run.
              </p>
            </div>
          </div>
          <figcaption className={styles.demoCaption}>
            For the hero example, the output is <code>Start → End → Async</code>
            . This illustration does not execute code.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
