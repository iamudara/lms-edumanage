/**
 * One-time seed script for Railway deployment
 * Checks if full seed data exists before running
 */

import { spawn } from 'child_process';
import { sequelize, User } from './models/index.js';

console.log('🔍 Checking if full seed is needed...\n');

try {
  // Check if we have more than 3 users (which means full seed already ran)
  const userCount = await User.count();
  
  if (userCount > 3) {
    console.log(`✓ Found ${userCount} users - full seed already completed, skipping...\n`);
    await sequelize.close();
    process.exit(0);
  }

  console.log(`📊 Found only ${userCount} users - running full seed...\n`);
  await sequelize.close();

  // Run the seed script
  const seedProcess = spawn('node', ['utils/seed-full.js'], {
    stdio: 'inherit'
  });

  seedProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Full seed completed successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Seed failed with code:', code);
      process.exit(1);
    }
  });

} catch (error) {
  console.error('❌ Error checking database:', error);
  process.exit(1);
}
