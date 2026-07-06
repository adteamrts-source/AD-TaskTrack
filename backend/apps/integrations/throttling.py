from rest_framework.throttling import SimpleRateThrottle

from .models import APIKey


class ApiKeyRateThrottle(SimpleRateThrottle):
    """Per-key rate limit (scope configured in REST_FRAMEWORK throttle rates)."""

    scope = "api_key"

    def get_cache_key(self, request, view):
        if not isinstance(request.auth, APIKey):
            return None  # unauthenticated requests are rejected by permission anyway
        return self.cache_format % {"scope": self.scope, "ident": request.auth.pk}
