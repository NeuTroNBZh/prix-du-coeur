// Check and add account_label column
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  try {
    // Check if column exists
    const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'accounts' AND column_name = 'account_label'
    `);
    
    if (check.rows.length === 0) {
      console.log('Adding account_label column...');
      await pool.query('ALTER TABLE accounts ADD COLUMN account_label VARCHAR(200)');
      console.log('Column added successfully!');
    } else {
      console.log('Column account_label already exists');
    }
    
    // Show all columns
    const cols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'accounts'
    `);
    console.log('Accounts table columns:', cols.rows.map(r => r.column_name));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
