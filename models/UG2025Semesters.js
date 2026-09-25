const mongoose = require('mongoose');
const { courseSchema } = require('./UG2024Semesters');

function createUG2025SemesterModel(modelName, collectionName, defaultSemester) {
  const schema = new mongoose.Schema(
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UG2025Batch',
        required: true,
      },
      batch: { type: String, default: '2025', trim: true },
      programme: { type: String, default: 'UG', trim: true },
      autonomousRollNo: { type: String, required: true, trim: true },
      collegeRollNo: { type: String, default: '', trim: true },
      name: { type: String, default: '', trim: true },
      dob: { type: String, default: '', trim: true },
      abcId: { type: String, default: null, trim: true },
      department: { type: String, default: '', trim: true },
      stream: { type: String, default: '', trim: true },
      registrationNumber: { type: String, default: '', trim: true },
      semester: { type: Number, required: true, default: defaultSemester },
      examcode: { type: String, default: '', trim: true },
      courses: { type: [courseSchema], default: [] },
      totalCredits: { type: Number, required: false },
      totalCreditPoints: { type: Number, required: false },
      sgpa: { type: Number, required: false },
      percentage: { type: Number, required: false },
      classification: { type: String, required: false, trim: true },
    },
    { timestamps: true, collection: collectionName }
  );

  schema.index({ student: 1 }, { unique: true });
  schema.index({ autonomousRollNo: 1 }, { unique: true });
  schema.index({ examcode: 1 });
  return mongoose.model(modelName, schema, collectionName);
}

const UG2025FirstSem = createUG2025SemesterModel('UG2025FirstSem', '1st-sem-2025', 1);
const UG2025SecondSem = createUG2025SemesterModel('UG2025SecondSem', '2nd-sem-2025', 2);

module.exports = {
  UG2025FirstSem,
  UG2025SecondSem,
};
