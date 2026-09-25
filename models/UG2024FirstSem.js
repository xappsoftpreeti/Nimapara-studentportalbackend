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

/**
 * UG 2024 semester 1 marksheet.
 * Linked to 2024batch-UG and copies master identity fields (no photo).
 */
const UG2024FirstSemSchema = new mongoose.Schema(
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
      default: 1,
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
    collection: 'firstsem-2024',
  }
);

UG2024FirstSemSchema.index({ student: 1 }, { unique: true });
UG2024FirstSemSchema.index({ autonomousRollNo: 1 }, { unique: true });
UG2024FirstSemSchema.index({ semester: 1 });

module.exports = mongoose.model('UG2024FirstSem', UG2024FirstSemSchema, 'firstsem-2024');
