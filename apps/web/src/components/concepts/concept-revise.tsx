import type { Concept } from '../../lib/concepts/contracts';
import { ConceptMarkdown } from './concept-markdown';
import styles from './concept-browser.module.css';

export function ConceptRevise({ revise }: { revise: Concept['revise'] }) {
  return (
    <>
      <h2>Revise</h2>
      {revise === null ? (
        <p className={styles.notice}>
          No revision content is available for this Concept yet.
        </p>
      ) : (
        <article
          className={`${styles.read} ${styles.revise}`}
          aria-label="Concept revision"
        >
          <p>{revise.summary}</p>
          {revise.keyPoints.length > 0 && (
            <section aria-label="Key points">
              <h3>Key points</h3>
              <ul>
                {revise.keyPoints.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </section>
          )}
          {revise.memoryTrick !== null && (
            <section aria-label="Memory trick">
              <h3>Memory trick</h3>
              <p>{revise.memoryTrick}</p>
            </section>
          )}
          {revise.importantCodeMarkdown !== null && (
            <section aria-label="Important code">
              <h3>Important code</h3>
              <ConceptMarkdown
                body={revise.importantCodeMarkdown}
                headingBase={4}
              />
            </section>
          )}
        </article>
      )}
    </>
  );
}
