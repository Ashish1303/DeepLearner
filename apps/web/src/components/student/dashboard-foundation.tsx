'use client';
import { useAuth } from '../../hooks/use-auth';
import styles from './student-shell.module.css';
const labels: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  INTERVIEW_READY: 'Interview ready',
  LEARN_FROM_SCRATCH: 'Learn from scratch',
  INTERVIEW_PREPARATION: 'Interview preparation',
  QUICK_REVISION: 'Quick revision',
  MASTER_TECHNOLOGY: 'Master a technology',
  STRENGTHEN_WEAK_AREAS: 'Strengthen weak areas',
};
export function DashboardFoundation() {
  const { state, controller } = useAuth();
  const user = state.user;
  if (!user) return null;
  const profile = user.profile;
  return (
    <>
      <section className={`${styles.card} ${styles.welcome}`}>
        <span className={styles.label}>DeepLearner workspace</span>
        <h1>Welcome back, {user.firstName}.</h1>
        <p>
          Your account is ready. Learning content and activity will become
          available here as the student experience develops.
        </p>
      </section>
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="account-title">
          <span className={styles.label}>Account</span>
          <h2 id="account-title">Your details</h2>
          <dl className={styles.details}>
            <div>
              <dt>Name</dt>
              <dd>
                {user.firstName} {user.lastName}
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{user.plan === 'PREMIUM' ? 'Premium' : 'Free'}</dd>
            </div>
            <div>
              <dt>Sign-in methods</dt>
              <dd>
                {user.authMethods
                  .map((method) =>
                    method === 'PASSWORD' ? 'Password' : 'Google',
                  )
                  .join(', ') || 'Not provided'}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={state.pending}
            onClick={() => void controller.reloadUser()}
          >
            Refresh account details
          </button>
        </section>
        <section className={styles.card} aria-labelledby="preferences-title">
          <span className={styles.label}>Profile</span>
          <h2 id="preferences-title">Learning preferences</h2>
          {!profile ? (
            <p>No learning preferences have been provided yet.</p>
          ) : (
            <dl className={styles.details}>
              <div>
                <dt>Experience</dt>
                <dd>
                  {profile.experienceLevel
                    ? labels[profile.experienceLevel]
                    : 'Not provided'}
                </dd>
              </div>
              <div>
                <dt>Goals</dt>
                <dd>
                  {profile.learningGoals
                    .map((goal) => labels[goal])
                    .join(', ') || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt>Preferred difficulty</dt>
                <dd>
                  {profile.preferredDifficulty
                    ? labels[profile.preferredDifficulty]
                    : 'Not provided'}
                </dd>
              </div>
              <div>
                <dt>Daily study goal</dt>
                <dd>
                  {profile.dailyStudyGoalMinutes === undefined
                    ? 'Not provided'
                    : `${profile.dailyStudyGoalMinutes} minutes`}
                </dd>
              </div>
              <div>
                <dt>Technology interests</dt>
                <dd>
                  {profile.interestedTechnologyIds.length
                    ? `${profile.interestedTechnologyIds.length} saved interests; technology names are not available yet.`
                    : 'Not provided'}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>
      <section
        className={`${styles.card} ${styles.empty}`}
        aria-labelledby="learning-title"
      >
        <span className={styles.label}>Learning</span>
        <h2 id="learning-title">Room for what comes next</h2>
        <p>
          Learning paths, practice and progress are not available yet. No
          learning activity is shown here.
        </p>
      </section>
    </>
  );
}
