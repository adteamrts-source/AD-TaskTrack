"""Projects CRUD (FN-PRJ-01..05) + project team (FN-TEAM-02) + dashboard."""
import datetime
from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Max, Prefetch, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasModulePermission
from apps.common.roles import can_see_money

from .models import HealthStatus, Project, ProjectPhase, ProjectTeamMember, Risk, RiskLog
from .selectors import user_project_scope
from .serializers import (
    ProjectSerializer,
    ProjectTeamMemberSerializer,
    ProjectWriteSerializer,
    RiskLogSerializer,
    RiskSerializer,
    RiskWriteSerializer,
)


class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [HasModulePermission]
    permission_module = "Projects"

    def get_serializer_class(self):
        return ProjectWriteSerializer if self.request.method == "POST" else ProjectSerializer

    def get_queryset(self):
        qs = Project.objects.select_related("client", "po_user")
        p = self.request.query_params
        search = p.get("search")
        phase = p.get("phase")
        health = p.get("health")
        if search:
            qs = qs.filter(
                Q(project_name__icontains=search)
                | Q(project_code__icontains=search)
                | Q(client__client_name__icontains=search)
                | Q(client__client_abbreviation__icontains=search)
            )
        if phase:
            qs = qs.filter(project_phase=phase)
        if health:
            qs = qs.filter(health_status=health)
        if p.get("mine") in ("1", "true", "me"):
            qs = qs.filter(user_project_scope(self.request.user)).distinct()
        return qs


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [HasModulePermission]
    permission_module = "Projects"
    queryset = Project.objects.select_related("client", "po_user")

    def get_serializer_class(self):
        return ProjectWriteSerializer if self.request.method in ("PATCH", "PUT") else ProjectSerializer

    # DELETE -> model.delete() performs the soft-delete (FN-X-05).


class ProjectTeamView(generics.ListCreateAPIView):
    """GET/POST /api/projects/:id/team — manage via Projects:edit (FN-TEAM-02)."""

    serializer_class = ProjectTeamMemberSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Projects"
    # Reads need Projects:view, writes need Projects:edit.
    permission_action_map = {"GET": "view", "POST": "edit"}

    def get_queryset(self):
        return ProjectTeamMember.objects.select_related("user").filter(
            project_id=self.kwargs["pk"]
        )

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs["pk"])


class ProjectTeamMemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectTeamMemberSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Projects"
    permission_action_map = {"GET": "view", "PATCH": "edit", "PUT": "edit", "DELETE": "edit"}
    queryset = ProjectTeamMember.objects.select_related("user")


# Risk fields whose changes are appended to the log (เก่า → ใหม่).
RISK_TRACKED_FIELDS = ("severity", "status", "mitigation")


class RiskListCreateView(APIView):
    """
    GET/POST /api/projects/<pk>/risks — lightweight risk register.
    POST maps to Projects:edit (not create) so BSA can log risks too —
    same precedent as ProjectTeamView; dev stays read-only.
    """

    permission_classes = [HasModulePermission]
    permission_module = "Projects"
    permission_action_map = {"GET": "view", "POST": "edit"}

    def get(self, request, pk):
        get_object_or_404(Project, pk=pk)
        risks = (
            Risk.objects.select_related("created_by")
            .prefetch_related("logs__by")
            .filter(project_id=pk)
        )
        return Response(RiskSerializer(risks, many=True).data)

    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        ser = RiskWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        risk = ser.save(project=project, created_by=request.user)
        RiskLog.objects.create(risk=risk, action="created", by=request.user)
        return Response(RiskSerializer(risk).data, status=http.HTTP_201_CREATED)


class RiskDetailView(APIView):
    """PATCH/DELETE /api/risks/<pk> — changes to tracked fields append logs."""

    permission_classes = [HasModulePermission]
    permission_module = "Projects"
    permission_action_map = {"PATCH": "edit", "DELETE": "delete"}

    def patch(self, request, pk):
        risk = get_object_or_404(Risk, pk=pk)
        old = {f: getattr(risk, f) for f in RISK_TRACKED_FIELDS}
        ser = RiskWriteSerializer(risk, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        for field in RISK_TRACKED_FIELDS:
            new = getattr(risk, field)
            if new != old[field]:
                RiskLog.objects.create(
                    risk=risk,
                    action=field,
                    detail=f"{old[field][:120]} → {new[:120]}",
                    by=request.user,
                )
        return Response(RiskSerializer(risk).data)

    def delete(self, request, pk):
        risk = get_object_or_404(Risk, pk=pk)
        risk.delete()  # logs cascade
        return Response(status=http.HTTP_204_NO_CONTENT)


class RiskLogListView(APIView):
    """GET /api/risks/<pk>/logs — full history."""

    permission_classes = [HasModulePermission]
    permission_module = "Projects"

    def get(self, request, pk):
        risk = get_object_or_404(Risk, pk=pk)
        return Response(RiskLogSerializer(risk.logs.select_related("by"), many=True).data)


ACTIVITY_WINDOW_DAYS = 7


class DashboardView(APIView):
    """
    GET /api/dashboard — the single Projects page payload: every project's
    status + team + activity + rollups. Rides on Projects:view so all roles
    see it. value_thb only for Admin/DM (PRD §6.4, same rule as the list
    serializer).
    """

    permission_classes = [HasModulePermission]
    permission_module = "Projects"

    def get(self, request):
        from apps.daily.models import DailyEntry
        from apps.plans.services import project_progress
        from apps.tasks.models import Task, TaskStatus

        qs = Project.objects.select_related("client").prefetch_related(
            "team_members__user",
            # Explicit queryset so prefetch goes through AliveManager and the
            # cache feeds project_progress() without re-querying per project.
            Prefetch("plan_items__tasks", queryset=Task.objects.all()),
        )
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(project_name__icontains=search)
                | Q(project_code__icontains=search)
                | Q(client__client_name__icontains=search)
                | Q(client__client_abbreviation__icontains=search)
            )
        phase = request.query_params.get("phase")
        if phase:
            qs = qs.filter(project_phase=phase)
        health = request.query_params.get("health")
        if health:
            qs = qs.filter(health_status=health)
        projects = list(qs)
        project_ids = [p.id for p in projects]

        # status counts per project — one aggregate query.
        task_counts = defaultdict(lambda: defaultdict(int))
        for row in (
            Task.objects.filter(project_id__in=project_ids)
            .values("project_id", "status")
            .annotate(n=Count("id"))
        ):
            task_counts[row["project_id"]][row["status"]] = row["n"]

        # who logged daily entries recently — one aggregate query.
        since = datetime.date.today() - datetime.timedelta(days=ACTIVITY_WINDOW_DAYS - 1)
        activity = defaultdict(list)
        for row in (
            DailyEntry.objects.filter(project_id__in=project_ids, work_date__gte=since)
            .values("project_id", "user_id", "user__full_name", "user__email")
            .annotate(last_date=Max("work_date"), hours=Sum("hours"))
            .order_by("-last_date")
        ):
            activity[row["project_id"]].append(
                {
                    "user": row["user_id"],
                    "full_name": row["user__full_name"] or row["user__email"],
                    "last_date": row["last_date"].isoformat(),
                    "hours": str(row["hours"] or Decimal("0")),
                }
            )

        show_money = can_see_money(request.user)
        by_health = {key: 0 for key in HealthStatus.values}
        by_phase = {key: 0 for key in ProjectPhase.values}
        items = []
        for p in projects:
            by_health[p.health_status] += 1
            by_phase[p.project_phase] += 1
            counts = task_counts[p.id]
            items.append(
                {
                    "id": p.id,
                    "project_name": p.project_name,
                    "project_code": p.project_code,
                    "client_name": p.client.client_name,
                    "client_abbreviation": p.client.client_abbreviation,
                    "project_phase": p.project_phase,
                    "health_status": p.health_status,
                    "health_reason": p.health_reason,
                    "delay_days": p.delay_days,
                    "start_date": p.start_date.isoformat() if p.start_date else None,
                    "end_date": p.end_date.isoformat() if p.end_date else None,
                    "progress": project_progress(p),
                    "task_counts": {
                        "total": sum(counts.values()),
                        **{key: counts[key] for key in TaskStatus.values},
                    },
                    "team": [
                        {
                            "user": m.user_id,
                            "full_name": m.user.full_name or m.user.email,
                            "email": m.user.email,
                            "role_in_project": m.role_in_project,
                            "allocation_percentage": m.allocation_percentage,
                        }
                        for m in p.team_members.all()
                    ],
                    "recent_activity": activity[p.id],
                    # Confidential — key present only for Admin/DM (PRD §6.4).
                    **({"value_thb": str(p.value_thb) if p.value_thb is not None else None} if show_money else {}),
                }
            )

        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "activity_window_days": ACTIVITY_WINDOW_DAYS,
                "rollups": {"total": len(items), "by_health": by_health, "by_phase": by_phase},
                "projects": items,
            }
        )
