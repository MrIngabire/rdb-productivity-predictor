# RDB AI-Based Business Productivity Prediction System

Full-stack implementation of the Rwanda Development Board case study (Murhula Bunani Adrian, BBICTR/2024/33643).

**Stack:** Django 5 + Django REST Framework + Scikit-Learn (Random Forest) + PostgreSQL (SQLite fallback) · React 18 + Vite 6 + Tailwind CSS v4.

## Run it

```bash
# 1. Backend (terminal 1)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # optional; with no POSTGRES_DB set it uses SQLite
python manage.py makemigrations accounts productivity
python manage.py migrate
python manage.py seed_demo      # users, 120+ profiles, trains the model
python manage.py runserver      # http://127.0.0.1:8000

# 2. Frontend (terminal 2)
cd frontend
npm install
npm run dev                     # http://localhost:5173  (proxies /api to Django)
```

Optional PostgreSQL: `docker compose up -d`, then set the `POSTGRES_*` values in `backend/.env`
(the example file already matches `docker-compose.yml`) before running `migrate`.

Run the backend tests: `python manage.py test`

## Demo logins (password `password123`)

| Email | Role | Can do |
|---|---|---|
| admin@rdb.rw | System Administrator | Everything, plus ML parameters, retraining and user accounts |
| supervisor@rdb.rw | Supervisor | Enter task data, run forecasts, escalate at-risk profiles |
| manager@rdb.rw | Senior Operational Manager | Receive alerts, assign tickets, log interventions and support plans |

## Objectives and use cases → where they live

| Book requirement | Implementation |
|---|---|
| Obj. i: web dashboard for managers/admins | `frontend/src/pages/*` (Login, Dashboard, Profiles, Queue), styled to match the prototype |
| Obj. ii: backend for real-time processing, secure storage, API | `backend/productivity/views.py`, token auth, role permissions, PostgreSQL |
| Obj. iii: ML model classifying future performance from completion rate and hours | `productivity/ml_engine.py` (RandomForestRegressor, per-tree confidence) |
| Obj. iv: automated alerts escalated to senior managers | `services.run_prediction` auto-escalates scores below the pass threshold and creates ticket `#ALT-8xx` |
| Admin use case: provision users, configure ML engine, maintain DB, oversee security | Administration page, `/api/users/`, `/api/settings/`, `/api/settings/retrain/`, Django admin at `/admin/` |
| Supervisor use case: input data, trigger prediction, review probability and confidence, escalate | Operational Profiles page, `POST /api/predict/`, `POST /api/alerts/{id}/escalate/` |
| Senior manager use case: receive alerts, review forecasts, create interventions and support plans | Intervention Queue and ticket workspace (assign, status, notes) |
| Activity diagram: score < threshold → alert → queue; otherwise stable dashboard | `services.classify` / `run_prediction` |
| ERD: Employee, Operational Record, Prediction Alert | `productivity/models.py` (plus `InterventionNote`, `EngineSettings`) |
| Risk mitigation: anonymised ML input | The model receives only the two numeric features, never names or IDs |

## API summary

`POST /api/auth/login/` · `GET /api/auth/me/` · `GET|POST /api/employees/` · `GET /api/employees/{id}/` ·
`POST /api/predict/` · `GET /api/alerts/` · `GET /api/alerts/{id}/` · `POST /api/alerts/{id}/escalate|assign|status|notes/` ·
`GET /api/dashboard/` · `GET|PUT /api/settings/` · `POST /api/settings/retrain/` · `GET|POST|PATCH /api/users/`

## Notes

- The model is trained on a synthetic baseline dataset (`ml_engine.synthetic_dataset`) because no real RDB logs exist yet.
  Swap in historical data there, then retrain from the Administration page.
- Risk bands: below the pass threshold (default 50) is **High** and auto-escalates; up to 65 is **Moderate**
  (supervisors can escalate manually); above that is **Low**. Both are configurable by an administrator.
- Added beyond the prototype so the use cases are reachable: a profile selector and "New Profile" button, a working-hours field
  (the model needs it), a ticket workspace behind "Assign", and an Administration page for admins.
