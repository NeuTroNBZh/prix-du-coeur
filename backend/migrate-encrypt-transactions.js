/**
 * Migration: Chiffrer les labels des transactions existantes
 * 
 * Ce script chiffre toutes les transactions qui n'ont pas encore été chiffrées.
 * Il détecte automatiquement les transactions déjà chiffrées pour éviter le double chiffrement.
 * Il génère aussi les hash des labels pour permettre les regroupements SQL.
 * 
 * Usage: node migrate-encrypt-transactions.js
 */

require('dotenv').config();
const pool = require('./src/config/database');
const { encrypt, isEncrypted, hashLabel } = require('./src/services/encryptionService');

async function migrateEncryptTransactions() {
  console.log('🔐 Starting transaction encryption migration...');
  console.log('');
  
  const client = await pool.connect();
  
  try {
    // Count total transactions
    const countResult = await client.query('SELECT COUNT(*) as total FROM transactions');
    const total = parseInt(countResult.rows[0].total);
    console.log(`📊 Total transactions in database: ${total}`);
    
    // Get all transactions
    const result = await client.query(
      'SELECT id, label FROM transactions ORDER BY id'
    );
    
    let encrypted = 0;
    let alreadyEncrypted = 0;
    let errors = 0;
    
    console.log('');
    console.log('🔄 Processing transactions...');
    
    await client.query('BEGIN');
    
    for (const row of result.rows) {
      try {
        // Skip null/empty labels
        if (!row.label) {
          continue;
        }
        
        // Check if already encrypted
        const needsEncryption = !isEncrypted(row.label);
        
        if (needsEncryption) {
          // Encrypt the label and generate hash
          const encryptedLabel = encrypt(row.label);
          const labelHash = hashLabel(row.label);
          
          // Update the transaction with encrypted label and hash
          await client.query(
            'UPDATE transactions SET label = $1, label_hash = $2 WHERE id = $3',
            [encryptedLabel, labelHash, row.id]
          );
          
          encrypted++;
        } else {
          // Already encrypted, but might need hash
          // We can't generate hash from encrypted label, skip this one
          alreadyEncrypted++;
        }
        
        // Progress indicator every 100 transactions
        if ((encrypted + alreadyEncrypted) % 100 === 0) {
          console.log(`   Processed ${encrypted + alreadyEncrypted}/${total}...`);
        }
      } catch (error) {
        console.error(`   ❌ Error encrypting transaction ${row.id}:`, error.message);
        errors++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('');
    console.log('✅ Migration completed!');
    console.log('');
    console.log('📈 Summary:');
    console.log(`   - Newly encrypted: ${encrypted}`);
    console.log(`   - Already encrypted: ${alreadyEncrypted}`);
    console.log(`   - Errors: ${errors}`);
    console.log(`   - Total processed: ${total}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('   All changes have been rolled back.');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateEncryptTransactions()
  .then(() => {
    console.log('');
    console.log('🎉 Migration script finished successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
