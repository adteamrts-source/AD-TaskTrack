# Deploy ASTRO on Railway

ASTRO deploys as one Docker service: Vite builds the React frontend, Django
serves the API and SPA through Gunicorn/WhiteNoise, and Railway PostgreSQL
stores persistent data.

## 1. Create the services

1. In Railway, create a project from the GitHub repository
   `adteamrts-source/AD-TaskTrack`.
2. Add a PostgreSQL service to the same Railway project.
3. Generate a public domain for the application service.

Railway detects the root `Dockerfile`. `railway.toml` runs database migrations
before each release and waits for `GET /api/health` to return HTTP 200.

## 2. Application variables

Set these on the application service:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
DJANGO_SECRET_KEY=<long-random-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

`RAILWAY_PUBLIC_DOMAIN` and `PORT` are injected by Railway. For a custom
domain, also set:

```dotenv
DJANGO_ALLOWED_HOSTS=app.example.com
CSRF_TRUSTED_ORIGINS=https://app.example.com
```

Do not set `DJANGO_DEBUG=true` in production and do not run `seed_demo`.

Generate a Django secret locally, for example:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## 3. Configure Google OAuth

Add this URI to the Google OAuth client's authorized redirect URIs:

```text
https://YOUR_RAILWAY_DOMAIN/accounts/google/login/callback/
```

If a custom domain is added later, add its callback URI too.

## 4. First administrator

After the first successful deployment, open a Railway shell/SSH session for
the application service and run:

```bash
python manage.py createsuperuser
```

The Google-login allowlist is the `accounts.User` table. Create the real user
with the same email as the Google account, set `is_allowed=True`, and assign
the required ASTRO role before the first Google login.

## Database behavior

- Local development uses `backend/db.sqlite3` when `DATABASE_URL` is empty.
- Production refuses to start without `DATABASE_URL`, preventing accidental
  use of Railway's ephemeral filesystem for SQLite.
- Railway PostgreSQL exposes `DATABASE_URL`; reference it from the app service
  as `${{Postgres.DATABASE_URL}}`.
- Enable Railway database backups before production use.

Official references:

- https://docs.railway.com/builds/dockerfiles
- https://docs.railway.com/config-as-code
- https://docs.railway.com/deployments/pre-deploy-command
- https://docs.railway.com/deployments/healthchecks
- https://docs.railway.com/databases/postgresql
