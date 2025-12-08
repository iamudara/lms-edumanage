/**
 * One-time seed script for Railway deployment
 * This creates a marker file to prevent re-running
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const markerFile = path.join(__dirname, '.seed-completed');

// Check if already seeded
if (fs.existsSync(markerFile)) {
  console.log('✓ Full seed already completed, skipping...');
  process.exit(0);
}

// Import and run the seed
import('./utils/seed-full.js').then(() => {
  // Create marker file
  fs.writeFileSync(markerFile, new Date().toISOString());
  console.log('✓ Marker file created - seed will not run again');
  process.exit(0);
}).catch(error => {
  console.error('Seed failed:', error);
  process.exit(1);
});
