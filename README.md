# Profiles API — Stage 1 Backend

A REST API that accepts a name, calls three external APIs (Genderize, Agify, Nationalize), classifies the result, stores it in PostgreSQL, and exposes full CRUD endpoints.

---

## Live API

> **Base URL:** `https://YOUR-DEPLOYED-URL.up.railway.app`

---

## Endpoints

| Method   | Path                  | Description              |
|----------|-----------------------|--------------------------|
| `POST`   | `/api/profiles`       | Create a profile by name |
| `GET`    | `/api/profiles`       | Get all profiles         |
| `GET`    | `/api/profiles/:id`   | Get one profile by ID    |
| `DELETE` | `/api/profiles/:id`   | Delete a profile         |

### Filtering (GET /api/profiles)
```
/api/profiles?gender=male
/api/profiles?country_id=NG
/api/profiles?age_group=adult
/api/profiles?gender=male&country_id=NG&age_group=adult
```
Filter values are **case-insensitive**.

---

## How to Run Locally

### Prerequisites
- Node.js >= 18
- A PostgreSQL database (local or cloud)

### Steps

```bash
git clone https://github.com/YOUR_USERNAME/profiles-api.git
cd profiles-api
npm install
cp .env.example .env
# Edit .env and set your DATABASE_URL
npm start
```

Server runs on `http://localhost:3000`

### Test it
```bash
# Create a profile
curl -X POST http://localhost:3000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "james"}'

# Get all profiles
curl http://localhost:3000/api/profiles

# Get one profile
curl http://localhost:3000/api/profiles/<id>

# Delete a profile
curl -X DELETE http://localhost:3000/api/profiles/<id>
```

---

## Classification Logic

| Field       | Source       | Logic                                              |
|-------------|--------------|----------------------------------------------------|
| gender      | Genderize    | Direct field                                       |
| age_group   | Agify        | 0–12 child, 13–19 teenager, 20–59 adult, 60+ senior |
| country_id  | Nationalize  | Country with highest probability                   |

---

## Error Responses

All errors use:
```json
{ "status": "error", "message": "<message>" }
```

| Status | Meaning                        |
|--------|--------------------------------|
| 400    | Missing or empty name          |
| 422    | Name is not a string           |
| 404    | Profile not found              |
| 502    | External API returned bad data |
| 500    | Internal server error          |

---

## Decisions Made

- **PostgreSQL** — persistent, production-ready, free on Railway
- **UUID v7** — time-ordered UUIDs for all profile IDs
- **Idempotency** — duplicate name returns existing record, no new DB row
- **Parallel API calls** — all three external APIs called with `Promise.all` for speed
- **Case-insensitive storage** — names stored lowercase to prevent case duplicates
- **Case-insensitive filtering** — query params lowercased before comparison

## Trade-offs

- No pagination on GET /api/profiles — out of scope for this stage
- No update (PATCH) endpoint — not required by spec
