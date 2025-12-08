import { Material } from '../models/index.js';
import { deleteCloudinaryFile } from '../config/cloudinary.js';

export const MaterialResource = {
  resource: Material,
  options: {
    listProperties: ['id', 'course_id', 'folder_id', 'title', 'file_url'],
    editProperties: ['course_id', 'folder_id', 'title', 'file_url', 'description'],
    filterProperties: ['course_id', 'folder_id', 'title'],
    properties: {
      course_id: {
        description: 'Course this material belongs to (optional if in a folder)'
      },
      folder_id: {
        description: 'Folder this material belongs to (optional if course-based)'
      }
    },
    actions: {
      delete: {
        before: async (request, context) => {
          if (request.method === 'post') {
            const material = await Material.findByPk(context.record.id());
            
            // Delete material file from Cloudinary if exists
            if (material && material.file_url) {
              try {
                await deleteCloudinaryFile(material.file_url);
                console.log(`Deleted course material from Cloudinary`);
              } catch (error) {
                console.error('Error deleting material file from Cloudinary:', error);
              }
            }
          }
          
          return request;
        },
        guard: 'Are you sure you want to delete this material? This will also delete the file from Cloudinary. This action cannot be undone!',
      }
    }
  }
};
