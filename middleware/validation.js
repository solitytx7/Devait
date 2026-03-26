// Validation middleware for user data
const { body, validationResult } = require('express-validator');

// User validation rules
const userValidationRules = () => {
  return [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email'),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
    body('age')
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage('Age must be between 0 and 120'),
    
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please enter a valid phone number'),
    
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin')
  ];
};

// User update validation rules (password is optional for updates)
const userUpdateValidationRules = () => {
  return [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email'),
    
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
    body('age')
      .optional()
      .isInt({ min: 0, max: 120 })
      .withMessage('Age must be between 0 and 120'),
    
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please enter a valid phone number'),
    
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin')
  ];
};

// Course validation rules
const courseValidationRules = () => {
  return [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Tên khóa học phải từ 2 đến 100 ký tự'),
    
    body('description')
      .trim()
      .isLength({ min: 5, max: 1000 })
      .withMessage('Mô tả khóa học phải từ 5 đến 1000 ký tự'),
    
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Giá khóa học phải là số không âm'),
    
    body('duration')
      .isInt({ min: 1 })
      .withMessage('Thời lượng khóa học phải ít nhất 1 phút'),
    
    body('level')
      .isIn(['Beginner', 'Intermediate', 'Advanced'])
      .withMessage('Cấp độ phải là Beginner, Intermediate hoặc Advanced'),
    
    body('category')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Danh mục phải từ 2 đến 50 ký tự'),
    
    body('instructor')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Tên giảng viên phải từ 2 đến 100 ký tự'),
    
    body('image')
      .optional()
      .custom((value, { req }) => {
        // Skip validation if file is uploaded
        if (req.files && req.files.image) {
          return true;
        }
        // Validate URL if no file
        if (value && !value.match(/^https?:\/\/.+/)) {
          throw new Error('Hình ảnh phải là URL hợp lệ (nếu không upload file)');
        }
        return true;
      }),
    
    body('video')
      .optional()
      .custom((value, { req }) => {
        // Skip validation if file is uploaded
        if (req.files && req.files.video) {
          return true;
        }
        // Validate URL if no file
        if (value && !value.match(/^https?:\/\/.+/)) {
          throw new Error('Video phải là URL hợp lệ (nếu không upload file)');
        }
        return true;
      }),
    
    body('rating')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Rating phải từ 0 đến 5'),
    
    body('studentsCount')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Số học viên không thể âm'),
    
    body('isPublished')
      .optional()
      .custom((value) => {
        // Accept string 'true'/'false' from form data
        if (value === 'true' || value === 'false' || typeof value === 'boolean') {
          return true;
        }
        throw new Error('Trạng thái xuất bản phải là true hoặc false');
      }),
    
    body('tags')
      .optional()
      .custom((value) => {
        // Handle tags as string (comma-separated) or array
        if (typeof value === 'string') {
          return true; // Will be processed in controller
        }
        if (Array.isArray(value)) {
          return true;
        }
        if (!value) {
          return true; // Optional field
        }
        throw new Error('Tags phải là chuỗi hoặc mảng');
      })
  ];
};

// Course update validation rules (most fields are optional for updates)
const courseUpdateValidationRules = () => {
  return [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Tên khóa học phải từ 2 đến 100 ký tự'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ min: 5, max: 1000 })
      .withMessage('Mô tả khóa học phải từ 5 đến 1000 ký tự'),
    
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Giá khóa học phải là số không âm'),
    
    body('duration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Thời lượng khóa học phải ít nhất 1 phút'),
    
    body('level')
      .optional()
      .isIn(['Beginner', 'Intermediate', 'Advanced'])
      .withMessage('Cấp độ phải là Beginner, Intermediate hoặc Advanced'),
    
    body('category')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Danh mục phải từ 2 đến 50 ký tự'),
    
    body('instructor')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Tên giảng viên phải từ 2 đến 100 ký tự'),
    
    body('rating')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Rating phải từ 0 đến 5'),
    
    body('studentsCount')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Số học viên không thể âm'),
    
    body('isPublished')
      .optional()
      .isBoolean()
      .withMessage('Trạng thái xuất bản phải là true hoặc false'),
    
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags phải là một mảng'),
    
    body('tags.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage('Mỗi tag phải từ 1 đến 30 ký tự')
  ];
};

// Check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array()); // Debug log
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  userValidationRules,
  userUpdateValidationRules,
  courseValidationRules,
  courseUpdateValidationRules,
  validate
};