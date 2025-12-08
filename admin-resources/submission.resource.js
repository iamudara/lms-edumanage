import { Submission } from '../models/index.js';
import { deleteCloudinaryFile } from '../config/cloudinary.js';

export const SubmissionResource = {
  resource: Submission,
  options: {
    listProperties: ['id', 'assignment_id', 'student_id', 'submitted_at', 'marks'],
    editProperties: ['assignment_id', 'student_id', 'file_url', 'submission_text', 'marks', 'feedback', 'graded_by'],
    actions: {
      delete: {
        before: async (request, context) => {
          if (request.method === 'post') {
            const submission = await Submission.findByPk(context.record.id());
            
            // Delete submission file from Cloudinary if exists
            if (submission && submission.file_url) {
              try {
                await deleteCloudinaryFile(submission.file_url);
                console.log(`Deleted submission file from Cloudinary`);
              } catch (error) {
                console.error('Error deleting submission file from Cloudinary:', error);
              }
            }
          }
          
          return request;
        },
        guard: 'Are you sure you want to delete this submission? This will also delete the submitted file from Cloudinary. This action cannot be undone!',
      }
    }
  }
};
