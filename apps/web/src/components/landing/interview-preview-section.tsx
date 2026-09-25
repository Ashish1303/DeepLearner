import styles from './landing.module.css';
export function InterviewPreviewSection() {
  return (
    <section
      id="interview-prep"
      className={styles.band}
      aria-labelledby="interview-title"
    >
      <div className={`${styles.section} ${styles.split}`}>
        <div>
          <p className={styles.eyebrow}>FROM UNDERSTANDING TO EXPLAINING</p>
          <h2 id="interview-title">
            Learn deeply.
            <br />
            Then prepare to explain it.
          </h2>
          <p className={styles.lead}>
            Turn a mental model into a clear answer. Connect the definition, a
            practical example, and the reason it works.
          </p>
          <p className={styles.hint}>
            Interview preparation preview. No answer recording or assessment.
          </p>
        </div>
        <article className={styles.interviewCard}>
          <div className={styles.demoTop}>
            <span className={styles.badge}>JavaScript · Asynchronous code</span>
            <span className={styles.mockLabel}>Sample question</span>
          </div>
          <h3>Why doesn’t setTimeout(fn, 0) run immediately?</h3>
          <p>
            A zero delay does not mean immediate execution. The callback is
            scheduled as a task and must wait until the current script and
            queued microtasks have finished.
          </p>
          <div className={styles.answerTip}>
            <strong>Explain it with an example</strong>
            <p>
              Walk through the hero’s three logs: “Start”, “End”, then “Async”.
              Connect their order to the call stack and task queue.
            </p>
          </div>
          <button className={styles.previewButton} type="button" disabled>
            Practice Speaking Answer · Coming soon
          </button>
        </article>
      </div>
    </section>
  );
}
