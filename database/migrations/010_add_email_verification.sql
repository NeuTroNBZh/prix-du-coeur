-- Migration: Add email verification and email 2FA support
-- Date: 2026-01-31

-- Add email verification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;

-- Add 2FA method column (none, totp, email)
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_method VARCHAR(20) DEFAULT 'none';

-- Add email 2FA code columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_2fa_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_2fa_expires TIMESTAMP;

-- Update existing users: those with totp_enabled = true get two_fa_method = 'totp'
UPDATE users SET two_fa_method = 'totp' WHERE totp_enabled = true;

-- Mark existing users as verified (they already registered before this feature)
UPDATE users SET email_verified = true WHERE email_verified IS NULL OR email_verified = false;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
