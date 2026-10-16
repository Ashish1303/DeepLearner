'use client';

import { useId } from 'react';
import {
  actionEnabled,
  type PlaybackAction,
  type PlaybackState,
} from '../../lib/visualizations/playback-controller';
import styles from './visualization-controls.module.css';

export function VisualizationControls({
  state,
  onAction,
}: {
  state: PlaybackState;
  onAction: (action: PlaybackAction) => void;
}) {
  const id = useId();
  const primary =
    state.mode === 'playing'
      ? 'Pause'
      : state.mode === 'completed'
        ? 'Replay'
        : 'Play';
  return (
    <div className={styles.controls}>
      <div
        role="group"
        aria-label="Visualization controls"
        aria-describedby={id}
        className={styles.buttons}
      >
        {(['previous', 'primary', 'next', 'reset'] as const).map((action) => (
          <button
            key={action}
            type="button"
            aria-disabled={!actionEnabled(state, action)}
            onClick={() => {
              if (actionEnabled(state, action)) onAction(action);
            }}
          >
            {action === 'primary'
              ? primary
              : { previous: 'Previous', next: 'Next', reset: 'Reset' }[action]}
          </button>
        ))}
      </div>
      <p id={id} data-playback-status>
        {state.mode === 'unavailable'
          ? 'Playback unavailable.'
          : `${state.selectedStepIndex === null ? 'Overview' : `Step ${state.selectedStepIndex + 1} of ${state.stepCount}`} — ${state.mode}.`}
      </p>
      {state.reducedMotion && (
        <p>
          Reduced motion is enabled. Use Previous and Next for manual steps.
        </p>
      )}
      <p
        className={styles.announcement}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.announcement}
      </p>
    </div>
  );
}
