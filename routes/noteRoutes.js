const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const noteController = require('../controllers/noteController');
const { protect } = require('../middleware/auth');

// Validation middleware
const createNoteValidation = [
  body('lessonId')
    .notEmpty()
    .withMessage('lessonId là bắt buộc')
    .isMongoId()
    .withMessage('lessonId không hợp lệ'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung ghi chú là bắt buộc')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Nội dung ghi chú phải từ 1 đến 5000 ký tự'),
  body('title')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Tiêu đề không được quá 200 ký tự'),
  body('timestamp')
    .optional()
    .isNumeric()
    .withMessage('timestamp phải là số')
    .isInt({ min: 0 })
    .withMessage('timestamp không thể âm'),
  body('color')
    .optional()
    .isIn(['yellow', 'blue', 'green', 'red', 'purple', 'orange', 'pink', 'gray'])
    .withMessage('color không hợp lệ'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('tags phải là mảng'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Mỗi tag không được quá 50 ký tự'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate phải là boolean')
];

const updateNoteValidation = [
  body('content')
    .optional()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Nội dung ghi chú phải từ 1 đến 5000 ký tự'),
  body('title')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Tiêu đề không được quá 200 ký tự'),
  body('timestamp')
    .optional()
    .isNumeric()
    .withMessage('timestamp phải là số')
    .isInt({ min: 0 })
    .withMessage('timestamp không thể âm'),
  body('color')
    .optional()
    .isIn(['yellow', 'blue', 'green', 'red', 'purple', 'orange', 'pink', 'gray'])
    .withMessage('color không hợp lệ'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('tags phải là mảng'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Mỗi tag không được quá 50 ký tự'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate phải là boolean'),
  body('isPinned')
    .optional()
    .isBoolean()
    .withMessage('isPinned phải là boolean')
];

// Áp dụng auth middleware cho tất cả routes
router.use(protect);

// @route   POST /api/notes
// @desc    Tạo ghi chú mới
// @access  Private
router.post('/', createNoteValidation, noteController.createNote);

// @route   GET /api/notes
// @desc    Lấy tất cả ghi chú của user
// @access  Private
router.get('/', noteController.getAllNotes);

// @route   GET /api/notes/lesson/:lessonId
// @desc    Lấy ghi chú theo bài học
// @access  Private
router.get('/lesson/:lessonId', noteController.getNotesByLesson);

// @route   GET /api/notes/course/:courseId
// @desc    Lấy ghi chú theo khóa học
// @access  Private
router.get('/course/:courseId', noteController.getNotesByCourse);

// @route   GET /api/notes/search
// @desc    Tìm kiếm ghi chú
// @access  Private
router.get('/search', noteController.searchNotes);

// @route   GET /api/notes/tags
// @desc    Lấy ghi chú theo tags
// @access  Private
router.get('/tags', noteController.getNotesByTags);

// @route   GET /api/notes/stats
// @desc    Lấy thống kê ghi chú
// @access  Private
router.get('/stats', noteController.getNotesStats);

// @route   GET /api/notes/:noteId
// @desc    Lấy chi tiết ghi chú
// @access  Private
router.get('/:noteId', noteController.getNoteDetail);

// @route   PUT /api/notes/:noteId
// @desc    Cập nhật ghi chú
// @access  Private
router.put('/:noteId', updateNoteValidation, noteController.updateNote);

// @route   DELETE /api/notes/:noteId
// @desc    Xóa ghi chú
// @access  Private
router.delete('/:noteId', noteController.deleteNote);

// @route   PUT /api/notes/:noteId/archive
// @desc    Archive/Unarchive ghi chú
// @access  Private
router.put('/:noteId/archive', noteController.toggleArchiveNote);

// @route   PUT /api/notes/:noteId/pin
// @desc    Pin/Unpin ghi chú
// @access  Private
router.put('/:noteId/pin', noteController.togglePinNote);

module.exports = router;