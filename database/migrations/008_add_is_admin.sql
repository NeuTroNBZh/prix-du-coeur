-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Set louis.cercle35@gmail.com as admin
UPDATE users SET is_admin = TRUE WHERE email = 'louis.cercle35@gmail.com';

-- Create index for admin lookup
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
