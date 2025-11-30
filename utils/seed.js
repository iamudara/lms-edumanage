/**
 * Database Seeding Script
 * Creates initial test users for development
 * Run with: node utils/seed.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { User, Batch, syncDatabase } from '../models/index.js';

/**
 * Seed initial users for testing
 * Creates admin, teacher, and student accounts
 */
async function seedUsers() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Ensure database is synced
    await syncDatabase();
    console.log('✓ Database synchronized\n');

    // Create a test batch first (required for student)
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
    console.log('');

    // Define test users
    const testUsers = [
      {
        username: 'admin',
        email: 'admin@lms.com',
        password: 'admin123',
        full_name: 'System Administrator',
        role: 'admin',
        batch_id: null, // Admins don't belong to batches
      },
      {
        username: 'teacher',
        email: 'teacher@lms.com',
        password: 'teacher123',
        full_name: 'John Doe',
        role: 'teacher',
        batch_id: null, // Teachers don't belong to batches
      },
      {
        username: 'student',
        email: 'student@lms.com',
        password: 'student123',
        full_name: 'Jane Smith',
        role: 'student',
        batch_id: batch.id, // Students must belong to a batch
      },
    ];

    console.log('👥 Creating test users...\n');

    // Create users
    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({
          where: { email: userData.email },
        });

        if (existingUser) {
          console.log(`ℹ User already exists: ${userData.email} (${userData.role})`);
          continue;
        }

        // Create new user (password will be auto-hashed by User model hooks)
        const user = await User.create(userData);

        console.log(`✓ Created ${userData.role}: ${userData.email} / ${userData.password}`);
      } catch (error) {
        console.error(`✗ Error creating ${userData.role}:`, error.message);
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
    console.log('├─────────────────────────────────────────────┤');
    console.log('│ Student:                                    │');
    console.log('│   Email: student@lms.com                    │');
    console.log('│   Password: student123                      │');
    console.log('│   Batch: Computer Science 2024              │');
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
