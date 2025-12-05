/**
 * Teacher Controller
 * Handles teacher-specific operations (dashboard, courses, materials, assignments, grading)
 * Phase 4: Teacher Features Implementation
 */

import { 
  User, 
  Course, 
  CourseTeacher,
  BatchEnrollment, 
  Assignment,
  AssignmentMaterial,
  Submission, 
  Batch, 
  Grade,
  Material
} from '../models/index.js';
import { Op } from 'sequelize';
import cloudinary, { generateSignedUrl, signUrlsInArray, deleteCloudinaryFile } from '../config/cloudinary.js';

/**
 * Helper function to check if a teacher has access to a course
 * Returns the course if teacher has access, null otherwise
 * 
 * @param {number} courseId - The course ID to check
 * @param {number} teacherId - The teacher's user ID
 * @param {Object} options - Additional options
 * @param {boolean} options.requireEdit - Require edit permission
 * @param {boolean} options.requireGrade - Require grade permission
 * @returns {Object|null} Course object if teacher has access, null otherwise
 */
async function checkTeacherCourseAccess(courseId, teacherId, options = {}) {
  const { requireEdit = false, requireGrade = false } = options;
  
  // First check if teacher is the primary teacher (owner)
  const course = await Course.findOne({
    where: { id: courseId }
  });
  
  if (!course) return null;
  
  // Primary teacher has full access
  if (course.teacher_id === teacherId) {
    return course;
  }
  
  // Check CourseTeacher table for additional access
  const accessQuery = {
    course_id: courseId,
    teacher_id: teacherId
  };
  
  if (requireEdit) accessQuery.can_edit = true;
  if (requireGrade) accessQuery.can_grade = true;
  
  const courseTeacher = await CourseTeacher.findOne({
    where: accessQuery
  });
  
  if (courseTeacher) {
    return course;
  }
  
  return null;
}

/**
 * Helper function to get all courses a teacher has access to
 * @param {number} teacherId - The teacher's user ID
 * @returns {Array} Array of course IDs
 */
async function getTeacherCourseIds(teacherId) {
  // Get courses where teacher is the primary teacher
  const ownedCourses = await Course.findAll({
    where: { teacher_id: teacherId },
    attributes: ['id']
  });
  
  // Get courses where teacher is assigned via CourseTeacher
  const assignedCourses = await CourseTeacher.findAll({
    where: { teacher_id: teacherId },
    attributes: ['course_id']
  });
  
  const courseIds = new Set([
    ...ownedCourses.map(c => c.id),
    ...assignedCourses.map(ct => ct.course_id)
  ]);
  
  return Array.from(courseIds);
}

/**
 * Show Teacher Dashboard
 * GET /teacher/dashboard
 * 
 * Displays:
 * - Teacher's courses count (including assigned courses)
 * - Total enrolled students across all courses
 * - Pending submissions count (ungraded)
 * - Recent activity (latest submissions)
 */
export const showDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // 1. Get all course IDs teacher has access to
    const courseIds = await getTeacherCourseIds(teacherId);

    // 2. Get teacher's courses with full details
    const courses = await Course.findAll({
      where: { id: { [Op.in]: courseIds } },
      include: [{
        model: BatchEnrollment,
        include: [{
          model: Batch,
          as: 'batch',
          include: [{
            model: User,
            as: 'students'
          }]
        }]
      }, {
        model: Assignment
      }, {
        model: User,
        as: 'teacher',
        attributes: ['id', 'full_name']
      }, {
        model: CourseTeacher,
        as: 'courseTeachers',
        include: [{
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name']
        }]
      }],
      order: [['created_at', 'DESC']]
    });

    // 3. Calculate statistics
    const totalCourses = courses.length;

    // Get unique students across all teacher's courses
    const studentIds = new Set();
    courses.forEach(course => {
      course.BatchEnrollments.forEach(enrollment => {
        enrollment.batch.students.forEach(student => {
          studentIds.add(student.id);
        });
      });
    });
    const totalStudents = studentIds.size;

    // Get all assignments for teacher's courses
    const assignmentIds = [];
    courses.forEach(course => {
      course.Assignments.forEach(assignment => {
        assignmentIds.push(assignment.id);
      });
    });

    // Count pending submissions (submitted but not graded)
    let pendingSubmissions = 0;
    if (assignmentIds.length > 0) {
      pendingSubmissions = await Submission.count({
        where: {
          assignment_id: { [Op.in]: assignmentIds },
          marks: null // Not graded yet
        }
      });
    }

    // 4. Get recent activity (latest 5 submissions)
    let recentSubmissions = [];
    if (assignmentIds.length > 0) {
      recentSubmissions = await Submission.findAll({
        where: {
          assignment_id: { [Op.in]: assignmentIds }
        },
        include: [{
          model: User,
          as: 'student',
          attributes: ['id', 'full_name', 'email']
        }, {
          model: Assignment,
          as: 'assignment',
          attributes: ['id', 'title', 'course_id'],
          include: [{
            model: Course,
            as: 'course',
            attributes: ['id', 'title', 'code']
          }]
        }],
        order: [['submitted_at', 'DESC']],
        limit: 5
      });
    }

    // 5. Calculate total assignments
    const totalAssignments = assignmentIds.length;

    // 6. Render dashboard
    res.render('teacher/dashboard', {
      user: req.user,
      stats: {
        totalCourses,
        totalStudents,
        totalAssignments,
        pendingSubmissions
      },
      courses,
      recentSubmissions,
      pageTitle: 'Teacher Dashboard'
    });

  } catch (error) {
    console.error('Teacher Dashboard Error:', error);
    res.status(500).send('Error loading dashboard: ' + error.message);
  }
};

/**
 * Get All Courses
 * GET /teacher/courses
 * 
 * Displays list of all courses the teacher has access to (owned + assigned)
 */
export const getCourses = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get all course IDs teacher has access to
    const courseIds = await getTeacherCourseIds(teacherId);

    const courses = await Course.findAll({
      where: { id: { [Op.in]: courseIds } },
      include: [{
        model: BatchEnrollment,
        include: [{
          model: Batch,
          as: 'batch',
          include: [{
            model: User,
            as: 'students'
          }]
        }]
      }, {
        model: Assignment
      }, {
        model: User,
        as: 'teacher',
        attributes: ['id', 'full_name']
      }, {
        model: CourseTeacher,
        as: 'courseTeachers',
        include: [{
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name']
        }]
      }],
      order: [['created_at', 'DESC']]
    });

    // Add a flag to indicate if current teacher is the owner
    const coursesWithOwnership = courses.map(course => ({
      ...course.toJSON(),
      isOwner: course.teacher_id === teacherId
    }));

    res.render('teacher/courses', {
      user: req.user,
      courses: coursesWithOwnership,
      pageTitle: 'My Courses'
    });

  } catch (error) {
    console.error('Get Courses Error:', error);
    res.status(500).send('Error loading courses: ' + error.message);
  }
};

/**
 * Show Course Creation Form
 * GET /teacher/courses/create
 */
export const showCreateCourse = async (req, res) => {
  try {
    res.render('teacher/course-create', {
      user: req.user,
      pageTitle: 'Create New Course',
      errors: null
    });
  } catch (error) {
    console.error('Show Create Course Error:', error);
    res.status(500).send('Error loading form: ' + error.message);
  }
};

/**
 * Create New Course
 * POST /teacher/courses/create
 * 
 * Validates:
 * - All fields required
 * - Course code must be unique
 */
export const createCourse = async (req, res) => {
  try {
    const { title, code, description } = req.body;
    const teacherId = req.user.id;

    // Validation
    const errors = [];

    if (!title || title.trim() === '') {
      errors.push('Course title is required');
    }

    if (!code || code.trim() === '') {
      errors.push('Course code is required');
    }

    if (!description || description.trim() === '') {
      errors.push('Course description is required');
    }

    // Check if course code already exists
    if (code) {
      const existingCourse = await Course.findOne({
        where: { code: code.trim().toUpperCase() }
      });

      if (existingCourse) {
        errors.push('Course code already exists. Please use a different code.');
      }
    }

    // If validation errors, re-render form
    if (errors.length > 0) {
      return res.render('teacher/course-create', {
        user: req.user,
        pageTitle: 'Create New Course',
        errors,
        formData: { title, code, description }
      });
    }

    // Create course
    const newCourse = await Course.create({
      title: title.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      teacher_id: teacherId
    });

    // Redirect to course detail page
    res.redirect(`/teacher/courses/${newCourse.id}`);

  } catch (error) {
    console.error('Create Course Error:', error);
    res.status(500).send('Error creating course: ' + error.message);
  }
};

/**
 * Get Course Detail
 * GET /teacher/courses/:id
 * 
 * Shows course details, enrolled batches, materials, assignments
 * Verifies teacher has access to the course (owner or assigned)
 */
export const getCourseDetail = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    // Check if teacher has access to this course
    const hasAccess = await checkTeacherCourseAccess(courseId, teacherId);
    if (!hasAccess) {
      return res.status(404).send('Course not found or you do not have permission to view it');
    }

    const course = await Course.findByPk(courseId, {
      include: [{
        model: BatchEnrollment,
        include: [{
          model: Batch,
          as: 'batch',
          include: [{
            model: User,
            as: 'students'
          }]
        }]
      }, {
        model: Assignment,
        include: [{
          model: Submission
        }, {
          model: AssignmentMaterial,
          as: 'materials'
        }]
      }, {
        model: User,
        as: 'teacher',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: CourseTeacher,
        as: 'courseTeachers',
        include: [{
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name', 'email']
        }]
      }]
    });

    if (!course) {
      return res.status(404).send('Course not found');
    }

    // Calculate enrolled students
    let totalStudents = 0;
    const enrolledBatches = [];
    
    course.BatchEnrollments.forEach(enrollment => {
      const studentsCount = enrollment.batch.students.length;
      totalStudents += studentsCount;
      enrolledBatches.push({
        id: enrollment.batch.id,
        name: enrollment.batch.name,
        code: enrollment.batch.code,
        studentsCount
      });
    });

    // Check if current teacher is the owner
    const isOwner = course.teacher_id === teacherId;

    // Get teacher's permissions if not owner
    let permissions = { can_edit: true, can_grade: true };
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: courseId, teacher_id: teacherId }
      });
      if (courseTeacher) {
        permissions = {
          can_edit: courseTeacher.can_edit,
          can_grade: courseTeacher.can_grade
        };
      }
    }

    // Sign assignment material URLs for authenticated access (12-hour expiry)
    if (course.Assignments) {
      course.Assignments.forEach(assignment => {
        if (assignment.materials && assignment.materials.length > 0) {
          assignment.materials = signUrlsInArray(assignment.materials, 'url', 'assignment');
        }
      });
    }

    res.render('teacher/course-detail', {
      user: req.user,
      course,
      totalStudents,
      enrolledBatches,
      isOwner,
      permissions,
      pageTitle: course.title
    });

  } catch (error) {
    console.error('Get Course Detail Error:', error);
    res.status(500).send('Error loading course details: ' + error.message);
  }
};

/**
 * Get Course Materials
 * GET /teacher/courses/:id/materials
 * 
 * Shows all materials for a course with upload form
 */
export const getMaterials = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    // Verify teacher has access to the course (with edit permission for uploads)
    const course = await checkTeacherCourseAccess(courseId, teacherId);

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
    }

    // Check edit permission
    const isOwner = course.teacher_id === teacherId;
    let canEdit = isOwner;
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: courseId, teacher_id: teacherId }
      });
      canEdit = courseTeacher ? courseTeacher.can_edit : false;
    }

    // Get all materials for this course
    const materials = await Material.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'DESC']]
    });

    // Sign URLs for authenticated access (24-hour expiry for materials)
    const signedMaterials = signUrlsInArray(materials, 'file_url', 'material');

    res.render('teacher/materials', {
      user: req.user,
      course,
      materials: signedMaterials,
      canEdit,
      pageTitle: `Materials - ${course.title}`,
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Materials Error:', error);
    res.status(500).send('Error loading materials: ' + error.message);
  }
};

/**
 * Upload Material
 * POST /teacher/courses/:id/materials/upload
 * 
 * Handles both file upload and URL input
 * Supports: PDF, DOC, DOCX, PPT, PPTX (max 10MB)
 */
export const uploadMaterial = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;
    const { title, description, material_url } = req.body;

    // Verify teacher has access and edit permission
    const course = await checkTeacherCourseAccess(courseId, teacherId, { requireEdit: true });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/materials?error=Course not found or you do not have edit permission`);
    }

    // Validation
    if (!title || title.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/materials?error=Title is required`);
    }

    let fileUrl = material_url || '';
    let fileType = 'url'; // Default to URL

    // Check if file was uploaded
    if (req.file) {
      fileUrl = req.file.path; // Cloudinary URL
      
      // Extract file extension from original filename
      const originalName = req.file.originalname;
      const extMatch = originalName.match(/\.([a-z0-9]+)$/i);
      fileType = extMatch ? extMatch[1].toLowerCase() : 'file';
    } else if (!material_url || material_url.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/materials?error=Please upload a file or provide a URL`);
    }

    // Validate URL format if provided
    if (material_url && !req.file) {
      // More flexible URL pattern that supports YouTube, Google Drive, etc.
      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(material_url)) {
        return res.redirect(`/teacher/courses/${courseId}/materials?error=Invalid URL format. URL must start with http:// or https://`);
      }
    }

    // Create material
    await Material.create({
      course_id: courseId,
      title: title.trim(),
      description: description ? description.trim() : null,
      file_url: fileUrl,
      file_type: fileType
    });

    res.redirect(`/teacher/courses/${courseId}/materials?success=Material uploaded successfully`);

  } catch (error) {
    console.error('Upload Material Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/materials?error=Error uploading material: ${error.message}`);
  }
};

/**
 * Delete Material
 * DELETE /teacher/materials/:id
 * 
 * Deletes material and associated Cloudinary file if exists
 */
export const deleteMaterial = async (req, res) => {
  try {
    const materialId = req.params.id;
    const teacherId = req.user.id;

    // Find material
    const material = await Material.findByPk(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check teacher has edit access to the course
    const course = await checkTeacherCourseAccess(material.course_id, teacherId, { requireEdit: true });

    if (!course) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this material'
      });
    }

    const courseId = material.course_id;

    // Delete from Cloudinary if it's a Cloudinary URL
    if (material.file_url && material.file_url.includes('cloudinary.com')) {
      try {
        await deleteCloudinaryFile(material.file_url);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    await material.destroy();

    res.json({
      success: true,
      message: 'Material deleted successfully',
      redirectUrl: `/teacher/courses/${courseId}/materials?success=Material deleted successfully`
    });

  } catch (error) {
    console.error('Delete Material Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting material: ' + error.message
    });
  }
};

/**
 * Show Assignment Creation Form
 * GET /teacher/courses/:id/assignments/create
 * 
 * Displays form to create a new assignment for a course
 */
export const showCreateAssignment = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    // Verify teacher has access with edit permission
    const course = await checkTeacherCourseAccess(courseId, teacherId, { requireEdit: true });

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to create assignments');
    }

    res.render('teacher/assignment-create', {
      user: req.user,
      course,
      pageTitle: `Create Assignment - ${course.code}`,
      error: req.query.error
    });

  } catch (error) {
    console.error('Show Create Assignment Error:', error);
    res.status(500).send('Error loading assignment creation form: ' + error.message);
  }
};

/**
 * Create New Assignment
 * POST /teacher/courses/:id/assignments
 * 
 * Creates a new assignment for a course with optional materials (files/URLs)
 * Validates: deadline must be in the future
 */
export const createAssignment = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;
    const { title, description, deadline, material_titles, url_titles, material_urls } = req.body;
    const uploadedFiles = req.files || [];

    // Verify teacher has access with edit permission
    const course = await checkTeacherCourseAccess(courseId, teacherId, { requireEdit: true });

    if (!course) {
      return res.redirect(`/teacher/courses?error=Course not found or you do not have permission to create assignments`);
    }

    // Validation
    if (!title || title.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/assignments/create?error=Title is required`);
    }

    if (!deadline) {
      return res.redirect(`/teacher/courses/${courseId}/assignments/create?error=Deadline is required`);
    }

    // Server-side deadline validation - must be in the future
    const deadlineDate = new Date(deadline);
    const now = new Date();

    if (deadlineDate <= now) {
      return res.redirect(`/teacher/courses/${courseId}/assignments/create?error=Deadline must be in the future`);
    }

    // Create assignment
    const assignment = await Assignment.create({
      course_id: courseId,
      title: title.trim(),
      description: description ? description.trim() : null,
      deadline: deadlineDate,
      created_by: teacherId
    });

    // Process uploaded files
    if (uploadedFiles && uploadedFiles.length > 0) {
      const fileTitles = Array.isArray(material_titles) ? material_titles : [material_titles].filter(Boolean);
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileTitle = fileTitles[i] || file.originalname;

        await AssignmentMaterial.create({
          assignment_id: assignment.id,
          title: fileTitle,
          type: 'file',
          url: file.path, // Cloudinary URL
          file_type: file.mimetype
        });
      }
    }

    // Process URL links
    if (material_urls) {
      const urls = Array.isArray(material_urls) ? material_urls : [material_urls];
      const urlTitlesArray = Array.isArray(url_titles) ? url_titles : [url_titles].filter(Boolean);
      
      for (let i = 0; i < urls.length; i++) {
        if (urls[i] && urls[i].trim() !== '') {
          const urlTitle = urlTitlesArray[i] || urls[i];
          
          await AssignmentMaterial.create({
            assignment_id: assignment.id,
            title: urlTitle,
            type: 'url',
            url: urls[i].trim()
          });
        }
      }
    }

    res.redirect(`/teacher/courses/${courseId}?success=Assignment created successfully with materials`);

  } catch (error) {
    console.error('Create Assignment Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/assignments/create?error=Error creating assignment: ${error.message}`);
  }
};

/**
 * Show Edit Assignment Form
 * GET /teacher/assignments/:id/edit
 * 
 * Shows form to edit assignment deadline only
 * Displays submission stats and warnings
 */
export const showEditAssignment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;

    // Get assignment with course details
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    // Check if assignment exists
    if (!assignment) {
      return res.status(404).send('Assignment not found');
    }

    // Check if teacher has access with edit permission
    const course = await checkTeacherCourseAccess(assignment.course_id, teacherId, { requireEdit: true });
    if (!course) {
      return res.status(403).send('You do not have permission to edit this assignment');
    }

    // Get submission statistics
    const submissionCount = await Submission.count({
      where: { assignment_id: assignmentId }
    });

    const gradedCount = await Submission.count({
      where: { 
        assignment_id: assignmentId,
        marks: { [Op.not]: null }
      }
    });

    const hasSubmissions = submissionCount > 0;

    res.render('teacher/assignment-edit', {
      user: req.user,
      assignment,
      course,
      submissionCount,
      gradedCount,
      hasSubmissions,
      pageTitle: `Edit Assignment - ${assignment.title}`,
      error: req.query.error
    });

  } catch (error) {
    console.error('Show Edit Assignment Error:', error);
    res.status(500).send('Error loading assignment: ' + error.message);
  }
};

/**
 * Edit Assignment
 * POST /teacher/assignments/:id/edit
 * 
 * Updates assignment details (title, description, deadline)
 * Validates: future date, teacher has edit permission
 */
export const editAssignment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;
    const { title, description, deadline, change_reason } = req.body;

    // Get assignment with course details
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    // Check if assignment exists
    if (!assignment) {
      return res.status(404).send('Assignment not found');
    }

    // Check if teacher has edit permission
    const course = await checkTeacherCourseAccess(assignment.course_id, teacherId, { requireEdit: true });
    if (!course) {
      return res.status(403).send('You do not have permission to edit this assignment');
    }

    // Validation
    if (!title || !deadline) {
      return res.redirect(`/teacher/assignments/${assignmentId}/edit?error=Title and deadline are required`);
    }

    // Server-side deadline validation - must be in the future
    const newDeadline = new Date(deadline);
    const now = new Date();

    if (newDeadline <= now) {
      return res.redirect(`/teacher/assignments/${assignmentId}/edit?error=Deadline must be in the future`);
    }

    // Update assignment fields
    let hasChanges = false;
    
    if (assignment.title !== title.trim()) {
      assignment.title = title.trim();
      hasChanges = true;
    }
    
    if (assignment.description !== (description || '').trim()) {
      assignment.description = (description || '').trim();
      hasChanges = true;
    }
    
    const oldDeadline = new Date(assignment.deadline);
    if (newDeadline.getTime() !== oldDeadline.getTime()) {
      assignment.deadline = newDeadline;
      hasChanges = true;
    }

    if (!hasChanges) {
      return res.redirect(`/teacher/courses/${assignment.course_id}?info=No changes made to assignment`);
    }

    await assignment.save();

    // Log change reason if provided (for future audit trail feature)
    if (change_reason && change_reason.trim() !== '') {
      console.log(`Assignment ${assignmentId} updated by teacher ${teacherId}: ${change_reason.trim()}`);
    }

    res.redirect(`/teacher/courses/${assignment.course_id}?success=Assignment updated successfully`);

  } catch (error) {
    console.error('Edit Assignment Error:', error);
    res.redirect(`/teacher/assignments/${req.params.id}/edit?error=Error updating assignment: ${error.message}`);
  }
};

/**
 * Get Submissions for Assignment
 * GET /teacher/assignments/:id/submissions
 * 
 * Displays all student submissions for a specific assignment
 * Shows: student info, submission date, grading status, score
 */
export const getSubmissions = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;

    // 1. Get assignment with course details
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    // Check if assignment exists
    if (!assignment) {
      return res.status(404).send('Assignment not found');
    }

    // Check if teacher has access (view submissions doesn't require grade permission, just access)
    const course = await checkTeacherCourseAccess(assignment.course_id, teacherId);
    if (!course) {
      return res.status(403).send('You do not have permission to view submissions for this assignment');
    }

    // Check if teacher can grade
    const isOwner = course.teacher_id === teacherId;
    let canGrade = isOwner;
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: assignment.course_id, teacher_id: teacherId }
      });
      canGrade = courseTeacher ? courseTeacher.can_grade : false;
    }

    // 2. Get all submissions for this assignment with student details
    const submissions = await Submission.findAll({
      where: { assignment_id: assignmentId },
      include: [{
        model: User,
        as: 'student',
        attributes: ['id', 'full_name', 'email', 'batch_id'],
        include: [{
          model: Batch,
          as: 'batch',
          attributes: ['id', 'name', 'code']
        }]
      }],
      order: [['submitted_at', 'DESC']] // Most recent first
    });

    // Sign URLs for authenticated access (1-hour expiry for submissions)
    const signedSubmissions = signUrlsInArray(submissions, 'file_url', 'submission');

    // 3. Render submissions view
    res.render('teacher/submissions', {
      user: req.user,
      assignment,
      course,
      submissions: signedSubmissions,
      canGrade,
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Submissions Error:', error);
    res.status(500).send('Error loading submissions: ' + error.message);
  }
};

/**
 * Show Grade Submission Form
 * GET /teacher/submissions/:id/grade
 * 
 * Displays the grading form with submission details
 * Shows: student work, file download, current grade (if exists)
 */
export const showGradeForm = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const submissionId = req.params.id;

    // 1. Get submission with student, assignment, and course details
    const submission = await Submission.findByPk(submissionId, {
      include: [{
        model: User,
        as: 'student',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: Assignment,
        as: 'assignment',
        include: [{
          model: Course,
          as: 'course'
        }]
      }]
    });

    // Check if submission exists
    if (!submission) {
      return res.status(404).send('Submission not found');
    }

    // Check if teacher has grade permission
    const course = await checkTeacherCourseAccess(submission.assignment.course_id, teacherId, { requireGrade: true });
    if (!course) {
      return res.status(403).send('You do not have permission to grade this submission');
    }

    const assignment = submission.assignment;

    // Sign the submission file URL for authenticated access (1-hour expiry)
    if (submission.file_url) {
      submission.file_url = generateSignedUrl(submission.file_url, { type: 'submission' });
    }

    // 2. Render grading form
    res.render('teacher/grade-submission', {
      user: req.user,
      submission,
      assignment,
      course,
      error: req.query.error
    });

  } catch (error) {
    console.error('Show Grade Form Error:', error);
    res.status(500).send('Error loading grading form: ' + error.message);
  }
};

/**
 * Process Grading
 * POST /teacher/submissions/:id/grade
 * 
 * Saves marks and feedback for a submission
 * Validates: marks must be 0-100
 */
export const gradeSubmission = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const submissionId = req.params.id;
    const { marks, feedback } = req.body;

    // 1. Get submission with assignment
    const submission = await Submission.findByPk(submissionId, {
      include: [{
        model: Assignment,
        as: 'assignment',
        include: [{
          model: Course,
          as: 'course'
        }]
      }]
    });

    if (!submission) {
      return res.status(404).send('Submission not found');
    }

    // Check if teacher has grade permission
    const course = await checkTeacherCourseAccess(submission.assignment.course_id, teacherId, { requireGrade: true });
    if (!course) {
      return res.status(403).send('You do not have permission to grade this submission');
    }

    // 2. Validate marks
    if (!marks || marks === '') {
      return res.redirect(`/teacher/submissions/${submissionId}/grade?error=Score is required`);
    }

    const marksNum = parseFloat(marks);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) {
      return res.redirect(`/teacher/submissions/${submissionId}/grade?error=Score must be between 0 and 100`);
    }

    // 3. Update submission with grade
    await submission.update({
      marks: marksNum,
      feedback: feedback ? feedback.trim() : null,
      graded_by: teacherId
    });

    // 4. Redirect back to submissions list with success message
    const assignmentId = submission.assignment.id;
    res.redirect(`/teacher/assignments/${assignmentId}/submissions?success=Submission graded successfully`);

  } catch (error) {
    console.error('Grade Submission Error:', error);
    res.redirect(`/teacher/submissions/${req.params.id}/grade?error=Error grading submission: ${error.message}`);
  }
};

/**
 * Get grades management page for a course
 * Displays all students with their assignment scores and suggested grades
 */
export const getGrades = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;

    // 1. Check if teacher has access to the course
    const course = await checkTeacherCourseAccess(courseId, teacherId);

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
    }

    // Check if teacher can grade
    const isOwner = course.teacher_id === teacherId;
    let canGrade = isOwner;
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: courseId, teacher_id: teacherId }
      });
      canGrade = courseTeacher ? courseTeacher.can_grade : false;
    }

    // Get full course details
    const fullCourse = await Course.findByPk(courseId, {
      include: [{
        model: User,
        as: 'teacher',
        attributes: ['id', 'full_name', 'email']
      }]
    });

    // 2. Import gradeService
    const { calculateSuggestedGrade } = await import('../services/gradeService.js');

    // 3. Get all students who have submitted assignments in this course
    const submissions = await Submission.findAll({
      include: [
        {
          model: Assignment,
          as: 'assignment',
          where: { course_id: courseId },
          attributes: ['id', 'title', 'course_id']
        },
        {
          model: User,
          as: 'student',
          attributes: ['id', 'full_name', 'email', 'username']
        }
      ],
      attributes: ['student_id'],
      raw: true
    });

    // Get unique student IDs
    const uniqueStudentIds = [...new Set(submissions.map(s => s.student_id))];

    // 4. For each student, calculate suggested grade and fetch current grade
    const studentGrades = await Promise.all(
      uniqueStudentIds.map(async (studentId) => {
        // Find student info
        const studentSubmission = submissions.find(s => s.student_id === studentId);
        const studentName = studentSubmission['student.full_name'];
        const studentEmail = studentSubmission['student.email'];

        // Calculate suggested grade
        const gradeData = await calculateSuggestedGrade(studentId, courseId);

        // Fetch current grade if exists
        const currentGrade = await Grade.findOne({
          where: {
            course_id: courseId,
            student_id: studentId
          }
        });

        return {
          studentId,
          studentName,
          studentEmail,
          ...gradeData,
          currentGrade: currentGrade ? {
            grade: currentGrade.grade,
            remarks: currentGrade.remarks
          } : null
        };
      })
    );

    // 5. Render grades page
    res.render('teacher/grades', {
      user: req.user,
      course: fullCourse,
      studentGrades,
      canGrade,
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Grades Error:', error);
    res.status(500).send('Error loading grades page: ' + error.message);
  }
};

/**
 * Save or update a student's final grade
 */
export const saveGrade = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;
    const { studentId, grade, remarks } = req.body;

    // 1. Verify teacher has grade permission
    const course = await checkTeacherCourseAccess(courseId, teacherId, { requireGrade: true });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Course not found or you do not have grade permission`);
    }

    // 2. Validate grade input
    if (!grade || grade.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Grade is required`);
    }

    const gradeTrimmed = grade.trim();

    // Validate grade format (letter A-F with optional +/- or numeric 0-100)
    const letterGradePattern = /^[A-Fa-f][+-]?$/;
    const numericGradePattern = /^\d+(\.\d+)?$/;

    if (!letterGradePattern.test(gradeTrimmed) && !numericGradePattern.test(gradeTrimmed)) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Invalid grade format. Use letter (A-F) or percentage (0-100)`);
    }

    // If numeric, validate range
    if (numericGradePattern.test(gradeTrimmed)) {
      const numGrade = parseFloat(gradeTrimmed);
      if (numGrade < 0 || numGrade > 100) {
        return res.redirect(`/teacher/courses/${courseId}/grades?error=Numeric grade must be between 0 and 100`);
      }
    }

    // 3. Check if student exists
    const student = await User.findByPk(studentId);
    if (!student || student.role !== 'student') {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Student not found`);
    }

    // 4. Create or update grade
    const [gradeRecord, created] = await Grade.findOrCreate({
      where: {
        course_id: courseId,
        student_id: studentId
      },
      defaults: {
        grade: gradeTrimmed,
        remarks: remarks ? remarks.trim() : null
      }
    });

    if (!created) {
      // Update existing grade
      await gradeRecord.update({
        grade: gradeTrimmed,
        remarks: remarks ? remarks.trim() : null
      });
    }

    // 5. Redirect with success message
    const successMsg = created ? 'Grade saved successfully' : 'Grade updated successfully';
    res.redirect(`/teacher/courses/${courseId}/grades?success=${successMsg}`);

  } catch (error) {
    console.error('Save Grade Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/grades?error=Error saving grade: ${error.message}`);
  }
};

/**
 * Bulk upload grades from CSV file
 * Only students in this course can be graded
 */
export const bulkUploadGrades = async (req, res) => {
  const { sequelize } = await import('../models/index.js');
  const transaction = await sequelize.transaction();
  
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;

    // 1. Verify teacher has grade permission
    const course = await checkTeacherCourseAccess(courseId, teacherId, { requireGrade: true });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Course not found or you do not have grade permission`);
    }

    // 2. Check if file was uploaded
    if (!req.file) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=No CSV file uploaded`);
    }

    // 3. Parse CSV
    const { parseCsv, validateTeacherGradeCsv } = await import('../services/csvService.js');
    const parseResult = parseCsv(req.file.buffer);

    if (!parseResult.success) {
      const { formatErrors } = await import('../services/csvService.js');
      const errorMsg = formatErrors(parseResult.errors);
      return res.redirect(`/teacher/courses/${courseId}/grades?error=${encodeURIComponent('CSV Parse Error: ' + errorMsg)}`);
    }

    // 4. Validate CSV structure
    const validation = validateTeacherGradeCsv(parseResult.data);
    if (!validation.valid) {
      const { formatErrors } = await import('../services/csvService.js');
      const errorMsg = formatErrors(validation.errors);
      return res.redirect(`/teacher/courses/${courseId}/grades?error=${encodeURIComponent('CSV Validation Error: ' + errorMsg)}`);
    }

    // 5. Get all students who have submitted in this course
    const submissions = await Submission.findAll({
      include: [
        {
          model: Assignment,
          as: 'assignment',
          where: { course_id: courseId },
          attributes: ['id', 'course_id']
        },
        {
          model: User,
          as: 'student',
          attributes: ['id', 'email', 'username', 'full_name']
        }
      ],
      attributes: ['student_id'],
      raw: true
    });

    const eligibleStudents = [...new Set(submissions.map(s => s.student_id))];
    
    // Create student lookup map by email and username
    const studentMap = new Map();
    for (const submission of submissions) {
      const studentId = submission.student_id;
      const studentEmail = submission['student.email'];
      const studentUsername = submission['student.username'];
      
      if (studentEmail) studentMap.set(studentEmail.toLowerCase(), studentId);
      if (studentUsername) studentMap.set(studentUsername.toLowerCase(), studentId);
    }

    // 6. Process each row
    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    for (const row of parseResult.data) {
      try {
        // Get student identifier
        const identifier = (row.student_email || row.username || row.email).toLowerCase();
        const studentId = studentMap.get(identifier);

        if (!studentId) {
          results.skipped.push({
            identifier: row.student_email || row.username || row.email,
            reason: 'Student not found in this course or has not submitted any assignments'
          });
          continue;
        }

        // Validate grade format
        const gradeTrimmed = row.grade.trim();
        const letterGradePattern = /^[A-Fa-f][+-]?$/;
        const numericGradePattern = /^\d+(\.\d+)?$/;

        if (!letterGradePattern.test(gradeTrimmed) && !numericGradePattern.test(gradeTrimmed)) {
          results.failed.push({
            identifier: row.student_email || row.username || row.email,
            reason: `Invalid grade format: ${row.grade}`
          });
          continue;
        }

        // If numeric, validate range
        if (numericGradePattern.test(gradeTrimmed)) {
          const numGrade = parseFloat(gradeTrimmed);
          if (numGrade < 0 || numGrade > 100) {
            results.failed.push({
              identifier: row.student_email || row.username || row.email,
              reason: `Grade out of range (0-100): ${row.grade}`
            });
            continue;
          }
        }

        // Create or update grade
        const [gradeRecord, created] = await Grade.findOrCreate({
          where: {
            course_id: courseId,
            student_id: studentId
          },
          defaults: {
            grade: gradeTrimmed,
            remarks: row.remarks ? row.remarks.trim() : null
          },
          transaction
        });

        if (!created) {
          await gradeRecord.update({
            grade: gradeTrimmed,
            remarks: row.remarks ? row.remarks.trim() : null
          }, { transaction });
        }

        results.success.push({
          identifier: row.student_email || row.username || row.email,
          grade: gradeTrimmed,
          action: created ? 'created' : 'updated'
        });

      } catch (rowError) {
        console.error('Row processing error:', rowError);
        results.failed.push({
          identifier: row.student_email || row.username || row.email,
          reason: rowError.message
        });
      }
    }

    // 7. Commit transaction
    await transaction.commit();

    // 8. Build success message
    let successMsg = `Bulk upload complete: ${results.success.length} grade(s) processed`;
    if (results.skipped.length > 0) {
      successMsg += `, ${results.skipped.length} skipped`;
    }
    if (results.failed.length > 0) {
      successMsg += `, ${results.failed.length} failed`;
    }

    // Log details for debugging
    console.log('Bulk Grade Upload Results:', {
      success: results.success.length,
      skipped: results.skipped.length,
      failed: results.failed.length
    });

    res.redirect(`/teacher/courses/${courseId}/grades?success=${encodeURIComponent(successMsg)}`);

  } catch (error) {
    await transaction.rollback();
    console.error('Bulk Upload Grades Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/grades?error=Error processing bulk upload: ${error.message}`);
  }
};

/**
 * Download CSV template for bulk grade upload
 */
export const downloadGradeTemplate = async (req, res) => {
  try {
    const csvContent = `student_email,grade,remarks
student1@example.com,A,Excellent performance
student2@example.com,85.5,Good work
student3@example.com,B+,Well done`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=grade-upload-template.csv');
    res.send(csvContent);

  } catch (error) {
    console.error('Download Template Error:', error);
    res.status(500).send('Error generating template');
  }
};

/**
 * Delete an assignment
 * DELETE /teacher/assignments/:id
 * Deletes assignment and all associated materials and submissions
 */
export const deleteAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const teacherId = req.user.id;

    // 1. Fetch assignment with course
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    if (!assignment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Assignment not found' 
      });
    }

    // 2. Verify teacher has edit permission
    const course = await checkTeacherCourseAccess(assignment.course_id, teacherId, { requireEdit: true });
    if (!course) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to delete this assignment' 
      });
    }

    // 3. Get all assignment materials to delete from Cloudinary
    const materials = await AssignmentMaterial.findAll({
      where: { 
        assignment_id: assignmentId,
        type: 'file' // Only files have Cloudinary URLs
      }
    });

    // 4. Delete files from Cloudinary
    for (const material of materials) {
      try {
        await deleteCloudinaryFile(material.url);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue even if Cloudinary deletion fails
      }
    }

    // 5. Get all submissions to delete files from Cloudinary
    const submissions = await Submission.findAll({
      where: { assignment_id: assignmentId }
    });

    for (const submission of submissions) {
      if (submission.file_url) {
        try {
          await deleteCloudinaryFile(submission.file_url);
        } catch (cloudinaryError) {
          console.error('Cloudinary deletion error:', cloudinaryError);
        }
      }
    }

    const courseId = assignment.course_id;

    // 6. Delete assignment (CASCADE will delete materials and submissions)
    await assignment.destroy();

    res.json({ 
      success: true, 
      message: 'Assignment deleted successfully',
      redirectUrl: `/teacher/courses/${courseId}`
    });

  } catch (error) {
    console.error('Delete Assignment Error:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error deleting assignment: ${error.message}` 
    });
  }
};

