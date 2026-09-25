const { PG2024SecondSem } = require('../models/PG2024Semesters');
const PG2024Batch = require('../models/PG2024Batch');
const { pgSubjectsToCourses } = require('../utils/repairGradeSheet');

const getByAutonomousRollNo = async (req, res) => {
  try {
    const autonomousRollNo = req.params.autonomousRollNo?.trim();

    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Autonomous Roll No is required' });
    }

    const master = await PG2024Batch.findOne({
      $or: [{ autonomousRollNo }, { collegeRollNo: autonomousRollNo }],
    });
    const roll = master?.autonomousRollNo || autonomousRollNo;
    const doc = await PG2024SecondSem.findOne({ autonomousRollNo: roll });

    if (!doc) {
      return res.status(404).json({ message: 'PG 2nd semester record not found' });
    }

    return res.json({
      autonomousRollNo: roll,
      collegeRollNo: master?.collegeRollNo || '',
      applicantName: master?.name || '',
      department: master?.department || '',
      course: master?.course || '',
      semester: 2,
      courses: pgSubjectsToCourses(doc.subjects || []),
      totalCredits: doc.totalCredits,
      totalCreditPoints: doc.totalCreditPoints,
      sgpa: doc.sgpa,
      classification: doc.classification,
      percentage: doc.percentage,
    });
  } catch (error) {
    console.error('Error fetching PGSecondSem2024:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getByAutonomousRollNo,
};
