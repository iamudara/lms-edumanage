/**
 * Fix Missing Timestamps
 * Updates users that don't have created_at/updated_at values
 */

import { User } from '../models/index.js';

const fixTimestamps = async () => {
  try {
    console.log('🔧 Fixing missing timestamps for users...');
    
    // Update users with null created_at
    const [affectedRows] = await User.update(
      {
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        where: {
          created_at: null
        }
      }
    );

    console.log(`✅ Updated ${affectedRows} users with missing timestamps`);
    
    // Verify
    const usersWithoutTimestamps = await User.count({
      where: {
        created_at: null
      }
    });
    
    console.log(`📊 Users without timestamps: ${usersWithoutTimestamps}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing timestamps:', error);
    process.exit(1);
  }
};

fixTimestamps();
