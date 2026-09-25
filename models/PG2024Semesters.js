const mongoose = require('mongoose');
const { PGSubjectSchema } = require('./pgSubjectSchema');

const PGSemesterBlockSchema = new mongoose.Schema(
  {
    examcode: { type: String, default: '' },
    subjects: { type: [PGSubjectSchema], default: [] },
    grandTotal: { type: mongoose.Schema.Types.Mixed, required: false },
    totalCredits: { type: Number, required: false },
    totalCreditPoints: { type: Number, required: false },
    totalMarks: { type: Number, required: false },
    sgpa: { type: mongoose.Schema.Types.Mixed, required: false },
    grade: { type: String, required: false },
    gradePoint: { type: mongoose.Schema.Types.Mixed, required: false },
    percentage: { type: mongoose.Schema.Types.Mixed, required: false },
    classification: { type: String, required: false },
    performance: { type: String, required: false },
  },
  { _id: false }
);

const linkFields = {
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PG2024Batch',
    required: true,
  },
  autonomousRollNo: { type: String, required: true, trim: true },
};

function createPG2024SemesterModel(modelName, collectionName, defaultSemester) {
  const schema = new mongoose.Schema(
    {
      ...linkFields,
      semester: { type: Number, required: true, default: defaultSemester },
      examcode: { type: String, default: '', trim: true },
      subjects: { type: [PGSubjectSchema], default: [] },
      grandTotal: { type: mongoose.Schema.Types.Mixed, required: false },
      totalCredits: { type: Number, required: false },
      totalCreditPoints: { type: Number, required: false },
      totalMarks: { type: Number, required: false },
      sgpa: { type: mongoose.Schema.Types.Mixed, required: false },
      grade: { type: String, required: false },
      gradePoint: { type: mongoose.Schema.Types.Mixed, required: false },
      percentage: { type: mongoose.Schema.Types.Mixed, required: false },
      classification: { type: String, required: false },
      performance: { type: String, required: false },
    },
    { timestamps: true, collection: collectionName }
  );

  schema.index({ student: 1 }, { unique: true });
  schema.index({ autonomousRollNo: 1 }, { unique: true });
  schema.index({ examcode: 1 });
  return mongoose.model(modelName, schema, collectionName);
}

const PG2024FirstSem = createPG2024SemesterModel('PG2024FirstSem', '1st-sem-2024-PG', 1);
const PG2024SecondSem = createPG2024SemesterModel('PG2024SecondSem', '2nd-sem-2024-PG', 2);
const PG2024ThirdSem = createPG2024SemesterModel('PG2024ThirdSem', '3rd-sem-2024-PG', 3);
const PG2024FourthSem = createPG2024SemesterModel('PG2024FourthSem', '4th-sem-2024-PG', 4);

const PG2024AllSemestersSchema = new mongoose.Schema(
  {
    ...linkFields,
    semesters: {
      sem1: { type: PGSemesterBlockSchema, default: undefined },
      sem2: { type: PGSemesterBlockSchema, default: undefined },
      sem3: { type: PGSemesterBlockSchema, default: undefined },
      sem4: { type: PGSemesterBlockSchema, default: undefined },
    },
    grandTotal: { type: Number, required: false },
    semesterTotals: {
      sem1: { type: Number, required: false },
      sem2: { type: Number, required: false },
      sem3: { type: Number, required: false },
      sem4: { type: Number, required: false },
    },
    maximumMark: { type: Number, required: false },
    percentage: { type: Number, required: false },
  },
  { timestamps: true, collection: 'all-semesters-2024-PG' }
);

PG2024AllSemestersSchema.index({ student: 1 }, { unique: true });
PG2024AllSemestersSchema.index({ autonomousRollNo: 1 }, { unique: true });

const PG2024AllSemesters = mongoose.model(
  'PG2024AllSemesters',
  PG2024AllSemestersSchema,
  'all-semesters-2024-PG'
);

module.exports = {
  PG2024FirstSem,
  PG2024SecondSem,
  PG2024ThirdSem,
  PG2024FourthSem,
  PG2024AllSemesters,
};
