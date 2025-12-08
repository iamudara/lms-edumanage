import { AssignmentMaterial } from '../models/index.js';
import { deleteCloudinaryFile } from '../config/cloudinary.js';

export const AssignmentMaterialResource = {
  resource: AssignmentMaterial,
  options: {
    listProperties: ['id', 'assignment_id', 'title', 'type', 'url'],
    editProperties: ['assignment_id', 'title', 'type', 'url', 'file_type', 'description'],
    actions: {
      delete: {
        before: async (request, context) => {
          if (request.method === 'post') {
            const material = await AssignmentMaterial.findByPk(context.record.id());
            
            // Delete assignment material file from Cloudinary if exists and is a file type
            if (material && material.url && material.type === 'file') {
              try {
                await deleteCloudinaryFile(material.url);
                console.log(`Deleted assignment material from Cloudinary`);
              } catch (error) {
                console.error('Error deleting assignment material file from Cloudinary:', error);
              }
            }
          }
          
          return request;
        },
        guard: 'Are you sure you want to delete this assignment material? If this is a file, it will also be deleted from Cloudinary. This action cannot be undone!',
      }
    }
  }
};
