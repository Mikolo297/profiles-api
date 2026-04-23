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
      country_name        TEXT,
      country_probability NUMERIC,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Indexes for query performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender     ON profiles (LOWER(gender));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age_group  ON profiles (LOWER(age_group));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_id ON profiles (UPPER(country_id));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age        ON profiles (age);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles (created_at);`);

  // Migration: add any columns that may be missing from older schema versions
  await pool.query(`
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS country_name TEXT,
      ADD COLUMN IF NOT EXISTS age_group TEXT,
      ADD COLUMN IF NOT EXISTS sample_size INTEGER,
      ADD COLUMN IF NOT EXISTS gender_probability NUMERIC,
      ADD COLUMN IF NOT EXISTS country_probability NUMERIC;
  `);

  console.log('Database ready');
}

initDB().catch(err => {
  console.error('DB init failed:', err.message);
});

module.exports = pool;