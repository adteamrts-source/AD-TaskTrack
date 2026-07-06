"""
ASTRO — base settings (shared by dev/prod).

Per PRD v1.3 §5: Django + DRF API under /api/, Google login via django-allauth,
RBAC authority = RolePermission table (Django perms only guard the Admin site).
Values are read from the environment via django-environ; see .env.example.
"""
from pathlib import Path

import environ

# backend/astro/settings/base.py -> BASE_DIR = backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_SECRET_KEY=(str, "dev-insecure-change-me"),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    # Database: empty DATABASE_URL => SQLite (dev default)
    DATABASE_URL=(str, ""),
    GOOGLE_CLIENT_ID=(str, ""),
    GOOGLE_CLIENT_SECRET=(str, ""),
)

# Read backend/.env if present (never committed)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# --- Applications ---------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
]

LOCAL_APPS = [
    "apps.common",
    "apps.accounts",
    "apps.clients",
    "apps.projects",
    "apps.plans",
    "apps.tasks",
    "apps.daily",
    "apps.budget",
    "apps.calendar_sync",
    "apps.meetings",
    "apps.settings_app",
    "apps.integrations",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "astro.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "astro.wsgi.application"
ASGI_APPLICATION = "astro.asgi.application"

# --- Database -------------------------------------------------------------
# Dev default = SQLite. Set DATABASE_URL (postgres://...) to switch (PRD §5.1).
if env("DATABASE_URL"):
    DATABASES = {"default": env.db("DATABASE_URL")}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# --- Auth -----------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- django-allauth (Google) ---------------------------------------------
SITE_ID = 1
LOGIN_REDIRECT_URL = "/my-work"
ACCOUNT_LOGOUT_REDIRECT_URL = "/login"

ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_USER_MODEL_USERNAME_FIELD = None

# Allowlist + first-login provisioning live in this adapter (FN-AUTH-01/03).
SOCIALACCOUNT_ADAPTER = "apps.accounts.adapters.AstroSocialAccountAdapter"
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_VERIFICATION = "none"
SOCIALACCOUNT_STORE_TOKENS = True
# Do not show django-allauth's intermediate "Continue" page for Google.
# The ASTRO login button should go straight to the provider, while fallback
# templates below keep error/cancel states on-brand if allauth needs a page.
SOCIALACCOUNT_LOGIN_ON_GET = True

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        # Read-only calendar so meetings can be suggested in Daily Task (AUTH-2).
        "SCOPE": ["profile", "email", "https://www.googleapis.com/auth/calendar.readonly"],
        # Keep offline access so Calendar can refresh in the background. Do not
        # force `prompt=consent`: Google should ask for permission on the first
        # grant (or after scopes/revocation), not on every normal login.
        "AUTH_PARAMS": {"access_type": "offline"},
        "APP": {
            "client_id": env("GOOGLE_CLIENT_ID"),
            "secret": env("GOOGLE_CLIENT_SECRET"),
            "key": "",
        },
    }
}

# --- DRF ------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    # We don't use DRF format suffixes; `?format=` is a plain param (e.g. budget export).
    "URL_FORMAT_OVERRIDE": None,
    "EXCEPTION_HANDLER": "apps.common.exceptions.astro_exception_handler",
    "DATETIME_FORMAT": "iso-8601",
    "DATE_FORMAT": "iso-8601",
    # External inbound API (apps.integrations) — per-key limit.
    "DEFAULT_THROTTLE_RATES": {"api_key": "600/hour"},
}

# --- i18n / tz ------------------------------------------------------------
LANGUAGE_CODE = "th"
TIME_ZONE = "Asia/Bangkok"  # PRD §9: normalize to Asia/Bangkok
USE_I18N = True
USE_TZ = True

# --- Static (React build served by Django via whitenoise) -----------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Vite build output (collected from frontend/dist by collectstatic).
STATICFILES_DIRS = [BASE_DIR / "frontend_build"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Vite already content-hashes asset filenames, so we skip manifest
    # re-hashing (which would break the SPA's references) and just compress.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- ASTRO app config (overridable via SystemSetting at runtime) -----------
ASTRO_DEFAULTS = {
    "HOURS_PER_WORKING_DAY": 8,  # PRD §6.6 / §6.15 — hours<->manday conversion
    # Health thresholds (PRD §3.2), as fractions of expected progress.
    "health_threshold_at_risk": 0.05,  # verified below expected by 5–15% => at_risk
    "health_threshold_delay": 0.15,    # verified below expected by >15% => delay
}
