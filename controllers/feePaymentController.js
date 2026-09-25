const crypto = require('crypto');
const Razorpay = require('razorpay');
const { validationResult } = require('express-validator');
const FeePayment = require('../models/FeePayment');
const { FEE_ACADEMIC_YEAR, FEE_STRUCTURE } = require('../data/feeStructure2026');
const { findStudentRecord, formatStudentSummary } = require('../utils/studentLookup');

const STREAMS = ['arts', 'science', 'commerce'];
const CATEGORIES = ['boys', 'girls', 'scStPh'];
const YEAR_LEVELS = ['2', '3'];
const SCIENCE_DEPARTMENTS = new Set([
  'CHEMISTRY', 'PHYSICS', 'MATHEMATICS', 'MATH', 'BOTANY', 'ZOOLOGY',
  'GEOLOGY', 'BIOTECHNOLOGY', 'BIOTECH', 'COMPUTER SCIENCE', 'IT',
]);
const COMMERCE_DEPARTMENTS = new Set([
  'COMMERCE', 'ACCOUNTING', 'BBA', 'BBA ', 'BCA', 'BBA(CA)', 'MANAGEMENT',
]);

const normalizeKey = (value) => (value || '').toString().trim().toUpperCase();

const mapDepartmentToStream = (department, course, studentType) => {
  const dept = normalizeKey(department);
  const crs = normalizeKey(course);
  const type = normalizeKey(studentType);
  if (type === 'BBA' || dept.includes('BBA') || crs.includes('BBA')) return 'commerce';
  if (SCIENCE_DEPARTMENTS.has(dept) || SCIENCE_DEPARTMENTS.has(crs)) return 'science';
  if (COMMERCE_DEPARTMENTS.has(dept) || COMMERCE_DEPARTMENTS.has(crs)) return 'commerce';
  return 'arts';
};

const inferYearLevel = (student) => {
  const rollNo = (student['Roll No'] || student['College Roll No'] || student.autonomousRollNo || '').toString();
  const batch = (student.batch || '').toString();
  const batchMatch = rollNo.match(/(?:BA|BSC|BCOM|BBA|BBM)?-?(\d{2})-/i) || rollNo.match(/(\d{2})NAC/i);
  const admissionYear = batchMatch ? 2000 + parseInt(batchMatch[1], 10) : null;
  if (admissionYear) {
    const yearsSinceAdmission = new Date().getFullYear() - admissionYear;
    if (yearsSinceAdmission >= 2) return '3';
    if (yearsSinceAdmission >= 1) return '2';
  }
  if (batch === '2023' || batch === '23') return '3';
  if (batch === '2024' || batch === '24') return '2';
  return '2';
};

const isEligibleForUgFees = (studentType) => {
  const type = normalizeKey(studentType);
  return type === 'UG' || type === 'UG2025';
};

const readStudentField = (student, ...keys) => {
  for (const key of keys) {
    const value = student?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const normalizeCategory = (value) => {
  const key = normalizeKey(value);
  if (['BOYS', 'BOY', 'MALE', 'M', 'BOYS.'].includes(key)) return 'boys';
  if (['GIRLS', 'GIRL', 'FEMALE', 'F', 'GIRLS.'].includes(key)) return 'girls';
  if (key.includes('SC/ST') || key.includes('SC ST') || key === 'SC' || key === 'ST' || key.includes('PH')) {
    return 'scStPh';
  }
  if (value === 'boys' || value === 'girls' || value === 'scStPh') return value;
  return null;
};

const normalizeStream = (value) => {
  const key = normalizeKey(value);
  if (key.includes('SCIENCE') || key === 'SCI') return 'science';
  if (key.includes('COMMERCE') || key.includes('COM')) return 'commerce';
  if (key.includes('ARTS') || key === 'ART') return 'arts';
  if (['arts', 'science', 'commerce'].includes(value)) return value;
  return null;
};

const normalizeYearLevel = (value) => {
  const key = normalizeKey(value);
  if (key === '2' || key.includes('2ND') || key.includes('SECOND')) return '2';
  if (key === '3' || key.includes('3RD') || key.includes('THIRD')) return '3';
  if (value === '2' || value === '3') return value;
  return null;
};

const getFeeBreakdown = ({ yearLevel, stream, category }) => {
  if (!YEAR_LEVELS.includes(yearLevel)) throw new Error('Invalid year level. Must be 2 or 3.');
  if (!STREAMS.includes(stream)) throw new Error('Invalid stream. Must be arts, science, or commerce.');
  if (!CATEGORIES.includes(category)) throw new Error('Invalid category. Must be boys, girls, or scStPh.');
  const yearData = FEE_STRUCTURE.years[yearLevel];
  const lineItems = yearData.items.map((item) => ({
    slNo: item.slNo,
    name: item.name,
    amount: item.amounts[stream][category],
  }));
  return {
    academicYear: FEE_STRUCTURE.academicYear,
    yearLevel,
    yearLabel: yearData.label,
    stream,
    category,
    lineItems,
    total: lineItems.reduce((sum, item) => sum + item.amount, 0),
  };
};

const resolveStudentFeeAssignment = (student, studentType) => {
  const yearLevel =
    normalizeYearLevel(readStudentField(student, 'feeYearLevel', 'Fee Year', 'Year Level', 'yearLevel')) ||
    inferYearLevel(student);
  const stream =
    normalizeStream(readStudentField(student, 'feeStream', 'Fee Stream', 'Stream', 'stream')) ||
    mapDepartmentToStream(
      readStudentField(student, 'Department', 'Course'),
      readStudentField(student, 'Stream'),
      studentType
    );
  const category = normalizeCategory(
    readStudentField(student, 'feeCategory', 'Fee Category', 'Category', 'Gender', 'gender')
  );
  if (!category) {
    return {
      yearLevel,
      stream,
      category: null,
      error: 'Your fee category is not assigned yet. Please contact the college office.',
    };
  }
  return { yearLevel, stream, category, error: null };
};

const resolveStudentFeeBreakdown = (student, studentType) => {
  const assignment = resolveStudentFeeAssignment(student, studentType);
  if (assignment.error) return { assignment, breakdown: null };
  return {
    assignment,
    breakdown: getFeeBreakdown({
      yearLevel: assignment.yearLevel,
      stream: assignment.stream,
      category: assignment.category,
    }),
  };
};

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const categoryLabels = {
  boys: 'Boys',
  girls: 'Girls',
  scStPh: 'SC/ST/PH',
};

const streamLabels = {
  arts: 'Arts',
  science: 'Science',
  commerce: 'Commerce',
};

const buildFeeResponse = async (student, resolvedType, autonomousRollNo) => {
  const summary = formatStudentSummary(student, resolvedType);
  const eligible = isEligibleForUgFees(resolvedType);

  if (!eligible) {
    return {
      eligible: false,
      message: 'Fee payment is currently available only for +3 UG (2nd & 3rd year) students.',
      student: summary,
      academicYear: FEE_ACADEMIC_YEAR,
    };
  }

  const { assignment, breakdown } = resolveStudentFeeBreakdown(student, resolvedType);

  const paidPayments = await FeePayment.find({
    autonomousRollNo,
    academicYear: FEE_ACADEMIC_YEAR,
    status: 'paid',
  }).sort({ paidAt: -1 });

  if (assignment.error) {
    return {
      eligible: false,
      message: assignment.error,
      student: summary,
      academicYear: FEE_ACADEMIC_YEAR,
      feeAssignment: assignment,
      paidPayments,
    };
  }

  const alreadyPaid = paidPayments.some(
    (payment) => payment.yearLevel === assignment.yearLevel && payment.status === 'paid'
  );

  return {
    eligible: true,
    academicYear: FEE_ACADEMIC_YEAR,
    student: summary,
    feeAssignment: {
      yearLevel: assignment.yearLevel,
      yearLabel: breakdown.yearLabel,
      stream: assignment.stream,
      streamLabel: streamLabels[assignment.stream],
      category: assignment.category,
      categoryLabel: categoryLabels[assignment.category],
    },
    breakdown,
    alreadyPaid,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
    paymentsEnabled: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    paidPayments,
  };
};

const getConfig = async (req, res) => {
  try {
    const { autonomousRollNo, studentType } = req.user;
    const { student, studentType: resolvedType } = await findStudentRecord(autonomousRollNo, studentType);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const response = await buildFeeResponse(student, resolvedType, autonomousRollNo);
    res.json(response);
  } catch (error) {
    console.error('Fee config error:', error.message);
    res.status(500).json({ message: 'Failed to load fee details' });
  }
};

const createOrder = async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({
        message: 'Payment gateway is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to config.env.',
      });
    }

    const { autonomousRollNo, studentType } = req.user;
    const { student, studentType: resolvedType } = await findStudentRecord(autonomousRollNo, studentType);

    if (!student || !isEligibleForUgFees(resolvedType)) {
      return res.status(400).json({ message: 'Fee payment not available for your course type' });
    }

    const { assignment, breakdown } = resolveStudentFeeBreakdown(student, resolvedType);

    if (assignment.error || !breakdown) {
      return res.status(400).json({ message: assignment.error || 'Fee not assigned for your profile' });
    }

    const { yearLevel, stream, category } = assignment;

    const existingPaid = await FeePayment.findOne({
      autonomousRollNo,
      academicYear: FEE_ACADEMIC_YEAR,
      yearLevel,
      status: 'paid',
    });

    if (existingPaid) {
      return res.status(400).json({
        message: `You have already paid ${breakdown.yearLabel} fees for ${FEE_ACADEMIC_YEAR}.`,
        payment: existingPaid,
      });
    }

    const summary = formatStudentSummary(student, resolvedType);
    const receipt = `fee_${autonomousRollNo}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '_');

    const order = await razorpay.orders.create({
      amount: breakdown.total * 100,
      currency: 'INR',
      receipt,
      notes: {
        autonomousRollNo,
        academicYear: FEE_ACADEMIC_YEAR,
        yearLevel,
        stream,
        category,
      },
    });

    const paymentRecord = await FeePayment.create({
      studentId: summary.id,
      studentType: resolvedType,
      autonomousRollNo,
      studentName: summary.name,
      department: summary.department,
      academicYear: FEE_ACADEMIC_YEAR,
      yearLevel,
      yearLabel: breakdown.yearLabel,
      stream,
      category,
      lineItems: breakdown.lineItems,
      amount: breakdown.total,
      razorpayOrderId: order.id,
      status: 'created',
    });

    res.json({
      orderId: order.id,
      amount: breakdown.total,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      breakdown,
      paymentRecordId: paymentRecord._id,
      prefill: {
        name: summary.name,
      },
    });
  } catch (error) {
    console.error('Create order error:', error.message);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ message: 'Payment gateway is not configured' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const { autonomousRollNo } = req.user;

    const paymentRecord = await FeePayment.findOne({
      razorpayOrderId: razorpay_order_id,
      autonomousRollNo,
    });

    if (!paymentRecord) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    if (paymentRecord.status === 'paid') {
      return res.json({ message: 'Payment already verified', payment: paymentRecord });
    }

    const bodyStr = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(bodyStr)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      paymentRecord.status = 'failed';
      await paymentRecord.save();
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    paymentRecord.status = 'paid';
    paymentRecord.razorpayPaymentId = razorpay_payment_id;
    paymentRecord.razorpaySignature = razorpay_signature;
    paymentRecord.paidAt = new Date();
    await paymentRecord.save();

    res.json({
      message: 'Payment successful',
      payment: paymentRecord,
    });
  } catch (error) {
    console.error('Verify payment error:', error.message);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const { autonomousRollNo } = req.user;
    const payments = await FeePayment.find({ autonomousRollNo }).sort({ createdAt: -1 });
    res.json({ payments });
  } catch (error) {
    console.error('Payment history error:', error.message);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
};

module.exports = {
  getConfig,
  createOrder,
  verifyPayment,
  getMyPayments,
};
