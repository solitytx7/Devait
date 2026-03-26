const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getComments,
  getReplies,
  createComment,
  updateComment,
  deleteComment,
  toggleLike,
  reportComment,
  getCommentStats
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');

// Comment validation rules
const commentValidationRules = () => {
  return [
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Nội dung bình luận phải từ 1 đến 1000 ký tự'),
    body('parentComment')
      .optional()
      .isMongoId()
      .withMessage('ID bình luận gốc không hợp lệ')
  ];
};

// Update comment validation rules
const updateCommentValidationRules = () => {
  return [
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Nội dung bình luận phải từ 1 đến 1000 ký tự')
  ];
};

// Report comment validation rules
const reportCommentValidationRules = () => {
  return [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Lý do báo cáo không được quá 200 ký tự')
  ];
};

// Routes

// GET /api/courses/:courseId/comments - Get comments for a course
router.get('/courses/:courseId/comments', getComments);

// GET /api/comments/:commentId/replies - Get replies for a comment
router.get('/comments/:commentId/replies', getReplies);

// POST /api/courses/:courseId/comments - Create a new comment (requires auth)
router.post(
  '/courses/:courseId/comments',
  protect,
  commentValidationRules(),
  createComment
);

// PUT /api/comments/:commentId - Update a comment (requires auth)
router.put(
  '/comments/:commentId',
  protect,
  updateCommentValidationRules(),
  updateComment
);

// DELETE /api/comments/:commentId - Delete a comment (requires auth)
router.delete('/comments/:commentId', protect, deleteComment);

// POST /api/comments/:commentId/like - Like/Unlike a comment (requires auth)
router.post('/comments/:commentId/like', protect, toggleLike);

// POST /api/comments/:commentId/report - Report a comment (requires auth)
router.post(
  '/comments/:commentId/report',
  protect,
  reportCommentValidationRules(),
  reportComment
);

// GET /api/courses/:courseId/comments/stats - Get comment statistics (admin only)
router.get('/courses/:courseId/comments/stats', protect, getCommentStats);

module.exports = router;