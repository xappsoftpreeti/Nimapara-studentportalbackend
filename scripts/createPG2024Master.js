/**
 * Copy PG 2024 identity into nimapara-repair / 2024batch-PG.
 * Reads admin-dashboard. Writes only nimapara-repair. No photos or semester marks.
 *
 *   node scripts/createPG2024Master.js
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

async function indexByRoll(collection, fields) {
  const map = new Map();
  const docs = await collection.find({}).toArray();
  for (const doc of docs) {
    for (const field of fields) {
      const roll = firstValue(doc[field]);
      if (roll) map.set(roll, doc);
    }
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
    const pgStudents = await source.db
      .collection('pgstudents')
      .find({}, { projection: { profileImage: 0 } })
      .toArray();

    const allSemByRoll = await indexByRoll(source.db.collection('pgallsemesters'), [
      'autonomousRollNo',
      'rollNo',
    ]);
    const abcByRoll = await indexByRoll(source.db.collection('abcidsubmissions'), [
      'autonomousRollNo',
    ]);

    const dest = target.db.collection('2024batch-PG');
    try {
      await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
      await dest.createIndex({ collegeRollNo: 1 });
      await dest.createIndex({ department: 1 });
    } catch (error) {
      console.warn('Index create skipped:', error.message);
    }

    const ops = [];
    let skipped = 0;

    for (const pg of pgStudents) {
      const auto = firstValue(pg['Autonomous Roll No']);
      const college = firstValue(pg['College Roll No']);
      if (!auto) {
        skipped += 1;
        continue;
      }

      const allSem = allSemByRoll.get(auto) || allSemByRoll.get(college) || {};
      const abc = abcByRoll.get(auto) || {};

      const doc = compact({
        batch: '2024',
        programme: 'PG',
        autonomousRollNo: auto,
        collegeRollNo: firstValue(college, allSem.rollNo),
        name: firstValue(pg['Applicant Name'], allSem.studentName),
        dob: firstValue(pg.DOB, pg.dob, allSem.dob),
        abcId: firstValue(pg.ABC_ID, abc.ABC_ID),
        department: firstValue(allSem.department, pg.Course),
        course: firstValue(allSem.course, pg.Course),
        graduationBoard: firstValue(pg['Graduation Board'], allSem.graduationBoard),
        registrationNumber: firstValue(allSem.registrationNumber),
        barcode: firstValue(pg['Barcode No.'], pg['Barcode No']),
        gradeSheetSlNo: firstValue(allSem.gradeSheetSlNo),
      });

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
    const batchSize = 100;
    for (let i = 0; i < ops.length; i += batchSize) {
      const result = await dest.bulkWrite(ops.slice(i, i + batchSize), { ordered: false });
      upserted += result.upsertedCount || 0;
      matched += result.matchedCount || 0;
    }

    const total = await dest.countDocuments();
    const withDob = await dest.countDocuments({ dob: { $exists: true, $nin: [null, ''] } });
    const withAbc = await dest.countDocuments({ abcId: { $exists: true, $nin: [null, ''] } });
    const withReg = await dest.countDocuments({
      registrationNumber: { $exists: true, $nin: [null, ''] },
    });
    const depts = await dest.distinct('department');
    const sample = await dest.findOne({});

    console.log('\nWrote nimapara-repair.2024batch-PG');
    console.log(`Source pgstudents: ${pgStudents.length}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Upserted: ${upserted}`);
    console.log(`Matched existing: ${matched}`);
    console.log(`Total in master: ${total}`);
    console.log(`With DOB: ${withDob}`);
    console.log(`With ABC ID: ${withAbc}`);
    console.log(`With registration no: ${withReg}`);
    console.log(`Departments: ${depts.join(', ')}`);
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
