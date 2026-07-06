"""
Production settings.

PRD §5.6: must run behind domain + HTTPS and gated access (IAP / Cloudflare
Access / IP allowlist) — not fully public. Set DATABASE_URL to Postgres.
"""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

DEBUG = False

# Required secrets/services in production. Refuse to boot with the development
# fallback or ephemeral SQLite storage.
SECRET_KEY = env("DJANGO_SECRET_KEY")  # noqa: F405
if not SECRET_KEY or SECRET_KEY == "dev-insecure-change-me":
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to a secure production value")
if not env("DATABASE_URL"):  # noqa: F405
    raise ImproperlyConfigured("DATABASE_URL must point to persistent PostgreSQL in production")

DATABASES["default"]["CONN_MAX_AGE"] = 60  # noqa: F405
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True  # noqa: F405

# Railway injects its public domain at runtime. Health checks use a separate
# hostname which Django must also accept. Explicit values remain useful for a
# custom domain.
railway_domain = env("RAILWAY_PUBLIC_DOMAIN", default="").strip()  # noqa: F405
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])  # noqa: F405
ALLOWED_HOSTS.extend(["healthcheck.railway.app", ".up.railway.app"])
if railway_domain:
    ALLOWED_HOSTS.append(railway_domain)
ALLOWED_HOSTS = list(dict.fromkeys(ALLOWED_HOSTS))

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])  # noqa: F405
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])  # noqa: F405
if railway_domain:
    CSRF_TRUSTED_ORIGINS.append(f"https://{railway_domain}")
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(CSRF_TRUSTED_ORIGINS))

# HTTPS hardening (terminated at the reverse proxy / gated access layer).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
# Railway's internal health probe must receive 200 rather than an HTTPS redirect.
SECURE_REDIRECT_EXEMPT = [r"^api/health$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
