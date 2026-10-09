import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  Technology,
  technologySchema,
} from '../src/modules/technologies/technology.model.js';
import { javascriptInitialData } from '../src/modules/technologies/technology.initial-data.js';
const valid = () => ({
  name: ' JavaScript ',
  slug: 'javascript',
  createdBy: new Types.ObjectId(),
  updatedBy: new Types.ObjectId(),
});
test('technology model validates canonical defaults and optional fields offline', async () => {
  const doc = new Technology(valid());
  await doc.validate();
  assert.equal(doc.name, 'JavaScript');
  assert.equal(doc.status, 'DRAFT');
  assert.equal(doc.order, 0);
  assert.equal(doc.iconAssetId, null);
  await new Technology({
    ...valid(),
    description: 'a'.repeat(2000),
    status: 'ARCHIVED',
    order: 2,
  }).validate();
});
test('technology rejects malformed required fields, slug, status and ordering', async () => {
  for (const patch of [
    { name: '' },
    { name: ' ' },
    { name: 'a'.repeat(81) },
    { slug: 'JavaScript' },
    { slug: 'js\n' },
    { slug: '-js' },
    { slug: 'js--ts' },
    { slug: 'é' },
    { slug: 'a'.repeat(101) },
    { description: 'a'.repeat(2001) },
    { status: 'DELETED' },
    { order: -1 },
    { order: 1.5 },
    { createdBy: null },
    { updatedBy: null },
    { iconAssetId: 'invalid' },
  ])
    await assert.rejects(new Technology({ ...valid(), ...patch }).validate());
  assert.throws(() => new Technology({ ...valid(), unknown: true }));
});
test('technology declares only approved indexes and disables automatic provisioning', () => {
  assert.deepEqual(technologySchema.indexes(), [
    [{ slug: 1 }, { unique: true }],
    [{ status: 1, order: 1 }, {}],
  ]);
  assert.equal(technologySchema.get('autoCreate'), false);
  assert.equal(technologySchema.get('autoIndex'), false);
  assert.equal(technologySchema.get('bufferCommands'), false);
  assert.equal(technologySchema.get('timestamps'), true);
});
test('JavaScript initial definition has no invented provenance and cannot validate as provisioned data', async () => {
  assert.deepEqual(javascriptInitialData, {
    name: 'JavaScript',
    slug: 'javascript',
    iconAssetId: null,
    status: 'PUBLISHED',
    order: 0,
  });
  assert(Object.isFrozen(javascriptInitialData));
  await assert.rejects(new Technology(javascriptInitialData).validate());
});
