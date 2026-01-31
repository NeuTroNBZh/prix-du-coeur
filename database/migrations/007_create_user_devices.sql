-- Migration: Création de la table user_devices pour les notifications push
-- Date: 2026-01-29

CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    platform VARCHAR(20) DEFAULT 'unknown', -- 'ios', 'android', 'web'
    device_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

-- Index pour recherche par token (unicité)
CREATE INDEX IF NOT EXISTS idx_user_devices_push_token ON user_devices(push_token);

-- Contrainte d'unicité sur user_id + device_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_unique 
ON user_devices(user_id, device_id);

-- Commentaires
COMMENT ON TABLE user_devices IS 'Appareils mobiles des utilisateurs pour les notifications push';
COMMENT ON COLUMN user_devices.push_token IS 'Token FCM (Android) ou APNS (iOS)';
COMMENT ON COLUMN user_devices.platform IS 'Plateforme: ios, android, web';
COMMENT ON COLUMN user_devices.device_id IS 'Identifiant unique de l appareil';
