import { Assignment, AssignmentMaterial, Submission } from '../models/index.js';
import { deleteCloudinaryFile } from '../config/cloudinary.js';
import { ValidationError } from 'adminjs';

export const AssignmentResource = {
  resource: Assignment,
  options: {
    navigation: {
      name: 'Content Management',
      icon: 'Clipboard'
    },
    listProperties: ['id', 'course_id', 'title', 'deadline', 'created_by'],
    editProperties: ['course_id', 'title', 'description', 'deadline', 'created_by'],
    actions: {
      delete: {
        before: async (request, context) => {
          if (request.method === 'post') {
            const assignmentId = context.record.id();

            // Check for submissions
            const submissionCount = await Submission.count({ where: { assignment_id: assignmentId } });
            if (submissionCount > 0) {
              throw new ValidationError(
                {
                  base: {
                    message: 'validation error'
                  }
                },
                {
                  message: 'You cant delete this assignment because it has submissions associated with it'
                }
              );
            }
            
            // Get all assignment materials to delete from Cloudinary
            const materials = await AssignmentMaterial.findAll({
              where: { assignment_id: assignmentId }
            });
            
            // Delete each material file from Cloudinary
            for (const material of materials) {
              if (material.url && material.type === 'file') {
                try {
                  await deleteCloudinaryFile(material.url);
                  console.log(`Deleted assignment material from Cloudinary`);
                } catch (error) {
                  console.error('Error deleting assignment material from Cloudinary:', error);
                }
              }
            }
            
            // Get all submissions to delete their files from Cloudinary
            const submissions = await Submission.findAll({
              where: { assignment_id: assignmentId }
            });
            
            // Delete each submission file from Cloudinary
            for (const submission of submissions) {
              if (submission.file_url) {
                try {
                  await deleteCloudinaryFile(submission.file_url);
                  console.log(`Deleted submission file from Cloudinary`);
                } catch (error) {
                  console.error('Error deleting submission file from Cloudinary:', error);
                }
              }
            }
          }
          
          return request;
        },
        guard: 'Are you sure you want to delete this assignment? This will also delete all assignment materials and their files from Cloudinary. This action cannot be undone! ',
      }
    }
  }
};
