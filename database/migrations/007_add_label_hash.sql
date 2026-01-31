-- Migration: Add label_hash column for encrypted label matching
-- This allows SQL GROUP BY on labels while keeping them encrypted

-- Add label_hash column to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS label_hash VARCHAR(64);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_label_hash ON transactions(label_hash);

-- Note: After running this migration, you need to run the Node.js migration script
-- to populate the label_hash values and encrypt existing labels.
