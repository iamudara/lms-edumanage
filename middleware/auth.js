/**
 * Authentication Middleware
 * Protects routes and enforces role-based access control
 */

import { User } from '../models/index.js';

/**
 * Check if user is authenticated and session is valid
 * Used to protect all routes that require login
 */
export const isAuthenticated = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }

  try {
    // Check if the current session matches the user's active session
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      // User not found, logout
      req.logout(() => {
        req.session.error_msg = 'Session expired. Please login again.';
        return res.redirect('/auth/login');
      });
      return;
    }

    // If active_session_id doesn't match current session, another device has logged in
    if (user.active_session_id && user.active_session_id !== req.sessionID) {
      req.logout(() => {
        req.session.error_msg = 'Your account has been logged in from another device. Please login again.';
        return res.redirect('/auth/login');
      });
      return;
    }

    return next();
  } catch (error) {
    console.error('Session validation error:', error);
    return next(); // Continue on error to avoid blocking legitimate users
  }
};

/**
 * Check if user has admin role
 * Used to protect admin-only routes (AdminJS, user management, bulk operations)
 */
// ... (isAuthenticated function remains unchanged)

/**
 * Check if user has admin role
 * Used to protect admin-only routes (AdminJS, user management, bulk operations)
 */
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).render('error/403', {
    message: 'Access denied: Admin privileges required',
    user: req.user // Pass user for navbar logic
  });
};

/**
 * Check if user has teacher role
 * Used to protect teacher-only routes (course creation, grading, materials)
 */
export const isTeacher = (req, res, next) => {
  if (req.user && req.user.role === 'teacher') {
    return next();
  }
  res.status(403).render('error/403', {
    message: 'Access denied: Teacher privileges required',
    user: req.user
  });
};

/**
 * Check if user has student role
 * Used to protect student-only routes (submissions, viewing grades)
 */
export const isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    return next();
  }
  res.status(403).render('error/403', {
    message: 'Access denied: Student privileges required',
    user: req.user
  });
};

/**
 * Check if user is teacher OR admin
 * Useful for routes that both roles can access
 */
export const isTeacherOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  res.status(403).render('error/403', {
    message: 'Access denied: Teacher or Admin privileges required',
    user: req.user
  });
};

/**
 * Check if user is NOT a specific role
 * Useful for preventing certain roles from accessing routes
 */
export const isNotStudent = (req, res, next) => {
  if (req.user && req.user.role !== 'student') {
    return next();
  }
  res.status(403).render('error/403', {
    message: 'Access denied: This action is not available for students',
    user: req.user
  });
};
