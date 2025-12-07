-- Migration: Add session tracking to users table
-- Purpose: Prevent multiple simultaneous logins from different devices
-- Date: 2025-12-07

-- Add active_session_id column to users table
ALTER TABLE users 
ADD COLUMN active_session_id VARCHAR(255) NULL 
COMMENT 'Current active session ID - only one session allowed per user'
AFTER batch_id;

-- Create index for faster session lookups
CREATE INDEX idx_active_session_id ON users(active_session_id);
