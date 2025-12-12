/**
 * Database Seeding Script
 * Creates initial test users, batch, and course for development
 * Run with: node utils/seed.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { User, Batch, Course, CourseTeacher, BatchEnrollment, syncDatabase, sequelize } from '../models/index.js';

/**
 * Seed initial data for testing
 * Creates admin, teacher, student, batch, and course
 */
async function seedUsers() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Check for force reset arg
    const forceReset = process.argv.includes('force');
    if (forceReset) {
       console.log('⚠️  FORCE RESET: Dropping all tables and recreating...');
       // Disable FK checks to allow dropping tables with constraints
       await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    }

    // Ensure database is synced
    await sequelize.sync({ force: forceReset });

    if (forceReset) {
       // Re-enable FK checks
       await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }
    console.log('✓ Database synchronized\n');

    // 1. Create a Test Batch
    console.log('📚 Creating test batch...');
    const [batch, batchCreated] = await Batch.findOrCreate({
      where: { code: 'BATCH2024' },
      defaults: {
        name: 'Computer Science 2024',
        code: 'BATCH2024',
        description: 'Computer Science students batch for year 2024',
        year: 2024,
      },
    });

    if (batchCreated) {
      console.log('✓ Test batch created:', batch.name);
    } else {
      console.log('ℹ Test batch already exists:', batch.name);
    }

    // 2. Create a Test Course
    console.log('📘 Creating test course...');
    const [course, courseCreated] = await Course.findOrCreate({
      where: { code: 'Test101' },
      defaults: {
        title: 'Test Course',
        code: 'Test101',
        description: 'Test Course Description',
        semester: 'Semester 1',
      },
    });

    if (courseCreated) {
      console.log('✓ Test course created:', course.title);
    } else {
      console.log('ℹ Test course already exists:', course.title);
    }
    console.log('');

    // 3. Define Test Users
    const testUsers = [
      {
        username: 'admin',
        email: 'admin@lms.com',
        password: 'admin123',
        full_name: 'System Administrator',
        role: 'admin',
        batch_id: null,
      },
      {
        username: 'teacher',
        email: 'teacher@lms.com',
        password: 'teacher123',
        full_name: 'John Doe',
        role: 'teacher',
        batch_id: null,
      },
      // Create student assigned to the test batch
      {
        username: 'student',
        email: 'student@lms.com',
        password: 'student123',
        full_name: 'Jane Smith',
        role: 'student',
        batch_id: batch.id, // Assign to the created batch
      },
    ];

    console.log('👥 Creating test users...\n');

    // 4. Create Users and capture instances
    const createdUsers = {};

    for (const userData of testUsers) {
      try {
        const [user, created] = await User.findOrCreate({
          where: { email: userData.email },
          defaults: userData,
        });

        createdUsers[userData.role] = user;

        if (created) {
          console.log(`✓ Created ${userData.role}: ${userData.email}`);
        } else {
          console.log(`ℹ User already exists: ${userData.email}`);
          // Update batch_id for student if it was missing/different (optional fix-up)
          if (userData.role === 'student' && user.batch_id !== batch.id) {
            user.batch_id = batch.id;
            await user.save();
            console.log(`  └Updated batch for ${userData.email}`);
          }
        }
      } catch (error) {
        console.error(`✗ Error creating ${userData.role}:`, error.message);
      }
    }

    // 5. Assign Teacher to Course
    if (createdUsers['teacher'] && course) {
      console.log('\n👨‍🏫 Assigning teacher to course...');
      try {
        const [assignment, assigned] = await CourseTeacher.findOrCreate({
          where: {
            course_id: course.id,
            teacher_id: createdUsers['teacher'].id
          },
          defaults: {
            is_primary: true,
            can_edit: true,
            can_grade: true
          }
        });
        
        if (assigned) console.log('✓ Teacher assigned to course');
        else console.log('ℹ Teacher already assigned to course');
      } catch (err) {
        console.error('✗ Failed to assign teacher:', err.message);
      }
    }

    // 6. Enroll Batch in Course (Optional but good for testing)
    if (batch && course) {
      console.log('🔗 Enrolling batch in course...');
      try {
        const [enrollment, enrolled] = await BatchEnrollment.findOrCreate({
          where: {
            batch_id: batch.id,
            course_id: course.id
          }
        });

        if (enrolled) console.log('✓ Batch enrolled in course');
        else console.log('ℹ Batch already enrolled');
      } catch (err) {
        console.error('✗ Failed to enroll batch:', err.message);
      }
    }

    console.log('\n🎉 Seeding completed successfully!\n');
    console.log('📝 Test Credentials:');
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│ Admin:                                      │');
    console.log('│   Email: admin@lms.com                      │');
    console.log('│   Password: admin123                        │');
    console.log('├─────────────────────────────────────────────┤');
    console.log('│ Teacher:                                    │');
    console.log('│   Email: teacher@lms.com                    │');
    console.log('│   Password: teacher123                      │');
    console.log(`│   Course: ${course.code} (${course.title})       │`);
    console.log('├─────────────────────────────────────────────┤');
    console.log('│ Student:                                    │');
    console.log('│   Email: student@lms.com                    │');
    console.log('│   Password: student123                      │');
    console.log(`│   Batch: ${batch.name}             │`);
    console.log('└─────────────────────────────────────────────┘');
    console.log('\n✨ You can now login at http://localhost:3000/auth/login\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run seeding
seedUsers();
