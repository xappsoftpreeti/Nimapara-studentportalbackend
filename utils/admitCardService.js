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
const { PG2025FirstSem, PG2025SecondSem } = require('../models/PG2025Semesters');
const { UG2025FirstSem, UG2025SecondSem } = require('../models/UG2025Semesters');
const {
  findStudentByRoll,
  formatAdmitCardData,
  isBbaMaster,
  toPlainStudent,
} = require('./studentLookup');

const COURSE_LABELS = {
  'Core-1-Major-1': 'Major CP-1',
  'Core-1-Major-2': 'Major CP-2',
  'Core-2-Minor-1': 'Minor P-1',
  'Multidisciplinary-1': 'MDC-1',
  'AEC-I': 'AEC-I',
  'VAC-I': 'VAC-I',
  'Major-3': 'Major CP-3',
  'Major-4': 'Major CP-4',
  'MINOR-2(20)': 'Minor P-2',
  'Multi Disciplinary-2': 'MDC-2',
  'AEC-2': 'AEC-2',
  'SEC-I': 'SEC-I',
  'Major-CP-5': 'Major CP-5',
  'Major-CP-6': 'Major CP-6',
  'Major-CP-7': 'Major CP-7',
  'MINOR-3': 'Minor P-3',
  'Multi Disciplinary-3': 'MDC-3',
  'VAC-2': 'VAC-2',
  'CORE-1 MAJOR-8': 'Major CP-8',
  'CORE-1 MAJOR-9': 'Major CP-9',
  'CORE-1 MAJOR-10': 'Major CP-10',
  'CORE-2 MINOR-4': 'Minor P-4',
  'CC-101': 'CC-101',
  'CC-102': 'CC-102',
  'CC-103': 'CC-103',
  'MDE-101': 'MDE-101',
  'AEC-101': 'AEC-101',
  'AEC-102': 'AEC-102',
  'VAC-101': 'VAC-101',
  'CC-201': 'CC-201',
  'CC-202': 'CC-202',
  'CC-203': 'CC-203',
  'Multi Disciplinary-201': 'MDC-201',
  'AEC-201': 'AEC-201',
  'SEC-201': 'SEC-201',
  'VAC-201': 'VAC-201',
  'VAC-201-I.C': 'VAC-201',
  'CC-301': 'CC-301',
  'CC-302': 'CC-302',
  'CC-303': 'CC-303',
  'MDE-301': 'MDE-301',
  'SEC-301': 'SEC-301',
  'VAC-301': 'VAC-301',
};

const SEMESTER_SOURCES = [
  {
    key: '1stsem2024',
    label: '1st Semester (2024 Batch)',
    order: 1,
    programme: 'UG',
    batch: '2024',
    studentType: 'UG',
    fetch: (roll) => UG2024FirstSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: '2ndsem2024',
    label: '2nd Semester (2024 Batch)',
    order: 2,
    programme: 'UG',
    batch: '2024',
    studentType: 'UG2ND2024',
    fetch: (roll) => UG2024SecondSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: '3rdsem',
    label: '3rd Semester',
    order: 3,
    programme: 'UG',
    batch: '2024',
    studentType: 'UG',
    fetch: (roll) => UG2024ThirdSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: '4thsem2024',
    label: '4th Semester (2024 Batch)',
    order: 4,
    programme: 'UG',
    batch: '2024',
    studentType: 'UG4TH2024',
    fetch: (roll) => UG2024FourthSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: '1stsem2025',
    label: '1st Semester (2025 Batch)',
    order: 1,
    programme: 'UG',
    batch: '2025',
    studentType: 'UG2025',
    fetch: (roll) => UG2025FirstSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: '2ndsem2025',
    label: '2nd Semester (2025 Batch)',
    order: 2,
    programme: 'UG',
    batch: '2025',
    studentType: 'UG2ND2025',
    fetch: (roll) => UG2025SecondSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: 'pg1stsem2024',
    label: '1st Semester',
    order: 1,
    programme: 'PG',
    batch: '2024',
    studentType: 'PG',
    fetch: (roll) => PG2024FirstSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: 'pg2ndsem2024',
    label: '2nd Semester',
    order: 2,
    programme: 'PG',
    batch: '2024',
    studentType: 'PG',
    fetch: (roll) => PG2024SecondSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: 'pg3rdsem2024',
    label: '3rd Semester',
    order: 3,
    programme: 'PG',
    batch: '2024',
    studentType: 'PG',
    fetch: (roll) => PG2024ThirdSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: 'pg4thsem2024',
    label: '4th Semester',
    order: 4,
    programme: 'PG',
    batch: '2024',
    studentType: 'PG',
    fetch: (roll) => PG2024FourthSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: 'pg1stsem2025',
    label: '1st Semester',
    order: 1,
    programme: 'PG',
    batch: '2025',
    studentType: 'PG2025',
    fetch: (roll) => PG2025FirstSem.findOne({ autonomousRollNo: roll }),
  },
  {
    key: 'pg2ndsem2025',
    label: '2nd Semester',
    order: 2,
    programme: 'PG',
    batch: '2025',
    studentType: 'PG2ND2025',
    fetch: (roll) => PG2025SecondSem.findOne({ autonomousRollNo: roll }),
  },
];

const STUDENT_TYPE_DEFAULT_SEMESTER = {
  UG2025: '1stsem2025',
  UG2ND2025: '2ndsem2025',
  UG2ND2024: '2ndsem2024',
  UG: '4thsem2024',
  UG4TH2024: '4thsem2024',
  BBA: '4thsem2024',
  PG: 'pg4thsem2024',
  PG2025: 'pg1stsem2025',
  PG2ND2025: 'pg2ndsem2025',
};

const hasPapers = (doc) => {
  if (!doc) return false;
  if (Array.isArray(doc.courses) && doc.courses.length > 0) return true;
  if (Array.isArray(doc.subjects) && doc.subjects.length > 0) return true;
  return false;
};

const buildSubjectRows = (doc) => {
  if (Array.isArray(doc?.courses) && doc.courses.length > 0) {
    return doc.courses.map((course) => {
      const code = course.courseType || '';
      const label = COURSE_LABELS[code] || code || 'Paper';
      return {
        field: code || course.subjectName,
        label,
        value: course.subjectName || '',
        paper: label,
        subjectName: course.subjectName || '',
      };
    });
  }

  if (Array.isArray(doc?.subjects) && doc.subjects.length > 0) {
    return doc.subjects.map((subject, index) => {
      const code = subject.paper?.code || subject.courseType || `PAPER-${index + 1}`;
      const title = subject.paper?.title || subject.subjectName || '';
      return {
        field: `${code}-${index}`,
        label: code,
        value: title,
        paper: code,
        subjectName: title,
      };
    });
  }

  return [];
};

const listAvailableSemesters = async (autonomousRollNo) => {
  const { student, studentType } = await findStudentByRoll(autonomousRollNo);
  if (!student) return [];

  const master = toPlainStudent(student);
  const masterProgramme = String(
    master.programme || (studentType?.startsWith('PG') ? 'PG' : 'UG')
  ).toUpperCase();
  const programme = masterProgramme === 'BBA' ? 'UG' : masterProgramme;
  const batch = String(master.batch || '').trim();
  const roll = master.autonomousRollNo;

  const available = [];
  for (const source of SEMESTER_SOURCES) {
    if (source.programme !== programme || source.batch !== batch) continue;
    const row = await source.fetch(roll);
    if (!row) continue;
    const plain = toPlainStudent(row);
    if (!hasPapers(plain)) continue;

    const resolvedType = isBbaMaster(master) && source.programme === 'UG' ? 'BBA' : source.studentType;
    available.push({
      key: source.key,
      label: source.label,
      order: source.order,
      studentType: resolvedType,
      examcode: plain.examcode || '',
      subjects: buildSubjectRows(plain),
    });
  }

  if (!available.length) {
    console.warn('No admit card subjects matched student lookup', {
      autonomousRollNo: roll,
      programme: masterProgramme,
      batch,
      studentType,
      eligibleSemesterKeys: SEMESTER_SOURCES
        .filter((source) => source.programme === programme && source.batch === batch)
        .map((source) => source.key),
    });
  }

  return available.sort((a, b) => a.order - b.order);
};

const pickSemester = (available, semesterKey, preferredStudentType) => {
  if (semesterKey) {
    return available.find((item) => item.key === semesterKey) || null;
  }

  const preferredKey = STUDENT_TYPE_DEFAULT_SEMESTER[preferredStudentType?.toUpperCase()];
  if (preferredKey) {
    const preferred = available.find((item) => item.key === preferredKey);
    if (preferred) return preferred;
  }

  return available[available.length - 1] || available[0] || null;
};

const getAdmitCardData = async (autonomousRollNo, options = {}) => {
  const { semesterKey = null, studentType: preferredStudentType = null } = options;
  const { student, studentType } = await findStudentByRoll(autonomousRollNo);
  if (!student) return null;

  const available = await listAvailableSemesters(student.autonomousRollNo || autonomousRollNo);
  if (available.length === 0) {
    const formatted = await formatAdmitCardData(student, preferredStudentType || studentType);
    return {
      ...formatted,
      subjects: [],
      availableSemesters: [],
    };
  }

  const selected = pickSemester(available, semesterKey, preferredStudentType || studentType);
  if (!selected) {
    return {
      notFound: true,
      availableSemesters: available.map((s) => ({ key: s.key, label: s.label })),
    };
  }

  const formatted = await formatAdmitCardData(student, selected.studentType);
  const paperFields = {};
  selected.subjects.forEach((row) => {
    paperFields[row.field] = row.value;
  });

  return {
    ...formatted,
    ...paperFields,
    examCode: selected.examcode || formatted.examCode,
    semesterKey: selected.key,
    semesterLabel: selected.label,
    subjects: selected.subjects,
    availableSemesters: available.map((s) => ({ key: s.key, label: s.label })),
  };
};

module.exports = {
  COURSE_LABELS,
  SEMESTER_SOURCES,
  listAvailableSemesters,
  getAdmitCardData,
  buildSubjectRows,
};
