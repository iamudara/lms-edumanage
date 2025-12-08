import { FolderCourse } from '../models/index.js';

export const FolderCourseResource = {
  resource: FolderCourse,
  options: {
    navigation: {
      name: 'Folder Management',
      icon: 'Share'
    },
    listProperties: ['id', 'folder_id', 'course_id', 'added_by', 'created_at'],
    editProperties: ['folder_id', 'course_id', 'added_by'],
    filterProperties: ['folder_id', 'course_id', 'added_by'],
    showProperties: ['id', 'folder_id', 'course_id', 'added_by', 'created_at'],
    properties: {
      folder_id: {
        description: 'The folder being shared',
        position: 1
      },
      course_id: {
        description: 'The course this folder is shared with',
        position: 2
      },
      added_by: {
        description: 'Teacher who shared this folder',
        position: 3
      }
    }
  }
};
