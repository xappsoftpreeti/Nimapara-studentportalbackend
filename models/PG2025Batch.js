const mongoose = require('mongoose');

const PG2025BatchSchema = new mongoose.Schema(
  {
    batch: { type: String, required: true, default: '2025', trim: true },
    programme: { type: String, required: true, default: 'PG', trim: true },
    autonomousRollNo: { type: String, required: true, trim: true },
    collegeRollNo: { type: String, default: '', trim: true },
    name: { type: String, default: '', trim: true },
    dob: { type: String, default: '', trim: true },
    abcId: { type: String, default: null, trim: true },
    department: { type: String, default: '', trim: true },
    course: { type: String, default: '', trim: true },
    stream: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
    collection: '2025batch-PG',
  }
);

PG2025BatchSchema.index({ autonomousRollNo: 1 }, { unique: true });
PG2025BatchSchema.index({ collegeRollNo: 1 });
PG2025BatchSchema.index({ department: 1 });
PG2025BatchSchema.index({ abcId: 1 }, { sparse: true });

module.exports = mongoose.model('PG2025Batch', PG2025BatchSchema, '2025batch-PG');
