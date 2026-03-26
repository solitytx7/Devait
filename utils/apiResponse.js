// Utility functions for API responses

// Success response
const success = (message = 'Success', data = null, statusCode = 200) => {
  const response = {
    success: true,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return response;
};

// Error response
const error = (message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return response;
};

// Validation error response
const validationError = (errors, message = 'Validation errors') => {
  return {
    success: false,
    message,
    errors
  };
};

// Success response for res object
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

// Error response for res object
const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};

// Pagination helper
const getPagination = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 10;
  const totalPages = Math.ceil(total / itemsPerPage);
  const skip = (currentPage - 1) * itemsPerPage;
  
  return {
    pagination: {
      page: currentPage,
      limit: itemsPerPage,
      total,
      pages: totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    },
    skip
  };
};

module.exports = {
  success,
  error,
  validationError,
  successResponse,
  errorResponse,
  getPagination
};