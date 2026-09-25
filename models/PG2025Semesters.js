const mongoose = require('mongoose');

const paperSubjectSchema = new mongoose.Schema(
  {
    paper: {
      code: { type: String, default: '' },
      title: { type: String, default: '' },
    },
  },
  { _id: false }
);

const linkFields = {
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PG2025Batch',
    required: true,
  },
  autonomousRollNo: { type: String, required: true, trim: true },
};

function createPG2025SemesterModel(modelName, collectionName, defaultSemester) {
  const schema = new mongoose.Schema(
    {
      ...linkFields,
      semester: { type: Number, required: true, default: defaultSemester },
      examcode: { type: String, default: '', trim: true },
      subjects: { type: [paperSubjectSchema], default: [] },
    },
    { timestamps: true, collection: collectionName }
  );

  schema.index({ student: 1 }, { unique: true });
  schema.index({ autonomousRollNo: 1 }, { unique: true });
  return mongoose.model(modelName, schema, collectionName);
}

const PG2025FirstSem = createPG2025SemesterModel('PG2025FirstSem', '1st-sem-2025-PG', 1);
const PG2025SecondSem = createPG2025SemesterModel('PG2025SecondSem', '2nd-sem-2025-PG', 2);

module.exports = {
  PG2025FirstSem,
  PG2025SecondSem,
};
