/**
 * Copy PG 2024 sem 1-4 plus combined all-semesters into nimapara-repair.
 * Linked to 2024batch-PG. Empty mark fields are omitted.
 *
 *   node scripts/createPG2024Semesters.js
 */
const mongoose = require('mongoose');
const { loadEnv } = require('../../archive/utils/loadEnv');
const { fromSem1, fromSem2, fromSem3Or4 } = require('../../archive/utils/pgSemesterMigrators');

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

const compact = (value) => {
  if (Array.isArray(value)) {
    return value.map(compact).filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId) && !(value instanceof Date)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const next = compact(item);
      if (next === undefined || next === null || next === '') continue;
      if (Array.isArray(next) && next.length === 0) continue;
      out[key] = next;
    }
    return out;
  }
  return value;
};

const linkFromMaster = (master) =>
  compact({
    student: master._id,
    autonomousRollNo: trim(master.autonomousRollNo),
  });

const findMaster = (maps, ...rolls) => {
  for (const roll of rolls) {
    const key = trim(roll);
    if (key && maps.byRoll.has(key)) return maps.byRoll.get(key);
  }
  return null;
};

const blockToDoc = (block, semester, master) => {
  if (!block || !Array.isArray(block.subjects) || block.subjects.length === 0) return null;
  const { dataSource, ...rest } = block;
  return compact({
    ...linkFromMaster(master),
    semester,
    examcode: rest.examcode,
    subjects: rest.subjects,
    grandTotal: rest.grandTotal,
    totalCredits: rest.totalCredits,
    totalCreditPoints: rest.totalCreditPoints,
    totalMarks: rest.totalMarks,
    sgpa: rest.sgpa,
    grade: rest.grade,
    gradePoint: rest.gradePoint,
    percentage: rest.percentage,
    classification: rest.classification,
    performance: rest.performance,
  });
};

async function loadMasters(target) {
  const masters = await target.db.collection('2024batch-PG').find({}).toArray();
  const byRoll = new Map();
  for (const master of masters) {
    const auto = trim(master.autonomousRollNo);
    const college = trim(master.collegeRollNo);
    if (auto) byRoll.set(auto, master);
    if (college) byRoll.set(college, master);
  }
  return { masters, byRoll };
}

async function writeCollection(dest, docs) {
  try {
    await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
    await dest.createIndex({ student: 1 }, { unique: true });
  } catch (error) {
    console.warn(`${dest.collectionName} index skipped:`, error.message);
  }

  const ops = docs.map((doc) => ({
    replaceOne: {
      filter: { autonomousRollNo: doc.autonomousRollNo },
      replacement: doc,
      upsert: true,
    },
  }));

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
    const subjectCount = sample.subjects?.length
      || (sample.semesters
        ? ['sem1', 'sem2', 'sem3', 'sem4'].filter((key) => sample.semesters[key]?.subjects?.length).length
        : 0);
    console.log(
      `  sample: ${sample.autonomousRollNo} | examcode=${sample.examcode || '-'} | subjects/sems=${subjectCount}`
    );
    console.log(`  keys: ${Object.keys(sample).join(', ')}`);
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
    const maps = await loadMasters(target);
    console.log(`Masters in 2024batch-PG: ${maps.masters.length}`);

    const pgStudents = await source.db
      .collection('pgstudents')
      .find({}, { projection: { 'Autonomous Roll No': 1, 'College Roll No': 1 } })
      .toArray();
    const rollByOldId = new Map();
    for (const pg of pgStudents) {
      rollByOldId.set(String(pg._id), {
        auto: trim(pg['Autonomous Roll No']),
        college: trim(pg['College Roll No']),
      });
    }

    const sem1Sheets = await source.db.collection('ugmarksheets').find({
      semester: 1,
      studentType: 'PGStudent',
    }).toArray();
    const sem2Rows = await source.db.collection('pg2ndsem2024').find({}).toArray();
    const sem3Rows = await source.db.collection('pgsem3results').find({}).toArray();
    const sem4Rows = await source.db.collection('pgsem4results').find({}).toArray();
    const allRows = await source.db.collection('pgallsemesters').find({}).toArray();

    const sem1Docs = [];
    for (const sheet of sem1Sheets) {
      const old = rollByOldId.get(String(sheet.student));
      const master = findMaster(maps, old?.auto, old?.college);
      const block = fromSem1(sheet);
      const doc = master ? blockToDoc(block, 1, master) : null;
      if (doc) sem1Docs.push(doc);
    }

    const mapSemesterRows = (rows, semester, toBlock) => {
      const docs = [];
      for (const row of rows) {
        const master = findMaster(
          maps,
          row.autonomousRollNo,
          row['Autonomous Roll No'],
          row.rollNo,
          row['Roll No'],
          row.collegeRollNo
        );
        const doc = master ? blockToDoc(toBlock(row), semester, master) : null;
        if (doc) docs.push(doc);
      }
      return docs;
    };

    const sem2Docs = mapSemesterRows(sem2Rows, 2, fromSem2);
    const sem3Docs = mapSemesterRows(sem3Rows, 3, (row) => fromSem3Or4(row, 'pgsem3results', 3));
    const sem4Docs = mapSemesterRows(sem4Rows, 4, (row) => fromSem3Or4(row, 'pgsem4results', 4));

    const allDocs = [];
    for (const row of allRows) {
      const master = findMaster(maps, row.autonomousRollNo, row.rollNo);
      if (!master) continue;
      const semesters = compact({
        sem1: row.semesters?.sem1,
        sem2: row.semesters?.sem2,
        sem3: row.semesters?.sem3,
        sem4: row.semesters?.sem4,
      });
      if (!semesters.sem1 && !semesters.sem2 && !semesters.sem3 && !semesters.sem4) continue;
      allDocs.push(
        compact({
          ...linkFromMaster(master),
          semesters,
          grandTotal: row.grandTotal,
          semesterTotals: row.semesterTotals,
          maximumMark: row.maximumMark,
          percentage: row.percentage,
        })
      );
    }

    await writeCollection(target.db.collection('1st-sem-2024-PG'), sem1Docs);
    await writeCollection(target.db.collection('2nd-sem-2024-PG'), sem2Docs);
    await writeCollection(target.db.collection('3rd-sem-2024-PG'), sem3Docs);
    await writeCollection(target.db.collection('4th-sem-2024-PG'), sem4Docs);
    await writeCollection(target.db.collection('all-semesters-2024-PG'), allDocs);
  } finally {
    await source.close();
    await target.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
