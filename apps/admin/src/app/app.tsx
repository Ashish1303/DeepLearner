import { AdminShell } from '../components/layout/admin-shell';

export function App() {
  return (
    <AdminShell>
      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">DeepLearner Admin</p>
        <h1 id="welcome-title">A home for thoughtful learning content.</h1>
        <p>The administration workspace is taking shape.</p>
      </section>
    </AdminShell>
  );
}
