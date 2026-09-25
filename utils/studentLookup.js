const UG2024Batch = require('../models/UG2024Batch');
const UG2025Batch = require('../models/UG2025Batch');
const PG2024Batch = require('../models/PG2024Batch');
const PG2025Batch = require('../models/PG2025Batch');

const SEMESTER_STUDENT_TYPES = ['UG2ND2025', 'UG4TH2024', 'PG2ND2025', 'UG2ND2024'];

const MASTER_SEARCH_ORDER = [
  { Model: PG2024Batch, studentType: 'PG' },
  { Model: PG2025Batch, studentType: 'PG2025' },
  { Model: UG2024Batch, studentType: 'UG' },
  { Model: UG2025Batch, studentType: 'UG2025' },
];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rollNumberQuery = (trimmedRollNo) => {
  const exact = String(trimmedRollNo || '').trim();
  if (!exact) return { autonomousRollNo: '__none__' };
  const insensitive = new RegExp(`^${escapeRegex(exact)}$`, 'i');
  return {
    $or: [
      { autonomousRollNo: insensitive },
      { collegeRollNo: insensitive },
    ],
  };
};

const toPlainStudent = (student) => {
  if (!student) return null;
  return typeof student.toObject === 'function' ? student.toObject() : { ...student };
};

const isBbaMaster = (student) => {
  const dept = String(student?.department || student?.stream || '').trim().toUpperCase();
  const roll = String(
    student?.autonomousRollNo || student?.collegeRollNo || ''
  )
    .trim()
    .toUpperCase();
  return dept.includes('BBA') || roll.startsWith('BBA-') || roll.includes('NACBBA');
};

const resolveStudentType = (student, fallbackType) => {
  if (!student) return fallbackType;
  if (String(student.programme || '').toUpperCase() === 'PG') {
    return String(student.batch) === '2025' ? 'PG2025' : 'PG';
  }
  if (isBbaMaster(student)) return 'BBA';
  return String(student.batch) === '2025' ? 'UG2025' : 'UG';
};

const inferBatchFromStudent = (student) => {
  if (student?.batch) return String(student.batch).trim();
  return null;
};

const getSemesterKey = (studentType) => {
  switch (studentType?.toUpperCase()) {
    case 'UG2ND2025':
      return '2ndsem2025';
    case 'UG4TH2024':
      return '4thsem2024';
    case 'UG2ND2024':
      return '2ndsem2024';
    case 'UG2025':
      return '1stsem2025';
    case 'PG2025':
      return 'pg1stsem2025';
    case 'PG2ND2025':
      return 'pg2ndsem2025';
    default:
      return null;
  }
};

const getStudentModel = (studentType) => {
  switch (studentType?.toUpperCase()) {
    case 'PG':
      return PG2024Batch;
    case 'PG2025':
    case 'PG2ND2025':
      return PG2025Batch;
    case 'UG2025':
    case 'UG2ND2025':
      return UG2025Batch;
    case 'UG':
    case 'BBA':
    case 'UG2ND2024':
    case 'UG4TH2024':
      return UG2024Batch;
    default:
      return null;
  }
};

const applyLegacyAliases = (plain, studentType) => {
  if (!plain) return null;
  const autonomousRollNo = plain.autonomousRollNo || '';
  const collegeRollNo = plain.collegeRollNo || '';
  const name = plain.name || '';
  const department = plain.department || '';
  const course = plain.course || department;
  const abcId = plain.abcId || null;

  return {
    ...plain,
    studentType,
    autonomousRollNo,
    collegeRollNo,
    name,
    department,
    course,
    abcId,
    ABC_ID: abcId,
    profileImage: plain.profileImage || null,
    'Autonomous Roll No': autonomousRollNo,
    'Roll No': collegeRollNo,
    'College Roll No': collegeRollNo,
    'Name of the Students': name,
    'Applicant Name': name,
    Name: name,
    Department: department,
    Course: course,
    Stream: plain.stream || '',
    dob: plain.dob || '',
    DOB: plain.dob || '',
    'Registration Number': plain.registrationNumber || '',
  };
};

const enrichStudentRecord = async (student, studentType) => {
  const plain = toPlainStudent(student);
  const resolvedType = studentType || resolveStudentType(plain);
  return applyLegacyAliases(plain, resolvedType);
};

const formatAdmitCardData = async (student, studentType) => {
  const studentData = await enrichStudentRecord(student, studentType);
  const batch = inferBatchFromStudent(studentData);
  const semesterKey = getSemesterKey(studentType);

  return {
    studentType,
    semesterKey,
    batch,
    autonomousRollNo: studentData.autonomousRollNo,
    name: studentData.name,
    rollNo: studentData.collegeRollNo,
    department: studentData.department || studentData.course || null,
    dob: studentData.dob,
    ABC_ID: studentData.abcId || null,
    profileImage: studentData.profileImage || null,
    examCode: studentData.examcode || studentData.examCode || null,
    ...studentData,
  };
};

const findInMasters = async (trimmedRollNo) => {
  const exact = String(trimmedRollNo || '').trim();
  if (!exact) return { student: null, studentType: null };
  const insensitive = new RegExp(`^${escapeRegex(exact)}$`, 'i');

  for (const field of ['autonomousRollNo', 'collegeRollNo']) {
    const hits = await Promise.all(
      MASTER_SEARCH_ORDER.map(async ({ Model, studentType }) => {
        const student = await Model.findOne({ [field]: insensitive });
        return student ? { student, fallbackType: studentType } : null;
      })
    );
    const match = hits.find(Boolean);
    if (match) {
      return {
        student: match.student,
        studentType: resolveStudentType(match.student, match.fallbackType),
      };
    }
  }

  return { student: null, studentType: null };
};

const findStudentByRoll = async (trimmedRollNo) => findInMasters(trimmedRollNo);

const findStudentRecord = async (autonomousRollNo, studentType) => {
  const normalizedType = studentType?.trim().toUpperCase();
  const Model = getStudentModel(normalizedType);
  const exact = String(autonomousRollNo || '').trim();
  const insensitive = new RegExp(`^${escapeRegex(exact)}$`, 'i');

  if (normalizedType && Model) {
    const student =
      (await Model.findOne({ autonomousRollNo: insensitive })) ||
      (await Model.findOne({ collegeRollNo: insensitive }));
    if (student) {
      return { student, studentType: resolveStudentType(student, normalizedType) };
    }
  }

  return findStudentByRoll(autonomousRollNo);
};

const formatStudentSummary = (student, studentType) => {
  const plain = applyLegacyAliases(toPlainStudent(student), studentType);
  return {
    id: plain._id,
    studentType,
    autonomousRollNo: plain.autonomousRollNo,
    name: plain.name,
    department: plain.department || plain.course || null,
    streamField: plain.stream || null,
    rollNo: plain.collegeRollNo || null,
    batch: inferBatchFromStudent(plain),
    semesterKey: getSemesterKey(studentType),
  };
};

const findMasterById = async (id) => {
  if (!id) return { student: null, studentType: null };
  const hits = await Promise.all(
    MASTER_SEARCH_ORDER.map(async ({ Model, studentType }) => {
      const student = await Model.findById(id);
      return student ? { student, fallbackType: studentType } : null;
    })
  );
  const match = hits.find(Boolean);
  if (!match) return { student: null, studentType: null };
  return {
    student: match.student,
    studentType: resolveStudentType(match.student, match.fallbackType),
  };
};

const findByAbcId = async (abcId, { excludeRoll } = {}) => {
  const value = String(abcId || '').trim();
  if (!value) return null;
  const insensitive = new RegExp(`^${escapeRegex(value)}$`, 'i');
  const filter = { abcId: insensitive };
  if (excludeRoll) {
    filter.autonomousRollNo = { $ne: excludeRoll };
  }
  for (const { Model } of MASTER_SEARCH_ORDER) {
    const student = await Model.findOne(filter);
    if (student) return student;
  }
  return null;
};

const listMastersWithAbcId = async ({ department, search } = {}) => {
  const filter = { abcId: { $nin: [null, ''] } };
  if (department) filter.department = department;
  if (search) {
    const rx = new RegExp(search, 'i');
    filter.$or = [{ autonomousRollNo: rx }, { name: rx }, { abcId: rx }];
  }
  const rows = await Promise.all(
    MASTER_SEARCH_ORDER.map(({ Model, studentType }) =>
      Model.find(filter).sort({ department: 1, name: 1 }).then((docs) =>
        docs.map((doc) => {
          const type = resolveStudentType(doc, studentType);
          return {
            _id: doc._id,
            autonomousRollNo: doc.autonomousRollNo,
            studentName: doc.name,
            department: doc.department || doc.course || '',
            ABC_ID: doc.abcId,
            studentType: type,
            status: 'submitted',
          };
        })
      )
    )
  );
  return rows.flat();
};

module.exports = {
  SEMESTER_STUDENT_TYPES,
  MASTER_SEARCH_ORDER,
  rollNumberQuery,
  inferBatchFromStudent,
  getSemesterKey,
  getStudentModel,
  formatAdmitCardData,
  enrichStudentRecord,
  applyLegacyAliases,
  toPlainStudent,
  isBbaMaster,
  findStudentByRoll,
  findStudentRecord,
  findMasterById,
  findByAbcId,
  listMastersWithAbcId,
  formatStudentSummary,
};
