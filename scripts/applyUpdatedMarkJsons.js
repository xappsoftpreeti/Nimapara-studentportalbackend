/**
 * Overwrite semester marks for rolls in the listed JSON files only.
 *
 *   node scripts/applyUpdatedMarkJsons.js
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { UG2024ThirdSem } = require('../models/UG2024Semesters');
const { UG2025FirstSem } = require('../models/UG2025Semesters');

dotenv.config({ path: path.join(__dirname, '..', 'config.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const JOBS = [
  { file: 'UPDATEDMARK-1ST-2025-COMPLAIN.JSON', Model: UG2025FirstSem, collection: '1st-sem-2025' },
  { file: 'UPDATEDMARK-3RD-2024.JSON', Model: UG2024ThirdSem, collection: '3rd-sem-2024' },
  { file: 'UPDATEDMARK-3RD-2024-COMPLAIN.JSON', Model: UG2024ThirdSem, collection: '3rd-sem-2024' },
];

const toNum = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const paperKey = (value) => {
  const compact = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!compact) return '';
  if (compact.includes('MAJOR') && compact.includes('7')) return 'MAJOR7';
  if (compact.includes('MAJOR') && compact.includes('6')) return 'MAJOR6';
  if (compact.includes('MAJOR') && compact.includes('5')) return 'MAJOR5';
  if (compact.includes('MAJOR') && compact.includes('2')) return 'MAJOR2';
  if (compact.includes('MAJOR') && compact.includes('1')) return 'MAJOR1';
  if (compact.includes('MINOR') && compact.includes('3')) return 'MINOR3';
  if (compact.includes('MINOR')) return 'MINOR1';
  if (compact.includes('MDC') || compact.includes('MULTIDISCIPLIN')) return 'MDC';
  if (compact.includes('VAC')) return 'VAC';
  if (compact.includes('AEC')) return 'AEC';
  if (compact.includes('SEC')) return 'SEC';
  return compact;
};

const normalizeIncoming = (course = {}) => ({
  subjectName: String(course.subjectName || '').trim(),
  courseType: String(course.courseType || '').trim(),
  credit: toNum(course.credit),
  theory: toNum(course.theory ?? course.endsem ?? course.finalMark),
  internal: toNum(course.internalMark) ?? toNum(course.internal) ?? toNum(course.midsemMark),
  practical: toNum(course.practical ?? course.practicalMark),
  marks: toNum(course.marks ?? course.totalMarks ?? course.totalMark),
  grade: String(course.grade || '').trim(),
  gradePoint: toNum(course.gradePoint),
  creditPoint: toNum(course.creditPoint),
});

const applyField = (target, field, value) => {
  if (value === undefined || value === null || value === '') return false;
  if (target[field] === value) return false;
  target[field] = value;
  return true;
};

const overwriteCourses = (existingCourses = [], incomingCourses = []) => {
  const used = new Set();
  const next = existingCourses.map((row) =>
    typeof row.toObject === 'function' ? row.toObject() : { ...row }
  );
  let changed = false;

  incomingCourses.forEach((incoming) => {
    const incomingKey = paperKey(incoming.courseType);
    const index = next.findIndex(
      (row, i) => !used.has(i) && paperKey(row.courseType) === incomingKey && incomingKey
    );
    if (index < 0) {
      next.push({
        subjectName: incoming.subjectName,
        courseType: incoming.courseType,
        credit: incoming.credit,
        theory: incoming.theory,
        internal: incoming.internal,
        practical: incoming.practical,
        marks: incoming.marks,
        grade: incoming.grade,
        gradePoint: incoming.gradePoint,
        creditPoint: incoming.creditPoint,
      });
      changed = true;
      return;
    }
    used.add(index);
    const row = { ...next[index] };
    ['subjectName', 'courseType', 'credit', 'theory', 'internal', 'practical', 'marks', 'grade', 'gradePoint', 'creditPoint'].forEach(
      (field) => {
        if (applyField(row, field, incoming[field])) changed = true;
      }
    );
    next[index] = row;
  });

  return { courses: next, changed };
};

const loadRows = (file) => {
  const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.students)) return parsed.students;
  if (Array.isArray(parsed.marksheets)) return parsed.marksheets;
  return [];
};

const applyFile = async ({ file, Model, collection }) => {
  const rows = loadRows(file);
  const summary = { file, collection, jsonRows: rows.length, updated: 0, skippedMissing: [], failed: [] };

  for (const row of rows) {
    const roll = String(row.AutonomousRollNo || row.autonomousRollNo || '').trim();
    try {
      if (!roll) {
        summary.failed.push({ error: 'missing AutonomousRollNo' });
        continue;
      }

      const doc = await Model.findOne({
        autonomousRollNo: new RegExp(`^${roll.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (!doc) {
        summary.skippedMissing.push(roll);
        continue;
      }

      const incomingCourses = (row.courses || []).map(normalizeIncoming);
      const merged = overwriteCourses(doc.courses || [], incomingCourses);
      if (merged.changed) {
        doc.courses = merged.courses;
        doc.markModified('courses');
      }

      const totals = {
        totalCredits: toNum(row.totalCredits),
        totalCreditPoints: toNum(row.totalCreditPoints),
        sgpa: toNum(row.sgpa),
        percentage: toNum(row.percentage),
        classification: String(row.classification || '').trim(),
        examcode: String(row.Examcode || row.examcode || '').trim(),
      };
      Object.entries(totals).forEach(([field, value]) => {
        if (value === undefined || value === '') return;
        if (doc[field] !== value) {
          doc[field] = value;
          merged.changed = true;
        }
      });

      if (merged.changed) {
        await doc.save();
        summary.updated += 1;
      }
    } catch (error) {
      summary.failed.push({ roll, error: error.message });
    }
  }

  return summary;
};

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const results = [];
  for (const job of JOBS) {
    results.push(await applyFile(job));
  }
  console.log(JSON.stringify({ results }, null, 2));
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
