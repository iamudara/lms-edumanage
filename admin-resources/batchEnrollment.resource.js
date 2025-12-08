import { BatchEnrollment } from '../models/index.js';

export const BatchEnrollmentResource = {
  resource: BatchEnrollment,
  options: {
    listProperties: ['id', 'batch_id', 'course_id'],
    editProperties: ['batch_id', 'course_id'],
  }
};
