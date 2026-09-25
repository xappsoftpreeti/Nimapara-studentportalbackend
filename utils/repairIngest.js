const UG2024Batch = require('../models/UG2024Batch');
const UG2025Batch = require('../models/UG2025Batch');
const PG2024Batch = require('../models/PG2024Batch');
const PG2025Batch = require('../models/PG2025Batch');
const { upsertSemesterMarksheet } = require('./repairSemesterStore');

const trim = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const asArray = (body) => {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.students)) return body.students;
  if (Array.isArray(body?.marksheets)) return body.marksheets;
  if (body && typeof body === 'object') return [body];
  return [];
};

const normalizeBatch = (value, fallback) => {
  const raw = trim(value);
  if (!raw) return fallback;
  if (/^\d{2}$/.test(raw)) return `20${raw}`;
  return raw;
};

const pick = (row, ...keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const getUgMasterModel = (batch) => {
  if (batch === '2025') return UG2025Batch;
  if (batch === '2024') return UG2024Batch;
  return null;
};

const getPgMasterModel = (batch) => {
  if (batch === '2025') return PG2025Batch;
  if (batch === '2024') return PG2024Batch;
  return null;
};

const isBbaIdentity = (row) => {
  const dept = String(row?.department || row?.stream || '').trim().toUpperCase();
  const roll = String(
    row?.autonomousRollNo || row?.collegeRollNo || row?.CollegeRollNo || ''
  )
    .trim()
    .toUpperCase();
  return dept.includes('BBA') || roll.startsWith('BBA-') || roll.includes('NACBBA');
};

const normalizeUgMaster = (row, defaultBatch) => {
  const batch = normalizeBatch(pick(row, 'batch', 'Batch'), defaultBatch || '2024');
  const autonomousRollNo = trim(
    pick(row, 'autonomousRollNo', 'AutonomousRollNo', 'Autonomous Roll No')
  );
  return {
    batch,
    programme: 'UG',
    autonomousRollNo,
    collegeRollNo: trim(pick(row, 'collegeRollNo', 'CollegeRollNo', 'College Roll No', 'Roll No')),
    name: trim(pick(row, 'name', 'Name of the Students', 'Applicant Name', 'Name')),
    dob: trim(pick(row, 'dob', 'DOB', 'DateOfBirth')),
    abcId: trim(pick(row, 'abcId', 'ABC_ID', 'ABC ID')) || null,
    department: trim(pick(row, 'department', 'Department')),
    stream: trim(pick(row, 'stream', 'Stream')),
    registrationNumber: trim(pick(row, 'registrationNumber', 'Registration Number')),
  };
};

const normalizePgMaster = (row, defaultBatch) => {
  const batch = normalizeBatch(pick(row, 'batch', 'Batch'), defaultBatch || '2024');
  const autonomousRollNo = trim(
    pick(row, 'autonomousRollNo', 'AutonomousRollNo', 'Autonomous Roll No')
  );
  return {
    batch,
    programme: 'PG',
    autonomousRollNo,
    collegeRollNo: trim(pick(row, 'collegeRollNo', 'College Roll No', 'Roll No')),
    name: trim(pick(row, 'name', 'studentName', 'Applicant Name', 'Name of the Students', 'Name')),
    dob: trim(pick(row, 'dob', 'DOB', 'DateOfBirth')),
    abcId: trim(pick(row, 'abcId', 'ABC_ID', 'ABC ID')) || null,
    department: trim(pick(row, 'department', 'Department')),
    course: trim(pick(row, 'course', 'Course')),
    stream: trim(pick(row, 'stream', 'Stream')),
    graduationBoard: trim(pick(row, 'graduationBoard', 'Graduation Board')),
    registrationNumber: trim(pick(row, 'registrationNumber', 'Registration Number')),
    barcode: trim(pick(row, 'barcode', 'Barcode')),
    gradeSheetSlNo: trim(pick(row, 'gradeSheetSlNo', 'GradeSheetSlNo')),
  };
};

const upsertMaster = async (Model, data) => {
  let doc = await Model.findOne({ autonomousRollNo: data.autonomousRollNo });
  const action = doc ? 'updated' : 'created';
  if (!doc) {
    doc = new Model(data);
  } else {
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'abcId' && (value === null || value === '')) return;
      if (value === undefined || value === '') return;
      doc[key] = value;
    });
  }
  await doc.save();
  return { action, id: doc._id, autonomousRollNo: doc.autonomousRollNo };
};

const toNum = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const normalizeCourse = (course) => ({
  subjectName: course.subjectName || course.paperName || course.Subject || course.title || '',
  courseType: course.courseType || course.paperCode || course.paper?.code || course.code || '',
  credit: toNum(course.credit),
  theory: toNum(course.theory ?? course.endsem ?? course.finalMark),
  internal: toNum(course.internal ?? course.midsem ?? course.midsemMark),
  practical: toNum(course.practical ?? course.practicalMark),
  marks: toNum(course.marks ?? course.totalMark ?? course.TotalMark ?? course.totalMarks),
  grade: course.grade || course.Grade || '',
  gradePoint: toNum(course.gradePoint ?? course['Grade Point']),
  creditPoint: toNum(course.creditPoint ?? course.CreditPoint),
  percentage: toNum(course.percentage),
  midsem: toNum(course.midsem ?? course.midsemMark),
  endsem: toNum(course.endsem ?? course.finalMark),
});

const normalizeCourses = (row) => {
  if (Array.isArray(row.courses) && row.courses.length) {
    return row.courses.map(normalizeCourse);
  }
  if (Array.isArray(row.subjects) && row.subjects.length) {
    return row.subjects.map((subject) =>
      normalizeCourse({
        ...subject,
        subjectName: subject.paper?.title || subject.subjectName || subject.title || '',
        courseType: subject.paper?.code || subject.courseType || subject.code || '',
        theory: subject.finalMark ?? subject.endsem,
        internal: subject.midsemMark ?? subject.midsem,
        practical: subject.practicalMark ?? subject.practical,
        marks: subject.marks ?? subject.totalMark ?? subject.totalMarks,
      })
    );
  }
  return [];
};

const ingestMasters = async ({ programme, body }) => {
  const rows = asArray(body);
  const defaultBatch = normalizeBatch(body?.batch, programme === 'PG' ? '2024' : '2024');
  const results = { success: [], failed: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const data =
        programme === 'PG' ? normalizePgMaster(row, defaultBatch) : normalizeUgMaster(row, defaultBatch);
      if (!data.autonomousRollNo) {
        results.failed.push({ index: i, error: 'autonomousRollNo is required' });
        continue;
      }
      const Model = programme === 'PG' ? getPgMasterModel(data.batch) : getUgMasterModel(data.batch);
      if (!Model) {
        results.failed.push({
          index: i,
          error: `Unsupported ${programme} batch ${data.batch}`,
        });
        continue;
      }
      const saved = await upsertMaster(Model, data);
      results.success.push({ index: i, ...saved, batch: data.batch });
    } catch (error) {
      results.failed.push({ index: i, error: error.message });
    }
  }

  return {
    message: `${programme} master upload completed`,
    summary: {
      total: rows.length,
      successful: results.success.length,
      failed: results.failed.length,
    },
    results,
  };
};

const ingestMarksheets = async ({ programme, body }) => {
  const rows = asArray(body);
  const defaultBatch = normalizeBatch(body?.batch);
  const defaultSemester = body?.semester ?? body?.Semester;
  const defaultExamcode = trim(body?.examcode || body?.examCode || '');
  const results = { success: [], failed: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const batch = normalizeBatch(pick(row, 'batch', 'Batch'), defaultBatch);
      const semester = Number(row.semester ?? row.Semester ?? defaultSemester);
      const roll = trim(pick(row, 'autonomousRollNo', 'AutonomousRollNo', 'Autonomous Roll No'));
      const courses = normalizeCourses(row);

      if (!roll) {
        results.failed.push({ index: i, error: 'autonomousRollNo is required' });
        continue;
      }
      if (!semester) {
        results.failed.push({ index: i, error: 'semester is required' });
        continue;
      }
      if (!courses.length) {
        results.failed.push({ index: i, error: 'courses/subjects array is required' });
        continue;
      }

      const Master = programme === 'PG' ? getPgMasterModel(batch) : getUgMasterModel(batch);
      if (!Master) {
        results.failed.push({ index: i, error: `Unsupported ${programme} batch ${batch}` });
        continue;
      }

      let student = await Master.findOne({ autonomousRollNo: roll });
      let masterAction = 'existing';
      if (!student && programme !== 'PG') {
        const data = normalizeUgMaster(row, batch);
        data.batch = batch || data.batch;
        data.autonomousRollNo = roll;
        data.programme = isBbaIdentity(data) || isBbaIdentity(row) ? 'BBA' : 'UG';
        student = new Master(data);
        await student.save();
        masterAction = 'created';
      }
      if (!student) {
        results.failed.push({
          index: i,
          error: `Master record not found for ${roll}. Upload masters first.`,
        });
        continue;
      }

      const saved = await upsertSemesterMarksheet({
        student,
        semester,
        marksheetData: {
          courses,
          examcode: trim(pick(row, 'examcode', 'examCode', 'Examcode', 'Exam Code') || defaultExamcode),
          totalCredits: toNum(row.totalCredits),
          totalCreditPoints: toNum(row.totalCreditPoints),
          sgpa: toNum(row.sgpa),
          percentage: toNum(row.percentage),
          classification: trim(row.classification),
          grandTotal: toNum(row.grandTotal),
          totalMarks: toNum(row.totalMarks),
        },
      });

      results.success.push({
        index: i,
        ...saved,
        masterAction,
        autonomousRollNo: roll,
        batch,
        semester,
      });
    } catch (error) {
      results.failed.push({ index: i, error: error.message });
    }
  }

  return {
    message: `${programme} marksheet upload completed`,
    summary: {
      total: rows.length,
      successful: results.success.filter((row) => row.action !== 'skipped').length,
      skipped: results.success.filter((row) => row.action === 'skipped').length,
      failed: results.failed.length,
    },
    results,
  };
};

module.exports = {
  ingestMasters,
  ingestMarksheets,
};
