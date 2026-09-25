/**
 * Copy UG 2024 identity into nimapara-repair / 2024batch-UG.
 * Reads admin-dashboard only. Never writes to admin-dashboard.
 *
 *   node scripts/createUG2024Master.js
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

const isBba = (doc) => {
  const roll = firstValue(doc['Autonomous Roll No'], doc['Roll No']).toUpperCase();
  const dept = trim(doc.Department).toUpperCase();
  return dept.includes('BBA') || roll.includes('BBA');
};

const buildMasterDoc = (ug, extras = {}) => {
  const autonomousRollNo = firstValue(ug['Autonomous Roll No']);
  const department = firstValue(ug.Department, extras.department);
  const stream =
    firstValue(ug.Stream, extras.stream) ||
    mapDepartmentToStream(department, ug.Stream, isBba(ug) ? 'BBA' : 'UG');

  return {
    batch: '2024',
    programme: isBba(ug) ? 'BBA' : 'UG',
    autonomousRollNo,
    collegeRollNo: firstValue(ug['Roll No'], extras.collegeRollNo),
    name: firstValue(ug['Name of the Students'], ug['Applicant Name'], extras.name),
    dob: firstValue(ug.dob, ug.DOB, extras.dob),
    abcId: firstValue(ug.ABC_ID, extras.abcId) || null,
    department,
    stream,
    registrationNumber: firstValue(ug['Registration No.'], extras.registrationNumber),
    slNo: ug['Sl.No'] ?? ug.Sl ?? extras.slNo ?? null,
  };
};

async function indexByRoll(collection, rollField = 'Autonomous Roll No') {
  const map = new Map();
  const docs = await collection.find({}).toArray();
  for (const doc of docs) {
    const roll = firstValue(doc[rollField], doc.autonomousRollNo);
    if (roll) map.set(roll, doc);
  }
  return map;
}

async function stripUnusedFields(dest) {
  const stripped = await dest.updateMany(
    {},
    {
      $unset: {
        feeYearLevel: '',
        feeStream: '',
        feeCategory: '',
        sourceCollection: '',
        profileImage: '',
      },
    }
  );
  console.log(`Removed unused fields from ${stripped.modifiedCount} documents`);
}

async function run() {
  if (TARGET_URI.includes('/admin-dashboard')) {
    throw new Error('Refusing to write: repair URI still points at admin-dashboard');
  }

  const stripOnly = process.argv.includes('--strip-only');
  const stripImages = process.argv.includes('--strip-images');
  const rebuild = process.argv.includes('--rebuild');

  console.log('Source:', SOURCE_URI.replace(/:[^:@]+@/, ':***@'));
  console.log('Target:', TARGET_URI.replace(/:[^:@]+@/, ':***@'));

  const source =
    stripOnly && !stripImages ? null : await mongoose.createConnection(SOURCE_URI).asPromise();
  const target = await mongoose.createConnection(TARGET_URI).asPromise();

  try {
    const dest = target.db.collection('2024batch-UG');

    if (stripImages) {
      const masterUnset = await dest.updateMany({}, { $unset: { profileImage: '' } });
      console.log(`Removed profileImage from 2024batch-UG: ${masterUnset.modifiedCount}`);
      if (source) {
        const sourceUnset = await source.db
          .collection('ugstudents')
          .updateMany({}, { $unset: { profileImage: '' } });
        console.log(`Removed profileImage from ugstudents: ${sourceUnset.modifiedCount}`);
      }
      return;
    }

    if (stripOnly) {
      await stripUnusedFields(dest);
      const sample = await dest.findOne({});
      console.log('Sample keys:', sample ? Object.keys(sample).join(', ') : '(empty collection)');
      console.log(`Total in master: ${await dest.countDocuments()}`);
      return;
    }

    if (rebuild) {
      const dropped = await dest.deleteMany({});
      console.log(`Cleared ${dropped.deletedCount} master docs (images not kept)`);
    }
    const ugDocs = await source.db.collection('ugstudents').find({}, { projection: { profileImage: 0 } }).toArray();
    const fourthByRoll = await indexByRoll(source.db.collection('2024-4thsem'));
    const secondByRoll = await indexByRoll(source.db.collection('2ndsem2024'));
    const abcByRoll = await indexByRoll(
      source.db.collection('abcidsubmissions'),
      'autonomousRollNo'
    );

    const ops = [];
    let skipped = 0;

    for (const ug of ugDocs) {
      const roll = firstValue(ug['Autonomous Roll No']);
      if (!roll) {
        skipped += 1;
        continue;
      }

      const s4 = fourthByRoll.get(roll) || {};
      const s2 = secondByRoll.get(roll) || {};
      const abc = abcByRoll.get(roll) || {};

      const doc = buildMasterDoc(ug, {
        department: s4.Department || s2.Department,
        stream: s4.Stream || s2.Stream,
        collegeRollNo: s4['Roll No'] || s2['Roll No'],
        name: s4['Name of the Students'] || s2['Name of the Students'],
        dob: s4.dob || s4.DOB || s2.dob || s2.DOB,
        registrationNumber: s4['Registration No.'],
        abcId: abc.ABC_ID,
        slNo: s4['Sl.No'] || s4.Sl,
      });

      ops.push({
        replaceOne: {
          filter: { autonomousRollNo: doc.autonomousRollNo },
          replacement: doc,
          upsert: true,
        },
      });
    }

    try {
      await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
      await dest.createIndex({ collegeRollNo: 1 });
      await dest.createIndex({ department: 1 });
    } catch (error) {
      console.warn('Index create skipped:', error.message);
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
    const withDob = await dest.countDocuments({ dob: { $nin: [null, ''] } });
    const withAbc = await dest.countDocuments({ abcId: { $nin: [null, ''] } });
    const withReg = await dest.countDocuments({ registrationNumber: { $nin: [null, ''] } });
    const programmes = await dest.distinct('programme');
    const streams = await dest.distinct('stream');

    console.log('\nWrote nimapara-repair.2024batch-UG');
    console.log(`Source ugstudents: ${ugDocs.length}`);
    console.log(`Skipped (no autonomous roll): ${skipped}`);
    console.log(`Upserted: ${upserted}`);
    console.log(`Matched existing: ${matched}`);
    console.log(`Total in master: ${total}`);
    console.log(`With DOB: ${withDob}`);
    console.log(`With ABC ID: ${withAbc}`);
    console.log(`With registration no: ${withReg}`);
    console.log(`Programmes: ${programmes.join(', ')}`);
    console.log(`Streams: ${streams.join(', ')}`);

    await stripUnusedFields(dest);
  } finally {
    if (source) await source.close();
    await target.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
