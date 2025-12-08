import { CourseTeacher, User } from '../models/index.js';

export const CourseTeacherResource = {
  resource: CourseTeacher,
  options: {
    navigation: {
      name: 'Course Management',
      icon: 'Book'
    },
    listProperties: ['id', 'course_id', 'teacher_id', 'is_primary', 'can_edit', 'can_grade'],
    editProperties: ['course_id', 'teacher_id', 'is_primary', 'can_edit', 'can_grade'],
    filterProperties: ['course_id', 'teacher_id', 'is_primary'],
    properties: {
      course_id: {
        description: 'Select the course to assign a teacher to'
      },
      teacher_id: {
        description: 'Select the teacher to assign (must have teacher role)'
      },
      is_primary: {
        description: 'Is this the primary teacher? (Only one primary per course)'
      },
      can_edit: {
        description: 'Can this teacher edit course materials and assignments?'
      },
      can_grade: {
        description: 'Can this teacher grade student submissions?'
      }
    },
    actions: {
      new: {
        before: async (request) => {
          // Validate that the user is a teacher
          if (request.payload && request.payload.teacher_id) {
            const teacher = await User.findByPk(request.payload.teacher_id);
            if (!teacher || teacher.role !== 'teacher') {
              throw new Error('Selected user must have teacher role');
            }
          }
          return request;
        }
      },
      edit: {
        before: async (request) => {
          // Validate that the user is a teacher
          if (request.payload && request.payload.teacher_id) {
            const teacher = await User.findByPk(request.payload.teacher_id);
            if (!teacher || teacher.role !== 'teacher') {
              throw new Error('Selected user must have teacher role');
            }
          }
          return request;
        }
      }
    }
  }
};
