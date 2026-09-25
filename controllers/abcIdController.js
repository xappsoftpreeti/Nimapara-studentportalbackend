const {
  findStudentByRoll,
  findMasterById,
  findByAbcId,
  listMastersWithAbcId,
} = require('../utils/studentLookup');

const submitAbcId = async (req, res) => {
  try {
    const { ABC_ID } = req.body;
    const { autonomousRollNo } = req.user;

    if (!ABC_ID) {
      return res.status(400).json({ message: 'ABC_ID is required' });
    }

    if (String(ABC_ID).trim().length < 5) {
      return res.status(400).json({ message: 'ABC_ID must be at least 5 characters' });
    }

    const detected = await findStudentByRoll(autonomousRollNo);
    const student = detected.student;

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const duplicate = await findByAbcId(ABC_ID, { excludeRoll: student.autonomousRollNo });
    if (duplicate) {
      return res.status(400).json({
        message: 'This ABC_ID is already registered by another student',
      });
    }

    const hadAbc = !!student.abcId;
    student.abcId = String(ABC_ID).trim();
    await student.save();

    return res.json({
      message: hadAbc ? 'ABC_ID updated successfully' : 'ABC_ID submitted successfully',
      action: hadAbc ? 'updated' : 'created',
      ABC_ID: student.abcId,
    });
  } catch (error) {
    console.error('ABC_ID submission error:', error.message);
    return res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};

const getMySubmission = async (req, res) => {
  try {
    const { autonomousRollNo } = req.user;
    const detected = await findStudentByRoll(autonomousRollNo);
    if (!detected.student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const abcId = detected.student.abcId || null;
    res.json({
      hasSubmitted: !!abcId,
      ABC_ID: abcId,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const listSubmissions = async (req, res) => {
  try {
    const submissions = await listMastersWithAbcId({
      department: req.query.department,
      search: req.query.search,
    });

    res.json({
      total: submissions.length,
      submissions,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSubmissionByRoll = async (req, res) => {
  try {
    const detected = await findStudentByRoll(req.params.autonomousRollNo);
    if (!detected.student || !detected.student.abcId) {
      return res.status(404).json({ message: 'No ABC_ID submission found' });
    }

    res.json({
      autonomousRollNo: detected.student.autonomousRollNo,
      studentName: detected.student.name,
      department: detected.student.department,
      ABC_ID: detected.student.abcId,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifySubmission = async (req, res) => {
  try {
    const { student } = await findMasterById(req.params.id);
    if (!student || !student.abcId) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json({
      message: 'ABC_ID is stored on the student master',
      ABC_ID: student.abcId,
      autonomousRollNo: student.autonomousRollNo,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteSubmission = async (req, res) => {
  try {
    const { student } = await findMasterById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    student.abcId = null;
    await student.save();

    res.json({ message: 'ABC_ID removed from student master' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const getStats = async (req, res) => {
  try {
    const submissions = await listMastersWithAbcId();
    const byDepartmentMap = {};
    submissions.forEach((row) => {
      const key = row.department || 'Unknown';
      byDepartmentMap[key] = (byDepartmentMap[key] || 0) + 1;
    });

    res.json({
      total: submissions.length,
      byStatus: {
        submitted: submissions.length,
        verified: 0,
        rejected: 0,
      },
      byDepartment: Object.entries(byDepartmentMap).map(([_id, count]) => ({ _id, count })),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  submitAbcId,
  getMySubmission,
  listSubmissions,
  getSubmissionByRoll,
  verifySubmission,
  deleteSubmission,
  getStats,
};
