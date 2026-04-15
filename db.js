const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      gender     TEXT,
      gender_probability  NUMERIC,
      sample_size         INTEGER,
      age                 INTEGER,
      age_group           TEXT,
      country_id          TEXT,
      country_probability NUMERIC,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('Database ready');
}

initDB().catch(err => {
  console.error('DB init failed:', err.message);
});

module.exports = pool;
