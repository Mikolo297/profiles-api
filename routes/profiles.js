const express = require('express');
const router = express.Router();
const pool = require('../db');
const { uuidv7 } = require('../utils/uuid');
const { fetchAllAPIs, validateAndExtract } = require('../utils/apis');
const { parseNaturalLanguage } = require('../utils/nlp');

// ── VALID SORT FIELDS ─────────────────────────────────────────────────────────
const VALID_SORT_BY = ['age', 'created_at', 'gender_probability'];
const VALID_ORDER   = ['asc', 'desc'];

// ── HELPER: build filter query ────────────────────────────────────────────────
function buildFilterQuery(query) {
  const conditions = [];
  const values = [];
  let i = 1;

  const {
    gender, age_group, country_id,
    min_age, max_age,
    min_gender_probability, min_country_probability,
  } = query;

  if (gender) {
    conditions.push(`LOWER(gender) = $${i++}`);
    values.push(gender.toLowerCase());
  }
  if (age_group) {
    conditions.push(`LOWER(age_group) = $${i++}`);
    values.push(age_group.toLowerCase());
  }
  if (country_id) {
    conditions.push(`UPPER(country_id) = $${i++}`);
    values.push(country_id.toUpperCase());
  }
  if (min_age !== undefined && min_age !== '') {
    const val = parseInt(min_age);
    if (!isNaN(val)) { conditions.push(`age >= $${i++}`); values.push(val); }
  }
  if (max_age !== undefined && max_age !== '') {
    const val = parseInt(max_age);
    if (!isNaN(val)) { conditions.push(`age <= $${i++}`); values.push(val); }
  }
  if (min_gender_probability !== undefined && min_gender_probability !== '') {
    const val = parseFloat(min_gender_probability);
    if (!isNaN(val)) { conditions.push(`gender_probability >= $${i++}`); values.push(val); }
  }
  if (min_country_probability !== undefined && min_country_probability !== '') {
    const val = parseFloat(min_country_probability);
    if (!isNaN(val)) { conditions.push(`country_probability >= $${i++}`); values.push(val); }
  }

  return { conditions, values, nextIndex: i };
}

// ── GET /api/profiles/search ──────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const { q, page, limit } = req.query;

  if (!q || q.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty query' });
  }

  const parsed = parseNaturalLanguage(q);
  if (parsed.error) {
    return res.status(200).json({ status: 'error', message: parsed.error });
  }

  const { filters } = parsed;

  const { conditions, values, nextIndex } = buildFilterQuery(filters);
  let i = nextIndex;

  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset   = (pageNum - 1) * limitNum;

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM profiles ${where}`, values
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limitNum);
    values.push(offset);

    const dataResult = await pool.query(
      `SELECT * FROM profiles ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      values
    );

    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    console.error('GET /search error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/profiles ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { sort_by, order, page, limit, ...filterParams } = req.query;

  if (sort_by && !VALID_SORT_BY.includes(sort_by)) {
    return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
  }
  if (order && !VALID_ORDER.includes(order.toLowerCase())) {
    return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
  }

  const sortField = VALID_SORT_BY.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = order && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset   = (pageNum - 1) * limitNum;

  const { conditions, values, nextIndex } = buildFilterQuery(filterParams);
  let i = nextIndex;

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM profiles ${where}`, values
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limitNum);
    values.push(offset);

    const dataResult = await pool.query(
      `SELECT * FROM profiles ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${i++} OFFSET $${i++}`,
      values
    );

    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    console.error('GET /profiles error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/profiles/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    return res.status(200).json({ status: 'success', data: formatProfile(result.rows[0]) });
  } catch (err) {
    console.error('GET /profiles/:id error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── POST /api/profiles ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (name === undefined || name === null || name === '')
    return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
  if (typeof name !== 'string')
    return res.status(422).json({ status: 'error', message: 'Name must be a string' });

  const cleanName = name.trim().toLowerCase();

  try {
    const existing = await pool.query('SELECT * FROM profiles WHERE name = $1', [cleanName]);
    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: formatProfile(existing.rows[0]),
      });
    }

    let genderData, ageData, nationData;
    try {
      ({ genderData, ageData, nationData } = await fetchAllAPIs(cleanName));
    } catch {
      return res.status(502).json({ status: 'error', message: 'Failed to reach external API' });
    }

    const result = validateAndExtract({ genderData, ageData, nationData });
    if (result.error)
      return res.status(result.error.status).json({ status: 'error', message: result.error.message });

    const { profile } = result;
    const id = uuidv7();
    const created_at = new Date().toISOString();

    await pool.query(
      `INSERT INTO profiles
        (id, name, gender, gender_probability, sample_size, age, age_group,
         country_id, country_name, country_probability, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, cleanName, profile.gender, profile.gender_probability, profile.sample_size,
       profile.age, profile.age_group, profile.country_id, profile.country_name,
       profile.country_probability, created_at]
    );

    return res.status(201).json({
      status: 'success',
      data: { id, name: cleanName, ...profile, created_at },
    });
  } catch (err) {
    console.error('POST /profiles error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── DELETE /api/profiles/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM profiles WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    return res.sendStatus(204);
  } catch (err) {
    console.error('DELETE /profiles/:id error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── Format helper ─────────────────────────────────────────────────────────────
function formatProfile(row) {
  return {
    id:                  row.id,
    name:                row.name,
    gender:              row.gender,
    gender_probability:  parseFloat(row.gender_probability),
    sample_size:         row.sample_size ? parseInt(row.sample_size) : null,
    age:                 parseInt(row.age),
    age_group:           row.age_group,
    country_id:          row.country_id,
    country_name:        row.country_name,
    country_probability: parseFloat(row.country_probability),
    created_at:          new Date(row.created_at).toISOString(),
  };
}

module.exports = router;
