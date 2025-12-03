import sequelize from '../config/database.js';

// Import model factory functions
import UserModel from './User.js';
import BatchModel from './Batch.js';
import CourseModel from './Course.js';
import BatchEnrollmentModel from './BatchEnrollment.js';
import MaterialModel from './Material.js';
import AssignmentModel from './Assignment.js';
import AssignmentMaterialModel from './AssignmentMaterial.js';
import SubmissionModel from './Submission.js';
import GradeModel from './Grade.js';

// Initialize models
const User = UserModel(sequelize);
const Batch = BatchModel(sequelize);
const Course = CourseModel(sequelize);
const BatchEnrollment = BatchEnrollmentModel(sequelize);
const Material = MaterialModel(sequelize);
const Assignment = AssignmentModel(sequelize);
const AssignmentMaterial = AssignmentMaterialModel(sequelize);
const Submission = SubmissionModel(sequelize);
const Grade = GradeModel(sequelize);

// Define associations

// Batch associations
Batch.hasMany(User, { 
  foreignKey: 'batch_id', 
  as: 'students' 
});

Batch.hasMany(BatchEnrollment, { 
  foreignKey: 'batch_id', 
  onDelete: 'RESTRICT' 
});

// User associations
User.belongsTo(Batch, { 
  foreignKey: 'batch_id', 
  as: 'batch' 
});

User.hasMany(Course, { 
  foreignKey: 'teacher_id', 
  as: 'courses' 
});

User.hasMany(Submission, {
  foreignKey: 'student_id',
  as: 'submissions'
});

User.hasMany(Grade, {
  foreignKey: 'student_id',
  as: 'grades'
});

// Course associations
Course.belongsTo(User, { 
  foreignKey: 'teacher_id', 
  as: 'teacher' 
});

Course.hasMany(BatchEnrollment, { 
  foreignKey: 'course_id', 
  onDelete: 'CASCADE'  // Changed from RESTRICT - allows deleting course with enrollments
});

Course.hasMany(Assignment, { 
  foreignKey: 'course_id', 
  onDelete: 'CASCADE'  // Changed from RESTRICT - allows deleting course with assignments
});

Course.hasMany(Material, {
  foreignKey: 'course_id',
  onDelete: 'CASCADE'  // Changed from RESTRICT - allows deleting course with materials
});

Course.hasMany(Grade, {
  foreignKey: 'course_id',
  onDelete: 'CASCADE'  // Changed from RESTRICT - allows deleting course with grades
});

// BatchEnrollment associations
BatchEnrollment.belongsTo(Batch, { 
  foreignKey: 'batch_id', 
  as: 'batch' 
});

BatchEnrollment.belongsTo(Course, { 
  foreignKey: 'course_id', 
  as: 'course' 
});

// Material associations
Material.belongsTo(Course, {
  foreignKey: 'course_id',
  as: 'course'
});

// Assignment associations
Assignment.belongsTo(Course, {
  foreignKey: 'course_id',
  as: 'course'
});

Assignment.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
});

Assignment.hasMany(Submission, { 
  foreignKey: 'assignment_id', 
  onDelete: 'RESTRICT' 
});

Assignment.hasMany(AssignmentMaterial, {
  foreignKey: 'assignment_id',
  onDelete: 'CASCADE',
  as: 'materials'
});

// AssignmentMaterial associations
AssignmentMaterial.belongsTo(Assignment, {
  foreignKey: 'assignment_id',
  as: 'assignment'
});

// Submission associations
Submission.belongsTo(Assignment, { 
  foreignKey: 'assignment_id',
  as: 'assignment'
});

Submission.belongsTo(User, { 
  foreignKey: 'student_id', 
  as: 'student' 
});

Submission.belongsTo(User, {
  foreignKey: 'graded_by',
  as: 'grader'
});

// Grade associations
Grade.belongsTo(Course, {
  foreignKey: 'course_id',
  as: 'course'
});

Grade.belongsTo(User, {
  foreignKey: 'student_id',
  as: 'student'
});

// Sync function
const syncDatabase = async () => {
  try {
    // Use { force: false } instead of { alter: true } to avoid too many keys error
    // Only creates tables if they don't exist, doesn't modify existing ones
    await sequelize.sync({ force: false });
    console.log('✓ Database synchronized successfully');
    console.log('✓ All tables created/updated');
  } catch (error) {
    console.error('✗ Database sync failed:', error);
    throw error;
  }
};

// Export models and sync function
export {
  sequelize,
  User,
  Batch,
  Course,
  BatchEnrollment,
  Material,
  Assignment,
  AssignmentMaterial,
  Submission,
  Grade,
  syncDatabase
};

