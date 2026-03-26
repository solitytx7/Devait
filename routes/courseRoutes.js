const express = require('express');
const router = express.Router();

const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses,
  getCoursesByCategory,
  getCourseStats,
  getCourseWithLessons
} = require('../controllers/courseController');

const auth = require('../middleware/auth');

const {
  courseValidationRules,
  courseUpdateValidationRules,
  validate
} = require('../middleware/validation');

const { uploadFields } = require('../middleware/upload');

// Search route should come before /:id to avoid conflicts
router.get('/search', searchCourses);

// Statistics route
router.get('/stats', getCourseStats);

// Category route
router.get('/category/:category', getCoursesByCategory);

// CRUD routes
router.route('/')
  .get(getCourses)
  .post(
    uploadFields,
    require('../middleware/upload').handleUploadError,
    require('../middleware/upload').processFileUrls,
    courseValidationRules(),
    validate,
    createCourse
  );

// Course detail with lessons
router.get('/:id/detail', auth.optional, getCourseWithLessons);

router.route('/:id')
  .get(getCourse)
  .put(
    auth.required,
    uploadFields,
    require('../middleware/upload').handleUploadError,
    require('../middleware/upload').processFileUrls,
    courseUpdateValidationRules(),
    validate,
    updateCourse
  )
  .delete(auth.required, deleteCourse);

// Admin/Teacher only routes
router.post('/',
  auth.required,
  uploadFields,
  courseValidationRules(),
  validate,
  createCourse
);

module.exports = router;