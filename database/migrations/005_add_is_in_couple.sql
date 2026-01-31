-- Migration: Add is_in_couple field to users table
-- Date: 2026-01-28
-- Description: Adds a boolean field to track if user is in a couple
-- Users who are not in a couple should not see harmonization features

-- Add is_in_couple column (default true for existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_in_couple BOOLEAN DEFAULT TRUE;

-- Create index for quick filtering
CREATE INDEX IF NOT EXISTS idx_users_is_in_couple ON users(is_in_couple);

-- Comment for documentation
COMMENT ON COLUMN users.is_in_couple IS 'Indicates if user is in a couple. If false, harmonization and shared expense features are hidden';
