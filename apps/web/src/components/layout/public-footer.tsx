import styles from './public-layout.module.css';
import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div>
          <Link className={styles.brand} href="/">
            DeepLearner
          </Link>
          <p>
            Understand it. Visualize it.
            <br />
            Practice it. Remember it.
          </p>
        </div>
        <nav aria-label="Explore">
          <h2>Explore</h2>
          <a href="#learning-method">Learning method</a>
          <a href="#technologies">Technologies</a>
          <a href="#visual-learning">Visual learning</a>
        </nav>
        <nav aria-label="Learning previews">
          <h2>Learning previews</h2>
          <a href="#code-visualizer">Code visualizer</a>
          <a href="#progress">Progress &amp; weak topics</a>
          <a href="#interview-prep">Interview preparation</a>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} DeepLearner</span>
        <span>Built for understanding.</span>
      </div>
    </footer>
  );
}
