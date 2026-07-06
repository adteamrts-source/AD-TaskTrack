"""
Production settings.

PRD §5.6: must run behind domain + HTTPS and gated access (IAP / Cloudflare
Access / IP allowlist) — not fully public. Set DATABASE_URL to Postgres.
"""
from .base import *  # noqa: F401,F403

DEBUG = False

# Required from environment in production.
SECRET_KEY = env("DJANGO_SECRET_KEY")  # noqa: F405
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")  # noqa: F405

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])  # noqa: F405
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])  # noqa: F405

# HTTPS hardening (terminated at the reverse proxy / gated access layer).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
