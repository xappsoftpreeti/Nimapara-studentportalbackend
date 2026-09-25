/**
 * Copy UG 2024 sem 2/3/4 into nimapara-repair.
 * Linked to 2024batch-UG. Includes examcode. No master identity fields.
 *
 *   node scripts/createUG2024LaterSems.js
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

const COURSE_FIELDS = {
  2: [
    'Major-3',
    'Major-4',
    'MINOR-2(20)',
    'Multi Disciplinary-2',
    'AEC-2',
    'SEC-I',
    'CC-201',
    'CC-202',
    'CC-203',
    'Multi Disciplinary-201',
    'AEC-201',
    'SEC-201',
    'VAC-201-I.C',
  ],
  3: [
    'Major-CP-5',
    'Major-CP-6',
    'Major-CP-7',
    'MINOR-3',
    'Multi Disciplinary-3',
    'VAC-2',
    'CC-301',
    'CC-302',
    'CC-303',
    'MDE-301',
    'SEC-301',
    'VAC-301',
  ],
  4: ['CORE-1 MAJOR-8', 'CORE-1 MAJOR-9', 'CORE-1 MAJOR-10', 'CORE-2 MINOR-4'],
};

const JOBS = [
  {
    semester: 2,
    collection: '2nd-sem-2024',
    sourceCollection: '2ndsem2024',
  },
  {
    semester: 3,
    collection: '3rd-sem-2024',
    sourceCollection: 'ugstudents',
  },
  {
    semester: 4,
    collection: '4th-sem-2024',
    sourceCollection: '2024-4thsem',
  },
];

const trim = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : undefined;
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
    return toNumber(value.No ?? value['Sl.No'] ?? value.Sl);
  }
  return toNumber(value);
};

const identityFromMaster = (master) =>
  compact({
    student: master._id,
    batch: master.batch || '2024',
    programme: master.programme || 'UG',
    autonomousRollNo: trim(master.autonomousRollNo),
    collegeRollNo: trim(master.collegeRollNo),
    name: trim(master.name),
    dob: trim(master.dob),
    abcId: trim(master.abcId),
    department: trim(master.department),
    stream: trim(master.stream),
    registrationNumber: trim(master.registrationNumber),
    slNo: normalizeSlNo(master.slNo),
  });

const examcodeOf = (doc) =>
  trim(doc.Examcode || doc['Exam Code'] || doc.examCode || doc.examcode);

const mapObjectCourse = (courseType, block) =>
  compact({
    subjectName: trim(block.Subject || block.subjectName || block.subject),
    courseType,
    credit: toNumber(block.credit || block.Credit),
    theory: toNumber(block.FinalMark || block['FinalMark-1'] || block.theory),
    internal: toNumber(block['MidsemMark(10/20)'] || block.internal),
    practical: toNumber(block['PracticalMark(20)'] || block['I-Practical'] || block.practical),
    marks: toNumber(block.TotalMark || block.marks),
    grade: trim(block.Grade || block.grade),
    gradePoint: toNumber(block['Grade Point'] || block.gradePoint),
    creditPoint: toNumber(block.CreditPoint || block.creditPoint),
  });

const coursesFromDoc = (doc, semester) => {
  const courses = [];
  for (const field of COURSE_FIELDS[semester]) {
    const value = doc[field];
    if (value === undefined || value === null || value === '') continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      const course = mapObjectCourse(field, value);
      if (course.subjectName) courses.push(course);
      continue;
    }

    const subjectName = trim(value);
    if (subjectName) {
      courses.push({ subjectName, courseType: field });
    }
  }
  return courses;
};

const summaryFromDoc = (doc, semester) => {
  if (semester === 3 || semester === 4) return {};
  return compact({
    totalCredits: toNumber(doc.TotalCredit || doc.totalCredits),
    totalCreditPoints: toNumber(doc.TotalCreditPoint || doc.totalCreditPoints),
    sgpa: toNumber(doc.SGPA || doc.sgpa),
    percentage: toNumber(doc.Percentage || doc.percentage),
    classification: trim(doc.Classification || doc.classification),
  });
};

async function loadMasters(target) {
  const masters = await target.db.collection('2024batch-UG').find({}).toArray();

  const byRoll = new Map();
  const byCollege = new Map();
  for (const master of masters) {
    const auto = trim(master.autonomousRollNo);
    const college = trim(master.collegeRollNo);
    if (auto) byRoll.set(auto, master);
    if (college) byCollege.set(college, master);
  }
  return { masters, byRoll, byCollege };
}

const findMaster = (doc, maps) => {
  const auto = trim(doc['Autonomous Roll No'] || doc.autonomousRollNo);
  const college = trim(doc['Roll No'] || doc.collegeRollNo);
  return maps.byRoll.get(auto) || maps.byCollege.get(college) || null;
};

async function importSemester(source, target, maps, job) {
  const rows = await source.db.collection(job.sourceCollection).find({}).toArray();
  const dest = target.db.collection(job.collection);

  try {
    await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
    await dest.createIndex({ student: 1 }, { unique: true });
    await dest.createIndex({ examcode: 1 });
  } catch (error) {
    console.warn(`${job.collection} index skipped:`, error.message);
  }

  const ops = [];
  const seen = new Set();
  let skippedNoMaster = 0;
  let skippedNoCourses = 0;

  for (const row of rows) {
    const master = findMaster(row, maps);
    if (!master) {
      skippedNoMaster += 1;
      continue;
    }

    const autonomousRollNo = trim(master.autonomousRollNo);
    if (!autonomousRollNo || seen.has(autonomousRollNo)) {
      skippedNoMaster += 1;
      continue;
    }

    const courses = coursesFromDoc(row, job.semester);
    if (courses.length === 0) {
      skippedNoCourses += 1;
      continue;
    }

    seen.add(autonomousRollNo);
    const summary = summaryFromDoc(row, job.semester);

    ops.push({
      replaceOne: {
        filter: { autonomousRollNo },
        replacement: compact({
          ...identityFromMaster(master),
          semester: job.semester,
          examcode: examcodeOf(row),
          courses,
          ...summary,
        }),
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
  const withExam = await dest.countDocuments({ examcode: { $nin: [null, ''] } });
  const sample = await dest.findOne({});

  console.log(`\n${job.collection}`);
  console.log(`  source ${job.sourceCollection}: ${rows.length}`);
  console.log(`  upserted: ${upserted}, matched: ${matched}, total: ${total}`);
  console.log(`  with examcode: ${withExam}`);
  console.log(`  skipped no master: ${skippedNoMaster}, skipped no courses: ${skippedNoCourses}`);
  if (sample) {
    console.log(
      `  sample: ${sample.name} | ${sample.department} | roll=${sample.autonomousRollNo} examcode=${sample.examcode} courses=${sample.courses.length}`
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
    const maps = await loadMasters(target);
    console.log(`Masters in 2024batch-UG: ${maps.masters.length}`);
    for (const job of JOBS) {
      await importSemester(source, target, maps, job);
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
