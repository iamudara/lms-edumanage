/**
 * One-time seed script for Railway deployment
 * Checks if full seed data exists before running
 */

import { spawn } from 'child_process';
import { sequelize, User } from './models/index.js';

console.log('='.repeat(60));
console.log('🔍 SEED-ONCE: Starting database check...');
console.log('='.repeat(60));

try {
  console.log('📡 Connecting to database...');
  await sequelize.authenticate();
  console.log('✅ Database connection successful');
  
  // Check if we have more than 3 users (which means full seed already ran)
  console.log('🔢 Counting users in database...');
  const userCount = await User.count();
  console.log(`📊 Current user count: ${userCount}`);
  
  if (userCount > 3) {
    console.log(`✓ Found ${userCount} users - full seed already completed, skipping...`);
    console.log('='.repeat(60));
    await sequelize.close();
    process.exit(0);
  }

  console.log(`⚠️  Found only ${userCount} users - need to run full seed!`);
  console.log('🌱 Starting full seed process...');
  console.log('='.repeat(60));
  
  await sequelize.close();
  console.log('✅ Database connection closed before running seed');

  // Run the seed script
  console.log('🚀 Spawning seed-full.js process...');
  const seedProcess = spawn('node', ['utils/seed-full.js'], {
    stdio: 'inherit'
  });

  seedProcess.on('error', (error) => {
    console.error('❌ Failed to spawn seed process:', error);
    process.exit(1);
  });

  seedProcess.on('close', (code) => {
    console.log('='.repeat(60));
    if (code === 0) {
      console.log('✅ SEED-ONCE: Full seed completed successfully!');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.error(`❌ SEED-ONCE: Seed failed with exit code: ${code}`);
      console.log('='.repeat(60));
      process.exit(1);
    }
  });

} catch (error) {
  console.log('='.repeat(60));
  console.error('❌ SEED-ONCE ERROR:', error.message);
  console.error('Stack trace:', error.stack);
  console.log('='.repeat(60));
  process.exit(1);
}
