const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const enrollmentController = require('../controllers/enrollmentController');
const auth = require('../middleware/auth');

// Validation rules
const progressValidation = [
  body('lessonId')
    .optional()
    .isMongoId()
    .withMessage('ID bài học không hợp lệ'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thời gian học phải là số nguyên không âm')
];

// Public/Student routes - require authentication
router.post('/', auth.required, enrollmentController.enrollInCourse);
router.post('/courses/:courseId/enroll', auth.required, enrollmentController.enrollInCourse);
router.get('/my-courses', auth.required, enrollmentController.getUserEnrollments);
router.get('/courses/:courseId', auth.required, enrollmentController.getEnrollmentDetails);
router.get('/course/:courseId', auth.required, enrollmentController.getEnrollmentDetails);
router.put('/courses/:courseId/progress', auth.required, progressValidation, enrollmentController.updateProgress);
router.delete('/courses/:courseId', auth.required, enrollmentController.cancelEnrollment);
router.delete('/courses/:courseId/notes/:noteId', auth.required, enrollmentController.deleteNote);

// Admin/Teacher only routes
router.get('/courses/:courseId/students', auth.required, enrollmentController.getCourseEnrollments);
router.get('/stats', auth.required, enrollmentController.getEnrollmentStats);

module.exports = router;