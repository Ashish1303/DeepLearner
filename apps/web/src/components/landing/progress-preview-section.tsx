import styles from './landing.module.css';
const topics = [
  { title: 'Scope & Closures', value: 91, status: 'Strong' },
  { title: 'Promises', value: 72, status: 'Improving' },
  { title: 'Event Loop', value: 48, status: 'Needs revision' },
  { title: 'Array Methods', value: 86, status: 'Strong' },
];
export function ProgressPreviewSection() {
  return (
    <section
      id="progress"
      className={styles.section}
      aria-labelledby="progress-title"
    >
      <div className={styles.centerHeading}>
        <p className={styles.eyebrow}>PROGRESS WITH PURPOSE</p>
        <h2 id="progress-title">
          Know what you understand —<br />
          and what you don’t.
        </h2>
        <p>
          See your strengths. Find the gaps. Make your next study session count.
        </p>
      </div>
      <figure className={styles.progressCard}>
        <figcaption className={styles.demoTop}>
          <strong>Your learning, at a glance</strong>
          <span className={styles.mockLabel}>
            Illustrative data · not your progress
          </span>
        </figcaption>
        <dl className={styles.metrics}>
          {[
            ['Study streak', '12 days'],
            ['Learning XP', '2,460'],
            ['Concepts explored', '38 / 54'],
            ['Practice accuracy', '89.4%'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.progressGrid}>
          <div>
            <h3>JavaScript · Topic confidence</h3>
            {topics.map((topic) => (
              <div className={styles.topic} key={topic.title}>
                <div>
                  <span>{topic.title}</span>
                  <span>
                    {topic.value}% · {topic.status}
                  </span>
                </div>
                <progress
                  aria-label={topic.title}
                  value={topic.value}
                  max={100}
                />
              </div>
            ))}
          </div>
          <aside className={styles.revisionCard}>
            <p className={styles.eyebrow}>A CLEAR NEXT STEP</p>
            <h3>Give the event loop another look.</h3>
            <p>
              Your example results suggest revisiting task order before moving
              on.
            </p>
            <span>Suggested revision · Preview</span>
          </aside>
        </div>
      </figure>
    </section>
  );
}
