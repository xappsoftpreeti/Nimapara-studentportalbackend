const mongoose = require('mongoose');

/**
 * UG 2025 master identity document.
 * Collection lives in the nimapara-repair database only.
 */
const UG2025BatchSchema = new mongoose.Schema(
  {
    batch: {
      type: String,
      required: true,
      default: '2025',
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
    collection: '2025batch-UG',
  }
);

UG2025BatchSchema.index({ autonomousRollNo: 1 }, { unique: true });
UG2025BatchSchema.index({ collegeRollNo: 1 });
UG2025BatchSchema.index({ department: 1 });
UG2025BatchSchema.index({ abcId: 1 }, { sparse: true });

module.exports = mongoose.model('UG2025Batch', UG2025BatchSchema, '2025batch-UG');
