const mongoose = require('mongoose');
const PG2024BatchSchema = new mongoose.Schema(
  {
    batch: {
      type: String,
      required: true,
      default: '2024',
      trim: true,
    },
    programme: {
      type: String,
      required: true,
      default: 'PG',
      trim: true,
    },
    autonomousRollNo: {
      type: String,
      required: true,
      trim: true,
    },
    collegeRollNo: {
      type: String,
      default: '',
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    dob: {
      type: String,
      default: '',
      trim: true,
    },
    abcId: {
      type: String,
      default: null,
      trim: true,
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    course: {
      type: String,
      default: '',
      trim: true,
    },
    graduationBoard: {
      type: String,
      default: '',
      trim: true,
    },
    registrationNumber: {
      type: String,
      default: '',
      trim: true,
    },
    barcode: {
      type: String,
      default: '',
      trim: true,
    },
    gradeSheetSlNo: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: '2024batch-PG',
  }
);

PG2024BatchSchema.index({ autonomousRollNo: 1 }, { unique: true });
PG2024BatchSchema.index({ collegeRollNo: 1 });
PG2024BatchSchema.index({ department: 1 });
PG2024BatchSchema.index({ abcId: 1 }, { sparse: true });
PG2024BatchSchema.index({ gradeSheetSlNo: 1 }, { sparse: true });

module.exports = mongoose.model('PG2024Batch', PG2024BatchSchema, '2024batch-PG');
