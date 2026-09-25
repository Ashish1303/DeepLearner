import { Icon } from '../ui/icon';
import { methods } from './landing-content';
import styles from './landing.module.css';
export function LearningMethodSection() {
  return (
    <section
      id="learning-method"
      className={styles.section}
      aria-labelledby="method-title"
    >
      <div className={styles.centerHeading}>
        <p className={styles.eyebrow}>THE DEEPLEARNER METHOD</p>
        <h2 id="method-title">One concept. Five ways to master it.</h2>
        <p>
          Go beyond remembering a definition. Build an understanding you can
          use.
        </p>
      </div>
      <ol className={styles.methodGrid}>
        {methods.map((method, index) => (
          <li className={styles.methodCard} key={method.title}>
            <div className={styles.cardTop}>
              <span className={styles.iconBox}>
                <Icon name={method.icon} />
              </span>
              <span className={styles.step}>0{index + 1}</span>
            </div>
            <h3>{method.title}</h3>
            <p>{method.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
