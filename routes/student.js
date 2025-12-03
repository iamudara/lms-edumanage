/**
 * Student Routes
 * Handles student-specific routes (dashboard, courses, assignments, submissions, grades)
 * Phase 5: Student Features Implementation
 */

import express from 'express';
import {
  showDashboard,
  getAllCourses,
  getCourseView,
  getAssignmentDetail,
  submitAssignment,
  getSubmissions,
  getGrades
} from '../controllers/studentController.js';
import { uploadSubmission } from '../middleware/upload.js';

const router = express.Router();

/**
 * Student Dashboard
 * GET /student/dashboard
 * Display: enrolled courses, upcoming deadlines, recent grades, pending assignments
 */
router.get('/dashboard', showDashboard);

/**
 * My Courses
 * GET /student/courses
 * Display: list of all enrolled courses
 */
router.get('/courses', getAllCourses);

/**
 * Course View (Student)
 * GET /student/courses/:id
 * Display: course info, materials, assignments list, course grade
 * Must check: student's batch is enrolled in this course
 */
router.get('/courses/:id', getCourseView);

/**
 * Assignment Detail View
 * GET /student/assignments/:id
 * Display: assignment description, deadline, submission status, submit button
 */
router.get('/assignments/:id', getAssignmentDetail);

/**
 * Submit Assignment
 * POST /student/assignments/:id/submit
 * Validation: enrolled, deadline not passed, file/text provided
 * Upload to Cloudinary, store in submissions table
 * Note: Students can resubmit (UPDATE) before deadline
 */
router.post('/assignments/:id/submit', uploadSubmission, submitAssignment);

/**
 * Submission History
 * GET /student/submissions
 * Display: all submissions, status, scores, feedback
 * Optional: filter by course
 */
router.get('/submissions', getSubmissions);

/**
 * Grades View
 * GET /student/grades
 * Display: all course grades, assignment scores breakdown, GPA/average
 */
router.get('/grades', getGrades);

export default router;
