import { BatchEnrollment } from '../models/index.js';

export const BatchEnrollmentResource = {
  resource: BatchEnrollment,
  options: {
    navigation: {
      name: 'Academic Management',
      icon: 'UserPlus'
    },
    listProperties: ['id', 'batch_id', 'course_id'],
    editProperties: ['batch_id', 'course_id'],
  }
};
