-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT FALSE,
    recovery_codes TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Couples table
CREATE TABLE couples (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id),
    user2_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    couple_id INTEGER REFERENCES couples(id),
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    label TEXT NOT NULL,
    category VARCHAR(50),
    type VARCHAR(20), -- 'commune', 'individuelle', 'abonnement'
    ratio DECIMAL(3,2) DEFAULT 0.50, -- Pour dépenses partielles
    csv_checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IA Classifications table
CREATE TABLE ai_classifications (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    original_classification VARCHAR(50),
    corrected_classification VARCHAR(50),
    confidence DECIMAL(3,2),
    user_corrected BOOLEAN DEFAULT FALSE,
    learn_from_correction BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Harmonizations table
CREATE TABLE harmonizations (
    id SERIAL PRIMARY KEY,
    couple_id INTEGER REFERENCES couples(id),
    amount DECIMAL(10,2) NOT NULL,
    debtor_id INTEGER REFERENCES users(id),
    creditor_id INTEGER REFERENCES users(id),
    harmonized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs table
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    component VARCHAR(50),
    message TEXT,
    context JSONB,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_transactions_couple_date ON transactions(couple_id, date);
CREATE INDEX idx_logs_created_at ON logs(created_at);
CREATE INDEX idx_logs_level ON logs(level);
