"""
API-key authentication for external endpoints.

External views list ONLY this authentication class — SessionAuthentication is
deliberately absent, so CSRF is never enforced here and a logged-in browser
session cannot implicitly call these endpoints. The paired HasValidApiKey
permission replaces the project-default IsAuthenticated (which would reject
the AnonymousUser this class returns).
"""
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from .models import APIKey, hash_key


def _extract_key(request) -> str | None:
    key = request.headers.get("X-API-Key")
    if key:
        return key.strip()
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[len("Bearer "):].strip()
    return None


class ApiKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw_key = _extract_key(request)
        if not raw_key:
            return None  # no credentials -> 401 via HasValidApiKey
        try:
            api_key = APIKey.objects.get(hashed_key=hash_key(raw_key), is_active=True)
        except APIKey.DoesNotExist:
            raise AuthenticationFailed("API key ไม่ถูกต้องหรือถูกปิดใช้งาน")
        api_key.last_used_at = timezone.now()
        api_key.save(update_fields=["last_used_at", "updated_at"])
        return (AnonymousUser(), api_key)

    def authenticate_header(self, request):
        # Makes DRF return 401 (not 403) when credentials are missing/invalid.
        return "Api-Key"


class HasValidApiKey(BasePermission):
    message = "ต้องใช้ API key ที่ถูกต้อง"

    def has_permission(self, request, view):
        return isinstance(request.auth, APIKey)
