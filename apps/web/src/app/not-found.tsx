import Link from 'next/link';
import { PublicShell } from '../components/layout/public-shell';

export default function NotFound() {
  return (
    <PublicShell>
      <section className="intro">
        <p className="eyebrow">404</p>
        <h1>Page not found.</h1>
        <p className="intro-copy">This page is not available.</p>
        <Link href="/">Return home</Link>
      </section>
    </PublicShell>
  );
}
