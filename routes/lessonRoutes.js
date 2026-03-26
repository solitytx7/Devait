const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const lessonController = require('../controllers/lessonController');
const auth = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// Validation rules
const lessonValidation = [
  body('title')
    .notEmpty()
    .withMessage('Tiêu đề bài học là bắt buộc')
    .isLength({ max: 200 })
    .withMessage('Tiêu đề không được quá 200 ký tự'),
  body('course')
    .optional()
    .isMongoId()
    .withMessage('ID khóa học không hợp lệ'),
  body('courseId')
    .optional()
    .isMongoId()
    .withMessage('ID khóa học không hợp lệ'),
  body('order')
    .isInt({ min: 1 })
    .withMessage('Thứ tự bài học phải là số nguyên dương'),
  body('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Thời lượng phải là số nguyên dương'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Mô tả không được quá 1000 ký tự'),
  // Custom validation to ensure either course or courseId exists
  body().custom((value, { req }) => {
    if (!req.body.course && !req.body.courseId) {
      throw new Error('ID khóa học là bắt buộc (course hoặc courseId)');
    }
    return true;
  })
];

const noteValidation = [
  body('content')
    .notEmpty()
    .withMessage('Nội dung ghi chú là bắt buộc')
    .isLength({ max: 2000 })
    .withMessage('Ghi chú không được quá 2000 ký tự'),
  body('timestamp')
    .optional()
    .isNumeric()
    .withMessage('Timestamp phải là số')
];

// Public routes (or with optional auth)
router.get('/', auth.optional, lessonController.getAllLessons);
router.get('/course/:courseId', auth.optional, lessonController.getLessonsByCourse);
router.get('/:id', auth.optional, lessonController.getLesson);

// Protected routes - require authentication
router.post('/:id/complete', auth.required, lessonController.completeLesson);
router.post('/:id/notes', auth.required, noteValidation, lessonController.addNote);
router.get('/:id/notes', auth.required, lessonController.getLessonNotes);

// Admin/Teacher only routes
router.post('/', 
  auth.required, 
  uploadSingle('video'), 
  lessonValidation, 
  lessonController.createLesson
);

router.put('/:id', 
  auth.required, 
  uploadSingle('video'), 
  lessonValidation, 
  lessonController.updateLesson
);

router.delete('/:id', auth.required, lessonController.deleteLesson);

module.exports = router;