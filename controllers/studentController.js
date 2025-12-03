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

    // Calculate deadline status
    const now = new Date();
    const deadline = new Date(assignment.deadline);
    const isPastDeadline = deadline < now;
    const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    const isUrgent = daysUntil <= 2 && daysUntil >= 0;

    // Determine if student can submit
    const canSubmit = !isPastDeadline && (!submission || submission.marks === null);
    const canResubmit = !isPastDeadline && submission && submission.marks === null;

    res.render('student/assignment', {
      title: assignment.title,
      user: req.user,
      assignment,
      submission,
      deadline: {
        date: deadline,
        isPastDeadline,
        daysUntil,
        isUrgent
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

    // Check deadline (server-side UTC validation)
    const now = new Date();
    const deadline = new Date(assignment.deadline);
    const isPastDeadline = deadline < now;

    if (isPastDeadline) {
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
