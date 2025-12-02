/**
 * Teacher Controller
 * Handles teacher-specific operations (dashboard, courses, materials, assignments, grading)
 * Phase 4: Teacher Features Implementation
 */

import { 
  User, 
  Course, 
  BatchEnrollment, 
  Assignment, 
  Submission, 
  Batch, 
  Grade,
  Material
} from '../models/index.js';
import { Op } from 'sequelize';
import cloudinary from '../config/cloudinary.js';

/**
 * Show Teacher Dashboard
 * GET /teacher/dashboard
 * 
 * Displays:
 * - Teacher's courses count
 * - Total enrolled students across all courses
 * - Pending submissions count (ungraded)
 * - Recent activity (latest submissions)
 */
export const showDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // 1. Get teacher's courses
    const courses = await Course.findAll({
      where: { teacher_id: teacherId },
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
      }],
      order: [['created_at', 'DESC']]
    });

    // 2. Calculate statistics
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

    // 3. Get recent activity (latest 5 submissions)
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

    // 4. Calculate total assignments
    const totalAssignments = assignmentIds.length;

    // 5. Render dashboard
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
 * Displays list of all courses created by the teacher
 */
export const getCourses = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const courses = await Course.findAll({
      where: { teacher_id: teacherId },
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
      }],
      order: [['created_at', 'DESC']]
    });

    res.render('teacher/courses', {
      user: req.user,
      courses,
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
 * Verifies teacher owns the course
 */
export const getCourseDetail = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    const course = await Course.findOne({
      where: { 
        id: courseId,
        teacher_id: teacherId // Ensure teacher owns this course
      },
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
        }]
      }]
    });

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to view it');
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

    res.render('teacher/course-detail', {
      user: req.user,
      course,
      totalStudents,
      enrolledBatches,
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

    // Verify teacher owns the course
    const course = await Course.findOne({
      where: { 
        id: courseId,
        teacher_id: teacherId
      }
    });

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
    }

    // Get all materials for this course
    const materials = await Material.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'DESC']]
    });

    res.render('teacher/materials', {
      user: req.user,
      course,
      materials,
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

    // Verify teacher owns the course
    const course = await Course.findOne({
      where: { 
        id: courseId,
        teacher_id: teacherId
      }
    });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/materials?error=Course not found`);
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

    // Find material with course to verify ownership
    const material = await Material.findOne({
      where: { id: materialId },
      include: [{
        model: Course,
        as: 'course',
        where: { teacher_id: teacherId }
      }]
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found or you do not have permission to delete it'
      });
    }

    const courseId = material.course_id;

    // Delete from Cloudinary if it's a Cloudinary URL
    if (material.file_url && material.file_url.includes('cloudinary.com')) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = material.file_url.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = `lms-uploads/materials/${filename.split('.')[0]}`;
        
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
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

    // Verify teacher owns the course
    const course = await Course.findOne({
      where: { 
        id: courseId,
        teacher_id: teacherId
      }
    });

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
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
 * Creates a new assignment for a course
 * Validates: deadline must be in the future
 */
export const createAssignment = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;
    const { title, description, deadline } = req.body;

    // Verify teacher owns the course
    const course = await Course.findOne({
      where: { 
        id: courseId,
        teacher_id: teacherId
      }
    });

    if (!course) {
      return res.redirect(`/teacher/courses?error=Course not found`);
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

    res.redirect(`/teacher/courses/${courseId}?success=Assignment created successfully`);

  } catch (error) {
    console.error('Create Assignment Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/assignments/create?error=Error creating assignment: ${error.message}`);
  }
};
