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
  Grade 
} from '../models/index.js';
import { Op } from 'sequelize';

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
