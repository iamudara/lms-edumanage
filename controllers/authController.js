/**
 * Authentication Controller
 * Handles login, logout, and password change logic
 * Implemented in Phase 2 (Task 2.3)
 */

import passport from 'passport';
import { User } from '../models/index.js';

/**
 * Show Login Page
 * GET /auth/login
 */
export const showLoginPage = (req, res) => {
  // If already authenticated, redirect to appropriate dashboard
  if (req.isAuthenticated()) {
    return redirectToDashboard(req, res);
  }

  // Get flash messages
  const error = req.session.error_msg || null;
  const info = req.session.info_msg || null;

  // Clear flash messages after retrieving
  req.session.error_msg = null;
  req.session.info_msg = null;

  // Render login page
  res.render('auth/login', {
    title: 'Login - LMS EduManage',
    error,
    info,
  });
};

/**
 * Process Login
 * POST /auth/login
 * Uses Passport LocalStrategy for authentication
 */
export const processLogin = (req, res, next) => {
  // Use passport.authenticate with custom callback for better control
  passport.authenticate('local', (err, user, info) => {
    // Handle errors during authentication
    if (err) {
      console.error('Login error:', err);
      req.session.error_msg = 'An error occurred during login. Please try again.';
      return res.redirect('/auth/login');
    }

    // Authentication failed - user not found or wrong password
    if (!user) {
      req.session.error_msg = info.message || 'Invalid username or password';
      return res.redirect('/auth/login');
    }

    // Establish login session
    // req.login() is provided by Passport
    req.logIn(user, (err) => {
      if (err) {
        console.error('Session establishment error:', err);
        req.session.error_msg = 'An error occurred. Please try again.';
        return res.redirect('/auth/login');
      }

      // Authentication successful
      req.session.success_msg = `Welcome back, ${user.full_name}!`;
      
      // Role-based redirect
      return redirectToDashboard(req, res);
    });
  })(req, res, next);
};

/**
 * Logout User
 * GET /auth/logout
 */
export const logout = (req, res, next) => {
  // req.logout() is provided by Passport
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }

    // Clear session messages
    req.session.success_msg = null;
    req.session.error_msg = null;
    
    // Set logout success message
    req.session.info_msg = 'You have been logged out successfully';
    
    res.redirect('/auth/login');
  });
};

/**
 * Show Change Password Page
 * GET /auth/change-password
 */
export const showChangePasswordPage = (req, res) => {
  // Get flash messages
  const error = req.session.error_msg || null;
  const success = req.session.success_msg || null;

  // Clear flash messages after retrieving
  req.session.error_msg = null;
  req.session.success_msg = null;

  res.render('auth/change-password', {
    title: 'Change Password - LMS EduManage',
    user: req.user,
    error,
    success,
  });
};

/**
 * Process Password Change
 * POST /auth/change-password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation: Check all fields are provided
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.session.error_msg = 'All fields are required';
      return res.redirect('/auth/change-password');
    }

    // Validation: Check new password and confirm match
    if (newPassword !== confirmPassword) {
      req.session.error_msg = 'New password and confirm password do not match';
      return res.redirect('/auth/change-password');
    }

    // Validation: Check new password length (minimum 6 characters)
    if (newPassword.length < 6) {
      req.session.error_msg = 'New password must be at least 6 characters long';
      return res.redirect('/auth/change-password');
    }

    // Validation: Check new password is different from current
    if (currentPassword === newPassword) {
      req.session.error_msg = 'New password must be different from current password';
      return res.redirect('/auth/change-password');
    }

    // Get user from database (need to fetch again to get password field)
    const user = await User.findByPk(req.user.id);

    if (!user) {
      req.session.error_msg = 'User not found';
      return res.redirect('/auth/change-password');
    }

    // Verify current password using bcrypt comparison
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      req.session.error_msg = 'Current password is incorrect';
      return res.redirect('/auth/change-password');
    }

    // Update password (will be auto-hashed by User model beforeUpdate hook)
    user.password = newPassword;
    await user.save();

    // Success message
    req.session.success_msg = 'Password changed successfully';
    
    // Redirect to role-specific dashboard
    return redirectToDashboard(req, res);

  } catch (error) {
    console.error('Password change error:', error);
    req.session.error_msg = 'An error occurred while changing password. Please try again.';
    res.redirect('/auth/change-password');
  }
};

/**
 * Helper Function: Role-based Dashboard Redirect
 * Redirects user to appropriate dashboard based on their role
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const redirectToDashboard = (req, res) => {
  if (!req.user || !req.user.role) {
    return res.redirect('/auth/login');
  }

  switch (req.user.role) {
    case 'admin':
      return res.redirect('/admin/dashboard');
    case 'teacher':
      return res.redirect('/teacher/dashboard');
    case 'student':
      return res.redirect('/student/dashboard');
    default:
      return res.redirect('/');
  }
};
