/**
 * Authentication Middleware
 * Protects routes and enforces role-based access control
 */

/**
 * Check if user is authenticated
 * Used to protect all routes that require login
 */
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
};

/**
 * Check if user has admin role
 * Used to protect admin-only routes (AdminJS, user management, bulk operations)
 */
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied: Admin privileges required');
};

/**
 * Check if user has teacher role
 * Used to protect teacher-only routes (course creation, grading, materials)
 */
exports.isTeacher = (req, res, next) => {
  if (req.user && req.user.role === 'teacher') {
    return next();
  }
  res.status(403).send('Access denied: Teacher privileges required');
};

/**
 * Check if user has student role
 * Used to protect student-only routes (submissions, viewing grades)
 */
exports.isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    return next();
  }
  res.status(403).send('Access denied: Student privileges required');
};

/**
 * Check if user is teacher OR admin
 * Useful for routes that both roles can access
 */
exports.isTeacherOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  res.status(403).send('Access denied: Teacher or Admin privileges required');
};

/**
 * Check if user is NOT a specific role
 * Useful for preventing certain roles from accessing routes
 */
exports.isNotStudent = (req, res, next) => {
  if (req.user && req.user.role !== 'student') {
    return next();
  }
  res.status(403).send('Access denied: This action is not available for students');
};
