const sequelize = require('../config/database');

// Import model factory functions
const UserModel = require('./User');
const BatchModel = require('./Batch');
const CourseModel = require('./Course');
const BatchEnrollmentModel = require('./BatchEnrollment');
const MaterialModel = require('./Material');
const AssignmentModel = require('./Assignment');
const SubmissionModel = require('./Submission');
const GradeModel = require('./Grade');

// Initialize models
const User = UserModel(sequelize);
const Batch = BatchModel(sequelize);
const Course = CourseModel(sequelize);
const BatchEnrollment = BatchEnrollmentModel(sequelize);
const Material = MaterialModel(sequelize);
const Assignment = AssignmentModel(sequelize);
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
  onDelete: 'RESTRICT' 
});

Course.hasMany(Assignment, { 
  foreignKey: 'course_id', 
  onDelete: 'RESTRICT' 
});

Course.hasMany(Material, {
  foreignKey: 'course_id',
  onDelete: 'RESTRICT'
});

Course.hasMany(Grade, {
  foreignKey: 'course_id',
  onDelete: 'RESTRICT'
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

// Sync database function
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✓ Database synchronized successfully');
    console.log('✓ All tables created/updated');
  } catch (error) {
    console.error('✗ Database sync failed:', error);
    throw error;
  }
};

// Export models and sync function
module.exports = {
  sequelize,
  User,
  Batch,
  Course,
  BatchEnrollment,
  Material,
  Assignment,
  Submission,
  Grade,
  syncDatabase
};
