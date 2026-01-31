require('dotenv').config();
const pool = require('./src/config/database');
const { decrypt } = require('./src/services/encryptionService');

async function showEncryptedData() {
  try {
    // Données brutes en base (chiffrées)
    const result = await pool.query(
      `SELECT id, date, amount, label as label_chiffre, label_hash, category 
       FROM transactions 
       WHERE user_id = 12 
       ORDER BY date DESC 
       LIMIT 6`
    );
    
    console.log('\n🔐 === DONNÉES BRUTES EN BASE DE DONNÉES (CHIFFRÉES) ===\n');
    
    result.rows.forEach((row, i) => {
      console.log(`--- Transaction #${i + 1} (ID: ${row.id}) ---`);
      console.log(`Date: ${row.date}`);
      console.log(`Montant: ${row.amount}€`);
      console.log(`Catégorie: ${row.category}`);
      console.log(`Label CHIFFRÉ: ${row.label_chiffre.substring(0, 70)}...`);
      console.log(`Hash: ${row.label_hash ? row.label_hash.substring(0, 20) + '...' : 'N/A'}`);
      console.log(`Label DÉCHIFFRÉ: ${decrypt(row.label_chiffre)}`);
      console.log('');
    });
    
    await pool.end();
  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }
}

showEncryptedData();
