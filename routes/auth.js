/**
 * Authentication Routes
 * Handles login, logout, and password change
 * Implemented in Phase 2 (Task 2.2)
 * Updated in Phase 2 (Task 2.3) - Using controller
 */

import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

/**
 * GET /auth/login
 * Show login form
 */
router.get('/login', authController.showLoginPage);

/**
 * POST /auth/login
 * Process login using Passport LocalStrategy
 */
router.post('/login', authController.processLogin);

/**
 * GET /auth/logout
 * Logout user and destroy session
 */
router.get('/logout', authController.logout);

/**
 * POST /auth/logout
 * Logout user and destroy session (for form submissions)
 */
router.post('/logout', authController.logout);

/**
 * GET /auth/change-password
 * Show change password form (requires authentication)
 */
router.get('/change-password', isAuthenticated, authController.showChangePasswordPage);

/**
 * POST /auth/change-password
 * Process password change (requires authentication)
 */
router.post('/change-password', isAuthenticated, authController.changePassword);

export default router;