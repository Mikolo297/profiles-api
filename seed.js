require('dotenv').config();
const { Pool } = require('pg');
const { uuidv7 } = require('./utils/uuid');
const { getCountryName } = require('./utils/apis');
const fs = require('fs');
const path = require('path');

// Own pool — does NOT import db.js to avoid race condition with initDB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i]; });
    return obj;
  });
}

function classifyAgeGroup(age) {
  if (age <= 12)  return 'child';
  if (age <= 19)  return 'teenager';
  if (age <= 59)  return 'adult';
  return 'senior';
}

async function ensureTable() {
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
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name TEXT;`);
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_group TEXT;`);
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sample_size INTEGER;`);
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender_probability NUMERIC;`);
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_probability NUMERIC;`);
}

async function seed() {
  await ensureTable();

  const csvPath = path.join(__dirname, 'data', 'profiles.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('Seed file not found at data/profiles.csv');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);

  console.log(`Seeding ${rows.length} profiles...`);

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = (row.name || '').trim();
    if (!name) continue;

    const age = parseInt(row.age) || null;
    const countryId = (row.country_id || '').trim().toUpperCase();
    const countryName = (row.country_name || '').trim() || getCountryName(countryId);

    try {
      const result = await pool.query(
        `INSERT INTO profiles
          (id, name, gender, gender_probability, sample_size, age, age_group,
           country_id, country_name, country_probability, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (name) DO NOTHING`,
        [
          uuidv7(),
          name,
          (row.gender || '').trim(),
          parseFloat(row.gender_probability) || null,
          parseInt(row.sample_size) || null,
          age,
          age ? classifyAgeGroup(age) : (row.age_group || '').trim(),
          countryId,
          countryName,
          parseFloat(row.country_probability) || null,
          row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        ]
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`Error inserting ${name}:`, err.message);
    }
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});