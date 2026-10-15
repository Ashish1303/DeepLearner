import type { VisualizationData } from './contracts';

/** Abbreviate by Unicode code points, never split surrogate pairs. */
export function abbreviate(label: string, limit: number): string {
  const points = Array.from(label);
  return points.length <= limit ? label : points.slice(0, limit).join('') + '…';
}

export function nodeLabelLines(label: string): string[] {
  const points = Array.from(label);
  return [
    points.slice(0, 12).join(''),
    points.slice(12, 24).join('') + (points.length > 24 ? '…' : ''),
  ];
}

/** Internal: callers first validate the authored graph; layout never repairs it. */
export function layoutFlow(data: VisualizationData) {
  if (
    data.nodes.length < 1 ||
    data.nodes.length > 50 ||
    data.edges.length > 100
  )
    throw new RangeError('Invalid graph bounds');
  const nodes = data.nodes.map((node, index) => ({
    id: node.id,
    index,
    x: 32,
    y: 32 + 176 * index,
    width: 256,
    height: 128,
    lines: nodeLabelLines(node.label),
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = data.edges.map((edge, index) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) throw new RangeError('Invalid endpoint');
    const self = source === target;
    const startY = source.y + 64 - (self ? 24 : 0);
    const endY = target.y + 64 + (self ? 24 : 0);
    const lane = 352 + 128 * index;
    return {
      id: edge.id,
      index,
      lane,
      startY,
      endY,
      path: `M 288 ${startY} H ${lane} V ${endY} H 288`,
      labelX: lane + 8,
      labelY: (startY + endY) / 2,
      label: abbreviate(edge.label, 10),
    };
  });
  return {
    width: edges.length ? 496 + 128 * (edges.length - 1) : 320,
    height: 64 + 128 * nodes.length + 48 * (nodes.length - 1),
    nodes,
    edges,
  };
}

export type FlowLayout = ReturnType<typeof layoutFlow>;
