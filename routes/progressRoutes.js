const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const progressController = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

// Validation middleware
const updateProgressValidation = [
  body('completed')
    .optional()
    .isBoolean()
    .withMessage('completed phải là boolean'),
  body('watchTime')
    .optional()
    .isNumeric()
    .withMessage('watchTime phải là số')
    .isInt({ min: 0 })
    .withMessage('watchTime không thể âm'),
  body('videoPosition')
    .optional()
    .isNumeric()
    .withMessage('videoPosition phải là số')
    .isInt({ min: 0 })
    .withMessage('videoPosition không thể âm'),
  body('quizScore')
    .optional()
    .isNumeric()
    .withMessage('quizScore phải là số')
    .isInt({ min: 0, max: 100 })
    .withMessage('quizScore phải từ 0 đến 100'),
  body('quizAttempts')
    .optional()
    .isNumeric()
    .withMessage('quizAttempts phải là số')
    .isInt({ min: 0 })
    .withMessage('quizAttempts không thể âm')
];

// Áp dụng auth middleware cho tất cả routes
router.use(protect);

// @route   GET /api/progress/course/:courseId
// @desc    Lấy tiến độ học tập của một khóa học
// @access  Private
router.get('/course/:courseId', progressController.getCourseProgress);

// @route   PUT /api/progress/lesson/:lessonId
// @desc    Cập nhật tiến độ của một bài học
// @access  Private
router.put('/lesson/:lessonId', updateProgressValidation, progressController.updateLessonProgress);

// @route   GET /api/progress/stats
// @desc    Lấy thống kê học tập của user
// @access  Private
router.get('/stats', progressController.getUserStats);

// @route   GET /api/progress/recent
// @desc    Lấy danh sách bài học gần đây
// @access  Private
router.get('/recent', progressController.getRecentLessons);

// @route   PUT /api/progress/bookmark/:lessonId
// @desc    Đánh dấu yêu thích bài học
// @access  Private
router.put('/bookmark/:lessonId', progressController.toggleBookmark);

// @route   GET /api/progress/bookmarks
// @desc    Lấy danh sách bài học yêu thích
// @access  Private
router.get('/bookmarks', progressController.getBookmarkedLessons);

// @route   DELETE /api/progress/course/:courseId/reset
// @desc    Reset tiến độ khóa học
// @access  Private
router.delete('/course/:courseId/reset', progressController.resetCourseProgress);

module.exports = router;