/**
 * Load calculated PG 2025 sem 1 results (utils/pg2025Sem1Calculated.json)
 * into 1st-sem-2025-PG, linked to 2025batch-PG. Same shape as createPG2025.js
 * (subjects[].paper{code,title}) plus marks and totals.
 *
 *   node scripts/importPG2025Sem1Results.js [--dry]
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const DRY = process.argv.includes('--dry');
const FILE = path.join(__dirname, '..', 'utils', 'pg2025Sem1Calculated.json');
const URI = process.env.REPAIR_MONGO_URI || process.env.MONGO_URI;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const compact = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );

// Same labels as the 2024 PG results; any F grade is a fail.
const classify = (sgpa, subjects) => {
  if (subjects.some((s) => String(s.grade).toUpperCase() === 'F')) return 'Fail';
  if (sgpa === undefined) return undefined;
  if (sgpa >= 9.5) return 'Outstanding';
  if (sgpa >= 8.5) return 'Excellent';
  if (sgpa >= 7.5) return 'Very Good';
  if (sgpa >= 6.5) return 'Good';
  if (sgpa >= 5.5) return 'Above Average';
  if (sgpa >= 4.5) return 'Average';
  return 'Pass';
};

const toSubject = (s) => {
  const course = (s.courses && s.courses[0]) || {};
  return compact({
    paper: compact({ code: course.courseType, title: course.subjectName }),
    credit: num(s.credit),
    midsemMark: s.midsemMark,
    finalMark: s.finalMark,
    practicalMark: s.practicalMark,
    totalMark: s.totalMark,
    marks: num(s.marks),
    grade: s.grade,
    gradePoint: s.gradePoint,
    creditPoint: num(s.creditPoint),
    percentage: num(s.percentage),
  });
};

async function run() {
  if (!URI || URI.includes('/admin-dashboard')) throw new Error('Bad/unsafe Mongo URI');
  const rows = require(FILE);
  const conn = await mongoose.createConnection(URI).asPromise();
  try {
    const masters = await conn.db.collection('2025batch-PG').find({}).toArray();
    const byRoll = new Map(masters.map((m) => [String(m.autonomousRollNo).trim(), m]));

    const ops = [];
    const missing = [];
    for (const r of rows) {
      const roll = String(r.autonomousRollNo).trim();
      const master = byRoll.get(roll);
      if (!master) {
        missing.push(roll);
        continue;
      }
      const subjects = r.subjects.map(toSubject);
      const totalMarks = num(r.grandTotal);
      const pct = num(r.percentage);
      const doc = compact({
        student: master._id,
        autonomousRollNo: roll,
        semester: 1,
        examcode: r.examcode,
        subjects,
        totalCredits: subjects.reduce((a, s) => a + (s.credit || 0), 0),
        totalCreditPoints: subjects.reduce((a, s) => a + (s.creditPoint || 0), 0),
        totalMarks,
        totalMaximumMarks: totalMarks && pct ? Math.round((totalMarks / pct) * 100) : undefined,
        sgpa: num(r.sgpa),
        percentage: pct,
        classification: classify(num(r.sgpa), subjects),
      });
      ops.push({
        replaceOne: { filter: { autonomousRollNo: roll }, replacement: doc, upsert: true },
      });
    }

    console.log(`rows: ${rows.length}, matched masters: ${ops.length}, missing: ${missing.length}`);
    if (missing.length) console.log('missing rolls:', missing.join(', '));
    if (DRY) {
      console.log('dry run; sample:', JSON.stringify(ops[0]?.replaceOne.replacement).slice(0, 700));
      return;
    }
    const col = conn.db.collection('1st-sem-2025-PG');
    const res = await col.bulkWrite(ops, { ordered: false });
    console.log(`upserted: ${res.upsertedCount}, modified: ${res.modifiedCount}, total: ${await col.countDocuments()}`);
  } finally {
    await conn.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
