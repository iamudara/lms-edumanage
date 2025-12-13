import { User, CourseTeacher, Assignment } from '../models/index.js';
import { ValidationError } from 'adminjs';

export const UserResource = {
  resource: User,
  options: {
    navigation: {
      name: 'User Management',
      icon: 'Users'
    },
    listProperties: ['id', 'username', 'email', 'full_name', 'role', 'batch_id'],
    editProperties: ['username', 'email', 'password', 'full_name', 'role', 'batch_id'],
    filterProperties: ['username', 'email', 'role', 'batch_id'],
    actions: {
      delete: {
        before: async (request, context) => {
          if (request.method === 'post') {
            const userId = context.record.id();
            
            // Check for associated records (Teacher Enrollments, Assignments)
            // We check both CourseTeacher (teacher_id) and Assignment (created_by)
            const [enrollmentCount, assignmentCount] = await Promise.all([
              CourseTeacher.count({ where: { teacher_id: userId } }),
              Assignment.count({ where: { created_by: userId } })
            ]);

            if (enrollmentCount > 0 || assignmentCount > 0) {
              throw new ValidationError(
                {
                  base: {
                    message: 'validation error'
                  }
                },
                {
                  // Using "cant" based on user's likely intent despite typo "can"
                  message: 'cant delete cause this teacher associate with course enrollment or assignment'
                }
              );
            }
          }
          return request;
        }
      }
    }
  }
};
