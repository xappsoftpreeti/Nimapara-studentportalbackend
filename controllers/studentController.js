const {
  findStudentByRoll,
  findStudentRecord,
  formatAdmitCardData,
  enrichStudentRecord,
} = require('../utils/studentLookup');
const { getAdmitCardData } = require('../utils/admitCardService');

const getAdmitCard = async (req, res) => {
  try {
    const { autonomousRollNo, semester, studentType } = req.query;

    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Autonomous Roll No is required' });
    }

    const admitCardData = await getAdmitCardData(autonomousRollNo.trim(), {
      semesterKey: semester?.trim() || null,
      studentType: studentType?.trim() || null,
    });

    if (!admitCardData) {
      const { student, studentType: resolvedType } = await findStudentByRoll(autonomousRollNo.trim());
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      const fallback = await formatAdmitCardData(student, resolvedType);
      return res.json({
        ...fallback,
        profileImage: null,
        subjects: [],
        availableSemesters: [],
      });
    }

    if (admitCardData.notFound) {
      return res.status(404).json({
        message: 'Semester data not found for this student',
        availableSemesters: admitCardData.availableSemesters,
      });
    }

    res.json({
      ...admitCardData,
      profileImage: null,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
};

const getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not found in token' });
    }

    const { autonomousRollNo } = req.user;
    if (!autonomousRollNo) {
      return res.status(400).json({
        message: 'Invalid token data - missing roll number',
        received: req.user,
      });
    }

    const { student, studentType: resolvedType } = await findStudentByRoll(autonomousRollNo);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const studentData = await enrichStudentRecord(student, resolvedType);
    studentData.profileImage = null;
    res.json(studentData);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
};

const searchStudent = async (req, res) => {
  try {
    const { autonomousRollNo } = req.query;

    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Autonomous Roll No is required' });
    }

    const { student, studentType } = await findStudentByRoll(autonomousRollNo);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const result = await enrichStudentRecord(student, studentType);
    result.profileImage = null;
    res.json({
      studentType,
      student: result,
      ABC_ID: result.abcId || result.ABC_ID || null,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
};

const bulkUpdateDob = async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.students;

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({
        message: 'Request body must be an array of student records or an object with a students array',
      });
    }

    const summary = {
      total: payload.length,
      updated: 0,
      modifiedDocs: 0,
      notFound: [],
      skipped: [],
      errors: [],
    };

    for (const entry of payload) {
      try {
        const rollNo =
          entry?.CollegeRollNo ||
          entry?.['College Roll No'] ||
          entry?.RollNo ||
          entry?.['Roll No'] ||
          entry?.autonomousRollNo ||
          entry?.['Autonomous Roll No'];

        const dob = entry?.DateOfBirth || entry?.DOB || entry?.dob;

        if (!rollNo || !dob) {
          summary.skipped.push({
            entry,
            reason: 'Missing roll number or DateOfBirth/DOB',
          });
          continue;
        }

        const { student } = await findStudentRecord(String(rollNo).trim());
        if (!student) {
          summary.notFound.push({ rollNo, dob });
          continue;
        }

        student.dob = String(dob).trim();
        await student.save();
        summary.updated += 1;
        summary.modifiedDocs += 1;
      } catch (innerError) {
        summary.errors.push({
          entry,
          error: innerError.message || 'Unknown error',
        });
      }
    }

    res.json({
      message: 'Bulk DOB update completed',
      summary,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const testUploadRoute = (req, res) => {
  res.json({ message: 'Upload route is accessible', path: '/api/students/upload-image' });
};

const uploadImage = async (req, res) => {
  try {
    const { autonomousRollNo } = req.user || {};
    const { image } = req.body;

    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Invalid token data - missing roll number' });
    }

    const { student } = await findStudentByRoll(autonomousRollNo);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (!image) {
      return res.status(400).json({ message: 'Image data is required' });
    }

    if (!String(image).startsWith('data:image/')) {
      return res.status(400).json({ message: 'Invalid image data. Please provide a valid base64 image.' });
    }

    return res.json({
      message: 'Profile photo is stored only on this device. ABC ID is saved in the database.',
      profileImage: image,
      persisted: false,
    });
  } catch (error) {
    console.error('Error uploading image:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { autonomousRollNo } = req.user || {};
    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Invalid token data - missing roll number' });
    }

    const { student } = await findStudentByRoll(autonomousRollNo);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      message: 'Profile image removed from this device only. Nothing was stored in the database.',
      persisted: false,
    });
  } catch (error) {
    console.error('Error deleting image:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAdmitCard,
  getProfile,
  searchStudent,
  bulkUpdateDob,
  testUploadRoute,
  uploadImage,
  deleteImage,
};
