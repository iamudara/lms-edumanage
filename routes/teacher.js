/**
 * Teacher Routes
 * Handles teacher-specific routes (dashboard, courses, assignments, materials, grading)
 * Phase 4: Teacher Features Implementation
 */

import express from 'express';
import { 
  showDashboard,
  getCourses,
  showCreateCourse,
  createCourse,
  getCourseDetail,
  getMaterials,
  uploadMaterial,
  deleteMaterial,
  showCreateAssignment,
  createAssignment,
  getSubmissions,
  showGradeForm,
  gradeSubmission,
  getGrades,
  saveGrade,
  bulkUploadGrades,
  downloadGradeTemplate
} from '../controllers/teacherController.js';
import { uploadMaterial as uploadMiddleware, uploadCsv } from '../middleware/upload.js';

const router = express.Router();

// ============================================
// DASHBOARD
// ============================================

/**
 * Teacher Dashboard
 * GET /teacher/dashboard
 * Shows teacher's courses, pending submissions, recent activity
 */
router.get('/dashboard', showDashboard);

// ============================================
// COURSE MANAGEMENT
// ============================================

/**
 * Get all teacher's courses
 * GET /teacher/courses
 * Lists all courses created by this teacher
 */
router.get('/courses', getCourses);

/**
 * Show course creation form
 * GET /teacher/courses/create
 * Form to create a new course
 */
router.get('/courses/create', showCreateCourse);

/**
 * Create a new course
 * POST /teacher/courses/create
 * Processes course creation form
 */
router.post('/courses/create', createCourse);

/**
 * Get single course details
 * GET /teacher/courses/:id
 * Shows course details, enrolled batches, materials, assignments
 */
router.get('/courses/:id', getCourseDetail);

// ============================================
// MATERIAL MANAGEMENT
// ============================================

/**
 * Get materials for a course
 * GET /teacher/courses/:id/materials
 * Lists all materials for a specific course
 */
router.get('/courses/:id/materials', getMaterials);

/**
 * Upload material to course
 * POST /teacher/courses/:id/materials/upload
 * Handles file upload or URL input for course materials
 */
router.post('/courses/:id/materials/upload', uploadMiddleware, uploadMaterial);

/**
 * Delete a material
 * DELETE /teacher/materials/:id
 * Removes a material from a course
 */
router.delete('/materials/:id', deleteMaterial);

// ============================================
// ASSIGNMENT MANAGEMENT
// ============================================

/**
 * Show assignment creation form
 * GET /teacher/courses/:id/assignments/create
 * Form to create a new assignment for a course
 */
router.get('/courses/:id/assignments/create', showCreateAssignment);

/**
 * Create new assignment
 * POST /teacher/courses/:id/assignments
 * Processes assignment creation (title, description, deadline)
 */
router.post('/courses/:id/assignments', createAssignment);

/**
 * Get assignment edit form
 * GET /teacher/assignments/:id/edit
 * Form to edit assignment deadline
 */
router.get('/assignments/:id/edit', (req, res) => {
  res.send(`Edit Assignment - ID: ${req.params.id} - To be implemented in Task 4.10`);
});

/**
 * Update assignment deadline
 * PUT /teacher/assignments/:id
 * Updates assignment deadline only
 */
router.put('/assignments/:id', (req, res) => {
  res.send(`Update Assignment - ID: ${req.params.id} - To be implemented in Task 4.10`);
});

// ============================================
// SUBMISSION MANAGEMENT
// ============================================

/**
 * View all submissions for an assignment
 * GET /teacher/assignments/:id/submissions
 * Lists all student submissions for a specific assignment
 */
router.get('/assignments/:id/submissions', getSubmissions);

/**
 * View single submission for grading
 * GET /teacher/submissions/:id/grade
 * Shows submission details and grading form
 */
router.get('/submissions/:id/grade', showGradeForm);

/**
 * Grade a submission
 * POST /teacher/submissions/:id/grade
 * Assigns marks and feedback to a submission
 */
router.post('/submissions/:id/grade', gradeSubmission);

// ============================================
// GRADE MANAGEMENT
// ============================================

/**
 * View grades for a course
 * GET /teacher/courses/:id/grades
 * Shows all enrolled students with assignment marks and final grades
 */
router.get('/courses/:id/grades', getGrades);

/**
 * Save final grade for a student
 * POST /teacher/courses/:id/grades
 * Manually saves final grade for a student in a course
 */
router.post('/courses/:id/grades', saveGrade);

/**
 * Bulk grade upload via CSV
 * POST /teacher/courses/:id/grades/bulk
 * Processes CSV file for bulk grade upload
 */
router.post('/courses/:id/grades/bulk', uploadCsv, bulkUploadGrades);

/**
 * Download CSV template for grade upload
 * GET /teacher/courses/:id/grades/template
 * Downloads a sample CSV file for bulk grade upload
 */
router.get('/courses/:id/grades/template', downloadGradeTemplate);

export default router;
