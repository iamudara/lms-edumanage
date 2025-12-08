import 'dotenv/config';
import { User } from './models/index.js';
import bcrypt from 'bcrypt';

async function testLogin() {
  try {
    console.log('\n🔐 Testing Login Credentials...\n');
    
    // Find admin user
    const admin = await User.findOne({
      where: { email: 'admin@lms.com' }
    });
    
    if (!admin) {
      console.log('❌ Admin user NOT found in database!');
      process.exit(1);
    }
    
    console.log('✅ Admin user found:');
    console.log('   Email:', admin.email);
    console.log('   Username:', admin.username);
    console.log('   Role:', admin.role);
    console.log('   Password hash:', admin.password.substring(0, 20) + '...');
    
    // Test password comparison
    const testPassword = 'admin123';
    const isMatch = await bcrypt.compare(testPassword, admin.password);
    
    console.log('\n🔑 Testing password "admin123":');
    console.log('   Result:', isMatch ? '✅ MATCH' : '❌ NO MATCH');
    
    if (!isMatch) {
      console.log('\n❌ Password does NOT match!');
      console.log('   This means the seed script may have used a different password');
      console.log('   or bcrypt hashing is not working correctly.');
    }
    
    // Try with username too
    const userByUsername = await User.findOne({
      where: { username: admin.username }
    });
    
    console.log('\n📧 Can login with:');
    console.log('   Email: admin@lms.com');
    console.log('   Username:', admin.username);
    console.log('   Password: admin123');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testLogin();
