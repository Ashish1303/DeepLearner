'use client';

import { useState } from 'react';
import { VisualizationPlayer } from '../../../../components/visualizations/visualization-player';
import type { VisualizationData } from '../../../../lib/visualizations/contracts';
import {
  javascriptClosureCode,
  javascriptClosureLesson,
} from '../../../../lib/visualizations/lessons/javascript-closure';

const graph: VisualizationData = {
  type: 'ANIMATED_FLOW',
  schemaVersion: 1,
  title: 'Synthetic branching flow',
  textAlternative:
    'Two nodes with parallel connections, a return cycle and a self-loop.',
  nodes: [
    {
      id: 'start',
      label:
        'Start: a complete accessible node label that remains available outside the abbreviated diagram',
      description:
        'const text = "<script>alert(1)</script>" is inert teaching text.',
    },
    {
      id: 'finish',
      label: 'Finish',
      description: 'A complete final node description.',
    },
  ],
  edges: [
    {
      id: 'first',
      source: 'start',
      target: 'finish',
      label: 'First labelled connection',
    },
    {
      id: 'parallel',
      source: 'start',
      target: 'finish',
      label: 'Parallel connection',
    },
    { id: 'cycle', source: 'finish', target: 'start', label: 'Return cycle' },
    { id: 'loop', source: 'finish', target: 'finish', label: 'Self-loop' },
  ],
  steps: [
    {
      title: 'Begin',
      explanation: 'Read the first node and its outgoing connection.',
      nodeIds: ['start'],
      edgeIds: ['first'],
    },
    {
      title: 'Explore',
      explanation: 'Compare parallel paths and the return cycle.',
      nodeIds: ['finish'],
      edgeIds: ['parallel', 'cycle'],
    },
    {
      title: 'Finish',
      explanation: 'Observe the self-loop without executing any authored text.',
      nodeIds: ['finish'],
      edgeIds: ['loop'],
    },
  ],
  animationConfig: { stepDurationMs: 1000, autoplay: false },
};
const single = { ...graph, steps: graph.steps.slice(0, 1) };
const empty = { ...graph, steps: [] };

export function VisualizationFixture() {
  const [data, setData] = useState<unknown>(graph);
  const [accountKey, setAccountKey] = useState('synthetic-account-a');
  const [visualizationKey, setVisualizationKey] = useState('synthetic-graph-a');
  const [mounted, setMounted] = useState(true);
  return (
    <main
      style={{ maxWidth: 1120, padding: 16, margin: '0 auto', minWidth: 0 }}
    >
      <h1>Visualization control fixture</h1>
      <p>Synthetic acceptance data only. This is not a student lesson.</p>
      <div
        role="group"
        aria-label="Synthetic fixture cases"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
      >
        <button
          type="button"
          onClick={() =>
            setAccountKey((key) =>
              key === 'synthetic-account-a'
                ? 'synthetic-account-b'
                : 'synthetic-account-a',
            )
          }
        >
          Change account
        </button>
        <button
          type="button"
          onClick={() =>
            setVisualizationKey((key) =>
              key === 'synthetic-graph-a'
                ? 'synthetic-graph-b'
                : 'synthetic-graph-a',
            )
          }
        >
          Change visualization
        </button>
        <button type="button" onClick={() => setAccountKey('')}>
          Logout identity
        </button>
        <button type="button" onClick={() => setData({ ...graph })}>
          Replace snapshot
        </button>
        <button type="button" onClick={() => setData(single)}>
          Single step
        </button>
        <button type="button" onClick={() => setData(empty)}>
          Empty steps
        </button>
        <button
          type="button"
          onClick={() => setData({ ...graph, unknown: true })}
        >
          Invalid data
        </button>
        <button type="button" onClick={() => setData(null)}>
          Missing data
        </button>
        <button type="button" onClick={() => setMounted((value) => !value)}>
          {mounted ? 'Unmount player' : 'Mount player'}
        </button>
        <button
          type="button"
          onClick={() => {
            setData(javascriptClosureLesson);
            setVisualizationKey('synthetic-closure-lesson');
          }}
        >
          Load closure lesson
        </button>
      </div>
      {data === javascriptClosureLesson && (
        <section aria-label="Closure lesson example" style={{ minWidth: 0 }}>
          <p>
            This graph is an overview of six authored stages, not simultaneous
            active stack frames. Highlighted results occur only at their stated
            stages. The code below is displayed, never executed.
          </p>
          <pre
            tabIndex={0}
            aria-label="makeCounter example code"
            style={{ maxWidth: '100%', overflow: 'auto', padding: 8 }}
          >
            <code>{javascriptClosureCode}</code>
          </pre>
        </section>
      )}
      {mounted && (
        <VisualizationPlayer
          data={data}
          visualizationKey={visualizationKey}
          accountKey={accountKey}
          headingLevel={2}
        />
      )}
    </main>
  );
}
