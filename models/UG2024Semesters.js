const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    subjectName: { type: String, required: true, trim: true },
    courseType: { type: String, required: false, trim: true },
    credit: { type: Number, required: false },
    theory: { type: Number, required: false },
    internal: { type: Number, required: false },
    practical: { type: Number, required: false },
    marks: { type: Number, required: false },
    grade: { type: String, required: false, trim: true },
    gradePoint: { type: Number, required: false },
    creditPoint: { type: Number, required: false },
  },
  { _id: false }
);

function createUG2024SemesterModel(modelName, collectionName, defaultSemester) {
  const schema = new mongoose.Schema(
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UG2024Batch',
        required: true,
      },
      batch: { type: String, default: '2024', trim: true },
      programme: { type: String, default: 'UG', trim: true },
      autonomousRollNo: {
        type: String,
        required: true,
        trim: true,
      },
      collegeRollNo: { type: String, default: '', trim: true },
      name: { type: String, default: '', trim: true },
      dob: { type: String, default: '', trim: true },
      abcId: { type: String, default: null, trim: true },
      department: { type: String, default: '', trim: true },
      stream: { type: String, default: '', trim: true },
      registrationNumber: { type: String, default: '', trim: true },
      semester: {
        type: Number,
        required: true,
        default: defaultSemester,
      },
      examcode: {
        type: String,
        default: '',
        trim: true,
      },
      courses: {
        type: [courseSchema],
        default: [],
      },
      totalCredits: { type: Number, required: false },
      totalCreditPoints: { type: Number, required: false },
      sgpa: { type: Number, required: false },
      percentage: { type: Number, required: false },
      classification: { type: String, required: false, trim: true },
    },
    {
      timestamps: true,
      collection: collectionName,
    }
  );

  schema.index({ student: 1 }, { unique: true });
  schema.index({ autonomousRollNo: 1 }, { unique: true });
  schema.index({ examcode: 1 });
  schema.index({ semester: 1 });

  return mongoose.model(modelName, schema, collectionName);
}

const UG2024SecondSem = createUG2024SemesterModel('UG2024SecondSem', '2nd-sem-2024', 2);
const UG2024ThirdSem = createUG2024SemesterModel('UG2024ThirdSem', '3rd-sem-2024', 3);
const UG2024FourthSem = createUG2024SemesterModel('UG2024FourthSem', '4th-sem-2024', 4);

module.exports = {
  courseSchema,
  createUG2024SemesterModel,
  UG2024SecondSem,
  UG2024ThirdSem,
  UG2024FourthSem,
};
