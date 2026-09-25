import styles from './landing.module.css';
export function EventLoopPreview() {
  return (
    <figure className={styles.runtime}>
      <div className={styles.windowBar}>
        <span>
          <i aria-hidden="true">● ● ●</i> JavaScript event loop
        </span>
        <span>Static preview</span>
      </div>
      <div className={styles.fileBar}>
        eventLoop.js <span>Main thread</span>
      </div>
      <div className={styles.runtimeGrid}>
        <div className={styles.codePane}>
          <pre tabIndex={0} aria-label="Example JavaScript code">
            <code>
              <span className={styles.comment}>{'// Synchronous work'}</span>
              {'\n'}console.log(
              <span className={styles.codeGreen}>&quot;Start&quot;</span>);
              {'\n\n'}
              <span className={styles.comment}>{'// Schedule a callback'}</span>
              {'\n'}
              <span className={styles.codeBlue}>setTimeout</span>(() =&gt; {'{'}
              {'\n'} console.log(
              <span className={styles.codeGreen}>&quot;Async&quot;</span>);
              {'\n'}
              {'}'}, 0);{'\n\n'}
              <span className={styles.codeActive}>
                console.log(&quot;End&quot;);
              </span>
            </code>
          </pre>
          <p className={styles.comment}>CONSOLE OUTPUT SO FAR</p>
          <code className={styles.codeGreen}>&gt; Start</code>
        </div>
        <div className={styles.runtimeDiagram}>
          <div className={styles.runtimeNode}>
            <span>CALL STACK · LIFO</span>
            <strong>console.log(&quot;End&quot;)</strong>
            <code>script</code>
          </div>
          <div className={styles.runtimeNode}>
            <span>WEB APIS</span>
            <code>Timer completed</code>
            <small>Callback queued</small>
          </div>
          <div className={styles.queue}>
            <span>TASK QUEUE · FIFO</span>
            <code>callback → log(&quot;Async&quot;)</code>
          </div>
          <div className={styles.loop}>
            <b aria-hidden="true">↻</b>
            <span>Event loop</span>
            <small>Waiting for the stack to clear</small>
          </div>
        </div>
      </div>
      <figcaption className={styles.runtimeCaption}>
        A moment before “End” is logged. The timer callback waits for
        synchronous work to finish.
      </figcaption>
      <div className={styles.previewControls}>
        <span>Illustrative snapshot · Step 3 of 4</span>
        <div>
          <button disabled type="button">
            Prev
          </button>
          <button disabled type="button">
            Pause
          </button>
          <button disabled type="button">
            Next
          </button>
        </div>
      </div>
    </figure>
  );
}
