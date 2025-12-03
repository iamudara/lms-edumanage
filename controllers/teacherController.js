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
        as: 'course',
        where: { teacher_id: teacherId } // Verify teacher owns the course
      }]
    });

    // Check if assignment exists and teacher has access
    if (!assignment) {
      return res.status(404).send('Assignment not found or access denied');
    }

    const course = assignment.course;

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

    // 3. Render submissions view
    res.render('teacher/submissions', {
      user: req.user,
      assignment,
      course,
      submissions,
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
          as: 'course',
          where: { teacher_id: teacherId } // Verify teacher owns the course
        }]
      }]
    });

    // Check if submission exists and teacher has access
    if (!submission) {
      return res.status(404).send('Submission not found or access denied');
    }

    const assignment = submission.assignment;
    const course = assignment.course;

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

    // 1. Get submission with assignment to verify teacher ownership
    const submission = await Submission.findByPk(submissionId, {
      include: [{
        model: Assignment,
        as: 'assignment',
        include: [{
          model: Course,
          as: 'course',
          where: { teacher_id: teacherId }
        }]
      }]
    });

    if (!submission) {
      return res.status(404).send('Submission not found or access denied');
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

    // 1. Fetch course and verify teacher ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacher_id: teacherId
      },
      include: [{
        model: User,
        as: 'teacher',
        attributes: ['id', 'full_name', 'email']
      }]
    });

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
    }

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
      course,
      studentGrades,
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

    // 1. Verify course ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacher_id: teacherId
      }
    });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Course not found or access denied`);
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
