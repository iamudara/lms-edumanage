import 'dotenv/config';
import sequelize from './config/database.js';
import { User } from './models/index.js';

async function checkRailwayDatabase() {
  try {
    console.log('\n🔍 Checking Railway Database Connection...\n');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful!\n');
    
    // Check if using MYSQL_URL (Railway) or local config
    const usingRailway = !!(process.env.MYSQL_URL || process.env.DATABASE_URL);
    console.log(`📍 Database Type: ${usingRailway ? 'RAILWAY (MYSQL_URL)' : 'LOCAL (.env)'}`);
    
    if (usingRailway) {
      const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
      const dbName = url.split('/').pop().split('?')[0];
      console.log(`📊 Database Name: ${dbName}\n`);
    } else {
      console.log(`📊 Database Name: ${process.env.DB_NAME}\n`);
    }
    
    // List all tables
    console.log('📋 Checking tables in database...\n');
    const [tables] = await sequelize.query("SHOW TABLES");
    
    if (tables.length === 0) {
      console.log('⚠️  NO TABLES FOUND! Database sync may not have run.\n');
      console.log('💡 Run this to create tables: npm run start\n');
      process.exit(1);
    }
    
    console.log(`✅ Found ${tables.length} tables:\n`);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    // Check Users table specifically
    console.log('\n👤 Checking Users table...\n');
    const userCount = await User.count();
    console.log(`   Total users: ${userCount}`);
    
    if (userCount === 0) {
      console.log('\n⚠️  NO USERS FOUND! Seed script may not have run.\n');
      console.log('💡 Run this to create default users: node utils/seed.js\n');
    } else {
      // Show all users (email and role only, no passwords)
      const users = await User.findAll({
        attributes: ['id', 'email', 'username', 'full_name', 'role'],
        order: [['role', 'ASC'], ['email', 'ASC']]
      });
      
      console.log('\n   📝 Users in database:\n');
      users.forEach(user => {
        console.log(`   ${user.role.toUpperCase().padEnd(8)} | ${user.email.padEnd(25)} | ${user.full_name}`);
      });
      
      console.log('\n✅ LOGIN CREDENTIALS:\n');
      console.log('   Email: admin@lms.com');
      console.log('   Password: admin123\n');
      console.log('   OR\n');
      console.log('   Email: teacher@lms.com');
      console.log('   Password: teacher123\n');
      console.log('   OR\n');
      console.log('   Email: student@lms.com');
      console.log('   Password: student123\n');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Troubleshooting:\n');
    console.error('   1. Make sure MYSQL_URL is set in Railway environment variables');
    console.error('   2. Check Railway logs: railway logs');
    console.error('   3. Verify database plugin is connected\n');
    process.exit(1);
  }
}

checkRailwayDatabase();
