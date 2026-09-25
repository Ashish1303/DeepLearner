import { Icon } from '../ui/icon';
import styles from './landing.module.css';
export function CodeVisualizerSection() {
  return (
    <section
      id="code-visualizer"
      className={`${styles.section} ${styles.split}`}
      aria-labelledby="code-title"
    >
      <div>
        <p className={styles.eyebrow}>CODE, WITH CONTEXT</p>
        <h2 id="code-title">See what your code is doing internally.</h2>
        <p className={styles.lead}>
          Follow values through a function. Connect each line to the state it
          changes, instead of guessing at the result.
        </p>
        <ul className={styles.checkList}>
          <li>
            <Icon name="check" /> Trace execution one step at a time
          </li>
          <li>
            <Icon name="check" /> Separate local and global scope
          </li>
          <li>
            <Icon name="check" /> Understand how a result is produced
          </li>
        </ul>
        <p className={styles.hint}>
          A preview of the planned learning experience.
        </p>
      </div>
      <figure className={styles.runtime}>
        <div className={styles.windowBar}>
          <span>scope-example.js</span>
          <span>Static preview</span>
        </div>
        <div className={styles.scopeGrid}>
          <pre
            className={styles.scopeCode}
            tabIndex={0}
            aria-label="Scope example"
          >
            <code>
              <span className={styles.codeBlue}>const</span> x = 10;{'\n\n'}
              <span className={styles.codeBlue}>function</span> test() {'{'}
              {'\n'} const y = 20;{'\n'}{' '}
              <span className={styles.codeActive}>return x + y;</span>
              {'\n'}
              {'}'}
              {'\n\n'}test();
            </code>
          </pre>
          <div className={styles.inspector}>
            <span>VARIABLE INSPECTOR</span>
            <p>Global scope</p>
            <code>
              x <b>10</b>
            </code>
            <p>Local scope · test()</p>
            <code>
              y <b>20</b>
            </code>
            <p>Return value</p>
            <code className={styles.codeGreen}>
              x + y <b>30</b>
            </code>
          </div>
        </div>
        <figcaption className={styles.runtimeCaption}>
          The function reads x from global scope and y from its local scope.
        </figcaption>
      </figure>
    </section>
  );
}
