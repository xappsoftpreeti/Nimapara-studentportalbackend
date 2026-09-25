/**
 * Copy UG 2024 semester-1 marksheets into nimapara-repair / firstsem-2024.
 * Links each row to 2024batch-UG. Does not copy master identity fields.
 *
 *   node scripts/createUG2024FirstSem.js
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

const identityFromMaster = (master) => ({
  student: master._id,
  batch: master.batch || '2024',
  programme: master.programme || 'UG',
  autonomousRollNo: trim(master.autonomousRollNo),
  collegeRollNo: trim(master.collegeRollNo),
  name: trim(master.name),
  dob: trim(master.dob),
  abcId: trim(master.abcId) || null,
  department: trim(master.department),
  stream: trim(master.stream),
  registrationNumber: trim(master.registrationNumber),
  slNo:
    master.slNo && typeof master.slNo === 'object'
      ? master.slNo.No ?? master.slNo['Sl.No'] ?? master.slNo.Sl ?? null
      : master.slNo ?? null,
});

const mapCourse = (course = {}) => ({
  subjectName: trim(course.subjectName),
  courseType: trim(course.courseType),
  credit: course.credit,
  theory: course.theory,
  internal: course.internal,
  practical: course.practical,
  marks: course.marks,
  grade: trim(course.grade),
  gradePoint: course.gradePoint,
  creditPoint: course.creditPoint,
});

async function run() {
  if (TARGET_URI.includes('/admin-dashboard')) {
    throw new Error('Refusing to write: repair URI still points at admin-dashboard');
  }

  console.log('Source:', SOURCE_URI.replace(/:[^:@]+@/, ':***@'));
  console.log('Target:', TARGET_URI.replace(/:[^:@]+@/, ':***@'));

  const source = await mongoose.createConnection(SOURCE_URI).asPromise();
  const target = await mongoose.createConnection(TARGET_URI).asPromise();

  try {
    const masters = await target.db
      .collection('2024batch-UG')
      .find({})
      .toArray();

    const masterByRoll = new Map();
    const masterByCollege = new Map();
    for (const master of masters) {
      const auto = trim(master.autonomousRollNo);
      const college = trim(master.collegeRollNo);
      if (auto) masterByRoll.set(auto, master);
      if (college) masterByCollege.set(college, master);
    }

    const ugStudents = await source.db.collection('ugstudents').find(
      {},
      { projection: { 'Autonomous Roll No': 1, 'Roll No': 1 } }
    ).toArray();

    const rollByOldId = new Map();
    for (const ug of ugStudents) {
      const auto = trim(ug['Autonomous Roll No']);
      const college = trim(ug['Roll No']);
      rollByOldId.set(String(ug._id), { auto, college });
    }

    const marksheets = await source.db.collection('ugmarksheets').find({
      semester: 1,
      studentType: { $in: ['UGStudent', 'BBAStudent'] },
    }).toArray();

    const dest = target.db.collection('firstsem-2024');
    try {
      await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
      await dest.createIndex({ student: 1 }, { unique: true });
    } catch (error) {
      console.warn('Index create skipped:', error.message);
    }

    const ops = [];
    let skippedNoStudent = 0;
    let skippedNoMaster = 0;
    let skippedNoCourses = 0;
    const seenRolls = new Set();

    for (const sheet of marksheets) {
      const old = rollByOldId.get(String(sheet.student));
      if (!old) {
        skippedNoStudent += 1;
        continue;
      }

      const master = masterByRoll.get(old.auto) || masterByCollege.get(old.college);
      if (!master) {
        skippedNoMaster += 1;
        continue;
      }

      const autonomousRollNo = trim(master.autonomousRollNo);
      if (!autonomousRollNo || seenRolls.has(autonomousRollNo)) {
        skippedNoMaster += 1;
        continue;
      }

      const courses = Array.isArray(sheet.courses)
        ? sheet.courses.map(mapCourse).filter((course) => course.subjectName)
        : [];

      if (courses.length === 0) {
        skippedNoCourses += 1;
        continue;
      }

      seenRolls.add(autonomousRollNo);

      ops.push({
        replaceOne: {
          filter: { autonomousRollNo },
          replacement: {
            ...identityFromMaster(master),
            semester: 1,
            courses,
            totalCredits: sheet.totalCredits,
            totalCreditPoints: sheet.totalCreditPoints,
            sgpa: sheet.sgpa,
            percentage: sheet.percentage,
            classification: trim(sheet.classification),
          },
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
    const sample = await dest.findOne({});
    const withMaster = sample
      ? await target.db.collection('2024batch-UG').findOne({ _id: sample.student })
      : null;

    console.log('\nWrote nimapara-repair.firstsem-2024');
    console.log(`Source sem-1 marksheets (UG/BBA): ${marksheets.length}`);
    console.log(`Masters in 2024batch-UG: ${masters.length}`);
    console.log(`Upserted: ${upserted}`);
    console.log(`Matched existing: ${matched}`);
    console.log(`Total in firstsem-2024: ${total}`);
    console.log(`Skipped (old student missing): ${skippedNoStudent}`);
    console.log(`Skipped (not in master / duplicate): ${skippedNoMaster}`);
    console.log(`Skipped (no courses): ${skippedNoCourses}`);
    if (sample) {
      console.log('Sample roll:', sample.autonomousRollNo);
      console.log('Sample student id:', String(sample.student));
      console.log('Master name for sample:', withMaster?.name || '(not found)');
      console.log('Sample keys:', Object.keys(sample).join(', '));
      console.log('Sample name:', sample.name, '| dept:', sample.department);
      console.log('Sample course count:', sample.courses?.length || 0);
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
