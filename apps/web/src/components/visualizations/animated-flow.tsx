import { useId } from 'react';
import type { VisualizationData } from '../../lib/visualizations/contracts';
import type { FlowLayout } from '../../lib/visualizations/layout';
import styles from './visualization.module.css';

// Internal presentation boundary: validated data and geometry only.
export function AnimatedFlow({
  data,
  layout,
  selectedStepIndex,
  headingLevel,
}: {
  data: VisualizationData;
  layout: FlowLayout;
  selectedStepIndex: number | null;
  headingLevel: 2 | 3 | 4;
}) {
  const uid = useId();
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const Subheading = `h${headingLevel + 1}` as 'h3' | 'h4' | 'h5';
  const step =
    selectedStepIndex === null ? null : data.steps[selectedStepIndex];
  const selectedNodes = new Set(step?.nodeIds);
  const selectedEdges = new Set(step?.edgeIds);
  const nodeNumbers = new Map(data.nodes.map((node, i) => [node.id, i + 1]));
  return (
    <section className={styles.renderer} aria-labelledby={`${uid}-heading`}>
      <Heading id={`${uid}-heading`}>{data.title}</Heading>
      <p>{data.textAlternative}</p>
      <p className={styles.notice}>
        {selectedStepIndex === null
          ? 'Overview — no step selected.'
          : `Step ${selectedStepIndex + 1} of ${data.steps.length}`}
      </p>
      <div
        className={styles.scroll}
        role="region"
        tabIndex={0}
        aria-label="Visualization diagram — scroll to explore"
      >
        <svg
          className={styles.diagram}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-labelledby={`${uid}-title`}
          aria-describedby={`${uid}-description`}
        >
          <title id={`${uid}-title`}>{data.title}</title>
          <desc id={`${uid}-description`}>
            {data.textAlternative} Complete node, connection and step
            descriptions follow the diagram.
          </desc>
          <defs>
            <marker
              id={`${uid}-arrow`}
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" className={styles.arrow} />
            </marker>
            {layout.nodes.map((node) => (
              <clipPath key={node.index} id={`${uid}-node-${node.index}`}>
                <rect x={node.x + 12} y={node.y + 8} width="232" height="112" />
              </clipPath>
            ))}
            {layout.edges.map((edge) => (
              <clipPath key={edge.index} id={`${uid}-edge-${edge.index}`}>
                <rect
                  x={edge.labelX + 4}
                  y={edge.labelY - 32}
                  width="104"
                  height="64"
                />
              </clipPath>
            ))}
          </defs>
          {layout.edges.map((edge) => {
            const selected = selectedEdges.has(edge.id);
            return (
              <g
                key={edge.id}
                data-edge-index={edge.index}
                data-selected={selected}
              >
                <path
                  d={edge.path}
                  className={selected ? styles.selectedEdge : styles.edge}
                  markerEnd={`url(#${uid}-arrow)`}
                />
                <rect
                  x={edge.labelX}
                  y={edge.labelY - 36}
                  width="112"
                  height="72"
                  rx="6"
                  className={styles.badge}
                />
                <text
                  className={styles.label}
                  clipPath={`url(#${uid}-edge-${edge.index})`}
                >
                  <tspan x={edge.labelX + 6} y={edge.labelY - 15}>
                    Edge {edge.index + 1}
                  </tspan>
                  <tspan x={edge.labelX + 6} y={edge.labelY + 4}>
                    {edge.label}
                  </tspan>
                  {selected && (
                    <tspan x={edge.labelX + 6} y={edge.labelY + 24}>
                      Selected
                    </tspan>
                  )}
                </text>
              </g>
            );
          })}
          {layout.nodes.map((node) => {
            const selected = selectedNodes.has(node.id);
            return (
              <g
                key={node.id}
                data-node-index={node.index}
                data-selected={selected}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx="12"
                  className={selected ? styles.selectedNode : styles.node}
                />
                <text
                  className={styles.label}
                  clipPath={`url(#${uid}-node-${node.index})`}
                >
                  <tspan x={node.x + 16} y={node.y + 26}>
                    Node {node.index + 1}
                  </tspan>
                  {node.lines.map((line, index) => (
                    <tspan
                      key={index}
                      x={node.x + 16}
                      y={node.y + 52 + index * 22}
                    >
                      {line}
                    </tspan>
                  ))}
                  {selected && (
                    <tspan x={node.x + 16} y={node.y + 104}>
                      Selected
                    </tspan>
                  )}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <section aria-labelledby={`${uid}-nodes`}>
        <Subheading id={`${uid}-nodes`}>Nodes</Subheading>
        <ol>
          {data.nodes.map((node) => (
            <li key={node.id}>
              <strong>{node.label}</strong>
              {selectedNodes.has(node.id) && <span> — Selected</span>}
              {node.description && <p>{node.description}</p>}
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby={`${uid}-edges`}>
        <Subheading id={`${uid}-edges`}>Connections</Subheading>
        {data.edges.length === 0 ? (
          <p>No connections.</p>
        ) : (
          <ol>
            {data.edges.map((edge) => (
              <li key={edge.id}>
                <strong>{edge.label}</strong> — Node{' '}
                {nodeNumbers.get(edge.source)} to Node{' '}
                {nodeNumbers.get(edge.target)}
                {selectedEdges.has(edge.id) && <span> — Selected</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby={`${uid}-steps`}>
        <Subheading id={`${uid}-steps`}>Steps</Subheading>
        <ol>
          {data.steps.map((item, index) => (
            <li
              key={index}
              aria-current={index === selectedStepIndex ? 'step' : undefined}
              className={
                index === selectedStepIndex ? styles.currentStep : undefined
              }
            >
              <strong>{item.title}</strong>
              {index === selectedStepIndex && <span> — Selected</span>}
              <p>{item.explanation}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
