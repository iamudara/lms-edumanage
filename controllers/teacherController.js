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
