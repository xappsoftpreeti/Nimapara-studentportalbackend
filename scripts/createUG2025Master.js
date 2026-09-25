/**
 * Copy UG 2025 identity into nimapara-repair / 2025batch-UG.
 * Reads admin-dashboard. Writes only nimapara-repair. No photos or semester marks.
 *
 *   node scripts/createUG2025Master.js
 */
const mongoose = require('mongoose');
const { loadEnv } = require('../../archive/utils/loadEnv');
const { mapDepartmentToStream } = require('../../archive/utils/feeCalculator');

loadEnv();

const SOURCE_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://Xappsoft:Xappsoft2025@cluster0.insqjcr.mongodb.net/admin-dashboard';

const TARGET_URI =
  process.env.REPAIR_MONGO_URI ||
  SOURCE_URI.replace('/admin-dashboard', '/nimapara-repair');

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

const normalizeSlNo = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object') {
    const num = Number(value.No ?? value['Sl.No'] ?? value.Sl);
    return Number.isFinite(num) ? num : undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
};

const isBba = (doc) => {
  const roll = firstValue(doc['Autonomous Roll No'], doc['Roll No']).toUpperCase();
  const dept = firstValue(doc.Department, doc.Stream).toUpperCase();
  return dept.includes('BBA') || roll.includes('BBA');
};

const buildMasterDoc = (ug, extras = {}) => {
  const department = firstValue(ug.Department, extras.department);
  const stream =
    firstValue(ug.Stream, extras.stream) ||
    mapDepartmentToStream(department, ug.Stream, isBba(ug) ? 'BBA' : 'UG');

  return compact({
    batch: '2025',
    programme: isBba(ug) ? 'BBA' : 'UG',
    autonomousRollNo: firstValue(ug['Autonomous Roll No'], extras.autonomousRollNo),
    collegeRollNo: firstValue(ug['Roll No'], extras.collegeRollNo),
    name: firstValue(
      ug['Name of the Students'],
      ug['Applicant Name'],
      extras.name
    ),
    dob: firstValue(ug.dob, ug.DOB, extras.dob),
    abcId: firstValue(ug.ABC_ID, extras.abcId),
    department,
    stream,
    registrationNumber: firstValue(ug['Registration No.'], extras.registrationNumber),
    slNo: normalizeSlNo(ug['Sl.No'] ?? ug.Sl ?? extras.slNo),
  });
};

async function indexByRoll(collection) {
  const map = new Map();
  const docs = await collection.find({}).toArray();
  for (const doc of docs) {
    const roll = firstValue(doc['Autonomous Roll No'], doc.autonomousRollNo);
    if (roll) map.set(roll, doc);
    const college = firstValue(doc['Roll No']);
    if (college && !map.has(college)) map.set(college, doc);
  }
  return map;
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
    const firstSem = await source.db
      .collection('ugfirstsem2025')
      .find({}, { projection: { profileImage: 0 } })
      .toArray();
    const secondByRoll = await indexByRoll(source.db.collection('2025-2ndsem'));
    const abcByRoll = await indexByRoll(source.db.collection('abcidsubmissions'));

    const dest = target.db.collection('2025batch-UG');
    try {
      await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
      await dest.createIndex({ collegeRollNo: 1 });
      await dest.createIndex({ department: 1 });
    } catch (error) {
      console.warn('Index create skipped:', error.message);
    }

    const ops = [];
    let skipped = 0;

    for (const ug of firstSem) {
      const roll = firstValue(ug['Autonomous Roll No'], ug['Roll No']);
      if (!roll) {
        skipped += 1;
        continue;
      }

      const s2 = secondByRoll.get(firstValue(ug['Autonomous Roll No']))
        || secondByRoll.get(firstValue(ug['Roll No']))
        || {};
      const abc = abcByRoll.get(firstValue(ug['Autonomous Roll No']))
        || abcByRoll.get(firstValue(ug['Roll No']))
        || {};

      const doc = buildMasterDoc(ug, {
        department: s2.Department,
        stream: s2.Stream,
        collegeRollNo: s2['Roll No'],
        autonomousRollNo: s2['Autonomous Roll No'],
        name: s2['Name of the Students'],
        dob: s2.dob || s2.DOB,
        registrationNumber: s2['Registration No.'],
        abcId: abc.ABC_ID,
        slNo: s2['Sl.No'] || s2.Sl,
      });

      if (!doc.autonomousRollNo) {
        skipped += 1;
        continue;
      }

      ops.push({
        replaceOne: {
          filter: { autonomousRollNo: doc.autonomousRollNo },
          replacement: doc,
          upsert: true,
        },
      });
    }

    let upserted = 0;
    let matched = 0;
    const batchSize = 250;
    for (let i = 0; i < ops.length; i += batchSize) {
      const result = await dest.bulkWrite(ops.slice(i, i + batchSize), { ordered: false });
      upserted += result.upsertedCount || 0;
      matched += result.matchedCount || 0;
    }

    const total = await dest.countDocuments();
    const withDob = await dest.countDocuments({ dob: { $exists: true, $nin: [null, ''] } });
    const withAbc = await dest.countDocuments({ abcId: { $exists: true, $nin: [null, ''] } });
    const programmes = await dest.distinct('programme');
    const streams = await dest.distinct('stream');
    const sample = await dest.findOne({});

    console.log('\nWrote nimapara-repair.2025batch-UG');
    console.log(`Source ugfirstsem2025: ${firstSem.length}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Upserted: ${upserted}`);
    console.log(`Matched existing: ${matched}`);
    console.log(`Total in master: ${total}`);
    console.log(`With DOB: ${withDob}`);
    console.log(`With ABC ID: ${withAbc}`);
    console.log(`Programmes: ${programmes.join(', ')}`);
    console.log(`Streams: ${streams.join(', ')}`);
    if (sample) {
      console.log('Sample keys:', Object.keys(sample).join(', '));
      console.log(`Sample: ${sample.name} | ${sample.autonomousRollNo} | ${sample.department}`);
    }
  } finally {
    await source.close();
    await target.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
