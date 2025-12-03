import { Submission, Assignment, User } from '../models/index.js';

/**
 * Calculate suggested grade for a student in a course
 * Fetches all assignment marks and computes average
 * 
 * @param {number} studentId - The student's ID
 * @param {number} courseId - The course ID
 * @returns {Object} - { suggestedGrade, assignmentScores, totalAssignments, gradedCount }
 */
export const calculateSuggestedGrade = async (studentId, courseId) => {
  try {
    // Fetch all assignments for this course
    const assignments = await Assignment.findAll({
      where: { course_id: courseId },
      attributes: ['id', 'title']
    });

    if (assignments.length === 0) {
      return {
        suggestedGrade: null,
        assignmentScores: [],
        totalAssignments: 0,
        gradedCount: 0,
        message: 'No assignments in this course'
      };
    }

    // Fetch all submissions for this student in these assignments
    const assignmentIds = assignments.map(a => a.id);
    const submissions = await Submission.findAll({
      where: {
        student_id: studentId,
        assignment_id: assignmentIds
      },
      include: [{
        model: Assignment,
        as: 'assignment',
        attributes: ['id', 'title']
      }],
      attributes: ['id', 'assignment_id', 'marks', 'submitted_at']
    });

    // Build assignment scores array
    const assignmentScores = assignments.map(assignment => {
      const submission = submissions.find(s => s.assignment_id === assignment.id);
      return {
        assignmentId: assignment.id,
        title: assignment.title,
        marks: submission?.marks || null,
        submitted: !!submission,
        graded: submission?.marks !== null && submission?.marks !== undefined
      };
    });

    // Calculate average from graded assignments
    const gradedSubmissions = submissions.filter(s => s.marks !== null && s.marks !== undefined);
    const gradedCount = gradedSubmissions.length;
    
    if (gradedCount === 0) {
      return {
        suggestedGrade: null,
        assignmentScores,
        totalAssignments: assignments.length,
        gradedCount: 0,
        message: 'No graded assignments yet'
      };
    }

    // Calculate average (all marks are 0-100 percentages)
    const totalMarks = gradedSubmissions.reduce((sum, s) => sum + parseFloat(s.marks), 0);
    const average = totalMarks / gradedCount;
    
    // Round to 2 decimal places
    const suggestedGrade = Math.round(average * 100) / 100;

    return {
      suggestedGrade,
      assignmentScores,
      totalAssignments: assignments.length,
      gradedCount,
      message: null
    };
  } catch (error) {
    console.error('Error calculating suggested grade:', error);
    throw error;
  }
};

/**
 * Get all students enrolled in a course with their grade data
 * 
 * @param {number} courseId - The course ID
 * @returns {Array} - Array of student grade data
 */
export const getCourseGrades = async (courseId) => {
  try {
    // This will be implemented when we have BatchEnrollment working
    // For now, we'll fetch all students who have submitted to assignments in this course
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
      group: ['student_id']
    });

    // Get unique students
    const uniqueStudents = [...new Set(submissions.map(s => s.student_id))];
    
    const studentGrades = await Promise.all(
      uniqueStudents.map(async (studentId) => {
        const student = submissions.find(s => s.student_id === studentId)?.student;
        const gradeData = await calculateSuggestedGrade(studentId, courseId);
        
        return {
          studentId,
          studentName: student?.full_name,
          studentEmail: student?.email,
          ...gradeData
        };
      })
    );

    return studentGrades;
  } catch (error) {
    console.error('Error fetching course grades:', error);
    throw error;
  }
};
