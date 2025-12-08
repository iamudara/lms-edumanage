import { Grade } from '../models/index.js';

export const GradeResource = {
  resource: Grade,
  options: {
    listProperties: ['id', 'course_id', 'student_id', 'grade'],
    editProperties: ['course_id', 'student_id', 'grade', 'remarks'],
  }
};
