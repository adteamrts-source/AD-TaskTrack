FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=astro.settings.prod

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/backend/frontend_build ./backend/frontend_build/

WORKDIR /app/backend

# Static collection does not need the production database or runtime secret.
RUN DJANGO_SECRET_KEY=build-only-not-for-runtime \
    DATABASE_URL=sqlite:////tmp/astro-build.sqlite3 \
    DJANGO_ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput

RUN addgroup --system astro \
    && adduser --system --ingroup astro astro \
    && chown -R astro:astro /app

USER astro

CMD ["sh", "-c", "exec gunicorn astro.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 120 --access-logfile - --error-logfile -"]
