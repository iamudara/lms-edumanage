/**
 * Student Controller
 * Handles student-specific operations (dashboard, courses, assignments, submissions, grades)
 */

import { 
  Course, 
  CourseTeacher,
  Batch,
  BatchEnrollment, 
  Assignment,
  AssignmentMaterial,
  Submission, 
  Material,
  User,
  Folder,
  FolderCourse,
  sequelize
} from '../models/index.js';
import { Op, QueryTypes } from 'sequelize';
import cloudinary, { generateSignedUrl, signUrlsInArray, deleteCloudinaryFile } from '../config/cloudinary.js';
import { checkDeadline, isDeadlinePassed } from '../services/deadlineService.js';
import https from 'https';

/**
 * Get all folders accessible by a course (including inherited subfolders)
 * Uses recursive CTE for query-time inheritance
 */
async function getFoldersForCourse(courseId) {
  // Get directly shared folder IDs
  const sharedFolders = await FolderCourse.findAll({
    where: { course_id: courseId },
    attributes: ['folder_id']
  });

  if (sharedFolders.length === 0) {
    return [];
  }

  const sharedFolderIds = sharedFolders.map(fc => fc.folder_id);

  // Use recursive CTE to get all subfolders
  const query = `
    WITH RECURSIVE folder_tree AS (
      -- Base case: directly shared folders
      SELECT f.* FROM folders f
      WHERE f.id IN (:sharedFolderIds)
      
      UNION ALL
      
      -- Recursive case: all children of shared folders
      SELECT f.* FROM folders f
      INNER JOIN folder_tree ft ON f.parent_id = ft.id
    )
    SELECT DISTINCT * FROM folder_tree
    ORDER BY parent_id, name ASC
  `;

  const folders = await sequelize.query(query, {
    replacements: { sharedFolderIds },
    type: QueryTypes.SELECT
  });

  return folders;
}

/**
 * Build folder tree with materials for student view
 */
function buildStudentFolderTree(folders, materials) {
  const folderMap = new Map();
  const rootFolders = [];

  // Create folder nodes with materials array
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      ...folder,
      materials: materials.filter(m => m.folder_id == folder.id), // Use loose comparison for type safety
      children: []
    });
  });

  // Build tree structure
  folders.forEach(folder => {
    const folderNode = folderMap.get(folder.id);
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id).children.push(folderNode);
    } else {
      rootFolders.push(folderNode);
    }
  });

  return rootFolders;
}

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
      return res.render('student/unassigned', {
        title: 'No Batch Assigned',
        user: req.user
      });
    }

    // Get ALL enrolled courses (via batch enrollments)
    const allEnrolledCourses = await Course.findAll({
      include: [
        {
          model: BatchEnrollment,
          where: { batch_id: batchId },
          required: true
        },
        {
          model: CourseTeacher,
          as: 'courseTeachers',
          where: { is_primary: true },
          required: false,
          include: [{
            model: User,
            as: 'teacher',
            attributes: ['id', 'full_name', 'email']
          }]
        },
        {
          model: Assignment,
          required: false,
          attributes: ['id', 'title', 'deadline']
        },
        {
          model: Material,
          required: false,
          attributes: ['id', 'updated_at']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Get latest material update for each course (including materials in folders)
    // Only run queries if student has enrolled courses
    let courseLatestMaterials = [];
    let folderMaterialUpdates = [];
    
    if (allEnrolledCourses.length > 0) {
      courseLatestMaterials = await sequelize.query(`
        SELECT 
          c.id as course_id,
          MAX(m.updated_at) as latest_material_update
        FROM courses c
        LEFT JOIN materials m ON m.course_id = c.id
        LEFT JOIN folder_courses fc ON fc.course_id = c.id
        LEFT JOIN materials fm ON fm.folder_id = fc.folder_id
        WHERE c.id IN (:courseIds)
        GROUP BY c.id
        HAVING MAX(m.updated_at) IS NOT NULL OR MAX(fm.updated_at) IS NOT NULL
      `, {
        replacements: { courseIds: allEnrolledCourses.map(c => c.id) },
        type: QueryTypes.SELECT
      });

      // Also get materials from folders
      folderMaterialUpdates = await sequelize.query(`
        SELECT 
          fc.course_id,
          MAX(m.updated_at) as latest_folder_material_update
        FROM folder_courses fc
        JOIN materials m ON m.folder_id = fc.folder_id
        WHERE fc.course_id IN (:courseIds)
        GROUP BY fc.course_id
      `, {
        replacements: { courseIds: allEnrolledCourses.map(c => c.id) },
        type: QueryTypes.SELECT
      });
    }

    // Create a map of course_id to latest update time
    const latestUpdateMap = new Map();
    
    // Add direct material updates
    courseLatestMaterials.forEach(row => {
      if (row.latest_material_update) {
        latestUpdateMap.set(row.course_id, new Date(row.latest_material_update));
      }
    });
    
    // Merge folder material updates (keep the most recent)
    folderMaterialUpdates.forEach(row => {
      const folderDate = new Date(row.latest_folder_material_update);
      const existing = latestUpdateMap.get(row.course_id);
      if (!existing || folderDate > existing) {
        latestUpdateMap.set(row.course_id, folderDate);
      }
    });

    // Sort courses by most recently updated material and get top 3
    const enrolledCourses = [...allEnrolledCourses]
      .map(course => {
        const latestMaterialUpdate = latestUpdateMap.get(course.id) || new Date(0);
        return { course, latestMaterialUpdate };
      })
      .sort((a, b) => b.latestMaterialUpdate - a.latestMaterialUpdate)
      .slice(0, 3)
      .map(item => item.course);

    // Get all course IDs for statistics (from all enrolled courses)
    const courseIds = allEnrolledCourses.map(course => course.id);
    
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

    // Get recent graded submissions (last 5)
    const recentGradedSubmissions = await Submission.findAll({
      where: { 
        student_id: studentId,
        marks: { [Op.ne]: null }  // Only graded submissions
      },
      include: [
        {
          model: Assignment,
          as: 'assignment',
          attributes: ['id', 'title'],
          include: [{
            model: Course,
            as: 'course',
            attributes: ['id', 'title', 'code']
          }]
        }
      ],
      order: [['updated_at', 'DESC']],
      limit: 5
    });

    // Calculate statistics (use allEnrolledCourses for accurate counts)
    const totalCourses = allEnrolledCourses.length;
    const totalAssignments = await Assignment.count({
      where: { course_id: { [Op.in]: courseIds } }
    });
    const submittedCount = await Submission.count({
      where: { student_id: studentId }
    });
    
    // Count submissions from this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const submittedThisWeek = await Submission.count({
      where: { 
        student_id: studentId,
        submitted_at: { [Op.gte]: weekStart }
      }
    });
    
    const pendingCount = totalAssignments - submittedCount;
    
    // Calculate completion rate (% of assignments submitted)
    const completionRate = totalAssignments > 0 
      ? ((submittedCount / totalAssignments) * 100).toFixed(1)
      : 0;

    res.render('student/dashboard', {
      title: 'Student Dashboard',
      user: req.user,
      enrolledCourses,
      totalEnrolledCourses: allEnrolledCourses.length,
      pendingAssignments,
      recentGradedSubmissions,
      stats: {
        totalCourses,
        toSubmit: pendingCount,
        submittedThisWeek,
        completionRate
      }
    });

  } catch (error) {
    console.error('Error loading student dashboard:', error);
    res.status(500).send('Error loading dashboard: ' + error.message);
  }
};

/**
 * Get All Courses (Student)
 * GET /student/courses
 * Display: list of all enrolled courses
 */
export const getAllCourses = async (req, res) => {
  try {
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    // Check if student has a batch assigned
    if (!batchId) {
      return res.redirect('/student/dashboard');
    }

    // Get enrolled courses (via batch enrollments)
    const enrolledCourses = await Course.findAll({
      include: [
        {
          model: BatchEnrollment,
          where: { batch_id: batchId },
          required: true,
          include: [
            {
              model: Batch,
              as: 'batch',
              attributes: ['id', 'name', 'code']
            }
          ]
        },
        {
          model: CourseTeacher,
          as: 'courseTeachers',
          where: { is_primary: true },
          required: false,
          include: [{
            model: User,
            as: 'teacher',
            attributes: ['id', 'full_name', 'email']
          }]
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

    res.render('student/courses', {
      title: 'My Courses',
      user: req.user,
      courses: enrolledCourses
    });

  } catch (error) {
    console.error('Error loading courses:', error);
    res.status(500).send('Error loading courses: ' + error.message);
  }
};

/**
 * Get Course View (Student)
 * GET /student/courses/:id
 * Display: course info, materials (with folder structure), assignments list, course grade
 */
export const getCourseView = async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    // Check if student has a batch assigned
    if (!batchId) {
      return res.redirect('/student/dashboard');
    }

    // Get course with all details
    const course = await Course.findByPk(courseId, {
      include: [
        {
          model: CourseTeacher,
          as: 'courseTeachers',
          where: { is_primary: true },
          required: false,
          include: [{
            model: User,
            as: 'teacher',
            attributes: ['id', 'full_name', 'email']
          }]
        },
        {
          model: BatchEnrollment,
          where: { batch_id: batchId },
          required: true  // Only show if student's batch is enrolled
        },
        {
          model: Material,
          required: false,
          where: { folder_id: null } // Only direct course materials (not in folders)
        },
        {
          model: Assignment,
          required: false,
          include: [
            {
              model: Submission,
              required: false,
              where: { student_id: studentId },
              attributes: ['id', 'submitted_at', 'marks', 'feedback', 'graded_by']
            }
          ]
        }
      ],
      order: [
        [Material, 'created_at', 'DESC'],
        [Assignment, 'deadline', 'ASC']
      ]
    });

    // Check if course exists and student's batch is enrolled
    if (!course) {
      return res.status(404).send('Course not found or you are not enrolled in this course.');
    }

    // Fix URLs for raw files (append extension if missing) and ensure plain objects
    if (course.Materials && course.Materials.length > 0) {
      course.Materials = course.Materials.map(m => {
        const material = m.get ? m.get({ plain: true }) : m;
        
        // Ensure created_at exists for EJS
        if (!material.created_at && material.createdAt) {
          material.created_at = material.createdAt;
        }

        if (material.file_url && material.file_type && 
            !material.file_url.toLowerCase().endsWith(`.${material.file_type.toLowerCase()}`)) {
          material.file_url = `${material.file_url}.${material.file_type}`;
        }
        return material;
      });
    }

    // Get folders shared with this course (with inherited subfolders)
    const sharedFolders = await getFoldersForCourse(courseId);

    // Get materials for shared folders
    const folderIds = sharedFolders.map(f => f.id);
    let folderMaterials = [];
    
    if (folderIds.length > 0) {
      folderMaterials = await Material.findAll({
        where: { folder_id: { [Op.in]: folderIds } },
        order: [['created_at', 'DESC']]
      });
    }

    // Fix folder materials URLs
    const signedFolderMaterials = folderMaterials.map(m => {
      const material = m.get ? m.get({ plain: true }) : m;
      
      // Ensure created_at exists for EJS
      if (!material.created_at && material.createdAt) {
        material.created_at = material.createdAt;
      }

      if (material.file_url && material.file_type && 
          !material.file_url.toLowerCase().endsWith(`.${material.file_type.toLowerCase()}`)) {
        material.file_url = `${material.file_url}.${material.file_type}`;
      }
      return material;
    });

    // Build folder tree with materials
    const folderTree = buildStudentFolderTree(sharedFolders, signedFolderMaterials);

    // Calculate assignment statistics
    const totalAssignments = course.Assignments ? course.Assignments.length : 0;
    const submittedAssignments = course.Assignments 
      ? course.Assignments.filter(a => a.Submissions && a.Submissions.length > 0).length 
      : 0;
    const gradedAssignments = course.Assignments
      ? course.Assignments.filter(a => a.Submissions && a.Submissions.length > 0 && a.Submissions[0].marks !== null).length
      : 0;
    
    // Calculate average assignment score
    let averageScore = null;
    if (gradedAssignments > 0) {
      const scores = course.Assignments
        .filter(a => a.Submissions && a.Submissions.length > 0 && a.Submissions[0].marks !== null)
        .map(a => parseFloat(a.Submissions[0].marks));
      
      averageScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    }

    // Total materials including folder materials
    const totalMaterials = (course.Materials ? course.Materials.length : 0) + folderMaterials.length;

    res.render('student/course', {
      title: course.title,
      user: req.user,
      course,
      folderTree,
      stats: {
        totalMaterials,
        totalAssignments,
        submittedAssignments,
        gradedAssignments,
        averageScore
      }
    });

  } catch (error) {
    console.error('Error loading course view:', error);
    res.status(500).send('Error loading course details: ' + error.message);
  }
};

/**
 * Get Assignment Detail
 * GET /student/assignments/:id
 * Display: assignment description, deadline, submission status, submit button
 */
export const getAssignmentDetail = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    // Check if student has a batch assigned
    if (!batchId) {
      return res.redirect('/student/dashboard');
    }

    // Get assignment with course and submission details
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'code'],
          include: [
            {
              model: CourseTeacher,
              as: 'courseTeachers',
              where: { is_primary: true },
              required: false,
              include: [{
                model: User,
                as: 'teacher',
                attributes: ['id', 'full_name', 'email']
              }]
            },
            {
              model: BatchEnrollment,
              where: { batch_id: batchId },
              required: true  // Only show if student's batch is enrolled
            }
          ]
        },
        {
          model: Submission,
          required: false,
          where: { student_id: studentId },
          attributes: ['id', 'file_url', 'submission_text', 'submitted_at', 'marks', 'feedback', 'graded_by'],
          include: [
            {
              model: User,
              as: 'grader',
              attributes: ['full_name'],
              required: false
            }
          ]
        },
        {
          model: AssignmentMaterial,
          as: 'materials',
          required: false,
          attributes: ['id', 'url', 'title', 'type', 'file_type', 'description']
        }
      ]
    });

    // Check if assignment exists and student's batch is enrolled in the course
    if (!assignment || !assignment.course) {
      return res.status(404).send('Assignment not found or you are not enrolled in this course.');
    }

    // Get submission if exists
    const submission = assignment.Submissions && assignment.Submissions.length > 0 
      ? assignment.Submissions[0] 
      : null;

    // Sign URLs for authenticated access
    // Sign submission file URL (1-hour expiry for submissions)
    // Sign submission file URL (1-hour expiry for submissions)
    if (submission && submission.file_url) {
      // submission.file_url = generateSignedUrl(submission.file_url, { type: 'submission' });
    }

    // Sign assignment materials URLs (12-hour expiry)
    // Sign assignment materials URLs (12-hour expiry)
    if (assignment.materials && assignment.materials.length > 0) {
      // assignment.materials = signUrlsInArray(assignment.materials, 'url', 'assignment');
    }

    // Calculate deadline status using deadline service
    const deadlineStatus = checkDeadline(assignment.deadline);

    // Determine if student can submit
    const canSubmit = deadlineStatus.canSubmit && (!submission || submission.marks === null);
    const canResubmit = deadlineStatus.canSubmit && submission && submission.marks === null;
    
    // Check if submission was late
    const isLate = submission && new Date(submission.submitted_at) > new Date(assignment.deadline);

    res.render('student/assignment', {
      title: assignment.title,
      user: req.user,
      assignment,
      submission,
      deadline: {
        date: deadlineStatus.deadline,
        isPastDeadline: deadlineStatus.isPastDeadline,
        daysUntil: deadlineStatus.daysUntil,
        isUrgent: deadlineStatus.isUrgent
      },
      canSubmit,
      canResubmit,
      isLate
    });

  } catch (error) {
    console.error('Error loading assignment detail:', error);
    res.status(500).send('Error loading assignment details: ' + error.message);
  }
};

/**
 * Submit Assignment
 * POST /student/assignments/:id/submit
 * Validation: enrolled, deadline not passed, file/text provided
 */
export const submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.user.id;
    const batchId = req.user.batch_id;
    const { submission_text } = req.body;

    // Check if student has a batch assigned
    if (!batchId) {
      return res.json({
        success: false,
        message: 'You are not assigned to any batch. Redirecting...',
        redirectUrl: '/student/dashboard'
      });
    }

    // Get assignment with course enrollment check
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'code'],
          include: [
            {
              model: BatchEnrollment,
              where: { batch_id: batchId },
              required: true  // Only show if student's batch is enrolled
            }
          ]
        }
      ]
    });

    // Check if assignment exists and student's batch is enrolled
    if (!assignment || !assignment.course) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found or you are not enrolled in this course.'
      });
    }

    // Check deadline using deadline service (server-side UTC validation)
    if (isDeadlinePassed(assignment.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Deadline has passed. You can no longer submit or resubmit this assignment.'
      });
    }

    // Validate that at least file OR text is provided
    const file = req.file;
    if (!file && !submission_text) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a file or text submission.'
      });
    }

    // Check if student already has a submission (for resubmission)
    const existingSubmission = await Submission.findOne({
      where: {
        assignment_id: assignmentId,
        student_id: studentId
      }
    });

    // If submission is already graded, prevent resubmission
    if (existingSubmission && existingSubmission.marks !== null) {
      return res.status(400).json({
        success: false,
        message: 'This assignment has already been graded. You cannot resubmit.'
      });
    }

    // Prepare submission data
    const submissionData = {
      assignment_id: assignmentId,
      student_id: studentId,
      file_url: file ? file.path : null,
      submission_text: submission_text || null,
      submitted_at: new Date()
    };

    let submission;

    if (existingSubmission) {
      // RESUBMISSION: Delete old file from Cloudinary if exists and new file is being uploaded
      if (existingSubmission.file_url && file) {
        try {
          await deleteCloudinaryFile(existingSubmission.file_url);
          console.log(`Deleted old submission file from Cloudinary`);
        } catch (cloudinaryError) {
          console.error('Error deleting old submission file from Cloudinary:', cloudinaryError);
          // Continue with resubmission even if old file deletion fails
        }
      }

      // Update existing submission
      // The beforeUpdate hook will auto-update submitted_at
      await existingSubmission.update({
        file_url: submissionData.file_url,
        submission_text: submissionData.submission_text,
        submitted_at: submissionData.submitted_at
      });
      submission = existingSubmission;
    } else {
      // FIRST SUBMISSION: Create new submission
      submission = await Submission.create(submissionData);
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: existingSubmission 
        ? 'Assignment resubmitted successfully!' 
        : 'Assignment submitted successfully!',
      submission: {
        id: submission.id,
        submitted_at: submission.submitted_at,
        has_file: !!submission.file_url,
        has_text: !!submission.submission_text
      }
    });

  } catch (error) {
    console.error('Error submitting assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit assignment. Please try again later.'
    });
  }
};

/**
 * Get Submission History
 * GET /student/submissions
 * Display: all submissions, status, scores, feedback
 */
export const getSubmissions = async (req, res) => {
  try {
    const studentId = req.user.id;
    const batchId = req.user.batch_id;
    const { course: selectedCourseId } = req.query;

    // Get student's enrolled courses for filter dropdown
    const enrolledCourses = await Course.findAll({
      include: [{
        model: BatchEnrollment,
        where: { batch_id: batchId },
        attributes: []
      }],
      attributes: ['id', 'title', 'code'],
      order: [['title', 'ASC']]
    });

    // Build submission query conditions
    const submissionWhere = { student_id: studentId };

    // Get all submissions for this student
    const submissions = await Submission.findAll({
      where: submissionWhere,
      include: [{
        model: Assignment,
        as: 'assignment',  // Use the alias defined in model associations
        attributes: ['id', 'title', 'deadline', 'course_id'],
        include: [{
          model: Course,
          as: 'course',  // Use the alias defined in model associations
          attributes: ['id', 'title', 'code'],
          // Filter by course if selected
          ...(selectedCourseId && {
            where: { id: selectedCourseId }
          })
        }]
      }],
      order: [['submitted_at', 'DESC']]
    });

    // Filter out submissions where course doesn't match (when filter applied)
    const filteredSubmissions = selectedCourseId 
      ? submissions.filter(s => s.assignment && s.assignment.course)
      : submissions;

    // Sign submission file URLs for authenticated access (1-hour expiry)
    const signedSubmissions = signUrlsInArray(filteredSubmissions, 'file_url', 'submission');

    // Calculate statistics
    const total = signedSubmissions.length;
    const graded = signedSubmissions.filter(s => s.marks !== null).length;
    const pending = total - graded;
    
    // Calculate average score from graded submissions
    const gradedSubmissions = signedSubmissions.filter(s => s.marks !== null);
    const averageScore = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, s) => sum + parseFloat(s.marks), 0) / gradedSubmissions.length
      : null;

    res.render('student/submissions', {
      title: 'Submission History',
      user: req.user,
      submissions: signedSubmissions,
      courses: enrolledCourses,
      selectedCourseId: selectedCourseId || '',
      stats: {
        total,
        graded,
        pending,
        averageScore
      }
    });

  } catch (error) {
    console.error('Error loading submission history:', error);
    res.status(500).send('Error loading submission history: ' + error.message);
  }
};

/**
 * Get Grades View
 * GET /student/grades
 * Display: assignment scores breakdown by course, organized by semester
 * Shows submission details with view submission button for each assignment
 */
export const getGrades = async (req, res) => {
  try {
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    // Get student's enrolled courses with teacher info and semester
    const enrolledCourses = await Course.findAll({
      include: [
        {
          model: BatchEnrollment,
          where: { batch_id: batchId },
          attributes: []
        },
        {
          model: CourseTeacher,
          as: 'courseTeachers',
          where: { is_primary: true },
          required: false,
          include: [{
            model: User,
            as: 'teacher',
            attributes: ['id', 'full_name']
          }]
        }
      ],
      attributes: ['id', 'title', 'code', 'semester'],
      order: [['semester', 'ASC'], ['title', 'ASC']]
    });

    // Get all submissions for this student with file URLs
    const submissions = await Submission.findAll({
      where: { student_id: studentId },
      include: [{
        model: Assignment,
        as: 'assignment',
        attributes: ['id', 'title', 'deadline', 'course_id']
      }]
    });

    // Sign submission file URLs for authenticated access
    const signedSubmissions = signUrlsInArray(submissions, 'file_url', 'submission');

    // Create a map of submissions by assignment_id
    const submissionMap = {};
    signedSubmissions.forEach(sub => {
      submissionMap[sub.assignment_id] = sub;
    });

    // Build course grades data organized by semester
    const semesterData = {};
    let totalGradedAssignments = 0;
    let totalSubmissions = 0;
    let pendingGrading = 0;

    for (const course of enrolledCourses) {
      const semester = course.semester || 'Other';
      
      if (!semesterData[semester]) {
        semesterData[semester] = {
          courses: [],
          totalGraded: 0,
          totalScore: 0,
          averageScore: null
        };
      }

      // Get all assignments for this course
      const assignments = await Assignment.findAll({
        where: { course_id: course.id },
        attributes: ['id', 'title', 'deadline', 'description'],
        order: [['deadline', 'ASC']]
      });

      // Add submission info to each assignment
      const assignmentsWithSubmissions = assignments.map(assignment => {
        const submission = submissionMap[assignment.id] || null;
        if (submission) {
          totalSubmissions++;
          if (submission.marks === null) {
            pendingGrading++;
          }
        }
        return {
          id: assignment.id,
          title: assignment.title,
          deadline: assignment.deadline,
          submission: submission ? {
            id: submission.id,
            submitted_at: submission.submitted_at,
            marks: submission.marks,
            feedback: submission.feedback,
            file_url: submission.file_url,
            submission_text: submission.submission_text
          } : null
        };
      });

      // Calculate stats for this course
      const gradedAssignments = assignmentsWithSubmissions.filter(
        a => a.submission && a.submission.marks !== null
      );
      const gradedCount = gradedAssignments.length;
      const totalAssignmentsCount = assignments.length;

      // Calculate average score for this course
      let courseAverageScore = null;
      if (gradedCount > 0) {
        const totalScore = gradedAssignments.reduce(
          (sum, a) => sum + parseFloat(a.submission.marks), 0
        );
        courseAverageScore = totalScore / gradedCount;
        totalGradedAssignments += gradedCount;
        
        // Add to semester totals
        semesterData[semester].totalGraded += gradedCount;
        semesterData[semester].totalScore += totalScore;
      }

      semesterData[semester].courses.push({
        course: {
          id: course.id,
          title: course.title,
          code: course.code,
          semester: course.semester,
          courseTeachers: course.courseTeachers
        },
        assignments: assignmentsWithSubmissions,
        totalAssignments: totalAssignmentsCount,
        gradedAssignments: gradedCount,
        submittedAssignments: assignmentsWithSubmissions.filter(a => a.submission).length,
        averageScore: courseAverageScore
      });
    }

    // Calculate semester averages
    Object.keys(semesterData).forEach(semester => {
      const data = semesterData[semester];
      if (data.totalGraded > 0) {
        data.averageScore = data.totalScore / data.totalGraded;
      }
    });

    // Sort semesters (1-8, then 'Other')
    const sortedSemesters = Object.keys(semesterData).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return parseInt(a) - parseInt(b);
    });

    // Calculate overall statistics
    const stats = {
      totalCourses: enrolledCourses.length,
      totalGradedAssignments,
      totalSubmissions,
      pendingGrading
    };

    res.render('student/grades', {
      title: 'My Grades',
      user: req.user,
      semesterData,
      sortedSemesters,
      stats
    });

  } catch (error) {
    console.error('Error loading grades:', error);
    res.status(500).send('Error loading grades: ' + error.message);
  }
};

/**
 * Download Assignment Material (Proxy)
 * GET /student/assignments/materials/:id/download
 * Proxies the file from Cloudinary to force download with correct Content-Disposition
 */
export const downloadAssignmentMaterial = async (req, res) => {
  try {
    const materialId = req.params.id;
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    if (!batchId) {
      return res.status(403).send('Access denied');
    }

    // Get material with course check
    const material = await AssignmentMaterial.findByPk(materialId, {
      include: [{
        model: Assignment,
        as: 'assignment',
        include: [{
          model: Course,
          as: 'course',
          include: [{
            model: BatchEnrollment,
            where: { batch_id: batchId },
            required: true
          }]
        }]
      }]
    });

    if (!material || !material.assignment || !material.assignment.course) {
      return res.status(404).send('Material not found or access denied');
    }

    // Determine filename
    let filename = material.title || 'download';
    // Clean filename (keep basic chars)
    filename = filename.replace(/[^a-z0-9-_ ]/gi, '_').toLowerCase();
    
    // Get extension: Prioritize URL as it preserves the uploaded extension
    let ext = '';
    if (material.url) {
      // Get everything after the last dot, and before query params
      const urlParts = material.url.split(/[?#]/)[0];
      const items = urlParts.split('.');
      if (items.length > 1) {
        ext = items.pop().toLowerCase();
      }
    }
    
    // Clean filename logic:
    // 1. Check if filename title ALREADY contains the extension (e.g. "file.pdf" or "file_pdf")
    // 2. Remove it to avoid "file_pdf.pdf"
    if (ext) {
        // Regex to match .ext or _ext at the end
        const suffixRegex = new RegExp(`[._]${ext}$`, 'i');
        filename = filename.replace(suffixRegex, '');
    }

    // Ensure filename ends with extension
    if (ext) {
      filename += '.' + ext;
    }

    // Set headers for forced download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Handle Cloudinary URLs (redirect or proxy)
    // IMPORTANT: Since Cloudinary Signed URLs are fragile to manipulation,
    // we just fetch the original URL and pipe it.
    
    https.get(material.url, (stream) => {
      stream.pipe(res);
    }).on('error', (err) => {
      console.error('Error fetching file for proxy:', err);
      res.status(500).send('Error downloading file');
    });

  } catch (error) {
    console.error('Error in download proxy:', error);
    res.status(500).send('Server error');
  }
};
