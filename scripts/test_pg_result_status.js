/**
 * TEST CODE
 * PG 2025 Semester-I
 *
 * Shows:
 * 1. Absent students
 * 2. Failed students
 * 3. Passed students
 *
 * Does NOT modify any JSON or database.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const RAW_FILE = path.join(
  ROOT,
  "utils",
  "pg2025Sem1Students.json"
);

const CALCULATED_FILE = path.join(
  ROOT,
  "utils",
  "pg2025Sem1Calculated.json"
);


// ----------------------------------------------------
// READ JSON
// ----------------------------------------------------

function readJSON(file) {
  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}


// ----------------------------------------------------
// CHECK ABSENT
// ----------------------------------------------------

function isAbsent(student) {

  if (!student.subjects || !student.subjects.length) {
    return true;
  }

  // College convention:
  // If the student has 0 in all papers,
  // count the student as ABSENT.

  return student.subjects.every(subject => {

    const totalMark =
      Number(subject.totalMark || 0);

    const marks =
      Number(subject.marks || 0);

    const midsem =
      Number(subject.midsemMark || 0);

    const finalMark =
      Number(subject.finalMark || 0);

    return (
      totalMark === 0 &&
      marks === 0 &&
      midsem === 0 &&
      finalMark === 0
    );
  });
}


// ----------------------------------------------------
// CHECK FAIL
// ----------------------------------------------------

function getFailedSubjects(student) {

  const failedSubjects = [];

  (student.subjects || []).forEach(subject => {

    const grade =
      String(subject.grade || "")
        .toUpperCase()
        .trim();

    if (
      grade === "F" ||
      grade === "AB" ||
      grade === "M"
    ) {

      const course =
        subject.courses?.[0] || {};

      failedSubjects.push({
        paper: course.courseType || "",
        subject: course.subjectName || "",
        grade: grade,
        totalMark: subject.totalMark ?? ""
      });
    }
  });

  return failedSubjects;
}


// ----------------------------------------------------
// MAIN
// ----------------------------------------------------

function main() {

  if (!fs.existsSync(RAW_FILE)) {
    throw new Error(
      `Raw JSON not found:\n${RAW_FILE}`
    );
  }

  if (!fs.existsSync(CALCULATED_FILE)) {
    throw new Error(
      `Calculated JSON not found:\n${CALCULATED_FILE}`
    );
  }


  const rawData =
    readJSON(RAW_FILE);

  const calculatedData =
    readJSON(CALCULATED_FILE);


  const rawStudents =
    rawData.students || rawData;

  const calculatedStudents =
    Array.isArray(calculatedData)
      ? calculatedData
      : calculatedData.students || [];


  // --------------------------------------------------
  // RAW STUDENT MAP
  // --------------------------------------------------

  const rawMap = new Map();

  rawStudents.forEach(student => {

    rawMap.set(
      String(student.autonomousRollNo),
      student
    );

  });


  // --------------------------------------------------
  // RESULT ARRAYS
  // --------------------------------------------------

  const absentStudents = [];

  const failedStudents = [];

  const passedStudents = [];


  // --------------------------------------------------
  // PROCESS STUDENTS
  // --------------------------------------------------

  calculatedStudents.forEach(student => {

    const rawStudent =
      rawMap.get(
        String(student.autonomousRollNo)
      ) || {};


    const failedSubjects =
      getFailedSubjects(student);


    // ABSENT
    if (isAbsent(student)) {

      absentStudents.push({
        autonomousRollNo:
          student.autonomousRollNo,

        collegeRollNo:
          rawStudent.collegeRollNo || "",

        name:
          rawStudent.name || "",

        department:
          rawStudent.department || ""
      });

      return;
    }


    // FAIL
    if (failedSubjects.length > 0) {

      failedStudents.push({

        autonomousRollNo:
          student.autonomousRollNo,

        collegeRollNo:
          rawStudent.collegeRollNo || "",

        name:
          rawStudent.name || "",

        department:
          rawStudent.department || "",

        failedSubjects
      });

      return;
    }


    // PASS
    passedStudents.push({

      autonomousRollNo:
        student.autonomousRollNo,

      collegeRollNo:
        rawStudent.collegeRollNo || "",

      name:
        rawStudent.name || "",

      department:
        rawStudent.department || ""
    });

  });


  // --------------------------------------------------
  // PRINT ABSENT
  // --------------------------------------------------

  console.log("\n");
  console.log(
    "============================================================"
  );
  console.log(
    "ABSENT STUDENTS"
  );
  console.log(
    "============================================================"
  );

  console.log(
    `Total Absent: ${absentStudents.length}`
  );

  console.table(absentStudents);


  // --------------------------------------------------
  // PRINT FAIL
  // --------------------------------------------------

  console.log("\n");
  console.log(
    "============================================================"
  );
  console.log(
    "FAILED STUDENTS"
  );
  console.log(
    "============================================================"
  );

  console.log(
    `Total Failed: ${failedStudents.length}`
  );


  failedStudents.forEach((student, index) => {

    console.log(
      `\n${index + 1}. ${student.name}`
    );

    console.log(
      `   College Roll : ${student.collegeRollNo}`
    );

    console.log(
      `   Exam Roll    : ${student.autonomousRollNo}`
    );

    console.log(
      `   Department   : ${student.department}`
    );

    console.log(
      "   Failed Papers:"
    );

    student.failedSubjects.forEach(subject => {

      console.log(
        `      ${subject.paper} - ${subject.subject} | ` +
        `Grade: ${subject.grade} | ` +
        `Total: ${subject.totalMark}`
      );

    });

  });


  // --------------------------------------------------
  // PRINT PASS
  // --------------------------------------------------

  console.log("\n");
  console.log(
    "============================================================"
  );
  console.log(
    "PASSED STUDENTS"
  );
  console.log(
    "============================================================"
  );

  console.log(
    `Total Passed: ${passedStudents.length}`
  );

  console.table(passedStudents);


  // --------------------------------------------------
  // FINAL SUMMARY
  // --------------------------------------------------

  console.log("\n");
  console.log(
    "============================================================"
  );
  console.log(
    "FINAL TEST SUMMARY"
  );
  console.log(
    "============================================================"
  );

  console.log(
    `Total Students : ${calculatedStudents.length}`
  );

  console.log(
    `Passed         : ${passedStudents.length}`
  );

  console.log(
    `Failed         : ${failedStudents.length}`
  );

  console.log(
    `Absent         : ${absentStudents.length}`
  );

  console.log(
    "============================================================"
  );
  console.log("\n");
}


// ----------------------------------------------------
// RUN
// ----------------------------------------------------

main();