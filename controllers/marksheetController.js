const { findStudentByRoll, findMasterById } = require('../utils/studentLookup');
const { loadGradeSheetPayload } = require('../utils/repairGradeSheet');
const {
  upsertSemesterMarksheet,
  findMarksheetById,
} = require('../utils/repairSemesterStore');

const bulkUpload = async (req, res) => {
  try {
    const { marksheets } = req.body;

    if (!marksheets || !Array.isArray(marksheets) || marksheets.length === 0) {
      return res.status(400).json({
        message: 'Marksheets array is required and must not be empty',
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (let i = 0; i < marksheets.length; i++) {
      const marksheetData = marksheets[i];

      try {
        const rollNo =
          marksheetData.autonomousRollNo ||
          marksheetData.AutonomousRollNo ||
          marksheetData['Autonomous Roll No'];

        if (!rollNo && !marksheetData.studentId) {
          results.failed.push({
            index: i,
            data: marksheetData,
            error: 'Either autonomousRollNo/AutonomousRollNo or studentId is required',
          });
          continue;
        }

        if (!marksheetData.semester) {
          results.failed.push({
            index: i,
            data: marksheetData,
            error: 'Semester is required',
          });
          continue;
        }

        if (!marksheetData.courses || !Array.isArray(marksheetData.courses) || marksheetData.courses.length === 0) {
          results.failed.push({
            index: i,
            data: marksheetData,
            error: 'Courses array is required and must not be empty',
          });
          continue;
        }

        let student = null;
        let studentType = null;

        if (marksheetData.studentId) {
          const found = await findMasterById(marksheetData.studentId);
          student = found.student;
          studentType = found.studentType;
        } else {
          const found = await findStudentByRoll(String(rollNo).trim());
          student = found.student;
          studentType = found.studentType;
        }

        if (!student) {
          results.failed.push({
            index: i,
            data: marksheetData,
            error: `Student not found for roll number: ${rollNo}`,
          });
          continue;
        }

        const processedCourses = marksheetData.courses.map((course) => {
          const normalized = {
            subjectName: course.subjectName,
            courseType: course.courseType,
            credit: course.credit,
            marks: course.marks,
          };
          if (course.theory !== undefined) normalized.theory = course.theory;
          if (course.internal !== undefined) normalized.internal = course.internal;
          if (course.midsem !== undefined) normalized.midsem = course.midsem;
          if (course.endsem !== undefined) normalized.endsem = course.endsem;
          if (course.practical !== undefined) normalized.practical = course.practical;
          if (course.grade !== undefined) normalized.grade = course.grade;
          if (course.gradePoint !== undefined) normalized.gradePoint = course.gradePoint;
          if (course.creditPoint !== undefined) normalized.creditPoint = course.creditPoint;
          if (course.percentage !== undefined) normalized.percentage = course.percentage;
          return normalized;
        });

        const saved = await upsertSemesterMarksheet({
          student,
          semester: marksheetData.semester,
          marksheetData: {
            courses: processedCourses,
            totalCredits: marksheetData.totalCredits,
            totalCreditPoints: marksheetData.totalCreditPoints,
            sgpa: marksheetData.sgpa,
            percentage: marksheetData.percentage,
            classification: marksheetData.classification,
          },
        });

        results.success.push({
          index: i,
          action: saved.action,
          studentName: student.name || 'N/A',
          studentType,
          autonomousRollNo: student.autonomousRollNo,
          semester: marksheetData.semester,
          marksheetId: saved.marksheetId,
        });
      } catch (error) {
        results.failed.push({
          index: i,
          data: marksheetData,
          error: error.message,
        });
      }
    }

    res.json({
      message: 'Bulk upload completed',
      summary: {
        total: marksheets.length,
        successful: results.success.length,
        failed: results.failed.length,
      },
      results,
    });
  } catch (error) {
    console.error('Bulk upload error:', error.message);
    res.status(500).json({
      message: 'Server error during bulk upload',
      error: error.message,
    });
  }
};

const getByStudentId = async (req, res) => {
  try {
    const { student, studentType } = await findMasterById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const payload = await loadGradeSheetPayload(student, studentType);
    if (!payload.marksheets.length) {
      return res.status(404).json({ message: 'No marksheets found for this student' });
    }

    res.json(payload.marksheets);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const getByAutonomousRollNo = async (req, res) => {
  try {
    const autonomousRollNo = req.params.autonomousRollNo?.trim();
    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Autonomous Roll No is required' });
    }

    const { student, studentType } = await findStudentByRoll(autonomousRollNo);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const payload = await loadGradeSheetPayload(student, studentType);
    if (!payload.marksheets.length && !payload.secondSem2024 && !payload.pgSecondSem2024) {
      return res.status(404).json({
        message: 'No marksheets found for this student',
        student: payload.student,
      });
    }

    return res.json(payload);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const clearAll = async (req, res) => {
  return res.status(400).json({
    message: 'Clear-all is disabled on nimapara-repair semester collections',
  });
};

const getById = async (req, res) => {
  try {
    const marksheet = await findMarksheetById(req.params.id);
    if (!marksheet) {
      return res.status(404).json({ message: 'Marksheet not found' });
    }
    res.json(marksheet);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteById = async (req, res) => {
  try {
    const marksheet = await findMarksheetById(req.params.id);
    if (!marksheet) {
      return res.status(404).json({ message: 'Marksheet not found' });
    }
    await marksheet.deleteOne();
    res.json({ message: 'Marksheet deleted successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  bulkUpload,
  getByStudentId,
  getByAutonomousRollNo,
  clearAll,
  getById,
  deleteById,
};
