import type { Concept } from '../../lib/concepts/contracts';
import { ConceptMarkdown } from './concept-markdown';
import styles from './concept-browser.module.css';

export function ConceptExamples({
  examples,
}: {
  examples: Concept['examples'];
}) {
  return (
    <>
      <h2>Example</h2>
      {examples.length === 0 ? (
        <p className={styles.notice}>
          No examples are available for this Concept yet.
        </p>
      ) : (
        <ol className={styles.examples}>
          {examples.map((example, index) => (
            <li key={index}>
              <article className={styles.read}>
                <h3>{example.title}</h3>
                <ConceptMarkdown body={example.bodyMarkdown} headingBase={4} />
              </article>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
