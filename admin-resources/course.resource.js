import { Course, Assignment, Material, BatchEnrollment } from '../models/index.js';

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
            
            // Count related records
            const assignmentCount = await Assignment.count({ where: { course_id: courseId } });
            const materialCount = await Material.count({ where: { course_id: courseId } });
            const enrollmentCount = await BatchEnrollment.count({ where: { course_id: courseId } });
            
            // Add notice to the record
            if (assignmentCount > 0 || materialCount > 0 || enrollmentCount > 0) {
              record.params.deleteWarning = `⚠️ WARNING: Deleting this course will also delete:\\n` +
                `- ${assignmentCount} assignment(s)\\n` +
                `- ${materialCount} material(s)\\n` +
                `- ${enrollmentCount} batch enrollment(s)\\n` +
                `This action cannot be undone!`;
            }
          }
          
          return request;
        },
        component: false, // Ensure no custom component covers the native confirm
        guard: 'Are you sure you want to delete this course? This will also delete all assignments, materials, submissions, and batch enrollments associated with it. This action cannot be undone!',
      }
    }
  }
};
