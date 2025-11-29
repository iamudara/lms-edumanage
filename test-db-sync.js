require('dotenv').config();
const { syncDatabase } = require('./models');

console.log('Testing database sync...\n');

syncDatabase()
  .then(() => {
    console.log('\n✓ Database sync test completed successfully');
    console.log('✓ Expected tables: users, batches, courses, batch_enrollments, materials, assignments, submissions, grades, sessions (9 total)');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Database sync test failed:', error);
    process.exit(1);
  });
