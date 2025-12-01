/**
 * Admin Controller
 * Handles admin dashboard and statistics
 */

import { User, Batch, Course, BatchEnrollment, Grade, Submission, Assignment } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Show Admin Dashboard
 * GET /admin/dashboard
 * Displays statistics, charts, and recent activity
 */
export const showDashboard = async (req, res) => {
  try {
    // ============================================
    // 1. USER STATISTICS
    // ============================================
    const totalUsers = await User.count();
    const adminCount = await User.count({ where: { role: 'admin' } });
    const teacherCount = await User.count({ where: { role: 'teacher' } });
    const studentCount = await User.count({ where: { role: 'student' } });

    // ============================================
    // 2. BATCH STATISTICS
    // ============================================
    const totalBatches = await Batch.count();

    // ============================================
    // 3. COURSE STATISTICS
    // ============================================
    const totalCourses = await Course.count();

    // ============================================
    // 4. ENROLLMENT STATISTICS
    // ============================================
    const totalEnrollments = await BatchEnrollment.count();

    // ============================================
    // 5. ASSIGNMENT & SUBMISSION STATISTICS
    // ============================================
    const totalAssignments = await Assignment.count();
    const totalSubmissions = await Submission.count();
    const gradedSubmissions = await Submission.count({ where: { marks: { [Op.ne]: null } } });

    // ============================================
    // 6. GRADE STATISTICS
    // ============================================
    const totalGrades = await Grade.count();

    // ============================================
    // 7. ENROLLMENTS PER COURSE (for bar chart)
    // ============================================
    const enrollmentsPerCourse = await BatchEnrollment.findAll({
      attributes: [
        'course_id',
        [Course.sequelize.fn('COUNT', Course.sequelize.col('BatchEnrollment.id')), 'enrollmentCount']
      ],
      include: [{
        model: Course,
        as: 'course',
        attributes: ['title', 'code']
      }],
      group: ['course_id', 'course.id', 'course.title', 'course.code'],
      order: [[Course.sequelize.fn('COUNT', Course.sequelize.col('BatchEnrollment.id')), 'DESC']],
      limit: 10,
      raw: false
    });

    // ============================================
    // 8. RECENT ACTIVITY (last 10 actions)
    // ============================================
    const recentUsers = await User.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['full_name', 'role', 'created_at']
    });

    const recentSubmissions = await Submission.findAll({
      order: [['submitted_at', 'DESC']],
      limit: 5,
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['full_name']
        },
        {
          model: Assignment,
          as: 'assignment',
          attributes: ['title']
        }
      ]
    });

    // ============================================
    // 9. PREPARE DATA FOR CHARTS
    // ============================================
    
    // Pie chart data (user distribution)
    const userDistribution = {
      labels: ['Admins', 'Teachers', 'Students'],
      data: [adminCount, teacherCount, studentCount],
      colors: ['#ef4444', '#3b82f6', '#10b981']
    };

    // Bar chart data (enrollments per course)
    const courseLabels = enrollmentsPerCourse.map(item => 
      item.course ? item.course.code : 'Unknown'
    );
    const enrollmentData = enrollmentsPerCourse.map(item => 
      parseInt(item.dataValues.enrollmentCount) || 0
    );

    // ============================================
    // 10. RENDER DASHBOARD
    // ============================================
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      stats: {
        totalUsers,
        adminCount,
        teacherCount,
        studentCount,
        totalBatches,
        totalCourses,
        totalEnrollments,
        totalAssignments,
        totalSubmissions,
        gradedSubmissions,
        totalGrades
      },
      charts: {
        userDistribution,
        courseLabels,
        enrollmentData
      },
      recentActivity: {
        users: recentUsers,
        submissions: recentSubmissions
      }
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).send(`
      <h1>Error Loading Dashboard</h1>
      <p>${error.message}</p>
      <a href="/admin">Go to AdminJS</a>
    `);
  }
};
