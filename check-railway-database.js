import { Sequelize } from 'sequelize';
import 'dotenv/config';

async function checkConnection() {
  console.log('🔍 Checking Railway Database Connection...');

  const databaseUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: MYSQL_URL or DATABASE_URL environment variable is not set.');
    console.log('ℹ️  If running locally, ensure .env file is populated.');
    console.log('ℹ️  If running on Railway, check the Service Variables.');
    process.exit(1);
  }

  // Mask password for logging
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`📡 Connecting to: ${maskedUrl}`);

  try {
    const sequelize = new Sequelize(databaseUrl, {
      dialect: 'mysql',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    await sequelize.authenticate();
    console.log('✅ Connection has been established successfully.');
    
    // Check if we can run a simple query
    const [results] = await sequelize.query('SELECT 1 + 1 AS result');
    console.log('✅ Test query executed successfully. Result:', results[0].result);

    console.log('🎉 Database connection is healthy!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    if (error.original) {
        console.error('   Original Error:', error.original.code);
    }
    process.exit(1);
  }
}

checkConnection();
