/**
 * One-time seed script for Railway deployment
 * This creates a marker file to prevent re-running
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const markerFile = path.join(__dirname, '.seed-completed');

// Check if already seeded
if (fs.existsSync(markerFile)) {
  console.log('✓ Full seed already completed, skipping...');
  process.exit(0);
}

console.log('🌱 Running full database seed for the first time...\n');

// Run the seed script
const seedProcess = spawn('node', ['utils/seed-full.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

seedProcess.on('close', (code) => {
  if (code === 0) {
    // Create marker file
    fs.writeFileSync(markerFile, new Date().toISOString());
    console.log('\n✓ Marker file created - seed will not run again');
    process.exit(0);
  } else {
    console.error('\n❌ Seed failed with code:', code);
    process.exit(1);
  }
});
