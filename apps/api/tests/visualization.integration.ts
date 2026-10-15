// Separately gated. Never execute as part of the offline *.test.ts suite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import { Visualization } from '../src/modules/visualizations/visualization.model.js';

test(
  'F026 isolated visualization persistence and index verification',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F021_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F021_TEST_URI,
        MONGODB_DB_NAME: process.env.F021_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    const owned: string[] = [];
    try {
      await database.connect();
      const db = mongoose.connection.db!;
      assert.equal(db.databaseName, 'deeplearner-f021-test');
      const options = (await db.admin().command({ getCmdLineOpts: 1 })).parsed;
      assert.equal(options.net.bindIp, '127.0.0.1');
      assert.equal(options.net.port, 27018);
      assert.equal(options.replication.replSet, 'f021-test');
      const hello = await db.admin().command({ hello: 1 });
      assert.equal(hello.setName, 'f021-test');
      assert.equal(hello.isWritablePrimary, true);
      const replica = (await db.admin().command({ replSetGetConfig: 1 }))
        .config;
      assert.equal(replica.members.length, 1);
      assert.equal(replica.members[0].host, '127.0.0.1:27018');
      assert.deepEqual(await db.listCollections().toArray(), []);
      for (const model of [
        Technology,
        LearningPath,
        Module,
        Topic,
        Concept,
        Visualization,
      ]) {
        await model.createCollection();
        owned.unshift(model.collection.name);
        await model.createIndexes();
      }
      const actor = new Types.ObjectId(); // Synthetic reference, not an Admin identity assertion.
      const audit = { createdBy: actor, updatedBy: actor };
      const common = {
        title: 'Synthetic',
        slug: 'synthetic-f026',
        status: 'PUBLISHED' as const,
      };
      const technology = await Technology.create({
        name: 'Synthetic',
        slug: common.slug,
        status: common.status,
        ...audit,
      });
      const path = await LearningPath.create({
        ...common,
        technologyId: technology._id,
        ...audit,
      });
      const module = await Module.create({
        ...common,
        technologyId: technology._id,
        learningPathId: path._id,
      });
      const topic = await Topic.create({
        ...common,
        technologyId: technology._id,
        learningPathId: path._id,
        moduleId: module._id,
      });
      const concept = await Concept.create({
        ...common,
        ...audit,
        technologyId: technology._id,
        learningPathId: path._id,
        moduleId: module._id,
        topicId: topic._id,
        difficulty: 'BEGINNER',
        read: { summary: 'Synthetic', bodyMarkdown: 'Synthetic content' },
        source: {
          label: 'Synthetic reference',
          url: 'https://example.invalid/docs',
          sourceType: 'OFFICIAL_OR_TRUSTED',
          isOfficial: false,
        },
      });
      const originals = await Promise.all([
        Technology.find().lean(),
        LearningPath.find().lean(),
        Module.find().lean(),
        Topic.find().lean(),
        Concept.find().lean(),
      ]);
      const conceptIndexes = await Concept.collection.indexes();
      const input = () => ({
        ...audit,
        conceptId: concept._id,
        technologyId: technology._id,
        topicId: topic._id,
        type: 'ANIMATED_FLOW' as const,
        title: ' Flow ',
        textAlternative: ' Plain explanation ',
        nodes: [
          { id: 'a', label: ' A ' },
          { id: 'b', label: 'B', description: ' Description ' },
        ],
        edges: [{ id: 'next', source: 'a', target: 'b', label: ' Next ' }],
        steps: [
          {
            title: ' Start ',
            explanation: ' Explain ',
            nodeIds: ['b', 'a'],
            edgeIds: ['next'],
          },
        ],
      });
      await t.test(
        'persist optional absence/full config, exact text, ordered refs, defaults and audit updates',
        async () => {
          const first = await Visualization.create(input());
          let stored = await Visualization.collection.findOne({
            _id: first._id,
          });
          assert(stored);
          assert.equal(stored.title, 'Flow');
          assert.equal(stored.status, 'DRAFT');
          assert.equal(stored.schemaVersion, 1);
          assert(!Object.hasOwn(stored, 'animationConfig'));
          assert(!Object.hasOwn(stored.nodes[0]!, 'description'));
          assert.deepEqual(stored.steps[0]!.nodeIds, ['b', 'a']);
          for (const entries of [stored.nodes, stored.edges, stored.steps])
            for (const entry of entries) assert(!Object.hasOwn(entry, '_id'));
          assert(
            stored.createdAt instanceof Date &&
              stored.updatedAt instanceof Date,
          );
          const created = stored.createdAt;
          first.title = 'Updated';
          await first.save();
          stored = await Visualization.collection.findOne({ _id: first._id });
          assert(stored);
          assert.equal(stored.title, 'Updated');
          assert.deepEqual(stored.createdAt, created);
          assert(stored.updatedAt >= created);
          const full = await Visualization.create({
            ...input(),
            conceptId: concept._id.toHexString(),
            animationConfig: { stepDurationMs: 10000, autoplay: false },
            textAlternative: '<script>inert()</script> const f = () => 1;',
          });
          const readback = await Visualization.findById(full._id);
          assert(readback);
          await readback.validate();
          assert.deepEqual(readback.toObject().animationConfig, {
            stepDurationMs: 10000,
            autoplay: false,
          });
          assert.equal(
            readback.textAlternative,
            '<script>inert()</script> const f = () => 1;',
          );
        },
      );
      await t.test(
        'invalid values/references never persist and validated mutations fail',
        async () => {
          const count = await Visualization.countDocuments();
          for (const patch of [
            { title: 1 },
            { title: 'x'.repeat(121) },
            { textAlternative: 'x'.repeat(4001) },
            { type: 'FLOWCHART' },
            { schemaVersion: '1' },
            { status: 'UNKNOWN' },
            { conceptId: 1 },
            { nodes: [] },
            {
              nodes: Array.from({ length: 51 }, (_, i) => ({
                id: 'a' + i,
                label: 'N',
              })),
            },
            { nodes: [input().nodes[0], input().nodes[0]] },
            { edges: [{ ...input().edges[0], target: 'missing' }] },
            { steps: [{ ...input().steps[0], edgeIds: ['missing'] }] },
            { animationConfig: { stepDurationMs: 100 } },
            { animationConfig: { stepDurationMs: 100, autoplay: 'false' } },
            { animationConfig: { stepDurationMs: 100, autoplay: true } },
            { animationConfig: null },
            { unexpected: true },
          ])
            await assert.rejects(async () => {
              await new Visualization({ ...input(), ...patch }).save();
            });
          assert.equal(await Visualization.countDocuments(), count);
          const existing = await Visualization.findOne();
          assert(existing);
          existing.nodes[0]!.id = 'missing';
          await assert.rejects(existing.save(), /reference/);
          assert.equal(
            (await Visualization.collection.findOne({ _id: existing._id }))
              ?.nodes[0]?.id,
            'a',
          );
        },
      );
      await t.test(
        'bounded maximum payload persists; one extra byte is rejected',
        async () => {
          const nodes = Array.from({ length: 50 }, (_, i) => ({
            id: 'n' + i,
            label: 'x'.repeat(120),
            description: 'x'.repeat(1000),
          }));
          const edges = Array.from({ length: 100 }, (_, i) => ({
            id: 'e' + i,
            source: 'n0',
            target: 'n1',
            label: 'x'.repeat(120),
          }));
          const steps = Array.from({ length: 100 }, () => ({
            title: 'x'.repeat(120),
            explanation: 'x',
            nodeIds: ['n0'],
            edgeIds: [] as string[],
          }));
          const data = {
            ...input(),
            title: 'x'.repeat(120),
            textAlternative: 'x'.repeat(4000),
            nodes,
            edges,
            steps,
            animationConfig: { stepDurationMs: 100, autoplay: false },
            schemaVersion: 1,
          };
          const bytes = () =>
            Buffer.byteLength(
              JSON.stringify(
                Object.fromEntries(
                  [
                    'type',
                    'title',
                    'textAlternative',
                    'nodes',
                    'edges',
                    'steps',
                    'animationConfig',
                    'schemaVersion',
                  ].map((key) => [key, data[key as keyof typeof data]]),
                ),
              ),
            );
          for (const step of steps)
            step.explanation += 'x'.repeat(
              Math.min(1999, Math.max(0, 262144 - bytes())),
            );
          assert.equal(bytes(), 262144);
          const saved = await Visualization.create(data);
          const stored = await Visualization.collection.findOne({
            _id: saved._id,
          });
          assert(stored);
          assert.deepEqual(stored.steps, steps);
          const available = saved.steps.find(
            (step) => step.explanation.length < 2000,
          )!;
          available.explanation += 'x';
          await assert.rejects(saved.save(), /256 KiB/);
          assert.deepEqual(
            (await Visualization.collection.findOne({ _id: saved._id }))?.steps,
            steps,
          );
        },
      );
      await t.test(
        'real indexes permit repeated Concept/type records; reads preserve data and Concept indexes',
        async () => {
          const indexes = await Visualization.collection.indexes();
          assert.equal(indexes.length, 3);
          for (const key of [
            { conceptId: 1, status: 1 },
            { conceptId: 1, type: 1 },
          ]) {
            const index = indexes.find(
              (i) => JSON.stringify(i.key) === JSON.stringify(key),
            );
            assert(
              index && !index.unique && index.expireAfterSeconds === undefined,
            );
          }
          const pair = await Promise.all([
            Visualization.create(input()),
            Visualization.create(input()),
          ]);
          assert.notEqual(String(pair[0]._id), String(pair[1]._id));
          await assert.rejects(
            Visualization.create({ ...input(), _id: pair[0]._id }),
            (e: unknown) =>
              typeof e === 'object' &&
              e !== null &&
              'code' in e &&
              e.code === 11000,
          );
          const before = await Visualization.find().sort({ _id: 1 }).lean();
          await Visualization.find({
            conceptId: concept._id,
            type: 'ANIMATED_FLOW',
          });
          assert.deepEqual(
            await Visualization.find().sort({ _id: 1 }).lean(),
            before,
          );
          assert.deepEqual(
            await Promise.all([
              Technology.find().lean(),
              LearningPath.find().lean(),
              Module.find().lean(),
              Topic.find().lean(),
              Concept.find().lean(),
            ]),
            originals,
          );
          assert.deepEqual(await Concept.collection.indexes(), conceptIndexes);
          assert.deepEqual(
            (await db.listCollections().toArray()).map((c) => c.name).sort(),
            [...owned].sort(),
          );
        },
      );
    } finally {
      try {
        const failures: string[] = [];
        for (const collection of owned) {
          try {
            await mongoose.connection.db!.collection(collection).drop();
          } catch {
            failures.push(collection);
          }
        }
        assert.deepEqual(failures, [], 'Owned collection cleanup failed');
      } finally {
        await database.disconnect();
      }
    }
  },
);
