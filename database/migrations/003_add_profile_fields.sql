-- Migration: Add profile fields to users table
-- Date: 2026-01-28
-- Description: Adds profile picture, birth date, profession and bio for user statistics

-- Add profile picture URL column
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);

-- Add birth date for age statistics
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Add profession for user statistics
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(100);

-- Add bio/description
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add last_name if not exists (was missing in initial schema)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Create index on profession for statistics queries
CREATE INDEX IF NOT EXISTS idx_users_profession ON users(profession);
