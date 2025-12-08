import { 
  User, 
  Course, 
  CourseTeacher,
  BatchEnrollment, 
  Assignment,
  Submission, 
  Batch, 
  Material,
  FolderCourse,
  sequelize
} from '../models/index.js';
import { Op, QueryTypes } from 'sequelize';

export const teacherService = {
  /**
   * Check if a teacher has access to a course
   */
  async checkCourseAccess(courseId, teacherId, options = {}) {
    const { requireEdit = false, requireGrade = false } = options;
    
    const course = await Course.findOne({ where: { id: courseId } });
    if (!course) return null;
    
    // Check CourseTeacher table
    const accessQuery = { course_id: courseId, teacher_id: teacherId };
    if (requireEdit) accessQuery.can_edit = true;
    if (requireGrade) accessQuery.can_grade = true;
    
    const courseTeacher = await CourseTeacher.findOne({ where: accessQuery });
    
    return courseTeacher ? course : null;
  },

  /**
   * Check if teacher is primary
   */
  async isPrimary(courseId, teacherId) {
    const courseTeacher = await CourseTeacher.findOne({
      where: { 
        course_id: courseId, 
        teacher_id: teacherId,
        is_primary: true
      }
    });
    return !!courseTeacher;
  },

  /**
   * Get all course IDs for a teacher
   */
  async getCourseIds(teacherId) {
    const assignedCourses = await CourseTeacher.findAll({
      where: { teacher_id: teacherId },
      attributes: ['course_id']
    });
    return assignedCourses.map(ct => ct.course_id);
  },

  /**
   * Get Dashboard Statistics and Courses
   */
  async getDashboardData(teacherId) {
    const courseIds = await this.getCourseIds(teacherId);

    // Get courses with details
    const allCourses = await Course.findAll({
      where: { id: { [Op.in]: courseIds } },
      include: [{
        model: BatchEnrollment,
        include: [{
          model: Batch,
          as: 'batch',
          include: [{ model: User, as: 'students' }]
        }]
      }, {
        model: Assignment
      }, {
        model: CourseTeacher,
        as: 'courseTeachers',
        include: [{ model: User, as: 'teacher', attributes: ['id', 'full_name'] }]
      }],
      order: [['created_at', 'DESC']]
    });

    // Get material updates
    const folderMaterialUpdates = await sequelize.query(`
      SELECT fc.course_id, MAX(m.updated_at) as latest_folder_material_update
      FROM folder_courses fc
      JOIN materials m ON m.folder_id = fc.folder_id
      WHERE fc.course_id IN (:courseIds)
      GROUP BY fc.course_id
    `, {
      replacements: { courseIds: courseIds.length > 0 ? courseIds : [0] },
      type: QueryTypes.SELECT
    });

    const latestUpdateMap = new Map();
    folderMaterialUpdates.forEach(row => {
      const folderDate = new Date(row.latest_folder_material_update);
      latestUpdateMap.set(row.course_id, folderDate);
    });

    // Sort for top 3 courses
    const recentCourses = [...allCourses]
      .map(course => {
        const latestMaterialUpdate = latestUpdateMap.get(course.id) || new Date(0);
        return { course, latestMaterialUpdate };
      })
      .sort((a, b) => b.latestMaterialUpdate - a.latestMaterialUpdate)
      .slice(0, 3)
      .map(item => item.course);

    // Calculate stats
    const totalCourses = allCourses.length;
    
    // Unique students
    const studentIds = new Set();
    allCourses.forEach(c => c.BatchEnrollments.forEach(e => e.batch.students.forEach(s => studentIds.add(s.id))));
    
    // Assignments
    const assignmentIds = allCourses.flatMap(c => c.Assignments.map(a => a.id));

    // Stats calculations
    let pendingSubmissions = 0;
    let activeAssignments = 0;
    let submissionsToday = 0;
    
    if (assignmentIds.length > 0) {
      pendingSubmissions = await Submission.count({
        where: { assignment_id: { [Op.in]: assignmentIds }, marks: null }
      });

      activeAssignments = await Assignment.count({
        where: { id: { [Op.in]: assignmentIds }, deadline: { [Op.gt]: new Date() } }
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      submissionsToday = await Submission.count({
        where: {
          assignment_id: { [Op.in]: assignmentIds },
          submitted_at: { [Op.between]: [todayStart, todayEnd] }
        }
      });
    }

    // Avg Submission Rate
    let avgSubmissionRate = 0;
    if (assignmentIds.length > 0) {
      const closedAssignments = await Assignment.findAll({
        where: { id: { [Op.in]: assignmentIds }, deadline: { [Op.lt]: new Date() } },
        attributes: ['id', 'deadline']
      });

      if (closedAssignments.length > 0) {
        const closedIds = closedAssignments.map(a => a.id);
        const onTimeSubmissions = await Submission.count({
          where: { assignment_id: { [Op.in]: closedIds } },
          include: [{
            model: Assignment,
            as: 'assignment',
            where: sequelize.where(sequelize.col('Submission.submitted_at'), { [Op.lte]: sequelize.col('assignment.deadline') }),
            attributes: []
          }]
        });
        const totalClosedSubmissions = await Submission.count({ where: { assignment_id: { [Op.in]: closedIds } } });
        
        if (totalClosedSubmissions > 0) {
          avgSubmissionRate = Math.round((onTimeSubmissions / totalClosedSubmissions) * 100);
        }
      }
    }

    // Recent Activity
    let recentSubmissions = [];
    if (assignmentIds.length > 0) {
      recentSubmissions = await Submission.findAll({
        where: { assignment_id: { [Op.in]: assignmentIds } },
        include: [
          { model: User, as: 'student', attributes: ['id', 'full_name', 'email'] },
          { model: Assignment, as: 'assignment', attributes: ['id', 'title', 'course_id'], include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'code'] }] }
        ],
        order: [['submitted_at', 'DESC']],
        limit: 5
      });
    }

    // Ongoing Assignments
    let ongoingAssignments = [];
    if (assignmentIds.length > 0) {
      ongoingAssignments = await Assignment.findAll({
        where: { id: { [Op.in]: assignmentIds }, deadline: { [Op.gt]: new Date() } },
        include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'code'] }],
        order: [['deadline', 'ASC']],
        limit: 5
      });
    }

    return {
      stats: {
        totalCourses,
        activeAssignments,
        submissionsToday,
        avgSubmissionRate,
        pendingSubmissions
      },
      courses: recentCourses,
      totalAllCourses: allCourses.length,
      recentSubmissions,
      ongoingAssignments
    };
  }
};
