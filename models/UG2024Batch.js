const mongoose = require('mongoose');

/**
 * UG 2024 master identity document.
 * Collection lives in the nimapara-repair database only.
 * Semester marks do not belong here.
 */
const UG2024BatchSchema = new mongoose.Schema(
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
      default: 'UG',
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
    stream: {
      type: String,
      default: '',
      trim: true,
    },
    registrationNumber: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: '2024batch-UG',
  }
);

UG2024BatchSchema.index({ autonomousRollNo: 1 }, { unique: true });
UG2024BatchSchema.index({ collegeRollNo: 1 });
UG2024BatchSchema.index({ department: 1 });
UG2024BatchSchema.index({ abcId: 1 }, { sparse: true });

module.exports = mongoose.model('UG2024Batch', UG2024BatchSchema, '2024batch-UG');
