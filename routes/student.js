const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');
const abcIdController = require('../controllers/abcIdController');
const marksheetController = require('../controllers/marksheetController');
const ugSecondSem2024Controller = require('../controllers/ugSecondSem2024Controller');
const pgSecondSem2024Controller = require('../controllers/pgSecondSem2024Controller');
const pgAllSemestersController = require('../controllers/pgAllSemestersController');
const feePaymentController = require('../controllers/feePaymentController');

const router = express.Router();

router.post(
  '/auth/login',
  [
    body('autonomousRollNo', 'Roll No is required').optional().not().isEmpty(),
    body('rollNo', 'Roll No is required').optional().not().isEmpty(),
    body('dob', 'Date of Birth is required').not().isEmpty(),
  ],
  authController.login
);

router.get('/students/admit-card', studentController.getAdmitCard);
router.get('/students/profile', auth, studentController.getProfile);
router.get('/students/search', studentController.searchStudent);
router.get('/students/test-upload-route', studentController.testUploadRoute);
router.post('/students/upload-image', auth, studentController.uploadImage);
router.delete('/students/delete-image', auth, studentController.deleteImage);

router.post('/abc-id/submit', auth, abcIdController.submitAbcId);
router.get('/abc-id/my-submission', auth, abcIdController.getMySubmission);
router.get('/abc-id/submission/:autonomousRollNo', abcIdController.getSubmissionByRoll);

router.get('/marksheet/student/:studentId', marksheetController.getByStudentId);
router.get('/marksheet/autonomous/:autonomousRollNo', marksheetController.getByAutonomousRollNo);
router.get('/marksheet/:id', marksheetController.getById);

router.get(
  '/ug-2ndsem2024/autonomous/:autonomousRollNo',
  ugSecondSem2024Controller.getByAutonomousRollNo
);
router.get(
  '/pg-2ndsem2024/autonomous/:autonomousRollNo',
  pgSecondSem2024Controller.getByAutonomousRollNo
);

router.get('/pg/all-semesters/autonomous/:autonomousRollNo', pgAllSemestersController.getByAutonomousRollNo);
router.get('/pg/all-semesters/verify/:slNo', pgAllSemestersController.verifyBySlNo);
router.get('/pg/all-semesters/roll/:rollNo', pgAllSemestersController.getByRollNo);
router.get('/pg/all-semesters', pgAllSemestersController.listAll);

router.get('/fee-payment/config', auth, feePaymentController.getConfig);
router.post('/fee-payment/create-order', auth, feePaymentController.createOrder);
router.post(
  '/fee-payment/verify',
  auth,
  [
    body('razorpay_order_id').notEmpty(),
    body('razorpay_payment_id').notEmpty(),
    body('razorpay_signature').notEmpty(),
  ],
  feePaymentController.verifyPayment
);
router.get('/fee-payment/my-payments', auth, feePaymentController.getMyPayments);

module.exports = router;
