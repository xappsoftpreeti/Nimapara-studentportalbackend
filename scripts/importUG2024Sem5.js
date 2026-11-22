/**
 * Import UG 2024 semester 5 from data/ug2024Sem5.json into `5th-sem-2024`.
 * Each row is linked to the master record in `2024batch-UG` by autonomousRollNo
 * (falls back to collegeRollNo). Identity fields (name, dob, dept...) come from the master.
 *
 *   node scripts/importUG2024Sem5.js            -> real import
 *   node scripts/importUG2024Sem5.js --dry-run  -> validate only, writes nothing
 *   node scripts/importUG2024Sem5.js other.json -> use a different json file
 *
 * Needs REPAIR_MONGO_URI (or MONGO_URI with /admin-dashboard swapped to /nimapara-repair) in .env
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');

const SEMESTER = 5;
const COLLECTION = '5th-sem-2024';
const MASTER_COLLECTION = '2024batch-UG';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fileArg = args.find((a) => !a.startsWith('--'));
const DATA_FILE = path.resolve(fileArg || path.join(__dirname, '..', 'data', 'ug2024Sem5.json'));

const TARGET_URI =
  process.env.REPAIR_MONGO_URI ||
  (process.env.MONGO_URI || '').replace('/admin-dashboard', '/nimapara-repair');

const trim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toNumber = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
};
const compact = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );

const mapCourse = (c) =>
  compact({
    subjectName: trim(c.subjectName),
    courseType: trim(c.courseType),
    credit: toNumber(c.credit),
    theory: toNumber(c.theory),
    internal: toNumber(c.internal),
    practical: toNumber(c.practical),
    marks: toNumber(c.marks),
    grade: trim(c.grade),
    gradePoint: toNumber(c.gradePoint),
    creditPoint: toNumber(c.creditPoint),
  });

async function run() {
  if (!TARGET_URI) throw new Error('Set REPAIR_MONGO_URI (or MONGO_URI) in .env');
  if (TARGET_URI.includes('/admin-dashboard')) {
    throw new Error('Refusing to write: URI points at admin-dashboard');
  }

  const rows = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('JSON must be an array of student objects');
  console.log(`Read ${rows.length} rows from ${DATA_FILE}${DRY_RUN ? ' (dry run)' : ''}`);

  const conn = await mongoose.createConnection(TARGET_URI).asPromise();
  try {
    const masters = await conn.db.collection(MASTER_COLLECTION).find({}).toArray();
    const byAuto = new Map();
    const byCollege = new Map();
    for (const m of masters) {
      if (trim(m.autonomousRollNo)) byAuto.set(trim(m.autonomousRollNo), m);
      if (trim(m.collegeRollNo)) byCollege.set(trim(m.collegeRollNo), m);
    }

    const ops = [];
    const seen = new Set();
    const problems = [];

    rows.forEach((row, i) => {
      const label = `row ${i + 1} (${trim(row.autonomousRollNo) || trim(row.collegeRollNo) || '?'})`;
      const master =
        byAuto.get(trim(row.autonomousRollNo)) || byCollege.get(trim(row.collegeRollNo));
      if (!master) return problems.push(`${label}: no master student found`);

      const auto = trim(master.autonomousRollNo);
      if (seen.has(auto)) return problems.push(`${label}: duplicate student in file`);

      const courses = (row.courses || []).map(mapCourse).filter((c) => c.subjectName);
      if (!courses.length) return problems.push(`${label}: no courses`);

      seen.add(auto);
      ops.push({
        replaceOne: {
          filter: { autonomousRollNo: auto },
          replacement: compact({
            student: master._id,
            batch: master.batch || '2024',
            programme: master.programme || 'UG',
            autonomousRollNo: auto,
            collegeRollNo: trim(master.collegeRollNo),
            name: trim(master.name),
            dob: trim(master.dob),
            abcId: trim(master.abcId),
            department: trim(master.department),
            stream: trim(master.stream),
            registrationNumber: trim(master.registrationNumber),
            semester: SEMESTER,
            examcode: trim(row.examcode),
            courses,
            totalCredits: toNumber(row.totalCredits),
            totalCreditPoints: toNumber(row.totalCreditPoints),
            sgpa: toNumber(row.sgpa),
            percentage: toNumber(row.percentage),
            classification: trim(row.classification),
            updatedAt: new Date(),
          }),
          upsert: true,
        },
      });
    });

    console.log(`Valid: ${ops.length}, problems: ${problems.length}`);
    problems.forEach((p) => console.log('  -', p));

    if (DRY_RUN) return console.log('Dry run: nothing written.');
    if (!ops.length) return console.log('Nothing to import.');

    const dest = conn.db.collection(COLLECTION);
    await dest.createIndex({ autonomousRollNo: 1 }, { unique: true });
    await dest.createIndex({ student: 1 }, { unique: true });
    await dest.createIndex({ examcode: 1 });
    await dest.createIndex({ semester: 1 });

    let upserted = 0;
    let matched = 0;
    for (let i = 0; i < ops.length; i += 250) {
      const r = await dest.bulkWrite(ops.slice(i, i + 250), { ordered: false });
      upserted += r.upsertedCount || 0;
      matched += r.matchedCount || 0;
    }
    console.log(
      `Done. inserted: ${upserted}, updated: ${matched}, total in ${COLLECTION}: ${await dest.countDocuments()}`
    );
  } finally {
    await conn.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
