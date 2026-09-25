const { findStudentByRoll } = require('../utils/studentLookup');
const { loadGradeSheetPayload } = require('../utils/repairGradeSheet');

const getByAutonomousRollNo = async (req, res) => {
  try {
    const autonomousRollNo = req.params.autonomousRollNo?.trim();

    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Autonomous Roll No is required' });
    }

    const { student, studentType } = await findStudentByRoll(autonomousRollNo);
    if (!student) {
      return res.status(404).json({ message: '2nd semester record not found' });
    }

    const payload = await loadGradeSheetPayload(student, studentType);
    if (!payload.secondSem2024) {
      return res.status(404).json({ message: '2nd semester record not found' });
    }

    return res.json(payload.secondSem2024);
  } catch (error) {
    console.error('Error fetching UGSecondSem2024:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getByAutonomousRollNo,
};
