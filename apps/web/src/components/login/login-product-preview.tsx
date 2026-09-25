import { Icon } from '../ui/icon';
import styles from './login.module.css';

const nodes = [
  { title: 'Call stack', code: 'Empty', detail: 'Ready for the next job' },
  { title: 'Web APIs', code: 'Request completed', detail: 'Promise resolved' },
  { title: 'Microtasks', code: 'Promise.then', detail: 'Next job to run' },
  {
    title: 'Task queue',
    code: 'Timer callback',
    detail: 'Waiting for microtasks',
  },
];

export function LoginProductPreview() {
  return (
    <section className={styles.productPanel} aria-labelledby="product-heading">
      <div>
        <div className={styles.previewBanner}>
          <span className={styles.previewBadge}>LEARNING PREVIEW</span>
          <span>Illustrative workspace</span>
        </div>
        <h2 id="product-heading">Pick up where you left off.</h2>
        <p className={styles.introduction}>
          A look at how visual explanations can connect code, concepts, and your
          learning journey.
        </p>
        <figure className={styles.workspace}>
          <div className={styles.windowBar}>
            <span>
              <i aria-hidden="true">● ● ●</i> JavaScript Concurrency · Event
              Loop
            </span>
            <span className={styles.staticLabel}>Static frame</span>
          </div>
          <div className={styles.workspaceBody}>
            <p className={styles.frameLabel}>
              Example snapshot: <strong>Before the next microtask</strong>
            </p>
            <div className={styles.nodes}>
              {nodes.map((node) => (
                <div className={styles.node} key={node.title}>
                  <h3>{node.title}</h3>
                  <code>{node.code}</code>
                  <p>{node.detail}</p>
                </div>
              ))}
            </div>
            <div className={styles.inspector}>
              <span>
                <Icon name="repeat" /> Stack empty → Run the next Promise job
              </span>
              <button type="button" disabled>
                Inspect Frame →
              </button>
            </div>
          </div>
          <figcaption className={styles.workspaceFooter}>
            <span>
              <Icon name="check" /> Static illustration · No code execution
            </span>
            <span>DeepLearner</span>
          </figcaption>
        </figure>
        <div className={styles.progressHeading}>
          <span>Example track: JavaScript foundations</span>
          <strong>72% completed</strong>
        </div>
        <progress
          className={styles.progress}
          aria-label="Illustrative JavaScript track completion"
          value={72}
          max={100}
        />
        <ul className={styles.badges}>
          <li>Closures · 91% mastered</li>
          <li>Promises · 78% improving</li>
          <li>Concurrency · 48% revisiting</li>
        </ul>
        <p className={styles.sampleNote}>
          Sample progress for illustration. This is not your learning record.
        </p>
      </div>
      <div className={styles.learner}>
        <span className={styles.avatar} aria-hidden="true">
          AC
        </span>
        <div>
          <strong>
            Alex Chen <span className={styles.sampleTag}>Sample learner</span>
          </strong>
          <p>JavaScript track · 12-day streak</p>
        </div>
        <button type="button" disabled>
          Continue <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}
