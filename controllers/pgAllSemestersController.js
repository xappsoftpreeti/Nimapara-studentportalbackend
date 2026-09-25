const PG2024Batch = require('../models/PG2024Batch');
const { PG2024AllSemesters } = require('../models/PG2024Semesters');
const { enrichPGAllSemestersDoc } = require('../utils/pgOverallMarks');

const isValid2026SlNo = (value) => /^2026\d{5}$/.test(String(value || '').trim());

const mergeMasterAndCombined = (combined, master) => {
  const plain = typeof combined.toObject === 'function' ? combined.toObject() : { ...combined };
  const identity = master && typeof master.toObject === 'function' ? master.toObject() : master || {};
  return enrichPGAllSemestersDoc({
    ...plain,
    studentName: identity.name || '',
    rollNo: identity.collegeRollNo || identity.autonomousRollNo || plain.autonomousRollNo,
    registrationNumber: identity.registrationNumber || '',
    department: identity.department || identity.course || '',
    course: identity.course || identity.department || '',
    dob: identity.dob || '',
    graduationBoard: identity.graduationBoard || '',
    gradeSheetSlNo: identity.gradeSheetSlNo || '',
    barcode: identity.barcode || '',
  });
};

const loadByRoll = async (autonomousRollNo) => {
  const combined = await PG2024AllSemesters.findOne({ autonomousRollNo });
  if (!combined) return null;
  const master = await PG2024Batch.findOne({ autonomousRollNo: combined.autonomousRollNo });
  return mergeMasterAndCombined(combined, master);
};

const getByAutonomousRollNo = async (req, res) => {
  try {
    const autonomousRollNo = req.params.autonomousRollNo?.trim();
    if (!autonomousRollNo) {
      return res.status(400).json({ message: 'Autonomous Roll No is required' });
    }

    const result =
      (await loadByRoll(autonomousRollNo)) ||
      (await (async () => {
        const master = await PG2024Batch.findOne({
          $or: [{ autonomousRollNo }, { collegeRollNo: autonomousRollNo }],
        });
        if (!master) return null;
        return loadByRoll(master.autonomousRollNo);
      })());

    if (!result) {
      return res.status(404).json({ message: 'PG student record not found' });
    }

    return res.json(result);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const verifyBySlNo = async (req, res) => {
  try {
    const slNo = req.params.slNo?.trim();
    if (!isValid2026SlNo(slNo)) {
      return res.status(400).json({ message: 'Invalid serial number' });
    }

    const master = await PG2024Batch.findOne({ gradeSheetSlNo: slNo });
    if (!master) {
      return res.status(404).json({ message: 'No record matches this serial number' });
    }

    const enriched = await loadByRoll(master.autonomousRollNo);
    if (!enriched) {
      return res.status(404).json({ message: 'No record matches this serial number' });
    }

    return res.json({
      gradeSheetSlNo: enriched.gradeSheetSlNo || slNo,
      studentName: enriched.studentName || '',
      rollNo: enriched.rollNo || enriched.autonomousRollNo || '',
      grandTotal: enriched.grandTotal ?? null,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getByRollNo = async (req, res) => {
  try {
    const rollNo = req.params.rollNo?.trim();
    if (!rollNo) {
      return res.status(400).json({ message: 'Roll No is required' });
    }

    const master = await PG2024Batch.findOne({
      $or: [{ collegeRollNo: rollNo }, { autonomousRollNo: rollNo }],
    });
    if (!master) {
      return res.status(404).json({ message: 'PG student record not found' });
    }

    const result = await loadByRoll(master.autonomousRollNo);
    if (!result) {
      return res.status(404).json({ message: 'PG student record not found' });
    }

    return res.json(result);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const listAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) {
      filter.department = req.query.department;
    }

    const masters = await PG2024Batch.find(filter).sort({ department: 1, collegeRollNo: 1 });
    const rolls = masters.map((m) => m.autonomousRollNo);
    const combined = await PG2024AllSemesters.find({ autonomousRollNo: { $in: rolls } });
    const byRoll = new Map(combined.map((doc) => [doc.autonomousRollNo, doc]));

    const list = masters
      .map((master) => {
        const row = byRoll.get(master.autonomousRollNo);
        if (!row) return null;
        const enriched = mergeMasterAndCombined(row, master);
        return {
          autonomousRollNo: enriched.autonomousRollNo,
          rollNo: enriched.rollNo,
          registrationNumber: enriched.registrationNumber,
          studentName: enriched.studentName,
          department: enriched.department,
          grandTotal: enriched.grandTotal,
          maximumMark: enriched.maximumMark,
          percentage: enriched.percentage,
        };
      })
      .filter(Boolean);

    return res.json({ count: list.length, results: list });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getByAutonomousRollNo,
  verifyBySlNo,
  getByRollNo,
  listAll,
};
