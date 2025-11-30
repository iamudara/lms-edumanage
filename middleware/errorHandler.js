/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate responses
 */

/**
 * Development Error Response
 * Shows detailed error information including stack trace
 */
const sendErrorDev = (err, req, res) => {
  console.error('ERROR 💥', err);
  
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    error: err,
    message: err.message,
    stack: err.stack
  });
};

/**
 * Production Error Response
 * Shows user-friendly error messages only
 */
const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } 
  // Programming or unknown error: don't leak error details
  else {
    console.error('ERROR 💥', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};

/**
 * Handle Sequelize Validation Errors
 */
const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map(e => e.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  
  return {
    statusCode: 400,
    status: 'fail',
    message,
    isOperational: true
  };
};

/**
 * Handle Sequelize Unique Constraint Errors
 */
const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors[0].path;
  const value = err.errors[0].value;
  const message = `${field} '${value}' already exists. Please use another value.`;
  
  return {
    statusCode: 400,
    status: 'fail',
    message,
    isOperational: true
  };
};

/**
 * Handle Sequelize Foreign Key Constraint Errors
 */
const handleSequelizeForeignKeyConstraintError = (err) => {
  const message = 'Cannot delete this record because it is referenced by other records.';
  
  return {
    statusCode: 400,
    status: 'fail',
    message,
    isOperational: true
  };
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => ({
  statusCode: 401,
  status: 'fail',
  message: 'Invalid token. Please log in again.',
  isOperational: true
});

/**
 * Handle JWT Expired Errors
 */
const handleJWTExpiredError = () => ({
  statusCode: 401,
  status: 'fail',
  message: 'Your token has expired. Please log in again.',
  isOperational: true
});

/**
 * Global Error Handler
 */
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    // Handle specific Sequelize errors
    if (err.name === 'SequelizeValidationError') {
      error = handleSequelizeValidationError(err);
    }
    if (err.name === 'SequelizeUniqueConstraintError') {
      error = handleSequelizeUniqueConstraintError(err);
    }
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      error = handleSequelizeForeignKeyConstraintError(err);
    }
    if (err.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }
    if (err.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }

    sendErrorProd(error, req, res);
  }
};

/**
 * Custom Error Class for Operational Errors
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports.AppError = AppError;
