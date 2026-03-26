const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

// Protect routes - authenticate user
const protect = async (req, res, next) => {
  console.log('🔐 protect middleware called for:', req.method, req.originalUrl);
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json(
          ApiResponse.error('Not authorized, user not found', 401)
        );
      }

      if (!req.user.isActive) {
        return res.status(401).json(
          ApiResponse.error('Account has been deactivated', 401)
        );
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json(
        ApiResponse.error('Not authorized, token failed', 401)
      );
    }
  }

  if (!token) {
    return res.status(401).json(
      ApiResponse.error('Not authorized, no token', 401)
    );
  }
};

// Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        ApiResponse.error('Not authorized', 401)
      );
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json(
        ApiResponse.error(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      ApiResponse.error('Not authorized', 401)
    );
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json(
      ApiResponse.error('Admin access required', 403)
    );
  }
  next();
};

// Teacher or Admin middleware
const teacherOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      ApiResponse.error('Not authorized', 401)
    );
  }

  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json(
      ApiResponse.error('Teacher or Admin access required', 403)
    );
  }
  next();
};

// User can only access their own data or admin can access any
const userOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      ApiResponse.error('Not authorized', 401)
    );
  }

  // Admin can access any data
  if (req.user.role === 'admin') {
    return next();
  }

  // User can only access their own data
  if (req.params.id && req.params.id !== req.user._id.toString()) {
    return res.status(403).json(
      ApiResponse.error('Access denied - you can only access your own data', 403)
    );
  }

  next();
};

// Optional auth - doesn't fail if no token, but populates user if token exists
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // If token is invalid, just continue without user
      req.user = null;
    }
  }

  next();
};

module.exports = {
  protect,
  authorize,
  adminOnly,
  teacherOrAdmin,
  userOrAdmin,
  optionalAuth,
  required: protect,
  optional: optionalAuth
};