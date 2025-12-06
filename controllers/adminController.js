/**
 * Admin Controller
 * Handles admin dashboard and statistics
 */

import { User, Batch, Course, BatchEnrollment, Grade, Submission, Assignment, Material, CourseTeacher } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Show Admin Dashboard
 * GET /admin/dashboard
 * Displays statistics, charts, and recent activity
 */
export const showDashboard = async (req, res) => {
  try {
    // ============================================
    // DATE CALCULATIONS
    // ============================================
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // ============================================
    // 1. USER STATISTICS (Students + Teachers only)
    // ============================================
    const totalUsers = await User.count();
    const adminCount = await User.count({ where: { role: 'admin' } });
    const teacherCount = await User.count({ where: { role: 'teacher' } });
    const studentCount = await User.count({ where: { role: 'student' } });
    const userCountDisplay = studentCount + teacherCount; // Students + Teachers only

    // ============================================
    // 2. PLATFORM USAGE - Active users this week
    // ============================================
    const activeUsersThisWeek = await User.count({
      where: {
        updated_at: { [Op.gte]: oneWeekAgo }
      }
    });

    // ============================================
    // 3. SYSTEM ACTIVITY - Submissions this week
    // ============================================
    const submissionsThisWeek = await Submission.count({
      where: {
        submitted_at: { [Op.gte]: oneWeekAgo }
      }
    });

    // ============================================
    // 4. NEW ENROLLMENTS - This year
    // ============================================
    const enrollmentsThisYear = await BatchEnrollment.count({
      where: {
        created_at: { [Op.gte]: startOfYear }
      }
    });

    // ============================================
    // 5. BATCH STATISTICS
    // ============================================
    const totalBatches = await Batch.count();

    // ============================================
    // 6. COURSE STATISTICS
    // ============================================
    const totalCourses = await Course.count();

    // ============================================
    // 7. ENROLLMENT STATISTICS
    // ============================================
    const totalEnrollments = await BatchEnrollment.count();

    // ============================================
    // 8. ASSIGNMENT & SUBMISSION STATISTICS
    // ============================================
    const totalAssignments = await Assignment.count();
    const totalSubmissions = await Submission.count();
    const gradedSubmissions = await Submission.count({ where: { marks: { [Op.ne]: null } } });

    // ============================================
    // 9. GRADE STATISTICS
    // ============================================
    const totalGrades = await Grade.count();

    // ============================================
    // 10. ACTIVITY TRENDS - Last 30 days
    // ============================================
    const activityTrends = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      const [submissions, grades, logins] = await Promise.all([
        Submission.count({
          where: {
            submitted_at: { [Op.between]: [startOfDay, endOfDay] }
          }
        }),
        Grade.count({
          where: {
            created_at: { [Op.between]: [startOfDay, endOfDay] }
          }
        }),
        User.count({
          where: {
            updated_at: { [Op.between]: [startOfDay, endOfDay] }
          }
        })
      ]);

      activityTrends.push({
        date: startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        submissions,
        grades,
        logins
      });
    }

    // ============================================
    // 11. TEACHER WORKLOAD DISTRIBUTION
    // ============================================
    const teachers = await User.findAll({
      where: { role: 'teacher' },
      attributes: ['id', 'full_name'],
      limit: 10
    });

    const teacherWorkload = [];
    for (let teacher of teachers) {
      // Count assignments created by this teacher
      const assignmentsCreated = await Assignment.count({
        where: { created_by: teacher.id }
      });

      // Count courses teaching
      const coursesTeaching = await CourseTeacher.count({
        where: { teacher_id: teacher.id }
      });

      // Count pending grades
      const pendingGrades = await Submission.count({
        where: { marks: null },
        include: [{
          model: Assignment,
          as: 'assignment',
          where: { created_by: teacher.id },
          required: true
        }]
      });

      teacherWorkload.push({
        id: teacher.id,
        full_name: teacher.full_name,
        assignmentsCreated,
        coursesTeaching,
        pendingGrades
      });
    }

    // ============================================
    // 12. INACTIVE TEACHERS - No activity in 14 days
    // ============================================
    const inactiveTeachers = await User.findAll({
      where: {
        role: 'teacher',
        updated_at: { [Op.lt]: twoWeeksAgo }
      },
      attributes: ['full_name', 'email', 'updated_at'],
      order: [['updated_at', 'ASC']],
      limit: 5
    });

    // ============================================
    // 13. RESOURCE USAGE - Files uploaded
    // ============================================
    const totalMaterials = await Material.count();
    const totalAssignmentMaterials = await Submission.count({
      where: {
        file_url: { [Op.ne]: null }
      }
    });
    const totalFilesUploaded = totalMaterials + totalAssignmentMaterials;

    // Storage calculation (mock - you'd need actual file sizes)
    const estimatedStorageGB = (totalFilesUploaded * 2.5 / 1024).toFixed(2); // Estimate 2.5MB per file

    // ============================================
    // 14. ENROLLMENTS PER COURSE (for reference)
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
    // 15. RECENT ACTIVITY (last 5 actions)
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
    // 16. PREPARE DATA FOR CHARTS
    // ============================================
    
    // Activity Trends Chart Data (Line/Area Chart)
    const activityTrendsChart = {
      labels: activityTrends.map(d => d.date),
      submissions: activityTrends.map(d => d.submissions),
      grades: activityTrends.map(d => d.grades),
      logins: activityTrends.map(d => d.logins)
    };

    // Teacher Workload Chart Data (Horizontal Bar Chart)
    const teacherWorkloadChart = {
      labels: teacherWorkload.map(t => t.full_name || 'Unknown'),
      assignmentsCreated: teacherWorkload.map(t => parseInt(t.assignmentsCreated) || 0),
      coursesTeaching: teacherWorkload.map(t => parseInt(t.coursesTeaching) || 0),
      pendingGrades: teacherWorkload.map(t => t.pendingGrades || 0)
    };

    // ============================================
    // 17. RENDER DASHBOARD
    // ============================================
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      stats: {
        userCountDisplay,
        activeUsersThisWeek,
        submissionsThisWeek,
        enrollmentsThisYear,
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
        totalGrades,
        totalFilesUploaded,
        estimatedStorageGB
      },
      charts: {
        activityTrends: activityTrendsChart,
        teacherWorkload: teacherWorkloadChart
      },
      alerts: {
        inactiveTeachers
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
