'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/use-auth';
import {
  difficultyOptions,
  draftFromProfile,
  experienceOptions,
  firstIncompleteStep,
  goalOptions,
  labels,
  stepFields,
  validateDraft,
  type Field,
} from '../../lib/onboarding/profile';
import styles from './onboarding.module.css';

const titles = [
  'Your experience',
  'Your learning goals',
  'Your study preferences',
  'Review and save',
];
export function OnboardingWizard() {
  const { state, controller } = useAuth();
  const [draft, setDraft] = useState(() =>
    draftFromProfile(state.user?.profile ?? null),
  );
  const [step, setStep] = useState(() => firstIncompleteStep(draft));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [notice, setNotice] = useState('');
  const [needsCheck, setNeedsCheck] = useState(false);
  const [working, setWorking] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const busy = working || state.pending;
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    const first = (Object.keys(errors) as Field[]).find(
      (field) => errors[field],
    );
    if (first)
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [errors]);
  function change(field: Field, value: string | string[]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || needsCheck) return;
    const validated = validateDraft(draft);
    if (step < 3) {
      const relevant = Object.fromEntries(
        (stepFields[step] ?? [])
          .filter((field) => validated.errors[field])
          .map((field) => [field, validated.errors[field]]),
      );
      setErrors(relevant);
      if (!Object.keys(relevant).length) {
        setNotice('');
        setStep(step + 1);
      }
      return;
    }
    if (!validated.profile) {
      setStep(firstIncompleteStep(draft));
      setErrors(validated.errors);
      return;
    }
    setWorking(true);
    setNotice('Saving your preferences…');
    const result = await controller.saveProfile(validated.profile);
    setWorking(false);
    if (result.kind === 'success')
      setNotice('Preferences saved. Opening your dashboard…');
    else if (result.kind !== 'interrupted') {
      setNotice(result.message);
      if (result.kind === 'uncertain' || result.kind === 'reverify')
        setNeedsCheck(true);
    }
  }
  async function checkSaved() {
    if (busy) return;
    setWorking(true);
    setNotice('Checking your saved profile and session…');
    const result = await controller.checkProfile();
    setWorking(false);
    if (result.kind === 'success') {
      setNeedsCheck(false);
      setNotice(
        'Server state checked. Your draft is unchanged; review it and choose Save and continue to submit again.',
      );
    } else if (result.kind !== 'interrupted') setNotice(result.message);
  }
  const radioGroup = (
    field: 'experienceLevel' | 'preferredDifficulty',
    options: readonly string[],
    legend: string,
  ) => (
    <fieldset className={styles.choices}>
      <legend>{legend}</legend>
      {options.map((value) => (
        <label key={value}>
          <input
            type="radio"
            name={field}
            value={value}
            checked={draft[field] === value}
            onChange={() => change(field, value)}
            aria-describedby={errors[field] ? `${field}-error` : undefined}
          />
          {labels[value]}
        </label>
      ))}
      {errors[field] && (
        <p id={`${field}-error`} className={styles.error} role="alert">
          {errors[field]}
        </p>
      )}
    </fieldset>
  );
  return (
    <section className={styles.card} aria-labelledby="onboarding-title">
      <p className={styles.eyebrow}>Make room for your learning</p>
      <h1 id="onboarding-title">Set up your learning preferences</h1>
      <p>
        Choose what fits you today. Reloading or leaving this page discards
        unsaved changes. Only the final save stores your preferences.
      </p>
      <ol className={styles.steps} aria-label="Onboarding progress">
        {titles.map((title, index) => (
          <li key={title} aria-current={index === step ? 'step' : undefined}>
            {index + 1}. {title}
          </li>
        ))}
      </ol>
      <h2 ref={heading} tabIndex={-1}>
        Step {step + 1} of 4: {titles[step]}
      </h2>
      <form
        ref={form}
        onSubmit={submit}
        noValidate
        aria-label="Student onboarding"
        aria-busy={busy}
      >
        <fieldset disabled={busy} className={styles.fields}>
          <legend className={styles.srOnly}>{titles[step]}</legend>
          {step === 0 &&
            radioGroup(
              'experienceLevel',
              experienceOptions,
              'Experience level (required)',
            )}
          {step === 1 && (
            <fieldset className={styles.choices}>
              <legend>Learning goals (choose 1–5)</legend>
              {goalOptions.map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    name="learningGoals"
                    value={value}
                    checked={draft.learningGoals.includes(value)}
                    onChange={(event) =>
                      change(
                        'learningGoals',
                        event.target.checked
                          ? [...draft.learningGoals, value]
                          : draft.learningGoals.filter(
                              (goal) => goal !== value,
                            ),
                      )
                    }
                    aria-invalid={Boolean(errors.learningGoals)}
                    aria-describedby={
                      errors.learningGoals ? 'learningGoals-error' : undefined
                    }
                  />
                  {labels[value]}
                </label>
              ))}
              {errors.learningGoals && (
                <p
                  id="learningGoals-error"
                  className={styles.error}
                  role="alert"
                >
                  {errors.learningGoals}
                </p>
              )}
            </fieldset>
          )}
          {step === 2 && (
            <>
              {radioGroup(
                'preferredDifficulty',
                difficultyOptions,
                'Preferred difficulty (required)',
              )}
              <label className={styles.minutes} htmlFor="dailyStudyGoalMinutes">
                Daily study goal in minutes (required)
              </label>
              <input
                id="dailyStudyGoalMinutes"
                name="dailyStudyGoalMinutes"
                type="number"
                inputMode="numeric"
                min={5}
                max={240}
                step={1}
                required
                value={draft.dailyStudyGoalMinutes}
                onChange={(event) =>
                  change('dailyStudyGoalMinutes', event.target.value)
                }
                aria-invalid={Boolean(errors.dailyStudyGoalMinutes)}
                aria-describedby="minutes-help minutes-error"
              />
              <p id="minutes-help">Choose a whole number from 5 to 240.</p>
              <p id="minutes-error" className={styles.error} role="alert">
                {errors.dailyStudyGoalMinutes}
              </p>
            </>
          )}
          {step === 3 && (
            <dl className={styles.review}>
              <div>
                <dt>Experience</dt>
                <dd>{labels[draft.experienceLevel]}</dd>
              </div>
              <div>
                <dt>Learning goals</dt>
                <dd>
                  {draft.learningGoals.map((goal) => labels[goal]).join(', ')}
                </dd>
              </div>
              <div>
                <dt>Preferred difficulty</dt>
                <dd>{labels[draft.preferredDifficulty]}</dd>
              </div>
              <div>
                <dt>Daily study goal</dt>
                <dd>{draft.dailyStudyGoalMinutes} minutes</dd>
              </div>
            </dl>
          )}
          <p className={styles.catalog}>
            Technology selection will be available when the catalog launches.
            Existing technology interests are preserved.
          </p>
          <div className={styles.actions}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => {
                  setErrors({});
                  setNotice('');
                  setStep(step - 1);
                }}
              >
                Back
              </button>
            )}
            <button
              type="submit"
              className={styles.primary}
              disabled={needsCheck}
            >
              {step === 3 ? 'Save and continue' : 'Next'}
            </button>
          </div>
        </fieldset>
      </form>
      <p role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </p>
      {needsCheck && (
        <button
          type="button"
          disabled={busy}
          className={styles.check}
          onClick={() => void checkSaved()}
        >
          Check saved profile and session
        </button>
      )}
    </section>
  );
}
