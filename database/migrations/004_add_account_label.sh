#!/bin/bash
# Add account_label column if it doesn't exist

sudo -u postgres psql -d prix_du_coeur << 'SQLEOF'
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_label VARCHAR(200);
SQLEOF

echo "Migration completed"
