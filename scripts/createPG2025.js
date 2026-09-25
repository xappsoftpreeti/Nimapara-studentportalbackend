/**
 * PG 2025 master + sem 1/2 into nimapara-repair.
 * Master: identity only. Semesters: link + paper names (no marks in source).
 *
 *   node scripts/createPG2025.js
 */
const mongoose = require('mongoose');
const { loadEnv } = require('../../archive/utils/loadEnv');

loadEnv();

const SOURCE_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://Xappsoft:Xappsoft2025@cluster0.insqjcr.mongodb.net/admin-dashboard';

const TARGET_URI =
  process.env.REPAIR_MONGO_URI ||
  SOURCE_URI.replace('/admin-dashboard', '/nimapara-repair');

const IDENTITY_KEYS = new Set([
  '_id',
  '__v',
  'Sl.No',
  'Sl. No',
  'College Roll No',
  'College  Roll No.',
  'Autonomous Roll No',
  'Autonomous  Roll No.',
  'Name of the Students',
  'Applicant Name',
  'Department',
  'Stream',
  'dob',
  'DOB',
  'ABC_ID',
  'profileImage',
  'batch',
  'Exam Code',
  'Examcode',
  'examcode',
]);

const trim = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const firstValue = (...values) => {
  for (const value of values) {
    const text = trim(value);
    if (text) return text;
  }
  return '';
};

const compact = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
};

const rollOf = (doc) =>
  firstValue(
    doc['Autonomous Roll No'],
    doc['Autonomous  Roll No.'],
    doc.autonomousRollNo
  );

const collegeOf = (doc) =>
  firstValue(doc['College Roll No'], doc['College  Roll No.'], doc.collegeRollNo);

const nameOf = (doc) =>
  firstValue(doc['Name of the Students'], doc['Applicant Name'], doc.name);

const papersFrom = (doc) => {
  const subjects = [];
  for (const [key, value] of Object.entries(doc || {})) {
    if (IDENTITY_KEYS.has(key)) continue;
    if (key.startsWith('_')) continue;
    if (typeof value === 'object') continue;
    const title = trim(value);
    if (!title) continue;
    subjects.push({ paper: { code: key, title } });
  }
  return subjects;
};

async function indexDocs(collection) {
  const map = new Map();
  const docs = await collection.find({}).toArray();
  for (const doc of docs) {
    const auto = rollOf(doc);
    const college = collegeOf(doc);
    if (auto) map.set(auto, doc);
    if (college) map.set(college, doc);
  }
  return { docs, map };
}

async function writeOps(dest, ops) {
  try {
    await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
  } catch (error) {
    console.warn(`${dest.collectionName} index skipped:`, error.message);
  }

  let upserted = 0;
  let matched = 0;
  for (let i = 0; i < ops.length; i += 100) {
    const result = await dest.bulkWrite(ops.slice(i, i + 100), { ordered: false });
    upserted += result.upsertedCount || 0;
    matched += result.matchedCount || 0;
  }
  const total = await dest.countDocuments();
  const sample = await dest.findOne({});
  console.log(`\n${dest.collectionName}`);
  console.log(`  upserted: ${upserted}, matched: ${matched}, total: ${total}`);
  if (sample) {
    console.log(`  keys: ${Object.keys(sample).join(', ')}`);
    console.log(
      `  sample: ${sample.name || sample.autonomousRollNo} | subjects=${sample.subjects?.length || 0}`
    );
  }
}

async function run() {
  if (TARGET_URI.includes('/admin-dashboard')) {
    throw new Error('Refusing to write: repair URI still points at admin-dashboard');
  }

  console.log('Source:', SOURCE_URI.replace(/:[^:@]+@/, ':***@'));
  console.log('Target:', TARGET_URI.replace(/:[^:@]+@/, ':***@'));

  const source = await mongoose.createConnection(SOURCE_URI).asPromise();
  const target = await mongoose.createConnection(TARGET_URI).asPromise();

  try {
    const first = await indexDocs(source.db.collection('pgfirstsem2025'));
    const second = await indexDocs(source.db.collection('pg2025-2ndsem'));
    const abcByRoll = (await indexDocs(source.db.collection('abcidsubmissions'))).map;

    const masterOps = [];
    let skipped = 0;

    for (const row of first.docs) {
      const auto = rollOf(row);
      if (!auto) {
        skipped += 1;
        continue;
      }
      const s2 = second.map.get(auto) || second.map.get(collegeOf(row)) || {};
      const abc = abcByRoll.get(auto) || {};
      const department = firstValue(row.Department, s2.Department);
      const stream = firstValue(row.Stream, s2.Stream);

      const doc = compact({
        batch: '2025',
        programme: 'PG',
        autonomousRollNo: auto,
        collegeRollNo: firstValue(collegeOf(row), collegeOf(s2)),
        name: firstValue(nameOf(row), nameOf(s2)),
        dob: firstValue(row.dob, row.DOB, s2.dob, s2.DOB),
        abcId: firstValue(row.ABC_ID, abc.ABC_ID),
        department,
        course: department,
        stream,
        slNo: firstValue(row['Sl.No'], row['Sl. No'], s2['Sl. No']),
      });

      masterOps.push({
        replaceOne: {
          filter: { autonomousRollNo: auto },
          replacement: doc,
          upsert: true,
        },
      });
    }

    const masterCol = target.db.collection('2025batch-PG');
    await writeOps(masterCol, masterOps);
    console.log(`Source pgfirstsem2025: ${first.docs.length}, skipped: ${skipped}`);

    const masters = await masterCol.find({}).toArray();
    const masterByRoll = new Map();
    for (const master of masters) {
      masterByRoll.set(trim(master.autonomousRollNo), master);
      if (master.collegeRollNo) masterByRoll.set(trim(master.collegeRollNo), master);
    }

    const buildSemOps = (rows, semester) => {
      const ops = [];
      const seen = new Set();
      for (const row of rows) {
        const master =
          masterByRoll.get(rollOf(row)) || masterByRoll.get(collegeOf(row));
        if (!master) continue;
        const roll = trim(master.autonomousRollNo);
        if (!roll || seen.has(roll)) continue;
        const subjects = papersFrom(row);
        if (!subjects.length) continue;
        seen.add(roll);
        ops.push({
          replaceOne: {
            filter: { autonomousRollNo: roll },
            replacement: compact({
              student: master._id,
              autonomousRollNo: roll,
              semester,
              examcode: firstValue(row.Examcode, row['Exam Code'], row.examcode),
              subjects,
            }),
            upsert: true,
          },
        });
      }
      return ops;
    };

    await writeOps(target.db.collection('1st-sem-2025-PG'), buildSemOps(first.docs, 1));
    await writeOps(target.db.collection('2nd-sem-2025-PG'), buildSemOps(second.docs, 2));
  } finally {
    await source.close();
    await target.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
