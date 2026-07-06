"""
External inbound API v1 (create-only). Spec: ASTRO-External-API-v1.md.

Auth = ApiKeyAuthentication only (no session -> no CSRF, no session bleed).
RolePermission matrix is not consulted: an active key grants exactly these
endpoints, nothing else.
"""
from pathlib import Path

from django.http import HttpResponse
from rest_framework import status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.exceptions import Conflict
from apps.plans.services import refresh_health

from .authentication import ApiKeyAuthentication, HasValidApiKey
from .serializers import ExternalProjectCreateSerializer, ExternalTaskCreateSerializer
from .throttling import ApiKeyRateThrottle

SPEC_PATH = Path(__file__).resolve().parents[3] / "ASTRO-External-API-v1.md"


class SpecView(APIView):
    """
    GET /api/external/v1/spec — the API spec document, downloadable from the
    app (Admin console) so integrators/admins don't need repo access.
    Session-authenticated (normal app users), NOT api-key.
    """

    def get(self, request):
        if not SPEC_PATH.exists():
            return Response({"detail": "ไม่พบไฟล์ spec"}, status=http.HTTP_404_NOT_FOUND)
        resp = HttpResponse(SPEC_PATH.read_bytes(), content_type="text/markdown; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="ASTRO-External-API-v1.md"'
        return resp


class ExternalBaseView(APIView):
    authentication_classes = [ApiKeyAuthentication]
    permission_classes = [HasValidApiKey]
    throttle_classes = [ApiKeyRateThrottle]


class ExternalHealthView(ExternalBaseView):
    """GET /api/external/v1/health — auth smoke-test for integrators."""

    def get(self, request):
        return Response({"status": "ok", "key_name": request.auth.name})


class ExternalProjectCreateView(ExternalBaseView):
    def post(self, request):
        ser = ExternalProjectCreateSerializer(data=request.data)
        if not ser.is_valid():
            # Duplicate project_code is a conflict (409), not a validation error.
            code_errors = ser.errors.get("project_code", [])
            if any(str(e) == "duplicate_project_code" for e in code_errors):
                raise Conflict("project_code นี้ถูกใช้แล้ว")
            ser.is_valid(raise_exception=True)
        project = ser.save()
        return Response(
            {
                "id": project.id,
                "project_name": project.project_name,
                "project_code": project.project_code,
                "client": {
                    "id": project.client_id,
                    "client_name": project.client.client_name,
                    "client_abbreviation": project.client.client_abbreviation,
                    "created": project._client_created,
                },
                "project_phase": project.project_phase,
                "start_date": project.start_date.isoformat() if project.start_date else None,
                "end_date": project.end_date.isoformat() if project.end_date else None,
            },
            status=http.HTTP_201_CREATED,
        )


class ExternalTaskCreateView(ExternalBaseView):
    def post(self, request):
        ser = ExternalTaskCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        task = ser.save()
        refresh_health(task.project)
        return Response(
            {
                "id": task.id,
                "title": task.title,
                "project": task.project_id,
                "project_code": task.project.project_code,
                "assigned_to": task.assigned_to_id,
                "assignee_matched": task._assignee_matched,
                "state": task.state,
                "status": task.status,
                "source": task.source,
                "estimated_manday": str(task.estimated_manday) if task.estimated_manday is not None else None,
                "scheduled_date": task.scheduled_date.isoformat() if task.scheduled_date else None,
            },
            status=http.HTTP_201_CREATED,
        )
