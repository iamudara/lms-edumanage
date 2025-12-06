/**
 * Teacher Routes
 * Handles teacher-specific routes (dashboard, courses, assignments, materials, grading)
 * Phase 4: Teacher Features Implementation
 */

import express from 'express';
import { 
  showDashboard,
  getCourses,
  getAssignments,
  showCreateCourse,
  createCourse,
  getCourseDetail,
  getMaterials,
  uploadMaterial,
  deleteMaterial,
  showCreateAssignment,
  createAssignment,
  showEditAssignment,
  editAssignment,
  deleteAssignment,
  getSubmissions,
  showGradeForm,
  gradeSubmission,
  getGrades,
  saveGrade,
  bulkUploadGrades,
  downloadGradeTemplate,
  bulkUploadAssignmentGrades,
  downloadAssignmentGradeTemplate,
  // Folder management
  createFolder,
  renameFolder,
  deleteFolder,
  getFolderSharedCourses,
  shareFolderWithCourses,
  unshareFolder,
  moveMaterialToFolder,
  getMaterialsWithFolders,
  uploadMaterialToFolder
} from '../controllers/teacherController.js';
import { uploadMaterial as uploadMiddleware, uploadAssignmentMaterials, uploadCsv } from '../middleware/upload.js';

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

// ============================================
// ASSIGNMENT MANAGEMENT (All Assignments View)
// ============================================

/**
 * Get all assignments across all courses
 * GET /teacher/assignments
 * Lists all assignments for all courses this teacher has access to
 */
router.get('/assignments', getAssignments);

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
 * Get materials for a course (with folder structure)
 * GET /teacher/courses/:id/materials
 * Lists all materials for a specific course, organized by folders
 */
router.get('/courses/:id/materials', getMaterialsWithFolders);

/**
 * Upload material to course
 * POST /teacher/courses/:id/materials/upload
 * Handles file upload or URL input for course materials
 */
router.post('/courses/:id/materials/upload', uploadMiddleware, uploadMaterial);

/**
 * Delete a material
 * DELETE /teacher/materials/:id
 * DELETE /teacher/courses/:course_id/materials/:id
 * Removes a material (can be direct or folder-based)
 */
router.delete('/materials/:id', deleteMaterial);
router.delete('/courses/:course_id/materials/:id', deleteMaterial);

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
 * Processes assignment creation (title, description, deadline, materials)
 */
router.post('/courses/:id/assignments', uploadAssignmentMaterials, createAssignment);

/**
 * Get assignment edit form
 * GET /teacher/assignments/:id/edit
 * Form to edit assignment deadline
 */
router.get('/assignments/:id/edit', showEditAssignment);

/**
 * Update assignment deadline
 * POST /teacher/assignments/:id/edit
 * Updates assignment deadline only
 */
router.post('/assignments/:id/edit', editAssignment);

/**
 * Delete assignment
 * DELETE /teacher/assignments/:id
 * Deletes assignment and all associated data
 */
router.delete('/assignments/:id', deleteAssignment);

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
 * Bulk grade upload for an assignment
 * POST /teacher/assignments/:id/grades/bulk
 * Processes CSV file for bulk grading assignment submissions
 */
router.post('/assignments/:id/grades/bulk', uploadCsv, bulkUploadAssignmentGrades);

/**
 * Download CSV template for assignment grade upload
 * GET /teacher/assignments/:id/grades/template
 * Downloads a CSV template pre-filled with students who submitted
 */
router.get('/assignments/:id/grades/template', downloadAssignmentGradeTemplate);

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

// ============================================
// FOLDER MANAGEMENT
// ============================================

/**
 * Create a new folder
 * POST /teacher/folders
 * Creates a new folder (optionally as subfolder)
 */
router.post('/folders', createFolder);

/**
 * Rename a folder
 * PUT /teacher/folders/:id
 * Updates folder name and description
 */
router.put('/folders/:id', renameFolder);

/**
 * Delete a folder
 * DELETE /teacher/folders/:id
 * Deletes folder (with option to delete or move contents)
 */
router.delete('/folders/:id', deleteFolder);

/**
 * Get shared courses for a folder
 * GET /teacher/folders/:id/shared-courses
 * Returns list of course IDs this folder is shared with
 */
router.get('/folders/:id/shared-courses', getFolderSharedCourses);

/**
 * Share folder with courses
 * POST /teacher/folders/:id/share
 * Shares folder (and subfolders) with selected courses
 */
router.post('/folders/:id/share', shareFolderWithCourses);

/**
 * Remove folder from a course
 * DELETE /teacher/folders/:id/share/:courseId
 * Removes folder sharing from a specific course
 */
router.delete('/folders/:id/share/:courseId', unshareFolder);

/**
 * Upload material to a folder
 * POST /teacher/folders/:id/materials
 * Uploads material directly to a folder
 */
router.post('/folders/:id/materials', uploadMiddleware, uploadMaterialToFolder);

/**
 * Move material to a folder
 * PUT /teacher/materials/:id/move
 * Moves material to a folder or root level
 */
router.put('/materials/:id/move', moveMaterialToFolder);

export default router;
