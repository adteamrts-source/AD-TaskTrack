"""Development settings — SQLite, permissive CORS for Vite dev server."""
from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

# Vite dev server runs on :5173 and calls the API on :8000.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Keep the browser on the Vite app after allauth completes the Google callback.
LOGIN_REDIRECT_URL = "http://localhost:5173/my-work"
ACCOUNT_LOGOUT_REDIRECT_URL = "http://localhost:5173/login"
