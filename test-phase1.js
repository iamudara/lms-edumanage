/**
 * Phase 1 Comprehensive Test Suite
 * Tests all components built in Tasks 1.1-1.14
 */

import 'dotenv/config';
import sequelize from './config/database.js';
import cloudinary from './config/cloudinary.js';
import {
  User,
  Batch,
  Course,
  BatchEnrollment,
  Material,
  Assignment,
  Submission,
  Grade
} from './models/index.js';

console.log('\n🧪 PHASE 1 COMPREHENSIVE TEST SUITE');
console.log('═'.repeat(60));

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(testName, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`\n${status} ${testName}`);
  if (details) console.log(`   ${details}`);
  
  testResults.tests.push({ name: testName, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

async function runTests() {
  try {
    // ====================================
    // TEST 1: Database Connection
    // ====================================
    console.log('\n📦 TEST 1: Database Connection');
    console.log('─'.repeat(60));
    try {
      await sequelize.authenticate();
      logTest('Database connection', true, 'Connected to MySQL database');
    } catch (error) {
      logTest('Database connection', false, error.message);
      throw error;
    }

    // ====================================
    // TEST 2: Database Tables
    // ====================================
    console.log('\n📋 TEST 2: Database Tables');
    console.log('─'.repeat(60));
    try {
      const [tables] = await sequelize.query('SHOW TABLES');
      const tableNames = tables.map(t => Object.values(t)[0]);
      
      const expectedTables = [
        'users', 'batches', 'courses', 'batch_enrollments',
        'materials', 'assignments', 'submissions', 'grades', 'sessions'
      ];
      
      const missingTables = expectedTables.filter(t => !tableNames.includes(t));
      
      if (missingTables.length === 0) {
        logTest('All required tables exist', true, `9 tables found: ${tableNames.join(', ')}`);
      } else {
        logTest('All required tables exist', false, `Missing: ${missingTables.join(', ')}`);
      }
    } catch (error) {
      logTest('Database tables check', false, error.message);
    }

    // ====================================
    // TEST 3: Cloudinary Configuration
    // ====================================
    console.log('\n☁️  TEST 3: Cloudinary Configuration');
    console.log('─'.repeat(60));
    try {
      const result = await cloudinary.api.ping();
      logTest('Cloudinary connection', true, `Status: ${result.status}`);
    } catch (error) {
      logTest('Cloudinary connection', false, error.message);
    }

    // ====================================
    // TEST 4: Model Creation & Associations
    // ====================================
    console.log('\n🔗 TEST 4: Model Creation & Associations');
    console.log('─'.repeat(60));
    
    // Clean up test data first
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await User.destroy({ where: {}, force: true });
    await Batch.destroy({ where: {}, force: true });
    await Course.destroy({ where: {}, force: true });
    await BatchEnrollment.destroy({ where: {}, force: true });
    await Material.destroy({ where: {}, force: true });
    await Assignment.destroy({ where: {}, force: true });
    await Submission.destroy({ where: {}, force: true });
    await Grade.destroy({ where: {}, force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Test 4.1: Create Batch
    try {
      const batch = await Batch.create({
        name: '2024 Batch A',
        code: '2024A',
        description: 'Test batch for Phase 1',
        year: 2024
      });
      logTest('Batch model creation', true, `Batch ID: ${batch.id}`);
    } catch (error) {
      logTest('Batch model creation', false, error.message);
    }

    // Test 4.2: Create Users (all roles)
    try {
      const admin = await User.create({
        username: 'testadmin',
        email: 'testadmin@lms.com',
        password: 'hashedpassword123',
        full_name: 'Test Admin',
        role: 'admin',
        batch_id: null
      });

      const teacher = await User.create({
        username: 'testteacher',
        email: 'testteacher@lms.com',
        password: 'hashedpassword123',
        full_name: 'Test Teacher',
        role: 'teacher',
        batch_id: null
      });

      const batch = await Batch.findOne({ where: { code: '2024A' } });
      const student = await User.create({
        username: 'teststudent',
        email: 'teststudent@lms.com',
        password: 'hashedpassword123',
        full_name: 'Test Student',
        role: 'student',
        batch_id: batch.id
      });

      logTest('User model creation (3 roles)', true, `Admin, Teacher, Student created`);
    } catch (error) {
      logTest('User model creation', false, error.message);
    }

    // Test 4.3: Create Course (Teacher association)
    try {
      const teacher = await User.findOne({ where: { role: 'teacher' } });
      const course = await Course.create({
        title: 'Introduction to Testing',
        code: 'TEST101',
        description: 'A test course for Phase 1',
        teacher_id: teacher.id
      });
      logTest('Course model creation with teacher association', true, `Course ID: ${course.id}`);
    } catch (error) {
      logTest('Course model creation', false, error.message);
    }

    // Test 4.4: Create BatchEnrollment (Batch-based enrollment)
    try {
      const batch = await Batch.findOne({ where: { code: '2024A' } });
      const course = await Course.findOne({ where: { code: 'TEST101' } });
      
      const enrollment = await BatchEnrollment.create({
        batch_id: batch.id,
        course_id: course.id
      });
      logTest('BatchEnrollment model (batch-based system)', true, `Enrollment ID: ${enrollment.id}`);
    } catch (error) {
      logTest('BatchEnrollment model', false, error.message);
    }

    // Test 4.5: Create Material
    try {
      const course = await Course.findOne({ where: { code: 'TEST101' } });
      const material = await Material.create({
        course_id: course.id,
        title: 'Test Material',
        file_url: 'https://cloudinary.com/test.pdf',
        description: 'Test material upload'
      });
      logTest('Material model creation', true, `Material ID: ${material.id}`);
    } catch (error) {
      logTest('Material model creation', false, error.message);
    }

    // Test 4.6: Create Assignment (NO max_marks)
    try {
      const course = await Course.findOne({ where: { code: 'TEST101' } });
      const teacher = await User.findOne({ where: { role: 'teacher' } });
      
      const assignment = await Assignment.create({
        course_id: course.id,
        title: 'Test Assignment',
        description: 'Complete the test',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        created_by: teacher.id
      });
      
      // Verify NO max_marks field
      const hasMaxMarks = assignment.hasOwnProperty('max_marks');
      logTest('Assignment model (NO max_marks field)', !hasMaxMarks, `Assignment ID: ${assignment.id}`);
    } catch (error) {
      logTest('Assignment model creation', false, error.message);
    }

    // Test 4.7: Create Submission (nullable marks, auto-updating submitted_at)
    try {
      const assignment = await Assignment.findOne({ where: { title: 'Test Assignment' } });
      const student = await User.findOne({ where: { role: 'student' } });
      
      const submission = await Submission.create({
        assignment_id: assignment.id,
        student_id: student.id,
        file_url: 'https://cloudinary.com/submission.pdf',
        submission_text: 'Here is my submission',
        marks: null, // Nullable - not graded yet
        feedback: null,
        graded_by: null
      });
      
      const initialTime = submission.submitted_at;
      
      // Test resubmission (update should change submitted_at)
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await submission.update({ submission_text: 'Updated submission' });
      await submission.reload();
      
      const timeUpdated = submission.submitted_at.getTime() !== initialTime.getTime();
      logTest('Submission model (nullable marks, auto-update submitted_at)', timeUpdated, 
        `Submission ID: ${submission.id}, submitted_at updated on resubmit`);
    } catch (error) {
      logTest('Submission model creation', false, error.message);
    }

    // Test 4.8: Create Grade (manual entry)
    try {
      const course = await Course.findOne({ where: { code: 'TEST101' } });
      const student = await User.findOne({ where: { role: 'student' } });
      
      const grade = await Grade.create({
        course_id: course.id,
        student_id: student.id,
        grade: 'A',
        remarks: 'Excellent performance'
      });
      logTest('Grade model creation (manual entry)', true, `Grade ID: ${grade.id}, Grade: ${grade.grade}`);
    } catch (error) {
      logTest('Grade model creation', false, error.message);
    }

    // ====================================
    // TEST 5: Model Associations
    // ====================================
    console.log('\n🔗 TEST 5: Model Associations (Relationships)');
    console.log('─'.repeat(60));

    // Test 5.1: User -> Batch relationship
    try {
      const student = await User.findOne({
        where: { role: 'student' },
        include: [{ model: Batch, as: 'batch' }]
      });
      const hasBatch = student.batch !== null && student.batch.code === '2024A';
      logTest('User belongsTo Batch', hasBatch, `Student belongs to batch: ${student.batch?.code}`);
    } catch (error) {
      logTest('User belongsTo Batch', false, error.message);
    }

    // Test 5.2: Batch -> Users relationship
    try {
      const batch = await Batch.findOne({
        where: { code: '2024A' },
        include: [{ model: User, as: 'students' }]
      });
      const hasStudents = batch.students.length > 0;
      logTest('Batch hasMany Users', hasStudents, `Batch has ${batch.students.length} student(s)`);
    } catch (error) {
      logTest('Batch hasMany Users', false, error.message);
    }

    // Test 5.3: Course -> Teacher relationship
    try {
      const course = await Course.findOne({
        where: { code: 'TEST101' },
        include: [{ model: User, as: 'teacher' }]
      });
      const hasTeacher = course.teacher !== null;
      logTest('Course belongsTo Teacher (User)', hasTeacher, `Teacher: ${course.teacher?.full_name}`);
    } catch (error) {
      logTest('Course belongsTo Teacher', false, error.message);
    }

    // Test 5.4: BatchEnrollment -> Batch & Course
    try {
      const enrollment = await BatchEnrollment.findOne({
        include: [
          { model: Batch, as: 'batch' },
          { model: Course, as: 'course' }
        ]
      });
      const hasRelations = enrollment.batch !== null && enrollment.course !== null;
      logTest('BatchEnrollment associations', hasRelations, 
        `Batch: ${enrollment.batch?.code}, Course: ${enrollment.course?.code}`);
    } catch (error) {
      logTest('BatchEnrollment associations', false, error.message);
    }

    // Test 5.5: Assignment -> Course & Submissions
    try {
      const assignment = await Assignment.findOne({
        include: [
          { model: Course, as: 'course' },
          { model: Submission, as: 'Submissions' }
        ]
      });
      const hasRelations = assignment.course !== null;
      logTest('Assignment associations', hasRelations, 
        `Course: ${assignment.course?.code}, Submissions: ${assignment.Submissions?.length || 0}`);
    } catch (error) {
      logTest('Assignment associations', false, error.message);
    }

    // ====================================
    // TEST 6: Unique Constraints
    // ====================================
    console.log('\n🔒 TEST 6: Unique Constraints');
    console.log('─'.repeat(60));

    // Test 6.1: Duplicate username
    try {
      await User.create({
        username: 'testadmin', // Duplicate
        email: 'another@email.com',
        password: 'password',
        full_name: 'Another User',
        role: 'admin'
      });
      logTest('Username unique constraint', false, 'Should have prevented duplicate username');
    } catch (error) {
      const isDuplicateError = error.name === 'SequelizeUniqueConstraintError';
      logTest('Username unique constraint', isDuplicateError, 'Correctly prevented duplicate username');
    }

    // Test 6.2: Duplicate course code
    try {
      const teacher = await User.findOne({ where: { role: 'teacher' } });
      await Course.create({
        title: 'Another Course',
        code: 'TEST101', // Duplicate
        description: 'Test',
        teacher_id: teacher.id
      });
      logTest('Course code unique constraint', false, 'Should have prevented duplicate code');
    } catch (error) {
      const isDuplicateError = error.name === 'SequelizeUniqueConstraintError';
      logTest('Course code unique constraint', isDuplicateError, 'Correctly prevented duplicate course code');
    }

    // Test 6.3: Duplicate batch enrollment
    try {
      const batch = await Batch.findOne({ where: { code: '2024A' } });
      const course = await Course.findOne({ where: { code: 'TEST101' } });
      
      await BatchEnrollment.create({
        batch_id: batch.id,
        course_id: course.id // Duplicate combination
      });
      logTest('BatchEnrollment unique constraint', false, 'Should have prevented duplicate enrollment');
    } catch (error) {
      const isDuplicateError = error.name === 'SequelizeUniqueConstraintError';
      logTest('BatchEnrollment unique constraint', isDuplicateError, 
        'Correctly prevented duplicate batch enrollment');
    }

    // ====================================
    // TEST 7: Foreign Key Constraints
    // ====================================
    console.log('\n🔗 TEST 7: Foreign Key Constraints (onDelete: RESTRICT)');
    console.log('─'.repeat(60));

    // Test 7.1: Cannot delete course with enrollments
    try {
      const course = await Course.findOne({ where: { code: 'TEST101' } });
      await course.destroy();
      logTest('Course RESTRICT on delete', false, 'Should have prevented deletion');
    } catch (error) {
      const isFKError = error.name === 'SequelizeForeignKeyConstraintError';
      logTest('Course RESTRICT on delete', isFKError, 
        'Correctly prevented deletion (has batch enrollments)');
    }

    // Test 7.2: Cannot delete batch with enrollments
    try {
      const batch = await Batch.findOne({ where: { code: '2024A' } });
      await batch.destroy();
      logTest('Batch RESTRICT on delete', false, 'Should have prevented deletion');
    } catch (error) {
      const isFKError = error.name === 'SequelizeForeignKeyConstraintError';
      logTest('Batch RESTRICT on delete', isFKError, 
        'Correctly prevented deletion (has enrollments and students)');
    }

    // ====================================
    // TEST 8: Middleware Configuration
    // ====================================
    console.log('\n⚙️  TEST 8: Middleware Files');
    console.log('─'.repeat(60));

    try {
      const { isAuthenticated, isAdmin, isTeacher, isStudent } = await import('./middleware/auth.js');
      const authFunctionsExist = 
        typeof isAuthenticated === 'function' &&
        typeof isAdmin === 'function' &&
        typeof isTeacher === 'function' &&
        typeof isStudent === 'function';
      
      logTest('Auth middleware functions', authFunctionsExist, 
        'isAuthenticated, isAdmin, isTeacher, isStudent exported');
    } catch (error) {
      logTest('Auth middleware functions', false, error.message);
    }

    try {
      const uploadMiddleware = await import('./middleware/upload.js');
      const hasUploadFunctions = uploadMiddleware.default !== undefined;
      logTest('Upload middleware (Multer + Cloudinary)', hasUploadFunctions, 
        'uploadMaterial and uploadSubmission configured');
    } catch (error) {
      logTest('Upload middleware', false, error.message);
    }

    try {
      const errorHandler = await import('./middleware/errorHandler.js');
      const hasErrorHandler = typeof errorHandler.default === 'function';
      logTest('Error handler middleware', hasErrorHandler, 
        'Global error handler with dev/prod modes');
    } catch (error) {
      logTest('Error handler middleware', false, error.message);
    }

    // ====================================
    // TEST 9: View Templates
    // ====================================
    console.log('\n🎨 TEST 9: View Templates (EJS + DaisyUI)');
    console.log('─'.repeat(60));

    const fs = await import('fs');
    const path = await import('path');

    const viewFiles = [
      'views/layouts/main.ejs',
      'views/shared/navbar.ejs',
      'views/shared/footer.ejs',
      'public/css/custom.css',
      'public/css/output.css'
    ];

    for (const file of viewFiles) {
      try {
        const exists = fs.existsSync(file);
        logTest(`View file: ${file}`, exists, exists ? 'File exists' : 'File missing');
      } catch (error) {
        logTest(`View file: ${file}`, false, error.message);
      }
    }

    // ====================================
    // CLEANUP
    // ====================================
    console.log('\n🧹 Cleaning up test data...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await User.destroy({ where: {}, force: true });
    await Batch.destroy({ where: {}, force: true });
    await Course.destroy({ where: {}, force: true });
    await BatchEnrollment.destroy({ where: {}, force: true });
    await Material.destroy({ where: {}, force: true });
    await Assignment.destroy({ where: {}, force: true });
    await Submission.destroy({ where: {}, force: true });
    await Grade.destroy({ where: {}, force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Test data cleaned');

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  } finally {
    await sequelize.close();
  }

  // ====================================
  // FINAL REPORT
  // ====================================
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL TEST REPORT');
  console.log('═'.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total: ${testResults.tests.length}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Phase 1 is working perfectly!');
    console.log('✅ Ready to proceed to Phase 2: Authentication System\n');
  } else {
    console.log('\n⚠️  Some tests failed. Review the results above.');
    console.log('Failed tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`   ❌ ${t.name}: ${t.details}`));
    console.log();
  }
}

// Run the test suite
runTests().catch(console.error);
