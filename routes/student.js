/**
 * Student Routes
 * Handles student-specific routes (dashboard, courses, assignments, submissions, grades)
 * Phase 5: Student Features Implementation
 */

import express from 'express';
// Import student controller (will be created in Task 5.2)
// import {
//   showDashboard,
//   getCourseView,
//   getAssignmentDetail,
//   submitAssignment,
//   getSubmissions,
//   getGrades
// } from '../controllers/studentController.js';

const router = express.Router();

/**
 * Student Dashboard
 * GET /student/dashboard
 * Display: enrolled courses, upcoming deadlines, recent grades, pending assignments
 */
router.get('/dashboard', (req, res) => {
  // Placeholder - will be implemented in Task 5.2
  res.send('Student Dashboard - Coming Soon (Task 5.2)');
  // TODO: Replace with: showDashboard
});

/**
 * Course View (Student)
 * GET /student/courses/:id
 * Display: course info, materials, assignments list, course grade
 * Must check: student's batch is enrolled in this course
 */
router.get('/courses/:id', (req, res) => {
  // Placeholder - will be implemented in Task 5.3
  res.send(`Course View - Course ID: ${req.params.id} - Coming Soon (Task 5.3)`);
  // TODO: Replace with: getCourseView
});

/**
 * Assignment Detail View
 * GET /student/assignments/:id
 * Display: assignment description, deadline, submission status, submit button
 */
router.get('/assignments/:id', (req, res) => {
  // Placeholder - will be implemented in Task 5.4
  res.send(`Assignment Detail - Assignment ID: ${req.params.id} - Coming Soon (Task 5.4)`);
  // TODO: Replace with: getAssignmentDetail
});

/**
 * Submit Assignment
 * POST /student/assignments/:id/submit
 * Validation: enrolled, deadline not passed, file/text provided
 * Upload to Cloudinary, store in submissions table
 * Note: Students can resubmit (UPDATE) before deadline
 */
router.post('/assignments/:id/submit', (req, res) => {
  // Placeholder - will be implemented in Task 5.5
  res.status(501).json({ 
    error: 'Assignment submission not yet implemented (Task 5.5)',
    assignment_id: req.params.id 
  });
  // TODO: Replace with: submitAssignment
  // TODO: Add upload middleware for file handling
});

/**
 * Submission History
 * GET /student/submissions
 * Display: all submissions, status, scores, feedback
 * Optional: filter by course
 */
router.get('/submissions', (req, res) => {
  // Placeholder - will be implemented in Task 5.7
  res.send('Submission History - Coming Soon (Task 5.7)');
  // TODO: Replace with: getSubmissions
});

/**
 * Grades View
 * GET /student/grades
 * Display: all course grades, assignment scores breakdown, GPA/average
 */
router.get('/grades', (req, res) => {
  // Placeholder - will be implemented in Task 5.8
  res.send('Grades View - Coming Soon (Task 5.8)');
  // TODO: Replace with: getGrades
});

export default router;
