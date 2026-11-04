import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { Types } from 'mongoose';
import { z } from 'zod';

export const proposalByteLimit = 65_536;
export const proposalInvalid = () =>
  new Error('Invalid Learning Path proposal');
const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const reference = z.union([
  id,
  z.instanceof(Types.ObjectId).transform((v) => v.toHexString()),
]);

function text(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .refine((s) => {
      if (s.trim() !== s) return false;
      for (let i = 0; i < s.length; i++) {
        const unit = s.charCodeAt(i);
        if (
          unit <= 0x1f ||
          unit === 0x7f ||
          unit === 0x85 ||
          unit === 0x2028 ||
          unit === 0x2029
        )
          return false;
        if (unit >= 0xd800 && unit <= 0xdbff) {
          const next = s.charCodeAt(++i);
          if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
      }
      return true;
    });
}
export const proposalContent = {
  title: text(120),
  objectives: z
    .array(text(240))
    .min(1)
    .max(20)
    .refine((a) => new Set(a).size === a.length),
  audience: text(500),
  depth: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  runtime: z
    .strictObject({ name: text(80), version: text(80).nullable() })
    .nullable(),
  technologyVersion: text(80).nullable(),
  prerequisites: z
    .array(z.strictObject({ description: text(240) }))
    .max(20)
    .refine((a) => new Set(a.map((p) => p.description)).size === a.length),
};
const fields = {
  _id: reference,
  proposalId: reference,
  technologyId: reference,
  revision: positive,
  schemaVersion: z.literal(1),
  source: z.strictObject({ id: reference, revision: positive, digest }),
  ...proposalContent,
  createdAt: z.date(),
};
const definition = z.strictObject(fields);
const record = definition.extend({ definitionDigest: digest });
const binding = z.strictObject({
  technologyId: id,
  source: z.strictObject({ id, revision: positive, digest }),
});
export type ProposalRecord = z.output<typeof record>;
export type ProposalBinding = z.output<typeof binding>;

/** Copy inert data before Zod reads it. No accessors, proxies or coercion run. */
export function proposalData(input: unknown): unknown {
  let budget = 256;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    if (--budget < 0 || depth > 5) throw proposalInvalid();
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value === 'string') {
      if (value.length > proposalByteLimit) throw proposalInvalid();
      return value;
    }
    if (
      typeof value !== 'object' ||
      types.isProxy(value) ||
      ancestors.has(value)
    )
      throw proposalInvalid();
    const proto = Object.getPrototypeOf(value);
    if (proto === Date.prototype) {
      if (Reflect.ownKeys(value).length) throw proposalInvalid();
      return new Date(Date.prototype.getTime.call(value));
    }
    if (proto === Types.ObjectId.prototype) {
      const keys = Reflect.ownKeys(value);
      // The installed BSON uses four own 24-bit words. Read only inert data
      // descriptors, never user-supplied id/getter/toHexString methods.
      if (
        keys.length !== 4 ||
        keys.some((key) => !['i0', 'i1', 'i2', 'i3'].includes(String(key)))
      )
        throw proposalInvalid();
      let hex = '';
      for (const name of ['i0', 'i1', 'i2', 'i3']) {
        const cell = Object.getOwnPropertyDescriptor(value, name);
        if (
          !cell ||
          !('value' in cell) ||
          !Number.isInteger(cell.value) ||
          cell.value < 0 ||
          cell.value > 0xffffff
        )
          throw proposalInvalid();
        hex += Number.prototype.toString.call(cell.value, 16).padStart(6, '0');
      }
      return new Types.ObjectId(hex);
    }
    const array = Array.isArray(value);
    if (
      array
        ? proto !== Array.prototype
        : proto !== Object.prototype && proto !== null
    )
      throw proposalInvalid();
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string') || keys.length > 33)
      throw proposalInvalid();
    ancestors.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, 'length');
        if (
          !length ||
          !('value' in length) ||
          !Number.isInteger(length.value) ||
          length.value < 0 ||
          length.value > 20 ||
          keys.length !== length.value + 1
        )
          throw proposalInvalid();
        const result: unknown[] = [];
        for (let i = 0; i < length.value; i++) {
          const cell = Object.getOwnPropertyDescriptor(value, String(i));
          if (!cell || !cell.enumerable || !('value' in cell))
            throw proposalInvalid();
          result.push(copy(cell.value, depth + 1));
        }
        return result;
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys) {
        if (typeof key !== 'string') throw proposalInvalid();
        const cell = Object.getOwnPropertyDescriptor(value, key);
        if (!cell || !cell.enumerable || !('value' in cell))
          throw proposalInvalid();
        result[key] = copy(cell.value, depth + 1);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  try {
    return copy(input, 0);
  } catch {
    throw proposalInvalid();
  }
}

function hash(row: z.output<typeof definition>) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'F044-proposal-v1',
        row._id,
        row.proposalId,
        row.technologyId,
        row.revision,
        row.source.id,
        row.source.revision,
        row.source.digest,
        row.title,
        row.objectives,
        row.audience,
        row.depth,
        row.runtime === null ? null : [row.runtime.name, row.runtime.version],
        row.technologyVersion,
        row.prerequisites.map((p) => p.description),
      ]),
      'utf8',
    )
    .digest('hex');
}

/** Bytes of canonical JSON, not UTF-16 string length. Not a record validator. */
export function assertProposalByteLimit(encoded: unknown): void {
  if (
    typeof encoded !== 'string' ||
    Buffer.byteLength(encoded, 'utf8') > proposalByteLimit
  )
    throw proposalInvalid();
}

/** Structural validation only: this never resolves stored source/parent records. */
export function validateProposalStructure(input: unknown): ProposalRecord {
  try {
    const row = record.parse(proposalData(input));
    assertProposalByteLimit(JSON.stringify(row));
    if (row.definitionDigest !== hash(row)) throw proposalInvalid();
    return row;
  } catch {
    throw proposalInvalid();
  }
}

/** Input excludes definitionDigest. No missing values are generated/defaulted. */
export function proposalDefinitionDigest(input: unknown): string {
  try {
    return hash(definition.parse(proposalData(input)));
  } catch {
    throw proposalInvalid();
  }
}

export function validateProposalRecord(
  input: unknown,
  expected: unknown,
): ProposalRecord {
  try {
    const row = validateProposalStructure(input);
    const target = binding.parse(proposalData(expected));
    if (
      row.technologyId !== target.technologyId ||
      row.source.id !== target.source.id ||
      row.source.revision !== target.source.revision ||
      row.source.digest !== target.source.digest
    )
      throw proposalInvalid();
    return row;
  } catch {
    throw proposalInvalid();
  }
}

/** Predecessor equality is local evidence, not persisted ordering/concurrency. */
export function validateProposalRevisionCreation(
  input: unknown,
  expected: unknown,
  predecessor?: unknown,
): ProposalRecord {
  try {
    const row = validateProposalRecord(input, expected);
    if (row.revision === 1) {
      if (predecessor !== undefined) throw proposalInvalid();
    } else {
      const previous = validateProposalStructure(predecessor);
      if (
        previous.proposalId !== row.proposalId ||
        previous.technologyId !== row.technologyId ||
        previous._id === row._id ||
        previous.revision === Number.MAX_SAFE_INTEGER ||
        row.revision !== previous.revision + 1 ||
        row.createdAt < previous.createdAt ||
        row.source.id !== previous.source.id ||
        row.source.revision < previous.source.revision ||
        (row.source.revision === previous.source.revision &&
          row.source.digest !== previous.source.digest)
      )
        throw proposalInvalid();
    }
    return row;
  } catch {
    throw proposalInvalid();
  }
}
