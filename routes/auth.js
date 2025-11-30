/**
 * Authentication Routes
 * Handles login, logout, and password change
 * Implemented in Phase 2 (Task 2.2)
 */

import express from 'express';
import passport from 'passport';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /auth/login
 * Show login form
 */
router.get('/login', (req, res) => {
  // If already authenticated, redirect to appropriate dashboard
  if (req.isAuthenticated()) {
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
  }

  // Render login page
  res.render('auth/login', {
    title: 'Login - LMS EduManage',
    error: req.session.error_msg || null,
    info: req.session.info_msg || null,
  });
});

/**
 * POST /auth/login
 * Process login using Passport LocalStrategy
 */
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    // Handle errors
    if (err) {
      console.error('Login error:', err);
      req.session.error_msg = 'An error occurred during login. Please try again.';
      return res.redirect('/auth/login');
    }

    // Authentication failed
    if (!user) {
      req.session.error_msg = info.message || 'Invalid username or password';
      return res.redirect('/auth/login');
    }

    // Establish session
    req.logIn(user, (err) => {
      if (err) {
        console.error('Session error:', err);
        req.session.error_msg = 'An error occurred. Please try again.';
        return res.redirect('/auth/login');
      }

      // Success - redirect based on role
      req.session.success_msg = `Welcome, ${user.full_name}!`;
      
      switch (user.role) {
        case 'admin':
          return res.redirect('/admin/dashboard');
        case 'teacher':
          return res.redirect('/teacher/dashboard');
        case 'student':
          return res.redirect('/student/dashboard');
        default:
          return res.redirect('/');
      }
    });
  })(req, res, next);
});

/**
 * GET /auth/logout
 * Logout user and destroy session
 */
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/');
    }

    req.session.info_msg = 'You have been logged out successfully';
    res.redirect('/auth/login');
  });
});

/**
 * GET /auth/change-password
 * Show change password form (requires authentication)
 */
router.get('/change-password', isAuthenticated, (req, res) => {
  res.render('auth/change-password', {
    title: 'Change Password - LMS EduManage',
    user: req.user,
    error: req.session.error_msg || null,
    success: req.session.success_msg || null,
  });
});

/**
 * POST /auth/change-password
 * Process password change (requires authentication)
 */
router.post('/change-password', isAuthenticated, async (req, res) => {
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

    // Validation: Check new password length
    if (newPassword.length < 6) {
      req.session.error_msg = 'New password must be at least 6 characters long';
      return res.redirect('/auth/change-password');
    }

    // Validation: Check new password is different from current
    if (currentPassword === newPassword) {
      req.session.error_msg = 'New password must be different from current password';
      return res.redirect('/auth/change-password');
    }

    // Get user from database (with password)
    const { User } = await import('../models/index.js');
    const user = await User.findByPk(req.user.id);

    if (!user) {
      req.session.error_msg = 'User not found';
      return res.redirect('/auth/change-password');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      req.session.error_msg = 'Current password is incorrect';
      return res.redirect('/auth/change-password');
    }

    // Update password (will be auto-hashed by User model hook)
    user.password = newPassword;
    await user.save();

    // Success
    req.session.success_msg = 'Password changed successfully';
    
    // Redirect to role-specific dashboard
    switch (user.role) {
      case 'admin':
        return res.redirect('/admin/dashboard');
      case 'teacher':
        return res.redirect('/teacher/dashboard');
      case 'student':
        return res.redirect('/student/dashboard');
      default:
        return res.redirect('/');
    }

  } catch (error) {
    console.error('Password change error:', error);
    req.session.error_msg = 'An error occurred while changing password. Please try again.';
    res.redirect('/auth/change-password');
  }
});

export default router;
