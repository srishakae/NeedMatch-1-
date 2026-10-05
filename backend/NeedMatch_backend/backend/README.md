# NeedMatch API (backend)

A small Python [FastAPI](https://fastapi.tiangolo.com/) service that will become the
backend for the NeedMatch reverse marketplace. Right now it only has a health check.
The React frontend in the repository root is untouched.

## Install

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
```

## Run

```bash
uvicorn app.main:app --reload
```

The server runs at http://127.0.0.1:8000. Interactive docs: http://127.0.0.1:8000/docs

## Health endpoint

`GET /api/health`

```json
{ "status": "ok", "service": "NeedMatch API" }
```

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated | `http://localhost:8443` |
| `ENVIRONMENT` | `development` / `production` | `development` |
| `DATABASE_URL` | Supabase PostgreSQL connection string | _(unset)_ |

When the frontend is deployed on Vercel, set `FRONTEND_URL` on Render to the Vercel
domain (e.g. `https://your-app.vercel.app`). Never commit a real `.env`.

## How the frontend will talk to it

The React app will call this API over HTTP (`fetch`) using a base URL such as
`http://localhost:8000` in development and the Render URL in production.

## Database (Supabase PostgreSQL + SQLAlchemy + Alembic)

NeedMatch uses **Supabase as its PostgreSQL database**. Do not create a separate
database on Render. The API still starts without `DATABASE_URL` (e.g. `/api/health`
works); only database commands need it.

- `app/db/base.py` - SQLAlchemy base class
- `app/db/session.py` - engine and session (created lazily)
- `app/db/models/` - one file per table: `profiles`, `requirements`, `offers`,
  `shortlists`, `negotiation_messages`, `provider_listings`
- `alembic/versions/` - migrations

Ranking scores and trust scores are **not stored**; they will be calculated later
in the service layer.

### 1. Configure `DATABASE_URL`

1. Create a project at https://supabase.com.
2. In the dashboard click **Connect** and copy the **Session pooler** connection
   string (or **Direct connection** if your network supports IPv6).
3. Put it in your local `backend/.env` (this file is git-ignored) and replace the
   password placeholder:

   ```
   DATABASE_URL=postgresql://postgres.<project-ref>:<your-password>@<region>.pooler.supabase.com:5432/postgres
   ```

The `postgresql://` prefix is converted automatically for SQLAlchemy. Use a
**port 5432** (session / direct) connection when running Alembic. Never commit the
real URL, and never put the Supabase service-role key in frontend code.

### 2. Run the migrations

From the `backend/` folder, with your virtual environment active:

```bash
pip install -r requirements.txt
alembic upgrade head        # create all tables
alembic current             # show the applied revision
alembic downgrade base      # (optional) remove everything
```

Check the result in Supabase under **Table Editor**. After you later change a
model, create a new migration with:

```bash
alembic revision --autogenerate -m "describe the change"
```

Review the generated file before running `alembic upgrade head`.

## Not implemented yet (on purpose)

Authentication, requirements/offers/providers/negotiation/messaging APIs,
matching and scoring, trust scores, AI/ML, payments, file storage, WebSockets,
admin features, deployment.
