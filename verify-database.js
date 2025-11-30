/**
 * Database Verification Script
 * Checks all tables created by server.js sync
 */

import 'dotenv/config';
import sequelize from './config/database.js';

async function verifyDatabase() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection successful\n');

    // Get all tables
    const [tables] = await sequelize.query(`SHOW TABLES`);
    
    console.log('📋 Tables in database:');
    console.log('═'.repeat(50));
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });
    console.log('═'.repeat(50));
    console.log(`\n✅ Total tables: ${tables.length}`);
    console.log('✅ Expected: 9 tables (8 models + sessions)\n');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    process.exit(1);
  }
}

verifyDatabase();
