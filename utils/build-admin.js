import { adminJs } from '../config/admin.js';

console.log('🔄 Building AdminJS assets...');
try {
  await adminJs.initialize();
  console.log('✅ AdminJS assets built successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ AdminJS build failed:', error);
  process.exit(1);
}
