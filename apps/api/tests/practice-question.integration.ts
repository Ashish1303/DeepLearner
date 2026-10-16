// Separately authorized disposable integration only; excluded from *.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { PracticeQuestion } from '../src/modules/practice/practice-question.model.js';

const persist = (input: unknown) => new PracticeQuestion(input).save();

test(
  'F030 isolated practice persistence, validation, projections and indexes',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F021_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    // The approved external procedure must first verify owned fresh storage/process.
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
    let owned = false;
    try {
      await database.connect();
      const db = mongoose.connection.db!;
      const hello = await db.admin().command({ hello: 1 });
      assert.equal(hello.setName, 'f021-test');
      assert.equal(hello.isWritablePrimary, true);
      const options = (await db.admin().command({ getCmdLineOpts: 1 })).parsed;
      assert.equal(options.net.bindIp, '127.0.0.1');
      assert.equal(options.net.port, 27018);
      assert.equal(options.replication.replSet, 'f021-test');
      const replica = (await db.admin().command({ replSetGetConfig: 1 }))
        .config;
      assert.equal(replica.members.length, 1);
      assert.equal(replica.members[0].host, '127.0.0.1:27018');
      assert.equal(db.databaseName, 'deeplearner-f021-test');
      assert.deepEqual(await db.listCollections().toArray(), []);
      // Explicit creation only after preflight. No parent or User documents needed:
      // this model validates identifiers, not existence or Admin authority.
      await PracticeQuestion.createCollection();
      owned = true;
      await PracticeQuestion.createIndexes();
      const references = {
        technologyId: new Types.ObjectId(),
        topicId: new Types.ObjectId(),
        conceptId: new Types.ObjectId(),
        createdBy: new Types.ObjectId(),
        updatedBy: new Types.ObjectId(),
      };
      const input = () => ({
        ...references,
        type: 'OUTPUT',
        difficulty: 'BEGINNER',
        prompt: ' Prompt ',
        answer: ' Answer ',
        explanation: ' Explanation ',
      });

      await t.test(
        'persist all types, whitespace/nulls/defaults and timestamped validated edits',
        async () => {
          for (const type of ['CODING', 'OUTPUT', 'DESCRIPTIVE', 'SCENARIO']) {
            for (const language of ['JAVASCRIPT', 'TYPESCRIPT']) {
              const doc = await new PracticeQuestion({
                ...input(),
                type,
                language,
                starterCode: ' \nconst x = "<script>inert</script>";\n ',
              }).save();
              const stored = await PracticeQuestion.collection.findOne({
                _id: doc._id,
              });
              assert(stored);
              assert.equal(stored.prompt, 'Prompt');
              assert.equal(stored.answer, 'Answer');
              assert.equal(stored.explanation, 'Explanation');
              assert.equal(
                stored.starterCode,
                ' \nconst x = "<script>inert</script>";\n ',
              );
              assert.equal(stored.language, language);
              assert.equal(stored.type, type);
              assert.equal(stored.status, 'DRAFT');
              assert.equal(stored.schemaVersion, 1);
              for (const [key, value] of Object.entries(references))
                assert.equal(
                  String(stored[key as keyof typeof references]),
                  String(value),
                );
              assert(
                stored.createdAt instanceof Date &&
                  stored.updatedAt instanceof Date,
              );
              doc.status = 'IN_REVIEW';
              await doc.save();
              const edited = await PracticeQuestion.collection.findOne({
                _id: doc._id,
              });
              assert(edited);
              assert.deepEqual(edited.createdAt, stored.createdAt);
              assert(edited.updatedAt >= stored.updatedAt);
              assert.equal(edited.status, 'IN_REVIEW');
            }
          }
          const absent = await persist({
            ...input(),
            explanation: undefined,
          });
          const read = await PracticeQuestion.collection.findOne({
            _id: absent._id,
          });
          assert(read);
          for (const key of ['starterCode', 'language', 'explanation'])
            assert(!Object.hasOwn(read, key));
          const nullable = await persist({
            ...input(),
            starterCode: null,
            language: null,
          });
          assert.equal(
            (await PracticeQuestion.collection.findOne({ _id: nullable._id }))
              ?.starterCode,
            null,
          );
          const max = await persist({
            ...input(),
            prompt: 'x'.repeat(50000),
            answer: 'a'.repeat(50000),
            explanation: 'e'.repeat(50000),
            starterCode: 'c'.repeat(50000),
            language: 'JAVASCRIPT',
          });
          assert.equal(
            (await PracticeQuestion.findById(max._id).select('+answer').lean())
              ?.answer.length,
            50000,
          );
        },
      );

      await t.test(
        'default/lean/inclusion projections hide answers, opt-in and unrelated saves preserve them',
        async () => {
          const doc = await persist(input());
          const before = await PracticeQuestion.collection.findOne({
            _id: doc._id,
          });
          const normal = await PracticeQuestion.findById(doc._id);
          assert(normal);
          for (const result of [
            normal.toObject(),
            await PracticeQuestion.findOne({ _id: doc._id }).lean(),
            (await PracticeQuestion.find({ _id: doc._id }).lean())[0],
            await PracticeQuestion.findById(doc._id)
              .select('prompt type')
              .lean(),
          ]) {
            assert(result);
            assert(!Object.hasOwn(result, 'answer'));
            assert(!Object.hasOwn(result, 'explanation'));
          }
          const full = await PracticeQuestion.findById(doc._id)
            .select('+answer +explanation')
            .lean();
          assert.equal(full?.answer, 'Answer');
          assert.equal(full?.explanation, 'Explanation');
          assert.deepEqual(
            await PracticeQuestion.collection.findOne({ _id: doc._id }),
            before,
          );
          normal.prompt = 'Changed prompt';
          await normal.save();
          const after = await PracticeQuestion.collection.findOne({
            _id: doc._id,
          });
          assert.equal(after?.answer, 'Answer');
          assert.equal(after?.explanation, 'Explanation');
        },
      );

      await t.test(
        'invalid inputs and whole-document mutations cannot persist',
        async () => {
          const before = await PracticeQuestion.countDocuments();
          const invalid: Record<string, unknown>[] = [
            { answer: undefined },
            { prompt: null },
            { explanation: null },
            { prompt: 1 },
            { type: 'OUTPUT_BASED' },
            { type: 'SCENARIO_BASED' },
            { difficulty: 'easy' },
            { status: 'UNKNOWN' },
            { schemaVersion: '1' },
            { schemaVersion: 2 },
            { conceptId: 1 },
            { conceptId: 'a'.repeat(24) + '\n' },
            { evaluation: {} },
            { unknown: true },
            { starterCode: {} },
            { starterCode: 'x' },
            { starterCode: 'x', language: null },
            { language: 'PYTHON' },
          ];
          for (const field of [
            'prompt',
            'answer',
            'explanation',
            'starterCode',
          ]) {
            invalid.push({
              [field]: 'x'.repeat(50001),
              language: 'TYPESCRIPT',
            });
            invalid.push({ [field]: ' \n ', language: 'TYPESCRIPT' });
          }
          for (const patch of invalid)
            await assert.rejects(async () => {
              await new PracticeQuestion({ ...input(), ...patch }).save();
            });
          assert.equal(await PracticeQuestion.countDocuments(), before);
          const doc = await persist({
            ...input(),
            starterCode: 'x',
            language: 'JAVASCRIPT',
          });
          doc.language = null;
          await assert.rejects(doc.save(), /language/);
          assert.equal(
            (await PracticeQuestion.collection.findOne({ _id: doc._id }))
              ?.language,
            'JAVASCRIPT',
          );
        },
      );

      await t.test(
        'actual indexes are nonunique; duplicate content allowed and reads leave data unchanged',
        async () => {
          const indexes = await PracticeQuestion.collection.indexes();
          assert.equal(indexes.length, 3);
          for (const key of [
            { conceptId: 1, status: 1, difficulty: 1 },
            { technologyId: 1, type: 1, status: 1 },
          ]) {
            const index = indexes.find(
              (item) => JSON.stringify(item.key) === JSON.stringify(key),
            );
            assert(
              index && !index.unique && index.expireAfterSeconds === undefined,
            );
          }
          const a = await persist(input());
          const b = await persist(input());
          assert.notEqual(String(a._id), String(b._id));
          await assert.rejects(
            persist({ ...input(), _id: a._id }),
            (error: unknown) =>
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              error.code === 11000,
          );
          const before = await PracticeQuestion.collection
            .find()
            .sort({ _id: 1 })
            .toArray();
          await PracticeQuestion.find().lean();
          await PracticeQuestion.find().select('+answer +explanation');
          assert.deepEqual(
            await PracticeQuestion.collection.find().sort({ _id: 1 }).toArray(),
            before,
          );
          assert.deepEqual(
            (await db.listCollections().toArray()).map((item) => item.name),
            ['practiceQuestions'],
          );
        },
      );
    } finally {
      try {
        if (owned) await PracticeQuestion.collection.drop();
      } finally {
        await database.disconnect();
      }
    }
  },
);
