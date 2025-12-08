/**
 * Full Database Seeding Script
 * Creates comprehensive test data for LMS EduManage
 * 
 * This seed includes:
 * - Multiple batches
 * - Multiple courses
 * - Multiple users (admins, teachers, students)
 * - Course-teacher assignments
 * - Batch enrollments
 * - Course materials and folders
 * 
 * Run: node utils/seed-full.js
 */

import 'dotenv/config';
import {
  sequelize,
  User,
  Batch,
  Course,
  CourseTeacher,
  BatchEnrollment,
  Folder,
  FolderCourse,
  Material,
  syncDatabase
} from '../models/index.js';

/**
 * Main seeding function
 */
async function seedFullDatabase() {
  try {
    console.log('\n🌱 Starting Full Database Seeding...\n');

    // Sync database first
    await syncDatabase();
    console.log('✓ Database synchronized\n');

    // ========================================
    // 1. CREATE BATCHES
    // ========================================
    console.log('📚 Creating Batches...');
    
    const batches = await Promise.all([
      Batch.findOrCreate({
        where: { code: 'B2024' },
        defaults: {
          name: 'Batch 2024',
          year: 2024,
          description: 'Academic year 2024 - Semester 1'
        }
      }),
      Batch.findOrCreate({
        where: { code: 'B2025' },
        defaults: {
          name: 'Batch 2025',
          year: 2025,
          description: 'Academic year 2025 - Semester 1'
        }
      }),
      Batch.findOrCreate({
        where: { code: 'B2026' },
        defaults: {
          name: 'Batch 2026',
          year: 2026,
          description: 'Academic year 2026 - Semester 1'
        }
      })
    ]);

    const [batch2024, batch2025, batch2026] = batches.map(b => b[0]);
    console.log(`✓ Created ${batches.length} batches\n`);

    // ========================================
    // 2. CREATE USERS
    // ========================================
    console.log('👥 Creating Users...\n');

    // --- ADMINS ---
    console.log('  Creating Admin...');
    const admins = await Promise.all([
      User.findOrCreate({
        where: { email: 'admin@lms.com' },
        defaults: {
          username: 'admin',
          password: 'admin123',
          full_name: 'System Administrator',
          role: 'admin'
        }
      })
    ]);
    console.log(`  ✓ Created ${admins.length} admin`);

    // --- TEACHERS ---
    console.log('  Creating Teachers...');
    const teachers = await Promise.all([
      User.findOrCreate({
        where: { email: 'nimal@lms.com' },
        defaults: {
          username: 'nimal',
          password: 'teacher123',
          full_name: 'Nimal Perera',
          role: 'teacher'
        }
      }),
      User.findOrCreate({
        where: { email: 'sanduni@lms.com' },
        defaults: {
          username: 'sanduni',
          password: 'teacher123',
          full_name: 'Sanduni Fernando',
          role: 'teacher'
        }
      }),
      User.findOrCreate({
        where: { email: 'kasun@lms.com' },
        defaults: {
          username: 'kasun',
          password: 'teacher123',
          full_name: 'Kasun Silva',
          role: 'teacher'
        }
      }),
      User.findOrCreate({
        where: { email: 'chathurika@lms.com' },
        defaults: {
          username: 'chathurika',
          password: 'teacher123',
          full_name: 'Chathurika Jayawardena',
          role: 'teacher'
        }
      }),
      User.findOrCreate({
        where: { email: 'dilshan@lms.com' },
        defaults: {
          username: 'dilshan',
          password: 'teacher123',
          full_name: 'Dilshan Wickramasinghe',
          role: 'teacher'
        }
      })
    ]);
    console.log(`  ✓ Created ${teachers.length} teachers`);

    const teacherUsers = teachers.map(t => t[0]);

    // --- STUDENTS ---
    console.log('  Creating Students...');
    const students = await Promise.all([
      User.findOrCreate({
        where: { email: 'saman@lms.com' },
        defaults: {
          username: 'saman',
          password: 'student123',
          full_name: 'Saman Kumara',
          role: 'student',
          batch_id: batch2024.id
        }
      }),
      User.findOrCreate({
        where: { email: 'nimali@lms.com' },
        defaults: {
          username: 'nimali',
          password: 'student123',
          full_name: 'Nimali Dissanayake',
          role: 'student',
          batch_id: batch2024.id
        }
      }),
      User.findOrCreate({
        where: { email: 'tharindu@lms.com' },
        defaults: {
          username: 'tharindu',
          password: 'student123',
          full_name: 'Tharindu Bandara',
          role: 'student',
          batch_id: batch2024.id
        }
      }),
      User.findOrCreate({
        where: { email: 'sachini@lms.com' },
        defaults: {
          username: 'sachini',
          password: 'student123',
          full_name: 'Sachini Rajapaksha',
          role: 'student',
          batch_id: batch2025.id
        }
      }),
      User.findOrCreate({
        where: { email: 'kavinda@lms.com' },
        defaults: {
          username: 'kavinda',
          password: 'student123',
          full_name: 'Kavinda Gunasekara',
          role: 'student',
          batch_id: batch2025.id
        }
      }),
      User.findOrCreate({
        where: { email: 'dilini@lms.com' },
        defaults: {
          username: 'dilini',
          password: 'student123',
          full_name: 'Dilini Malawana',
          role: 'student',
          batch_id: batch2025.id
        }
      }),
      User.findOrCreate({
        where: { email: 'yasitha@lms.com' },
        defaults: {
          username: 'yasitha',
          password: 'student123',
          full_name: 'Yasitha Ranasinghe',
          role: 'student',
          batch_id: batch2026.id
        }
      }),
      User.findOrCreate({
        where: { email: 'hansani@lms.com' },
        defaults: {
          username: 'hansani',
          password: 'student123',
          full_name: 'Hansani Wijesinghe',
          role: 'student',
          batch_id: batch2026.id
        }
      }),
      User.findOrCreate({
        where: { email: 'dinuka@lms.com' },
        defaults: {
          username: 'dinuka',
          password: 'student123',
          full_name: 'Dinuka Abeysekara',
          role: 'student',
          batch_id: batch2026.id
        }
      }),
      User.findOrCreate({
        where: { email: 'ishara@lms.com' },
        defaults: {
          username: 'ishara',
          password: 'student123',
          full_name: 'Ishara Gamage',
          role: 'student',
          batch_id: batch2026.id
        }
      })
    ]);
    console.log(`  ✓ Created ${students.length} students\n`);

    const studentUsers = students.map(s => s[0]);

    // ========================================
    // 3. CREATE COURSES
    // ========================================
    console.log('📖 Creating Courses...\n');

    const courses = await Promise.all([
      Course.findOrCreate({
        where: { code: 'MATH101' },
        defaults: {
          name: 'Mathematics',
          description: 'Basic mathematics course',
          credits: 3
        }
      }),
      Course.findOrCreate({
        where: { code: 'ENG101' },
        defaults: {
          name: 'English',
          description: 'Basic English course',
          credits: 3
        }
      }),
      Course.findOrCreate({
        where: { code: 'SCI101' },
        defaults: {
          name: 'Science',
          description: 'Basic science course',
          credits: 4
        }
      }),
      Course.findOrCreate({
        where: { code: 'HIST101' },
        defaults: {
          name: 'History',
          description: 'Basic history course',
          credits: 2
        }
      })
    ]);

    const courseList = courses.map(c => c[0]);
    console.log(`✓ Created ${courseList.length} courses\n`);

    // ========================================
    // 4. ASSIGN TEACHERS TO COURSES
    // ========================================
    console.log('👨‍🏫 Assigning Teachers to Courses...');

    const courseTeacherAssignments = [
      // MATH101 - Mathematics
      { course: courseList[0], teacher: teacherUsers[0], isPrimary: true },
      { course: courseList[0], teacher: teacherUsers[1], isPrimary: false },
      
      // ENG101 - English
      { course: courseList[1], teacher: teacherUsers[2], isPrimary: true },
      
      // SCI101 - Science
      { course: courseList[2], teacher: teacherUsers[3], isPrimary: true },
      { course: courseList[2], teacher: teacherUsers[4], isPrimary: false },
      
      // HIST101 - History
      { course: courseList[3], teacher: teacherUsers[1], isPrimary: true }
    ];

    for (const assignment of courseTeacherAssignments) {
      await CourseTeacher.findOrCreate({
        where: {
          course_id: assignment.course.id,
          teacher_id: assignment.teacher.id
        },
        defaults: {
          is_primary: assignment.isPrimary
        }
      });
    }
    console.log(`✓ Assigned teachers to ${courseTeacherAssignments.length} course slots\n`);

    // ========================================
    // 5. ENROLL BATCHES IN COURSES
    // ========================================
    console.log('📝 Enrolling Batches in Courses...');

    const batchEnrollments = [
      // Batch 2024
      { batch: batch2024, course: courseList[0] }, // MATH101
      { batch: batch2024, course: courseList[1] }, // ENG101
      { batch: batch2024, course: courseList[2] }, // SCI101
      
      // Batch 2025
      { batch: batch2025, course: courseList[0] }, // MATH101
      { batch: batch2025, course: courseList[3] }, // HIST101
      
      // Batch 2026
      { batch: batch2026, course: courseList[1] }, // ENG101
      { batch: batch2026, course: courseList[2] }, // SCI101
      { batch: batch2026, course: courseList[3] }  // HIST101
    ];

    for (const enrollment of batchEnrollments) {
      await BatchEnrollment.findOrCreate({
        where: {
          batch_id: enrollment.batch.id,
          course_id: enrollment.course.id
        }
      });
    }
    console.log(`✓ Created ${batchEnrollments.length} batch enrollments\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n🎉 Full Database Seeding Completed Successfully!\n');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📊 Summary:');
    console.log(`   • ${batches.length} Batches`);
    console.log(`   • ${admins.length} Admin`);
    console.log(`   • ${teachers.length} Teachers`);
    console.log(`   • ${students.length} Students`);
    console.log(`   • ${courseList.length} Courses`);
    console.log(`   • ${courseTeacherAssignments.length} Teacher-Course Assignments`);
    console.log(`   • ${batchEnrollments.length} Batch Enrollments`);
    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('🔐 Login Credentials:\n');
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│ ADMIN                                       │');
    console.log('│   Email: admin@lms.com                      │');
    console.log('│   Password: admin123                        │');
    console.log('├─────────────────────────────────────────────┤');
    console.log('│ TEACHERS                                    │');
    console.log('│   nimal@lms.com                             │');
    console.log('│   sanduni@lms.com                           │');
    console.log('│   kasun@lms.com                             │');
    console.log('│   chathurika@lms.com                        │');
    console.log('│   dilshan@lms.com                           │');
    console.log('│   Password: teacher123 (all)                │');
    console.log('├─────────────────────────────────────────────┤');
    console.log('│ STUDENTS                                    │');
    console.log('│   saman@lms.com (Batch 2024)                │');
    console.log('│   nimali@lms.com (Batch 2024)               │');
    console.log('│   tharindu@lms.com (Batch 2024)             │');
    console.log('│   sachini@lms.com (Batch 2025)              │');
    console.log('│   kavinda@lms.com (Batch 2025)              │');
    console.log('│   dilini@lms.com (Batch 2025)               │');
    console.log('│   yasitha@lms.com (Batch 2026)              │');
    console.log('│   hansani@lms.com (Batch 2026)              │');
    console.log('│   dinuka@lms.com (Batch 2026)               │');
    console.log('│   ishara@lms.com (Batch 2026)               │');
    console.log('│   Password: student123 (all)                │');
    console.log('└─────────────────────────────────────────────┘\n');
    console.log('✨ You can now login at http://localhost:3000/auth/login\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the seeding function
seedFullDatabase();