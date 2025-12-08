import { Folder, Material, FolderCourse } from '../models/index.js';
import { deleteCloudinaryFile } from '../config/cloudinary.js';

export const FolderResource = {
  resource: Folder,
  options: {
    navigation: {
      name: 'Folder Management',
      icon: 'Folder'
    },
    listProperties: ['id', 'name', 'parent_id', 'is_shared'],
    editProperties: ['name', 'parent_id', 'is_shared'],
    filterProperties: ['name', 'is_shared'],
    showProperties: ['id', 'name', 'parent_id', 'is_shared', 'createdAt', 'updatedAt'],
    properties: {
      name: {
        isTitle: true,
        position: 1
      },
      parent_id: {
        description: 'Parent folder (leave empty for root level folder)',
        position: 2
      },
      is_shared: {
        description: 'Whether this folder is shared with any courses',
        position: 3
      }
    },
    actions: {
      delete: {
        before: async (request, context) => {
          if (request.method === 'post') {
            const folderId = context.record.id();
            
            // Check for subfolders
            const subfolderCount = await Folder.count({ where: { parent_id: folderId } });
            if (subfolderCount > 0) {
              throw new Error('Cannot delete folder with subfolders. Delete subfolders first.');
            }
            
            // Delete materials in this folder from Cloudinary
            const materials = await Material.findAll({ where: { folder_id: folderId } });
            for (const material of materials) {
              if (material.file_url && material.file_url.includes('cloudinary.com')) {
                try {
                  await deleteCloudinaryFile(material.file_url);
                } catch (error) {
                  console.error('Error deleting material file from Cloudinary:', error);
                }
              }
            }
            
            // Delete materials
            await Material.destroy({ where: { folder_id: folderId } });
            
            // Delete folder-course associations
            await FolderCourse.destroy({ where: { folder_id: folderId } });
          }
          
          return request;
        },
        guard: 'Are you sure you want to delete this folder? This will also delete all materials inside and remove all course sharing. This action cannot be undone!',
      }
    }
  }
};
