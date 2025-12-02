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
  getCourseDetail
} from '../controllers/teacherController.js';

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
router.get('/courses/:id/materials', (req, res) => {
  res.send(`Course Materials - ID: ${req.params.id} - To be implemented in Task 4.4`);
});

/**
 * Upload material to course
 * POST /teacher/courses/:id/materials/upload
 * Handles file upload or URL input for course materials
 */
router.post('/courses/:id/materials/upload', (req, res) => {
  res.send(`Upload Material - Course ID: ${req.params.id} - To be implemented in Task 4.4`);
});

/**
 * Delete a material
 * DELETE /teacher/materials/:id
 * Removes a material from a course
 */
router.delete('/materials/:id', (req, res) => {
  res.send(`Delete Material - ID: ${req.params.id} - To be implemented in Task 4.4`);
});

// ============================================
// ASSIGNMENT MANAGEMENT
// ============================================

/**
 * Show assignment creation form
 * GET /teacher/courses/:id/assignments/create
 * Form to create a new assignment for a course
 */
router.get('/courses/:id/assignments/create', (req, res) => {
  res.send(`Create Assignment Form - Course ID: ${req.params.id} - To be implemented in Task 4.5`);
});

/**
 * Create new assignment
 * POST /teacher/courses/:id/assignments
 * Processes assignment creation (title, description, deadline)
 */
router.post('/courses/:id/assignments', (req, res) => {
  res.send(`Create Assignment - Course ID: ${req.params.id} - To be implemented in Task 4.5`);
});

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
router.get('/assignments/:id/submissions', (req, res) => {
  res.send(`Assignment Submissions - ID: ${req.params.id} - To be implemented in Task 4.6`);
});

/**
 * View single submission for grading
 * GET /teacher/submissions/:id/grade
 * Shows submission details and grading form
 */
router.get('/submissions/:id/grade', (req, res) => {
  res.send(`Grade Submission Form - ID: ${req.params.id} - To be implemented in Task 4.7`);
});

/**
 * Grade a submission
 * POST /teacher/submissions/:id/grade
 * Assigns marks and feedback to a submission
 */
router.post('/submissions/:id/grade', (req, res) => {
  res.send(`Grade Submission Action - ID: ${req.params.id} - To be implemented in Task 4.7`);
});

// ============================================
// GRADE MANAGEMENT
// ============================================

/**
 * View grades for a course
 * GET /teacher/courses/:id/grades
 * Shows all enrolled students with assignment marks and final grades
 */
router.get('/courses/:id/grades', (req, res) => {
  res.send(`Course Grades - ID: ${req.params.id} - To be implemented in Task 4.8`);
});

/**
 * Save final grade for a student
 * POST /teacher/courses/:id/grades
 * Manually saves final grade for a student in a course
 */
router.post('/courses/:id/grades', (req, res) => {
  res.send(`Save Grade - Course ID: ${req.params.id} - To be implemented in Task 4.8`);
});

/**
 * Bulk grade upload via CSV
 * POST /teacher/courses/:id/grades/bulk
 * Processes CSV file for bulk grade upload
 */
router.post('/courses/:id/grades/bulk', (req, res) => {
  res.send(`Bulk Grade Upload - Course ID: ${req.params.id} - To be implemented in Task 4.9`);
});

export default router;
