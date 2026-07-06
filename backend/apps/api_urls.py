"""
Central /api/ URLConf. Each module appends its routes here as it is built
(Phase 1+). Endpoints follow Functions Design §2 (REST, paginated lists).
"""
from django.urls import include, path

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok", "service": "astro"})


from apps.common.views import GlobalSearchView, NotificationsView

urlpatterns = [
    path("health", health, name="api-health"),
    path("notifications", NotificationsView.as_view(), name="notifications"),
    path("search", GlobalSearchView.as_view(), name="global-search"),
    path("", include("apps.accounts.urls")),
    path("", include("apps.settings_app.urls")),
    path("", include("apps.calendar_sync.urls")),
    path("", include("apps.clients.urls")),
    path("", include("apps.projects.urls")),
    path("", include("apps.plans.urls")),
    path("", include("apps.tasks.urls")),
    path("", include("apps.daily.urls")),
    path("", include("apps.meetings.urls")),
    path("", include("apps.budget.urls")),
    # Machine-to-machine inbound API (API-key auth, create-only — v1).
    path("external/v1/", include("apps.integrations.urls")),
]
