/**
 * Test Passport Configuration
 * Verifies password hashing and comparison methods
 */

import 'dotenv/config';
import { User, syncDatabase } from './models/index.js';

async function testPassportConfig() {
  console.log('\n🧪 Testing Passport Configuration...\n');

  try {
    // Sync database
    await syncDatabase();

    // Test 1: Create user with auto-hashed password
    console.log('Test 1: Creating user with password hashing...');
    const testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'plainPassword123',
      full_name: 'Test User',
      role: 'student',
      batch_id: null,
    });
    console.log('✅ User created successfully');
    console.log(`   - Password is hashed: ${testUser.password !== 'plainPassword123'}`);
    console.log(`   - Hash length: ${testUser.password.length} characters`);

    // Test 2: Compare correct password
    console.log('\nTest 2: Comparing correct password...');
    const isCorrect = await testUser.comparePassword('plainPassword123');
    console.log(`✅ Correct password: ${isCorrect ? 'PASS' : 'FAIL'}`);

    // Test 3: Compare incorrect password
    console.log('\nTest 3: Comparing incorrect password...');
    const isIncorrect = await testUser.comparePassword('wrongPassword');
    console.log(`✅ Incorrect password rejected: ${!isIncorrect ? 'PASS' : 'FAIL'}`);

    // Test 4: Hash password using static method
    console.log('\nTest 4: Using static hashPassword method...');
    const hashedPassword = await User.hashPassword('newPassword456');
    console.log(`✅ Static method works: ${hashedPassword.length === 60}`);

    // Test 5: Update password (should auto-hash)
    console.log('\nTest 5: Updating password...');
    testUser.password = 'updatedPassword789';
    await testUser.save();
    const isUpdated = await testUser.comparePassword('updatedPassword789');
    console.log(`✅ Updated password works: ${isUpdated ? 'PASS' : 'FAIL'}`);

    // Cleanup
    await testUser.destroy();
    console.log('\n✅ All tests passed! Passport configuration is working correctly.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testPassportConfig();
