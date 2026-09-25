const UG2024FirstSem = require('../models/UG2024FirstSem');
const {
  UG2024SecondSem,
  UG2024ThirdSem,
  UG2024FourthSem,
} = require('../models/UG2024Semesters');
const {
  PG2024FirstSem,
  PG2024SecondSem,
  PG2024ThirdSem,
  PG2024FourthSem,
} = require('../models/PG2024Semesters');
const { UG2025FirstSem, UG2025SecondSem } = require('../models/UG2025Semesters');
const { PG2025FirstSem, PG2025SecondSem } = require('../models/PG2025Semesters');
const { loadGradeSheetPayload } = require('./repairGradeSheet');

const UG_2024_MODELS = {
  1: UG2024FirstSem,
  2: UG2024SecondSem,
  3: UG2024ThirdSem,
  4: UG2024FourthSem,
};

const PG_2024_MODELS = {
  1: PG2024FirstSem,
  2: PG2024SecondSem,
  3: PG2024ThirdSem,
  4: PG2024FourthSem,
};

const UG_2025_MODELS = {
  1: UG2025FirstSem,
  2: UG2025SecondSem,
};

const PG_2025_MODELS = {
  1: PG2025FirstSem,
  2: PG2025SecondSem,
};

const ALL_SEMESTER_MODELS = [
  UG2024FirstSem,
  UG2024SecondSem,
  UG2024ThirdSem,
  UG2024FourthSem,
  UG2025FirstSem,
  UG2025SecondSem,
  PG2024FirstSem,
  PG2024SecondSem,
  PG2024ThirdSem,
  PG2024FourthSem,
  PG2025FirstSem,
  PG2025SecondSem,
];

const resolveSemesterTarget = (student, semester) => {
  const programme = String(student.programme || '').toUpperCase();
  const batch = String(student.batch || '').trim();
  const sem = Number(semester);
  const isUgFamily = programme === 'UG' || programme === 'BBA';

  if (isUgFamily && batch === '2024' && UG_2024_MODELS[sem]) {
    return { Model: UG_2024_MODELS[sem], kind: 'ug-courses', semester: sem };
  }
  if (isUgFamily && batch === '2025' && UG_2025_MODELS[sem]) {
    return { Model: UG_2025_MODELS[sem], kind: 'ug-courses', semester: sem };
  }
  if (programme === 'PG' && batch === '2024' && PG_2024_MODELS[sem]) {
    return { Model: PG_2024_MODELS[sem], kind: 'pg-subjects', semester: sem };
  }
  if (programme === 'PG' && batch === '2025' && PG_2025_MODELS[sem]) {
    return { Model: PG_2025_MODELS[sem], kind: 'pg-papers', semester: sem };
  }
  return null;
};

const coursesToPgSubjects = (courses = []) =>
  courses.map((course) => ({
    paper: {
      code: course.courseType || course.paperCode || '',
      title: course.subjectName || course.paperName || '',
    },
    credit: course.credit,
    midsemMark: course.midsem ?? course.internal,
    finalMark: course.endsem ?? course.theory,
    practicalMark: course.practical,
    totalMark: course.marks,
    marks: course.marks,
    grade: course.grade,
    gradePoint: course.gradePoint,
    creditPoint: course.creditPoint,
    percentage: course.percentage,
  }));

const isBlank = (value) => value === undefined || value === null || value === '';

const compactPaperKey = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const canonicalPaperKey = (value) => {
  const compact = compactPaperKey(value);
  if (!compact) return '';
  if (compact.includes('MAJOR') && compact.includes('5')) return 'MAJORCP5';
  if (compact.includes('MAJOR') && compact.includes('6')) return 'MAJORCP6';
  if (compact.includes('MAJOR') && compact.includes('7')) return 'MAJORCP7';
  if (compact.includes('MINOR') && compact.includes('3')) return 'MINOR3';
  if (compact.includes('MDC') || compact.includes('MULTIDISCIPLIN')) return 'MDC';
  if (compact.startsWith('VAC')) return 'VAC';
  return compact;
};

const fillIfEmpty = (doc, field, value) => {
  if (isBlank(value)) return false;
  if (!isBlank(doc[field])) return false;
  doc[field] = value;
  return true;
};

const mergeCourseMarks = (existing, incoming) => {
  const current = existing ? (typeof existing.toObject === 'function' ? existing.toObject() : { ...existing }) : {};
  const next = { ...current };
  let changed = false;
  const fields = ['credit', 'theory', 'internal', 'practical', 'marks', 'grade', 'gradePoint', 'creditPoint', 'percentage', 'midsem', 'endsem'];
  fields.forEach((field) => {
    if (fillIfEmpty(next, field, incoming[field])) changed = true;
  });
  if (isBlank(next.subjectName) && incoming.subjectName) {
    next.subjectName = incoming.subjectName;
    changed = true;
  }
  if (isBlank(next.courseType) && incoming.courseType) {
    next.courseType = incoming.courseType;
    changed = true;
  }
  return { course: next, changed };
};

const mergeUgCourses = (existingCourses = [], incomingCourses = []) => {
  const used = new Set();
  const merged = existingCourses.map((row) =>
    typeof row.toObject === 'function' ? row.toObject() : { ...row }
  );
  let changed = false;

  incomingCourses.forEach((incoming) => {
    let index = merged.findIndex(
      (row, i) => !used.has(i) && canonicalPaperKey(row.courseType) === canonicalPaperKey(incoming.courseType)
    );
    if (index < 0 && incoming.subjectName) {
      const name = String(incoming.subjectName).trim().toUpperCase();
      const matches = merged
        .map((row, i) => ({ row, i }))
        .filter(
          ({ row, i }) =>
            !used.has(i) && String(row.subjectName || '').trim().toUpperCase() === name
        );
      if (matches.length === 1) index = matches[0].i;
    }
    if (index < 0) {
      const subjectName = incoming.subjectName || incoming.courseType || '';
      const courseType = incoming.courseType || incoming.subjectName || '';
      if (!subjectName && !courseType) return;
      merged.push({
        subjectName,
        courseType,
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
    const result = mergeCourseMarks(merged[index], incoming);
    merged[index] = result.course;
    if (result.changed) changed = true;
  });

  merged.forEach((row) => {
    if (isBlank(row.subjectName) && row.courseType) {
      row.subjectName = row.courseType;
      changed = true;
    }
  });

  return { courses: merged, changed };
};

const upsertSemesterMarksheet = async ({ student, semester, marksheetData }) => {
  const target = resolveSemesterTarget(student, semester);
  if (!target) {
    throw new Error(
      `No repair semester collection for ${student.programme || ''} ${student.batch || ''} sem ${semester}`
    );
  }

  const roll = student.autonomousRollNo;
  let doc = await target.Model.findOne({ autonomousRollNo: roll });
  let changed = false;

  if (!doc) {
    doc = new target.Model({
      student: student._id,
      autonomousRollNo: roll,
      semester: target.semester,
    });
    changed = true;
  }

  const actionBase = doc.isNew ? 'created' : 'updated';

  if (target.kind === 'ug-courses') {
    changed = fillIfEmpty(doc, 'collegeRollNo', student.collegeRollNo) || changed;
    changed = fillIfEmpty(doc, 'name', student.name) || changed;
    changed = fillIfEmpty(doc, 'dob', student.dob) || changed;
    changed = fillIfEmpty(doc, 'abcId', student.abcId) || changed;
    changed = fillIfEmpty(doc, 'department', student.department) || changed;
    changed = fillIfEmpty(doc, 'stream', student.stream) || changed;
    changed = fillIfEmpty(doc, 'batch', student.batch) || changed;
    changed = fillIfEmpty(doc, 'programme', student.programme || 'UG') || changed;
    changed = fillIfEmpty(doc, 'examcode', marksheetData.examcode) || changed;
    const merged = mergeUgCourses(doc.courses || [], marksheetData.courses || []);
    if (merged.changed) {
      doc.courses = merged.courses;
      doc.markModified('courses');
      changed = true;
    }
    changed = fillIfEmpty(doc, 'totalCredits', marksheetData.totalCredits) || changed;
    changed = fillIfEmpty(doc, 'totalCreditPoints', marksheetData.totalCreditPoints) || changed;
    changed = fillIfEmpty(doc, 'sgpa', marksheetData.sgpa) || changed;
    changed = fillIfEmpty(doc, 'percentage', marksheetData.percentage) || changed;
    changed = fillIfEmpty(doc, 'classification', marksheetData.classification) || changed;
  } else if (target.kind === 'pg-subjects') {
    changed = fillIfEmpty(doc, 'examcode', marksheetData.examcode) || changed;
    if (!Array.isArray(doc.subjects) || doc.subjects.length === 0) {
      doc.subjects = coursesToPgSubjects(marksheetData.courses);
      changed = true;
    }
    changed = fillIfEmpty(doc, 'totalCredits', marksheetData.totalCredits) || changed;
    changed = fillIfEmpty(doc, 'totalCreditPoints', marksheetData.totalCreditPoints) || changed;
    changed = fillIfEmpty(doc, 'sgpa', marksheetData.sgpa) || changed;
    changed = fillIfEmpty(doc, 'percentage', marksheetData.percentage) || changed;
    changed = fillIfEmpty(doc, 'classification', marksheetData.classification) || changed;
  } else if (!Array.isArray(doc.subjects) || doc.subjects.length === 0) {
    doc.subjects = (marksheetData.courses || []).map((course) => ({
      paper: {
        code: course.courseType || '',
        title: course.subjectName || '',
      },
    }));
    changed = true;
  }

  if (!changed) {
    return { action: 'skipped', marksheetId: doc._id, reason: 'calculated fields already present' };
  }

  await doc.save();
  return { action: actionBase, marksheetId: doc._id };
};

const findMarksheetById = async (id) => {
  for (const Model of ALL_SEMESTER_MODELS) {
    const doc = await Model.findById(id);
    if (doc) return doc;
  }
  return null;
};

const findMarksheetsByStudentId = async (studentId, student, studentType) => {
  const payload = await loadGradeSheetPayload(student, studentType);
  return payload.marksheets;
};

module.exports = {
  resolveSemesterTarget,
  upsertSemesterMarksheet,
  findMarksheetById,
  findMarksheetsByStudentId,
};
