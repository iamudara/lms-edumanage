import { Course, Assignment, Material, BatchEnrollment, CourseTeacher, FolderCourse } from '../models/index.js';
import { ValidationError } from 'adminjs';

export const CourseResource = {
  resource: Course,
  options: {
    listProperties: ['id', 'title', 'code', 'semester'],
    editProperties: ['title', 'code', 'description', 'semester'],
    properties: {
      semester: {
        description: 'Semester/term when this course is offered (e.g., "2024 Fall", "Semester 1")'
      }
    },
    actions: {
      delete: {
        before: async (request, context) => {
          const { record } = context;
          
          if (request.method === 'post') {
            // Get course ID from the record
            const courseId = record.id();
            
            // Count related records to enforce integrity
            const [
              assignmentCount,
              materialCount,
              enrollmentCount,
              teacherCount,
              sharedFolderCount
            ] = await Promise.all([
              Assignment.count({ where: { course_id: courseId } }),
              Material.count({ where: { course_id: courseId } }),
              BatchEnrollment.count({ where: { course_id: courseId } }),
              CourseTeacher.count({ where: { course_id: courseId } }),
              FolderCourse.count({ where: { course_id: courseId } })
            ]);
            
            // Collect blocking reasons
            const reasons = [];
            if (assignmentCount > 0) reasons.push(`${assignmentCount} assignment(s)`);
            if (materialCount > 0) reasons.push(`${materialCount} material(s)`);
            if (enrollmentCount > 0) reasons.push(`${enrollmentCount} batch enrollment(s)`);
            if (teacherCount > 0) reasons.push(`${teacherCount} teacher(s)`);
            if (sharedFolderCount > 0) reasons.push(`${sharedFolderCount} shared folder(s)`);

            // If dependencies exist, PREVENT deletion with a validation error
            if (reasons.length > 0) {
              throw new ValidationError(
                {
                  base: {
                    message: 'validation error'
                  }
                },
                {
                  message: 'You cant delete this course if you have any assignments, course materials, folders, teacher enrollement or batch enrollments associated with this'
                }
              );
            }
          }
          
          return request;
        },
      }
    }
  }
};
