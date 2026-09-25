const express = require('express');
const { body } = require('express-validator');
const adminAuth = require('../middleware/adminAuth');
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');
const abcIdController = require('../controllers/abcIdController');
const marksheetController = require('../controllers/marksheetController');
const ugIngestController = require('../controllers/ugIngestController');
const pgIngestController = require('../controllers/pgIngestController');

const router = express.Router();

router.post(
  '/auth/admin-login',
  [
    body('username', 'Username is required').not().isEmpty(),
    body('password', 'Password is required').not().isEmpty(),
  ],
  authController.adminLogin
);

router.post('/students/bulk-update-dob', studentController.bulkUpdateDob);

router.get('/abc-id/submissions', adminAuth, abcIdController.listSubmissions);
router.patch('/abc-id/verify/:id', adminAuth, abcIdController.verifySubmission);
router.delete('/abc-id/submission/:id', adminAuth, abcIdController.deleteSubmission);
router.get('/abc-id/stats', adminAuth, abcIdController.getStats);

router.post('/marksheet/bulk-upload', adminAuth, marksheetController.bulkUpload);
router.delete('/marksheet/all/clear', adminAuth, marksheetController.clearAll);
router.delete('/marksheet/:id', adminAuth, marksheetController.deleteById);

router.post('/ug/masters', adminAuth, ugIngestController.uploadMasters);
router.post('/ug/marksheets', adminAuth, ugIngestController.uploadMarksheets);
router.post('/pg/masters', adminAuth, pgIngestController.uploadMasters);
router.post('/pg/marksheets', adminAuth, pgIngestController.uploadMarksheets);

module.exports = router;
