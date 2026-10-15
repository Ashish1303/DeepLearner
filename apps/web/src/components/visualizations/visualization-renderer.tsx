'use client';

import {
  parseVisualization,
  validStepSelection,
} from '../../lib/visualizations/contracts';
import { layoutFlow } from '../../lib/visualizations/layout';
import { AnimatedFlow } from './animated-flow';
import styles from './visualization.module.css';

export type VisualizationRendererProps = {
  data: unknown;
  selectedStepIndex?: number | null;
  headingLevel?: 2 | 3 | 4;
};

export function VisualizationRenderer({
  data,
  selectedStepIndex,
  headingLevel = 3,
}: VisualizationRendererProps) {
  if (![2, 3, 4].includes(headingLevel))
    return <p className={styles.notice}>Visualization unavailable.</p>;
  if (data == null)
    return <p className={styles.notice}>No visualization available.</p>;
  const parsed = parseVisualization(data);
  if (!parsed || !validStepSelection(parsed, selectedStepIndex))
    return <p className={styles.notice}>Visualization unavailable.</p>;
  return (
    <AnimatedFlow
      data={parsed}
      layout={layoutFlow(parsed)}
      selectedStepIndex={selectedStepIndex ?? null}
      headingLevel={headingLevel}
    />
  );
}
