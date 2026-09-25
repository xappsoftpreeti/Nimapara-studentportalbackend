const mongoose = require('mongoose');

const FeePaymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    studentType: {
      type: String,
      required: true,
    },
    autonomousRollNo: {
      type: String,
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: false,
    },
    academicYear: {
      type: String,
      required: true,
    },
    yearLevel: {
      type: String,
      required: true,
      enum: ['2', '3'],
    },
    yearLabel: {
      type: String,
      required: true,
    },
    stream: {
      type: String,
      required: true,
      enum: ['arts', 'science', 'commerce'],
    },
    category: {
      type: String,
      required: true,
      enum: ['boys', 'girls', 'scStPh'],
    },
    lineItems: [
      {
        slNo: Number,
        name: String,
        amount: Number,
      },
    ],
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed'],
      default: 'created',
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'feepayments',
  }
);

FeePaymentSchema.index({ autonomousRollNo: 1, academicYear: 1, yearLevel: 1, status: 1 });

module.exports = mongoose.model('FeePayment', FeePaymentSchema, 'feepayments');
