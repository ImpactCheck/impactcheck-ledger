# ImpactCheck v2 Backend (Phase 1)

Deterministic FastAPI + SQLite backend for the ImpactCheck v2 frontend contract.

## Tech

- Python 3.11
- FastAPI
- SQLite
- Asyncio background jobs

## Structure

```text
app/
  main.py
  settings.py
  db.py
  models.py
  storage/
  jobs/
  routes/
```

## Setup

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Run

```bash
uvicorn app.main:app --reload
```

## Frontend Proxy Note

Your Vite frontend can call `/api/*` directly if proxy is configured to the backend (typically `http://localhost:8000`).

Example `vite.config.ts` snippet:

```ts
server: {
  proxy: {
    "/api": "http://localhost:8000",
  },
}
```

## Implemented Endpoints

- `POST /api/projects`
- `GET /api/projects/{id}`
- `POST /api/projects/{id}/documents`
- `GET /api/projects/{id}/documents`
- `POST /api/projects/{id}/extract`
- `GET /api/jobs/{jobId}`
- `GET /api/projects/{id}/activities`
- `PUT /api/projects/{id}/activities`
- `POST /api/projects/{id}/export-csv`
- `POST /api/projects/{id}/map-emissions`
- `GET /api/projects/{id}/estimates`
- `GET /api/projects/{id}/report`
- `POST /api/projects/{id}/recommendations`
- `POST /api/projects/{id}/strategy/finalize`
- `POST /api/projects/{id}/deploy/crusoe`
- `GET /api/projects/{id}/deploy/status`

## Deterministic Stub Behavior

- Upload writes file to `data/uploads/{projectId}/{docId}_{filename}`
- Extract job deterministically creates 30-80 `ExtractedActivity` rows from filenames + fixed templates
- Mapping job deterministically generates `ActivityEstimate` rows from `text + region`
- Report returns deterministic region totals, hotspots, baseline delta, and compliance status/reasons
- Recommendations returns 4-6 deterministic scenarios from current hotspots
- Deploy endpoints return deterministic mock status/log progression

## Acceptance Test Flow (curl)

### 1) Create project

```bash
PROJECT_JSON=$(curl -s -X POST http://localhost:8000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Abilene DC Expansion",
    "year": 2026,
    "companyType": "ai_infra",
    "primaryRegion": "texas_ercot",
    "comparisonRegions": ["norway_hydro"]
  }')

echo "$PROJECT_JSON"
PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.id')
```

### 2) Upload document

```bash
echo "hardware,bom" > /tmp/hardware_bom_2026.csv
curl -s -X POST "http://localhost:8000/api/projects/$PROJECT_ID/documents" \
  -F "file=@/tmp/hardware_bom_2026.csv"
```

### 3) Start extract + poll job

```bash
EXTRACT_JOB_JSON=$(curl -s -X POST "http://localhost:8000/api/projects/$PROJECT_ID/extract")
echo "$EXTRACT_JOB_JSON"
EXTRACT_JOB_ID=$(echo "$EXTRACT_JOB_JSON" | jq -r '.jobId')

while true; do
  JOB=$(curl -s "http://localhost:8000/api/jobs/$EXTRACT_JOB_ID")
  echo "$JOB"
  STATUS=$(echo "$JOB" | jq -r '.status')
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 0.3
done
```

### 4) List activities

```bash
curl -s "http://localhost:8000/api/projects/$PROJECT_ID/activities"
```

### 5) Start mapping + poll job

```bash
MAP_JOB_JSON=$(curl -s -X POST "http://localhost:8000/api/projects/$PROJECT_ID/map-emissions")
echo "$MAP_JOB_JSON"
MAP_JOB_ID=$(echo "$MAP_JOB_JSON" | jq -r '.jobId')

while true; do
  JOB=$(curl -s "http://localhost:8000/api/jobs/$MAP_JOB_ID")
  echo "$JOB"
  STATUS=$(echo "$JOB" | jq -r '.status')
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 0.3
done
```

### 6) Get report

```bash
curl -s "http://localhost:8000/api/projects/$PROJECT_ID/report"
```
