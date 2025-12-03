/**
 * Student Controller
 * Handles student-specific operations (dashboard, courses, assignments, submissions, grades)
 */

import { 
  Course, 
  BatchEnrollment, 
  Assignment, 
  Submission, 
  Grade,
  Material,
  User 
} from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Show Student Dashboard
 * GET /student/dashboard
 * Display: enrolled courses, upcoming deadlines, recent grades, pending assignments
 */
export const showDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    // Check if student has a batch assigned
    if (!batchId) {
      return res.status(400).render('error', {
        message: 'You are not assigned to any batch. Please contact the administrator.',
        user: req.user
      });
    }

    // Get enrolled courses (via batch enrollments)
    const enrolledCourses = await Course.findAll({
      include: [
        {
          model: BatchEnrollment,
          where: { batch_id: batchId },
          required: true
        },
        {
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: Assignment,
          required: false,
          attributes: ['id', 'title', 'deadline']
        },
        {
          model: Material,
          required: false,
          attributes: ['id']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Get all assignments for enrolled courses
    const courseIds = enrolledCourses.map(course => course.id);
    
    // Get upcoming assignments (not submitted, deadline in future)
    const upcomingAssignments = await Assignment.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        deadline: { [Op.gt]: new Date() }
      },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'code']
        },
        {
          model: Submission,
          required: false,
          where: { student_id: studentId },
          attributes: ['id', 'submitted_at']
        }
      ],
      order: [['deadline', 'ASC']],
      limit: 5
    });

    // Filter out assignments that have already been submitted
    const pendingAssignments = upcomingAssignments.filter(
      assignment => !assignment.Submissions || assignment.Submissions.length === 0
    );

    // Get recent grades (last 5)
    const recentGrades = await Grade.findAll({
      where: { student_id: studentId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'code']
        }
      ],
      order: [['updated_at', 'DESC']],
      limit: 5
    });

    // Calculate statistics
    const totalCourses = enrolledCourses.length;
    const totalAssignments = await Assignment.count({
      where: { course_id: { [Op.in]: courseIds } }
    });
    const submittedCount = await Submission.count({
      where: { student_id: studentId }
    });
    const pendingCount = totalAssignments - submittedCount;
    const gradedCoursesCount = recentGrades.length;

    // Calculate average grade (if any grades exist)
    let averageGrade = null;
    if (recentGrades.length > 0) {
      const numericGrades = recentGrades
        .map(g => parseFloat(g.grade))
        .filter(g => !isNaN(g));
      
      if (numericGrades.length > 0) {
        averageGrade = (numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length).toFixed(2);
      }
    }

    res.render('student/dashboard', {
      title: 'Student Dashboard',
      user: req.user,
      enrolledCourses,
      pendingAssignments,
      recentGrades,
      stats: {
        totalCourses,
        totalAssignments,
        submittedCount,
        pendingCount,
        gradedCoursesCount,
        averageGrade
      }
    });

  } catch (error) {
    console.error('Error loading student dashboard:', error);
    res.status(500).render('error', {
      message: 'Failed to load dashboard. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error : {},
      user: req.user
    });
  }
};

/**
 * Get Course View (Student)
 * GET /student/courses/:id
 * Display: course info, materials, assignments list, course grade
 */
export const getCourseView = async (req, res) => {
  // TODO: Implement in Task 5.3
  res.send('Course View - Coming Soon (Task 5.3)');
};

/**
 * Get Assignment Detail
 * GET /student/assignments/:id
 * Display: assignment description, deadline, submission status, submit button
 */
export const getAssignmentDetail = async (req, res) => {
  // TODO: Implement in Task 5.4
  res.send('Assignment Detail - Coming Soon (Task 5.4)');
};

/**
 * Submit Assignment
 * POST /student/assignments/:id/submit
 * Validation: enrolled, deadline not passed, file/text provided
 */
export const submitAssignment = async (req, res) => {
  // TODO: Implement in Task 5.5
  res.status(501).json({ error: 'Not implemented yet (Task 5.5)' });
};

/**
 * Get Submission History
 * GET /student/submissions
 * Display: all submissions, status, scores, feedback
 */
export const getSubmissions = async (req, res) => {
  // TODO: Implement in Task 5.7
  res.send('Submission History - Coming Soon (Task 5.7)');
};

/**
 * Get Grades View
 * GET /student/grades
 * Display: all course grades, assignment scores breakdown, GPA/average
 */
export const getGrades = async (req, res) => {
  // TODO: Implement in Task 5.8
  res.send('Grades View - Coming Soon (Task 5.8)');
};
