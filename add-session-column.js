/**
 * Migration Script: Add active_session_id column to users table
 * Run this once to add the new column for single-session feature
 */

import sequelize from './config/database.js';

async function addSessionColumn() {
  try {
    console.log('🔄 Adding active_session_id column to users table...');
    
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'active_session_id'
    `);
    
    if (results.length > 0) {
      console.log('ℹ️  Column active_session_id already exists. Skipping...');
      process.exit(0);
    }
    
    // Add the column
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN active_session_id VARCHAR(255) NULL 
      COMMENT 'Current active session ID - only one session allowed per user'
      AFTER batch_id
    `);
    
    console.log('✅ Column active_session_id added successfully');
    
    // Add index for performance
    await sequelize.query(`
      CREATE INDEX idx_active_session_id ON users(active_session_id)
    `);
    
    console.log('✅ Index created successfully');
    console.log('\n🎉 Migration completed! You can now restart your server.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addSessionColumn();
