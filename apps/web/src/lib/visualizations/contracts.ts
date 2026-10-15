import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}(?![\s\S])/);
const text = (max: number) => z.string().trim().min(1).max(max);
const references = (min: number, max: number) =>
  z
    .array(id)
    .min(min)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length);

// Field order matches F026's normalized authored JSON projection for byte limits.
const authoredSchema = z.strictObject({
  type: z.literal('ANIMATED_FLOW'),
  title: text(120),
  textAlternative: text(4000),
  nodes: z
    .array(
      z.strictObject({
        id,
        label: text(120),
        description: text(1000).optional(),
      }),
    )
    .min(1)
    .max(50),
  edges: z
    .array(
      z.strictObject({
        id,
        source: id,
        target: id,
        label: text(120),
      }),
    )
    .max(100),
  steps: z
    .array(
      z.strictObject({
        title: text(120),
        explanation: text(2000),
        nodeIds: references(1, 50),
        edgeIds: references(0, 100),
      }),
    )
    .min(1)
    .max(100),
  animationConfig: z
    .strictObject({
      stepDurationMs: z.number().int().min(100).max(10000),
      autoplay: z.literal(false),
    })
    .optional(),
  schemaVersion: z.literal(1),
});

export type VisualizationData = z.infer<typeof authoredSchema>;

// Bound inspection before Zod traverses anything. Never invoke ordinary getters,
// toJSON or inherited properties. Proxies are not a JavaScript sandbox boundary.
function inspect(value: unknown, depth = 0): void {
  if (depth > 5) throw new Error('Invalid nesting');
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return;
  if (typeof value !== 'object') throw new Error('Invalid value');
  const array = Array.isArray(value);
  if (
    array
      ? Object.getPrototypeOf(value) !== Array.prototype
      : ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error('Invalid container');
  const keys = Reflect.ownKeys(value);
  if (array) {
    if (value.length > 100 || keys.length !== value.length + 1)
      throw new Error('Invalid array');
  } else if (keys.length > 8) throw new Error('Invalid object');
  for (const key of keys) {
    if (array && key === 'length') continue;
    if (
      typeof key !== 'string' ||
      ['__proto__', 'prototype', 'constructor'].includes(key)
    )
      throw new Error('Invalid key');
    if (
      array &&
      (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)
    )
      throw new Error('Invalid array key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
      throw new Error('Invalid property');
    inspect(descriptor.value, depth + 1);
  }
}

/** Fresh authored projection only; no persistence metadata or inferred defaults. */
export function parseVisualization(data: unknown): VisualizationData | null {
  try {
    inspect(data);
    const result = authoredSchema.safeParse(data);
    if (!result.success) return null;
    const value = result.data;
    const nodes = new Set(value.nodes.map((node) => node.id));
    const edges = new Set(value.edges.map((edge) => edge.id));
    if (
      nodes.size !== value.nodes.length ||
      edges.size !== value.edges.length ||
      value.edges.some(
        (edge) => !nodes.has(edge.source) || !nodes.has(edge.target),
      ) ||
      value.steps.some(
        (step) =>
          step.nodeIds.some((ref) => !nodes.has(ref)) ||
          step.edgeIds.some((ref) => !edges.has(ref)),
      )
    )
      return null;
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 262144)
      return null;
    return value;
  } catch {
    return null;
  }
}

export function validStepSelection(
  data: VisualizationData,
  index: unknown,
): boolean {
  return (
    index == null ||
    (typeof index === 'number' &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < data.steps.length)
  );
}
