/**
 * Service de chiffrement transparent pour les données sensibles
 * Utilise AES-256-GCM pour un chiffrement authentifié
 */

const crypto = require('crypto');

// Algorithme de chiffrement
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits pour GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Obtient la clé de chiffrement depuis l'environnement
 * @returns {Buffer} Clé de 32 bytes pour AES-256
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY must be defined in environment variables');
  }
  
  // Si la clé fait déjà 32 caractères, l'utiliser directement
  // Sinon, la hasher pour obtenir exactement 32 bytes
  if (key.length === 32) {
    return Buffer.from(key, 'utf-8');
  }
  
  // Hash la clé pour obtenir exactement 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Chiffre une chaîne de caractères
 * @param {string} plaintext - Texte en clair à chiffrer
 * @returns {string} Texte chiffré en format: iv:authTag:encryptedData (base64)
 */
function encrypt(plaintext) {
  if (!plaintext || plaintext === null || plaintext === undefined) {
    return plaintext;
  }
  
  // Convertir en string si c'est un nombre
  const text = String(plaintext);
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData (tout en base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Déchiffre une chaîne de caractères
 * @param {string} encryptedText - Texte chiffré au format iv:authTag:encryptedData
 * @returns {string} Texte en clair
 */
function decrypt(encryptedText) {
  if (!encryptedText || encryptedText === null || encryptedText === undefined) {
    return encryptedText;
  }
  
  // Vérifier si c'est vraiment chiffré (format attendu)
  if (!encryptedText.includes(':')) {
    // Pas chiffré, retourner tel quel (pour migration progressive)
    return encryptedText;
  }
  
  try {
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      // Format invalide, probablement pas chiffré
      return encryptedText;
    }
    
    const [ivBase64, authTagBase64, encrypted] = parts;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // Si le déchiffrement échoue, c'est peut-être une donnée non chiffrée
    console.warn('Decryption failed, returning original:', error.message);
    return encryptedText;
  }
}

/**
 * Chiffre un montant (number -> string chiffré)
 * @param {number} amount - Montant à chiffrer
 * @returns {string} Montant chiffré
 */
function encryptAmount(amount) {
  if (amount === null || amount === undefined) {
    return amount;
  }
  return encrypt(amount.toString());
}

/**
 * Déchiffre un montant (string chiffré -> number)
 * @param {string} encryptedAmount - Montant chiffré
 * @returns {number} Montant en clair
 */
function decryptAmount(encryptedAmount) {
  if (encryptedAmount === null || encryptedAmount === undefined) {
    return encryptedAmount;
  }
  
  // Si c'est déjà un nombre, le retourner
  if (typeof encryptedAmount === 'number') {
    return encryptedAmount;
  }
  
  const decrypted = decrypt(encryptedAmount);
  return parseFloat(decrypted);
}

/**
 * Chiffre les champs sensibles d'une transaction
 * @param {object} transaction - Transaction avec données en clair
 * @returns {object} Transaction avec données chiffrées
 */
function encryptTransaction(transaction) {
  return {
    ...transaction,
    label: encrypt(transaction.label),
    // Le montant reste en clair pour les calculs SQL (agrégations, etc.)
    // Mais on peut chiffrer d'autres champs sensibles si besoin
  };
}

/**
 * Déchiffre les champs sensibles d'une transaction
 * @param {object} transaction - Transaction avec données chiffrées
 * @returns {object} Transaction avec données en clair
 */
function decryptTransaction(transaction) {
  if (!transaction) return transaction;
  
  return {
    ...transaction,
    label: decrypt(transaction.label),
  };
}

/**
 * Déchiffre un tableau de transactions
 * @param {array} transactions - Tableau de transactions chiffrées
 * @returns {array} Tableau de transactions déchiffrées
 */
function decryptTransactions(transactions) {
  if (!Array.isArray(transactions)) return transactions;
  return transactions.map(decryptTransaction);
}

/**
 * Vérifie si une valeur est chiffrée
 * @param {string} value - Valeur à vérifier
 * @returns {boolean} True si la valeur semble chiffrée
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

/**
 * Génère un hash déterministe d'un label pour permettre les GROUP BY SQL
 * Utilise un HMAC avec une clé dérivée pour éviter les rainbow tables
 * @param {string} label - Label en clair
 * @returns {string} Hash hex de 64 caractères
 */
function hashLabel(label) {
  if (!label) return null;
  
  // Normaliser le label pour un meilleur regroupement
  const normalizedLabel = String(label).toLowerCase().trim();
  
  const key = getEncryptionKey();
  return crypto.createHmac('sha256', key)
    .update(normalizedLabel)
    .digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  encryptAmount,
  decryptAmount,
  encryptTransaction,
  decryptTransaction,
  decryptTransactions,
  isEncrypted,
  hashLabel,
};
