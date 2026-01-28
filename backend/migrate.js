require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function migrate() {
  console.log("Running migrations...");
  
  try {
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id)");
    console.log("Column account_id added to transactions");

    await pool.query("UPDATE transactions t SET account_id = (SELECT a.id FROM accounts a WHERE a.user_id = t.user_id LIMIT 1) WHERE t.account_id IS NULL");
    console.log("Transactions linked to accounts");

    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position");
    console.log("Transactions columns:", cols.rows.map(r => r.column_name).join(", "));

  } catch(e) {
    console.error("Migration error:", e.message);
  } finally {
    await pool.end();
    console.log("Migration complete");
  }
}

migrate();
