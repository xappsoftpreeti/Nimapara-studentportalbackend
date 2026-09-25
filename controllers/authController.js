const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { findStudentByRoll, enrichStudentRecord } = require('../utils/studentLookup');

const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
};

const getStoredDob = (student) => {
  const value = student?.dob ?? student?.DOB;
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const dobMatches = (student, trimmedDob) => {
  const storedDob = getStoredDob(student);
  if (!storedDob) return true;
  return storedDob === trimmedDob;
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rollNoInput = req.body.autonomousRollNo || req.body.rollNo;
    const { dob } = req.body;

    if (!rollNoInput) {
      return res.status(400).json({
        message: 'Roll No (Autonomous Roll No, Roll No, or College Roll No) is required',
      });
    }

    const trimmedRollNo = rollNoInput?.trim();
    const trimmedDob = dob?.trim();

    console.log('Login attempt:', { rollNo: trimmedRollNo, dob: trimmedDob });

    const { student, studentType } = await findStudentByRoll(trimmedRollNo);
    const studentRecord = student ? await enrichStudentRecord(student, studentType) : null;

    console.log('Query results:', {
      found: !!studentRecord,
      studentType,
      storedDob: studentRecord ? getStoredDob(studentRecord) : null,
    });

    if (!studentRecord) {
      return res.status(400).json({ message: 'Invalid credentials. Roll number not found.' });
    }

    if (!dobMatches(studentRecord, trimmedDob)) {
      return res.status(400).json({
        message: 'Invalid credentials. Date of birth does not match our records.',
      });
    }

    const autonomousRollNo =
      studentRecord.autonomousRollNo || studentRecord['Autonomous Roll No'] || trimmedRollNo;

    const payload = {
      user: {
        id: studentRecord._id,
        autonomousRollNo,
        studentType,
        name:
          studentRecord.name ||
          studentRecord['Name of the Students'] ||
          studentRecord['Applicant Name'] ||
          studentRecord.Name,
      },
    };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: payload.user,
        message: 'Login successful',
      });
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
};

const adminLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
      return res.status(400).json({ message: 'Invalid admin credentials' });
    }

    const payload = {
      user: {
        id: 'admin',
        username,
        role: 'admin',
        name: 'Administrator',
      },
    };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: payload.user,
        message: 'Admin login successful',
      });
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
};

module.exports = {
  login,
  adminLogin,
};
