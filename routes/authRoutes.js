const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  forgotPassword,
  resetPassword,
  setupSecurityQuestions,
  getSecurityQuestions,
  resetPasswordWithSecurity,
  getSecurityQuestionsList,
  googleAuth,
  googleCallback,
  linkGoogleAccount,
  unlinkGoogleAccount
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadAvatar, handleUploadError, processFileUrls } = require('../middleware/upload');

const router = express.Router();

// Public routes - simplified for testing
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Protected routes (require authentication)
router.get('/me', protect, getMe);
router.put('/profile', protect, uploadAvatar, handleUploadError, processFileUrls, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/logout', protect, logout);

// Admin only routes
router.get('/users', protect, adminOnly, getAllUsers);
router.put('/users/:id/role', protect, adminOnly, updateUserRole);
router.put('/users/:id/toggle-status', protect, adminOnly, toggleUserStatus);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Security questions routes
router.get('/security-questions/list', getSecurityQuestionsList);
router.put('/security-questions', (req, res, next) => {
  console.log('🎯 PUT /security-questions route hit!');
  console.log('📋 Request body:', req.body);
  console.log('📋 Request headers:', req.headers.authorization);
  next();
}, protect, (req, res, next) => {
  console.log('🔐 After protect middleware, calling setupSecurityQuestions');
  next();
}, setupSecurityQuestions);
router.post('/security-questions/verify-user', getSecurityQuestions);
router.put('/reset-password-security', resetPasswordWithSecurity);

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.post('/link-google', protect, linkGoogleAccount);
router.delete('/unlink-google', protect, unlinkGoogleAccount);

// Test route for middleware
router.get('/test-protect', protect, (req, res) => {
  console.log('🧪 Test protect route called');
  res.json({ success: true, message: 'Middleware working', user: req.user.email });
});

module.exports = router;