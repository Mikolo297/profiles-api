#  Stage 2 Backend: Intelligence Query Engine

A queryable demographic intelligence REST API. Stores 2026 profiles collected from Genderize, Agify, and Nationalize APIs. Supports advanced filtering, sorting, pagination, and natural language search.

---

## Live API

> **Base URL:** `https://profiles-api-production-206d.up.railway.app/api/profiles`

---

## Endpoints

| Method   | Path                     | Description                        |
|----------|--------------------------|------------------------------------|
| `GET`    | `/api/profiles`          | List profiles with filters/sort/pagination |
| `GET`    | `/api/profiles/search`   | Natural language query             |
| `GET`    | `/api/profiles/:id`      | Get one profile                    |
| `POST`   | `/api/profiles`          | Create profile (calls 3 APIs)      |
| `DELETE` | `/api/profiles/:id`      | Delete profile                     |

---

## Filtering

```
GET /api/profiles?gender=male&country_id=NG&min_age=25&max_age=40
```

| Parameter               | Description                        |
|-------------------------|------------------------------------|
| `gender`                | male / female                      |
| `age_group`             | child / teenager / adult / senior  |
| `country_id`            | ISO 2-letter code (NG, US, etc.)   |
| `min_age`               | Minimum age (inclusive)            |
| `max_age`               | Maximum age (inclusive)            |
| `min_gender_probability`| Minimum gender confidence score    |
| `min_country_probability`| Minimum country confidence score  |

All filters are combinable. All string filters are case-insensitive.

---

## Sorting

```
GET /api/profiles?sort_by=age&order=desc
```

| Parameter | Values                                    |
|-----------|-------------------------------------------|
| `sort_by` | `age`, `created_at`, `gender_probability` |
| `order`   | `asc`, `desc`                             |

---

## Pagination

```
GET /api/profiles?page=2&limit=20
```

| Parameter | Default | Max |
|-----------|---------|-----|
| `page`    | 1       | —   |
| `limit`   | 10      | 50  |

Response format:
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [...]
}
```

---

## Natural Language Search

```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=adult females above 30
GET /api/profiles/search?q=teenagers from ghana
```

Supports pagination: `?q=...&page=1&limit=10`

**Supported patterns:**
- Gender: `males`, `females`, `male and female`
- Age group: `children`, `teenagers`, `adults`, `seniors`
- Age ranges: `above 30`, `under 25`, `between 20 and 40`, `young` (16–24)
- Country: `from nigeria`, `from kenya`, `ghanaian`, `nigerian` etc.

Returns `{ "status": "error", "message": "Unable to interpret query" }` if unparseable.

---

## How to Run Locally

```bash
git clone https://github.com/Mikolo297/profiles-api
cd profiles-api
npm install
cp .env.example .env
# Set your DATABASE_URL in .env
npm start
```

### Seed the database
1. Download the seed CSV from the task brief
2. Place it at `data/profiles.csv`
3. Run: `npm run seed`

---

## Decisions Made

- **Rule-based NLP only** — no LLMs or AI libraries. Pure regex and keyword matching
- **`young` = ages 16–24** as specified — not a stored age group
- **Indexes** on gender, age_group, country_id, age, created_at for query performance
- **`ON CONFLICT DO NOTHING`** in seed — re-running seed is safe, no duplicates
- **country_name** resolved from ISO code using a built-in lookup map
- **UUID v7** for all IDs — time-ordered for better DB performance
- **case-insensitive** filters throughout (LOWER/UPPER in SQL)

## Trade-offs

- Natural language parser covers common patterns; very unusual phrasing may return "Unable to interpret query"
- No full-text search — rule-based parsing is deterministic and fast
- `sample_size` stored but not exposed in list view to keep response lean
