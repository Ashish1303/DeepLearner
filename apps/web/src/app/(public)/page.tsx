import { PublicShell } from '../../components/layout/public-shell';

export default function HomePage() {
  return (
    <PublicShell>
      <section className="intro" aria-labelledby="intro-title">
        <p className="eyebrow">DeepLearner</p>
        <h1 id="intro-title">See how concepts work.</h1>
        <p className="intro-copy">
          A space for understanding technical concepts through clear
          explanations and visual learning.
        </p>
        <p className="availability">
          The learning experience is taking shape. Check back soon.
        </p>
      </section>
    </PublicShell>
  );
}
