'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  bindPlaybackEnvironment,
  createPlaybackController,
  type PlaybackInput,
} from '../../lib/visualizations/playback-controller';
import { VisualizationControls } from './visualization-controls';
import { VisualizationRenderer } from './visualization-renderer';
import styles from './visualization-controls.module.css';

export type VisualizationPlayerProps = PlaybackInput;

export function VisualizationPlayer({
  data,
  visualizationKey,
  accountKey,
  headingLevel = 3,
}: VisualizationPlayerProps) {
  // Separate dependencies avoid key-pair collisions. Replacement occurs before rendering old state.
  const controller = useMemo(
    () =>
      createPlaybackController({
        data,
        visualizationKey,
        accountKey,
        headingLevel,
      }),
    [data, visualizationKey, accountKey, headingLevel],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const environment = useRef<ReturnType<typeof bindPlaybackEnvironment> | null>(
    null,
  );
  useEffect(() => {
    const binding = bindPlaybackEnvironment(controller, {
      document,
      motion:
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : null,
    });
    environment.current = binding;
    return () => {
      environment.current = null;
      binding.dispose();
    };
  }, [controller]);
  return (
    <section className={styles.player} aria-label="Visualization player">
      <VisualizationControls
        state={state}
        onAction={(action) => {
          environment.current?.refresh();
          controller.dispatch(action);
        }}
      />
      <VisualizationRenderer
        data={
          controller.data ??
          (data == null && state.mode === 'unavailable' ? null : {})
        }
        selectedStepIndex={state.selectedStepIndex}
        headingLevel={headingLevel}
      />
    </section>
  );
}
