-- Add is_dismissed column to subscription_settings
ALTER TABLE subscription_settings ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT FALSE;

-- Show table structure
\d subscription_settings
