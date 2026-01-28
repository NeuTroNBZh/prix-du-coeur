-- Accounts table for multi-bank support
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(50) NOT NULL,
    account_type VARCHAR(50),
    account_number VARCHAR(100),
    account_label VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add account reference to transactions
ALTER TABLE transactions 
ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
