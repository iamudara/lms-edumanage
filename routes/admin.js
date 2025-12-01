/**
 * Admin Routes
 * Handles admin-specific routes (dashboard, tools, etc.)
 * Phase 3: Full implementation pending
 */

import express from 'express';
import multer from 'multer';
import * as adminController from '../controllers/adminController.js';
import * as bulkController from '../controllers/bulkController.js';

const router = express.Router();

// Configure multer for CSV file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * Admin Dashboard (Placeholder)
 * GET /admin/dashboard
 */
router.get('/dashboard', adminController.showDashboard);

// ============================================
// BULK OPERATIONS ROUTES
// ============================================

/**
 * GET /admin/tools
 * Bulk operations page with CSV upload forms
 * Shows: Bulk user upload, bulk enrollment, bulk grades, bulk delete
 */
router.get('/tools', (req, res) => {
  res.render('admin/tools', {
    user: req.user,
    title: 'Bulk Operations - Admin Tools',
    useDataTables: true
  });
});

/**
 * POST /admin/tools/bulk-users
 * Process bulk user upload from CSV
 * CSV Format: username, email, password, full_name, role, batch_code
 */
router.post('/tools/bulk-users', upload.single('csvFile'), bulkController.bulkCreateUsers);

/**
 * POST /admin/tools/bulk-enrollments
 * Process bulk batch enrollment from CSV
 * CSV Format: batch_code, course_code
 */
router.post('/tools/bulk-enrollments', upload.single('csvFile'), bulkController.bulkCreateEnrollments);

/**
 * POST /admin/tools/bulk-grades
 * Process bulk grade upload from CSV
 * CSV Format: student_email, course_code, grade, remarks
 */
router.post('/tools/bulk-grades', upload.single('csvFile'), bulkController.bulkUploadGrades);

/**
 * POST /admin/tools/bulk-delete
 * Process bulk user deletion
 * Body: { userIds: [1, 2, 3, ...] }
 */
router.post('/tools/bulk-delete', bulkController.bulkDeleteUsers);

/**
 * POST /admin/tools/bulk-batch-change
 * Process bulk batch change from CSV
 * CSV Format: student_email, new_batch_code
 */
router.post('/tools/bulk-batch-change', (req, res) => {
  // Placeholder - will be implemented later
  res.json({ 
    success: false,
    message: 'Bulk batch change endpoint - to be implemented' 
  });
});

export default router;
