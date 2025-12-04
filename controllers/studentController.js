/**
 * Student Controller
 * Handles student-specific operations (dashboard, courses, assignments, submissions, grades)
 */

import { 
  Course, 
  Batch,
  BatchEnrollment, 
  Assignment,
  AssignmentMaterial,
  Submission, 
  Grade,
  Material,
  User 
} from '../models/index.js';
import { Op } from 'sequelize';
import cloudinary from '../config/cloudinary.js';
import { checkDeadline, isDeadlinePassed } from '../services/deadlineService.js';

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
      return res.status(400).send('You are not assigned to any batch. Please contact the administrator.');
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
      return res.status(400).send('You are not assigned to any batch. Please contact the administrator.');
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

    // Get grades for all courses
    const grades = await Grade.findAll({
      where: { student_id: studentId },
      attributes: ['course_id', 'grade']
    });

    // Create a map of course grades
    const gradeMap = {};
    grades.forEach(grade => {
      gradeMap[grade.course_id] = grade.grade;
    });

    res.render('student/courses', {
      title: 'My Courses',
      user: req.user,
      courses: enrolledCourses,
      gradeMap
    });

  } catch (error) {
    console.error('Error loading courses:', error);
    res.status(500).send('Error loading courses: ' + error.message);
  }
};

/**
 * Get Course View (Student)
 * GET /student/courses/:id
 * Display: course info, materials, assignments list, course grade
 */
export const getCourseView = async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    // Check if student has a batch assigned
    if (!batchId) {
      return res.status(400).send('You are not assigned to any batch. Please contact the administrator.');
    }

    // Get course with all details
    const course = await Course.findByPk(courseId, {
      include: [
        {
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: BatchEnrollment,
          where: { batch_id: batchId },
          required: true  // Only show if student's batch is enrolled
        },
        {
          model: Material,
          required: false
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

    // Get student's grade for this course
    const grade = await Grade.findOne({
      where: {
        course_id: courseId,
        student_id: studentId
      }
    });

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

    res.render('student/course', {
      title: course.title,
      user: req.user,
      course,
      grade,
      stats: {
        totalMaterials: course.Materials ? course.Materials.length : 0,
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
      return res.status(400).send('You are not assigned to any batch. Please contact the administrator.');
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
              model: User,
              as: 'teacher',
              attributes: ['id', 'full_name', 'email']
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

    // Calculate deadline status using deadline service
    const deadlineStatus = checkDeadline(assignment.deadline);

    // Determine if student can submit
    const canSubmit = deadlineStatus.canSubmit && (!submission || submission.marks === null);
    const canResubmit = deadlineStatus.canSubmit && submission && submission.marks === null;

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
      canResubmit
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
      return res.status(400).json({
        success: false,
        message: 'You are not assigned to any batch. Please contact the administrator.'
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
          // Extract public_id from Cloudinary URL
          const url = existingSubmission.file_url;
          const urlParts = url.split('/');
          const uploadIndex = urlParts.indexOf('upload');
          
          if (uploadIndex !== -1) {
            // Get path after 'upload', skip version number if present
            const pathAfterUpload = urlParts.slice(uploadIndex + 1);
            const publicIdParts = pathAfterUpload[0].match(/^v\d+$/) 
              ? pathAfterUpload.slice(1) 
              : pathAfterUpload;
            
            const fullPath = publicIdParts.join('/');
            const isRawFile = url.includes('/raw/upload/');
            
            if (isRawFile) {
              // Raw files (DOC, DOCX, TXT, ZIP): use full path WITH extension
              await cloudinary.uploader.destroy(fullPath, { 
                resource_type: 'raw',
                invalidate: true 
              });
              console.log(`Deleted old submission file from Cloudinary: ${fullPath}`);
            } else {
              // Image files (PDF): use path WITHOUT extension
              const publicIdNoExt = fullPath.replace(/\.[^.]+$/, '');
              await cloudinary.uploader.destroy(publicIdNoExt, { 
                resource_type: 'image',
                invalidate: true 
              });
              console.log(`Deleted old submission file from Cloudinary: ${publicIdNoExt}`);
            }
          }
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

    // Calculate statistics
    const total = filteredSubmissions.length;
    const graded = filteredSubmissions.filter(s => s.marks !== null).length;
    const pending = total - graded;
    
    // Calculate average score from graded submissions
    const gradedSubmissions = filteredSubmissions.filter(s => s.marks !== null);
    const averageScore = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, s) => sum + parseFloat(s.marks), 0) / gradedSubmissions.length
      : null;

    res.render('student/submissions', {
      title: 'Submission History',
      user: req.user,
      submissions: filteredSubmissions,
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
 * Display: all course grades, assignment scores breakdown, GPA/average
 */
export const getGrades = async (req, res) => {
  try {
    const studentId = req.user.id;
    const batchId = req.user.batch_id;

    // Get student's enrolled courses with teacher info
    const enrolledCourses = await Course.findAll({
      include: [
        {
          model: BatchEnrollment,
          where: { batch_id: batchId },
          attributes: []
        },
        {
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name']
        }
      ],
      attributes: ['id', 'title', 'code'],
      order: [['title', 'ASC']]
    });

    // Get all grades for this student
    const grades = await Grade.findAll({
      where: { student_id: studentId },
      include: [{
        model: Course,
        as: 'course',
        attributes: ['id', 'title', 'code']
      }]
    });

    // Create a map of course grades
    const gradeMap = {};
    grades.forEach(grade => {
      gradeMap[grade.course_id] = grade;
    });

    // Get all submissions for this student
    const submissions = await Submission.findAll({
      where: { student_id: studentId },
      include: [{
        model: Assignment,
        as: 'assignment',
        attributes: ['id', 'title', 'deadline', 'course_id']
      }]
    });

    // Create a map of submissions by assignment_id
    const submissionMap = {};
    submissions.forEach(sub => {
      submissionMap[sub.assignment_id] = sub;
    });

    // Build course grades data
    const courseGrades = [];
    let totalGradedAssignments = 0;
    let totalAssignmentScore = 0;
    let gpaPoints = 0;
    let gradedCoursesForGpa = 0;

    for (const course of enrolledCourses) {
      // Get all assignments for this course
      const assignments = await Assignment.findAll({
        where: { course_id: course.id },
        attributes: ['id', 'title', 'deadline'],
        order: [['deadline', 'ASC']]
      });

      // Add submission info to each assignment
      const assignmentsWithSubmissions = assignments.map(assignment => {
        const submission = submissionMap[assignment.id] || null;
        return {
          id: assignment.id,
          title: assignment.title,
          deadline: assignment.deadline,
          submission: submission ? {
            id: submission.id,
            submitted_at: submission.submitted_at,
            marks: submission.marks,
            feedback: submission.feedback
          } : null
        };
      });

      // Calculate stats for this course
      const gradedAssignments = assignmentsWithSubmissions.filter(
        a => a.submission && a.submission.marks !== null
      );
      const gradedCount = gradedAssignments.length;
      const totalAssignments = assignments.length;

      // Calculate average score for this course
      let averageScore = null;
      if (gradedCount > 0) {
        const totalScore = gradedAssignments.reduce(
          (sum, a) => sum + parseFloat(a.submission.marks), 0
        );
        averageScore = totalScore / gradedCount;
        totalGradedAssignments += gradedCount;
        totalAssignmentScore += totalScore;
      }

      // Get final grade if exists
      const finalGrade = gradeMap[course.id] || null;

      // Calculate GPA contribution
      if (finalGrade) {
        const gpaPoint = gradeToGPA(finalGrade.grade);
        if (gpaPoint !== null) {
          gpaPoints += gpaPoint;
          gradedCoursesForGpa++;
        }
      }

      courseGrades.push({
        course: {
          id: course.id,
          title: course.title,
          code: course.code,
          teacher: course.teacher
        },
        finalGrade: finalGrade ? {
          grade: finalGrade.grade,
          remarks: finalGrade.remarks
        } : null,
        assignments: assignmentsWithSubmissions,
        totalAssignments,
        gradedAssignments: gradedCount,
        averageScore
      });
    }

    // Calculate overall statistics
    const stats = {
      totalCourses: enrolledCourses.length,
      gradedCourses: gradedCoursesForGpa,
      totalGradedAssignments,
      averageAssignmentScore: totalGradedAssignments > 0 
        ? totalAssignmentScore / totalGradedAssignments 
        : null,
      gpa: gradedCoursesForGpa > 0 
        ? gpaPoints / gradedCoursesForGpa 
        : null
    };

    res.render('student/grades', {
      title: 'My Grades',
      user: req.user,
      courseGrades,
      stats
    });

  } catch (error) {
    console.error('Error loading grades:', error);
    res.status(500).send('Error loading grades: ' + error.message);
  }
};

/**
 * Convert letter grade to GPA points
 * @param {string} grade - Letter grade (A+, A, A-, B+, etc.)
 * @returns {number|null} - GPA points or null if invalid
 */
function gradeToGPA(grade) {
  const gpaScale = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  };
  
  // Handle numeric grades (convert to letter grade equivalent)
  const numericGrade = parseFloat(grade);
  if (!isNaN(numericGrade)) {
    if (numericGrade >= 97) return 4.0;
    if (numericGrade >= 93) return 4.0;
    if (numericGrade >= 90) return 3.7;
    if (numericGrade >= 87) return 3.3;
    if (numericGrade >= 83) return 3.0;
    if (numericGrade >= 80) return 2.7;
    if (numericGrade >= 77) return 2.3;
    if (numericGrade >= 73) return 2.0;
    if (numericGrade >= 70) return 1.7;
    if (numericGrade >= 67) return 1.3;
    if (numericGrade >= 63) return 1.0;
    if (numericGrade >= 60) return 0.7;
    return 0.0;
  }
  
  // Handle letter grades
  const upperGrade = grade.toUpperCase().trim();
  return gpaScale[upperGrade] !== undefined ? gpaScale[upperGrade] : null;
}
