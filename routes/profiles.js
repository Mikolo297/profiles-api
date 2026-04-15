const express = require('express');
const router = express.Router();
const pool = require('../db');
const { uuidv7 } = require('../utils/uuid');
const { fetchAllAPIs, validateAndExtract } = require('../utils/apis');

// ── POST /api/profiles ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name } = req.body;

  // Validation
  if (name === undefined || name === null || name === '') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
  }
  if (typeof name !== 'string') {
    return res.status(422).json({ status: 'error', message: 'Name must be a string' });
  }

  const cleanName = name.trim().toLowerCase();

  try {
    // Check for existing profile (idempotency)
    const existing = await pool.query(
      'SELECT * FROM profiles WHERE name = $1',
      [cleanName]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: formatProfile(existing.rows[0]),
      });
    }

    // Fetch all three APIs in parallel
    let genderData, ageData, nationData;
    try {
      ({ genderData, ageData, nationData } = await fetchAllAPIs(cleanName));
    } catch (err) {
      return res.status(502).json({ status: 'error', message: 'Failed to reach external API' });
    }

    // Validate and extract
    const result = validateAndExtract({ genderData, ageData, nationData });
    if (result.error) {
      return res.status(result.error.status).json({
        status: 'error',
        message: result.error.message,
      });
    }

    const { profile } = result;
    const id = uuidv7();
    const created_at = new Date().toISOString();

    // Store in DB
    await pool.query(
      `INSERT INTO profiles
        (id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id, cleanName,
        profile.gender, profile.gender_probability, profile.sample_size,
        profile.age, profile.age_group,
        profile.country_id, profile.country_probability,
        created_at,
      ]
    );

    return res.status(201).json({
      status: 'success',
      data: {
        id, name: cleanName,
        gender: profile.gender,
        gender_probability: profile.gender_probability,
        sample_size: profile.sample_size,
        age: profile.age,
        age_group: profile.age_group,
        country_id: profile.country_id,
        country_probability: profile.country_probability,
        created_at,
      },
    });
  } catch (err) {
    console.error('POST /profiles error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/profiles ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { gender, country_id, age_group } = req.query;

  try {
    const conditions = [];
    const values = [];
    let i = 1;

    if (gender) {
      conditions.push(`LOWER(gender) = $${i++}`);
      values.push(gender.toLowerCase());
    }
    if (country_id) {
      conditions.push(`LOWER(country_id) = $${i++}`);
      values.push(country_id.toLowerCase());
    }
    if (age_group) {
      conditions.push(`LOWER(age_group) = $${i++}`);
      values.push(age_group.toLowerCase());
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM profiles ${where} ORDER BY created_at DESC`,
      values
    );

    return res.status(200).json({
      status: 'success',
      count: result.rows.length,
      data: result.rows.map(formatProfileList),
    });
  } catch (err) {
    console.error('GET /profiles error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/profiles/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.status(200).json({ status: 'success', data: formatProfile(result.rows[0]) });
  } catch (err) {
    console.error('GET /profiles/:id error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── DELETE /api/profiles/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM profiles WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.sendStatus(204);
  } catch (err) {
    console.error('DELETE /profiles/:id error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatProfile(row) {
  return {
    id:                  row.id,
    name:                row.name,
    gender:              row.gender,
    gender_probability:  parseFloat(row.gender_probability),
    sample_size:         parseInt(row.sample_size),
    age:                 parseInt(row.age),
    age_group:           row.age_group,
    country_id:          row.country_id,
    country_probability: parseFloat(row.country_probability),
    created_at:          new Date(row.created_at).toISOString(),
  };
}

function formatProfileList(row) {
  return {
    id:         row.id,
    name:       row.name,
    gender:     row.gender,
    age:        parseInt(row.age),
    age_group:  row.age_group,
    country_id: row.country_id,
  };
}

module.exports = router;
