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
const { toPlainStudent, applyLegacyAliases } = require('./studentLookup');

const pgSubjectsToCourses = (subjects = []) =>
  subjects.map((subject) => ({
    subjectName: subject.paper?.title || subject.subjectName || '',
    courseType: subject.paper?.code || subject.courseType || '',
    credit: subject.credit,
    midsem: subject.midsemMark,
    endsem: subject.finalMark,
    practical: subject.practicalMark,
    marks: subject.marks ?? subject.totalMark,
    grade: subject.grade,
    gradePoint: subject.gradePoint,
    creditPoint: subject.creditPoint,
    percentage: subject.percentage,
  }));

const toMarksheetShape = (row, student, studentType, courses) => {
  const plain = toPlainStudent(row);
  return {
    _id: plain._id,
    semester: plain.semester,
    courses,
    totalCredits: plain.totalCredits,
    totalCreditPoints: plain.totalCreditPoints,
    sgpa: plain.sgpa,
    percentage: plain.percentage,
    classification: plain.classification,
    createdAt: plain.createdAt,
    student: applyLegacyAliases(toPlainStudent(student), studentType),
  };
};

const reconstructUgKeyedRow = (row, student) => {
  const master = toPlainStudent(student);
  const plain = toPlainStudent(row);
  const out = {
    'Autonomous Roll No': master.autonomousRollNo,
    'Name of the Students': master.name,
    'Roll No': master.collegeRollNo,
    Department: master.department,
    Examcode: plain.examcode || '',
  };

  (plain.courses || []).forEach((course) => {
    if (!course.courseType) return;
    out[course.courseType] = {
      Subject: course.subjectName,
      credit: course.credit,
      Credit: course.credit,
      FinalMark: course.theory,
      'MidsemMark(10/20)': course.internal,
      'PracticalMark(20)': course.practical,
      TotalMark: course.marks,
      Grade: course.grade,
      'Grade Point': course.gradePoint,
      CreditPoint: course.creditPoint,
    };
  });

  return out;
};

const toPgSecondSemRow = (row, student) => {
  const master = toPlainStudent(student);
  const plain = toPlainStudent(row);
  const courses = pgSubjectsToCourses(plain.subjects || []);
  return {
    autonomousRollNo: master.autonomousRollNo,
    collegeRollNo: master.collegeRollNo,
    applicantName: master.name,
    department: master.department,
    course: master.course,
    classification: plain.classification,
    percentage: plain.percentage,
    semester: 2,
    courses,
    totalCredits: plain.totalCredits,
    totalCreditPoints: plain.totalCreditPoints,
    sgpa: plain.sgpa,
  };
};

const loadGradeSheetPayload = async (student, studentType) => {
  const master = toPlainStudent(student);
  const roll = master.autonomousRollNo;
  const programme = String(master.programme || '').toUpperCase();
  const batch = String(master.batch || '').trim();
  const isUgProgramme = programme === 'UG' || programme === 'BBA';
  const studentInfo = {
    name: master.name || 'N/A',
    autonomousRollNo: roll,
    rollNo: master.collegeRollNo || 'N/A',
    department: master.department || master.course || 'N/A',
    studentType,
  };

  const marksheets = [];
  const searchedCollections = [];
  let secondSem2024 = null;
  let pgSecondSem2024 = null;

  if (isUgProgramme && batch === '2024') {
    searchedCollections.push('firstsem-2024', '2nd-sem-2024', '3rd-sem-2024', '4th-sem-2024');
    const [sem1, sem2, sem3, sem4] = await Promise.all([
      UG2024FirstSem.findOne({ autonomousRollNo: roll }),
      UG2024SecondSem.findOne({ autonomousRollNo: roll }),
      UG2024ThirdSem.findOne({ autonomousRollNo: roll }),
      UG2024FourthSem.findOne({ autonomousRollNo: roll }),
    ]);
    if (sem1) marksheets.push(toMarksheetShape(sem1, student, studentType, sem1.courses || []));
    if (sem2) {
      marksheets.push(toMarksheetShape(sem2, student, studentType, sem2.courses || []));
      secondSem2024 = reconstructUgKeyedRow(sem2, student);
    }
    if (sem3) marksheets.push(toMarksheetShape(sem3, student, studentType, sem3.courses || []));
    if (sem4) marksheets.push(toMarksheetShape(sem4, student, studentType, sem4.courses || []));
  }

  if (isUgProgramme && batch === '2025') {
    searchedCollections.push('1st-sem-2025', '2nd-sem-2025');
    const [sem1, sem2] = await Promise.all([
      UG2025FirstSem.findOne({ autonomousRollNo: roll }),
      UG2025SecondSem.findOne({ autonomousRollNo: roll }),
    ]);
    if (sem1) marksheets.push(toMarksheetShape(sem1, student, studentType, sem1.courses || []));
    if (sem2) marksheets.push(toMarksheetShape(sem2, student, studentType, sem2.courses || []));
  }

  if (programme === 'PG' && batch === '2024') {
    searchedCollections.push('1st-sem-2024-PG', '2nd-sem-2024-PG', '3rd-sem-2024-PG', '4th-sem-2024-PG');
    const [sem1, sem2, sem3, sem4] = await Promise.all([
      PG2024FirstSem.findOne({ autonomousRollNo: roll }),
      PG2024SecondSem.findOne({ autonomousRollNo: roll }),
      PG2024ThirdSem.findOne({ autonomousRollNo: roll }),
      PG2024FourthSem.findOne({ autonomousRollNo: roll }),
    ]);
    if (sem1) {
      marksheets.push(toMarksheetShape(sem1, student, studentType, pgSubjectsToCourses(sem1.subjects)));
    }
    if (sem2) {
      marksheets.push(toMarksheetShape(sem2, student, studentType, pgSubjectsToCourses(sem2.subjects)));
      pgSecondSem2024 = toPgSecondSemRow(sem2, student);
    }
    if (sem3) {
      marksheets.push(toMarksheetShape(sem3, student, studentType, pgSubjectsToCourses(sem3.subjects)));
    }
    if (sem4) {
      marksheets.push(toMarksheetShape(sem4, student, studentType, pgSubjectsToCourses(sem4.subjects)));
    }
  }

  if (!marksheets.length) {
    console.warn('No marksheets matched student lookup', {
      autonomousRollNo: roll,
      programme,
      batch,
      studentType,
      searchedCollections,
    });
  }

  return {
    student: studentInfo,
    marksheets,
    secondSem2024,
    pgSecondSem2024,
  };
};

module.exports = {
  loadGradeSheetPayload,
  pgSubjectsToCourses,
};
