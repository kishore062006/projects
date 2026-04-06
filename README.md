<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cb1ae81b-8975-4512-9727-8137547f331e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend server

The Express backend now stores app data in Supabase instead of a local JSON file.

Required environment variables for the backend:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Email verification and forgot-password (recommended):

- `APP_BASE_URL` (frontend URL used in email links, e.g. `http://localhost:3000` or your deployed site URL)
- `SMTP_HOST`
- `SMTP_PORT` (typically `587` or `465`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (sender email)

If SMTP is not configured, account creation still works but verification/reset emails cannot be delivered.

Create this table in Supabase first:

```sql
create table if not exists app_state (
   id text primary key,
   state jsonb not null,
   updated_at timestamptz not null default now()
);
```

The backend still exposes the same API routes:

- `GET /api/status`
- `GET /api/dashboard`
- `GET /api/reports`
- `POST /api/reports`
- `PATCH /api/reports/:id/resolve`
- `GET /api/rewards`
- `POST /api/redeem`

If you want to run frontend and backend together during development, start two terminals:

```bash
npm run dev
npm run server
```

## Deploying Frontend To Vercel

If your frontend is deployed on Vercel, do not use `localhost` API URLs in production.

- Set `VITE_API_BASE_URL` in your Vercel project environment variables.
- Example: `https://your-backend-domain.com`
- The app will call auth endpoints like `${VITE_API_BASE_URL}/api/auth/login`.

For local development, when `VITE_API_BASE_URL` is not set, the app automatically uses `http://localhost:4001`.
