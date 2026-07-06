"""
Cross-app aggregate endpoints: notifications (topbar bell) and global search.
Both are read-only and respect the RolePermission matrix per section.
"""
import datetime

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import role_allowed


class NotificationsView(APIView):
    """
    GET /api/notifications — "สิ่งที่ต้องสนใจตอนนี้" (stateless, no read/unread):
    daily ยังไม่กรอก, งานของฉันเลยกำหนด, งาน stuck, โครงการล่าช้า,
    ทรัพยากรใกล้หมดอายุ/หมดแล้ว. Each item: type/severity/title/detail/link.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.budget.models import InfraAsset
        from apps.daily.models import DailyEntry
        from apps.projects.models import Project
        from apps.settings_app.services import is_working_day
        from apps.tasks.models import Task

        user = request.user
        role = user.role
        today = datetime.date.today()
        items = []

        # Daily ยังไม่กรอกวันนี้ (วันทำงานเท่านั้น)
        if is_working_day(today) and not DailyEntry.objects.filter(
            user=user, work_date=today
        ).exists():
            items.append({
                "type": "daily", "severity": "warn",
                "title": "ยังไม่กรอกงานวันนี้", "detail": "", "link": "/my-work",
            })

        if role_allowed(role, "Task", "view"):
            overdue = (
                Task.objects.select_related("project")
                .filter(assigned_to=user, status__in=["not_started", "working"], scheduled_date__lt=today)
                .order_by("scheduled_date")[:5]
            )
            for t in overdue:
                items.append({
                    "type": "task_overdue", "severity": "danger",
                    "title": f"งานเลยกำหนด: {t.title}",
                    "detail": t.project.project_name,
                    "link": f"/projects/{t.project_id}?tab=tasks",
                })
            stuck = Task.objects.select_related("project").filter(status="stuck").order_by("-updated_at")[:5]
            for t in stuck:
                items.append({
                    "type": "task_stuck", "severity": "warn",
                    "title": f"งานติดปัญหา: {t.title}",
                    "detail": (t.assigned_to.get_short_name() if t.assigned_to else "ไม่มีผู้รับผิดชอบ")
                    + f" · {t.project.project_name}",
                    "link": f"/projects/{t.project_id}?tab=tasks",
                })

        if role_allowed(role, "Projects", "view"):
            for p in Project.objects.filter(health_status="delay").order_by("-delay_days")[:5]:
                items.append({
                    "type": "project_delay", "severity": "danger",
                    "title": f"โครงการล่าช้า: {p.project_name}",
                    "detail": p.health_reason,
                    "link": f"/projects/{p.id}",
                })

        if role_allowed(role, "Budget", "view"):
            horizon = today + datetime.timedelta(days=30)
            expiring = (
                InfraAsset.objects.select_related("project")
                .filter(status="active", expires_at__isnull=False, expires_at__lte=horizon)
                .order_by("expires_at")[:5]
            )
            for a in expiring:
                overdue_asset = a.expires_at < today
                items.append({
                    "type": "infra_expiry",
                    "severity": "danger" if overdue_asset else "warn",
                    "title": ("เลยวันหมดอายุ: " if overdue_asset else "ใกล้หมดอายุ: ") + a.name,
                    "detail": f"{a.expires_at:%d/%m/%Y}" + (f" · {a.project.project_name}" if a.project_id else ""),
                    "link": "/infrastructure",
                })

        return Response({"count": len(items), "items": items})


class GlobalSearchView(APIView):
    """GET /api/search?q= — โครงการ/งาน/ลูกค้า/ทรัพยากร (≤5 ต่อหมวด, ตาม matrix)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.budget.models import InfraAsset
        from apps.clients.models import Client
        from apps.projects.models import Project
        from apps.tasks.models import Task
        from django.db.models import Q

        q = (request.query_params.get("q") or "").strip()
        role = request.user.role
        results = []
        if len(q) < 2:
            return Response({"results": results})

        if role_allowed(role, "Projects", "view"):
            for p in Project.objects.filter(
                Q(project_name__icontains=q) | Q(project_code__icontains=q)
                | Q(client__client_name__icontains=q)
            ).select_related("client")[:5]:
                results.append({
                    "type": "project", "title": p.project_name,
                    "subtitle": f"{p.project_code or '-'} · {p.client.client_name}",
                    "link": f"/projects/{p.id}",
                })

        if role_allowed(role, "Task", "view"):
            for t in Task.objects.filter(title__icontains=q).select_related("project")[:5]:
                results.append({
                    "type": "task", "title": t.title,
                    "subtitle": t.project.project_name,
                    "link": f"/projects/{t.project_id}?tab=tasks",
                })

        if role_allowed(role, "Client Master", "view"):
            for c in Client.objects.filter(
                Q(client_name__icontains=q) | Q(client_abbreviation__icontains=q)
            )[:5]:
                results.append({
                    "type": "client", "title": c.client_name,
                    "subtitle": c.client_abbreviation or "",
                    "link": "/clients",
                })

        if role_allowed(role, "Budget", "view"):
            for a in InfraAsset.objects.filter(
                Q(name__icontains=q) | Q(provider__icontains=q) | Q(location__icontains=q)
            )[:5]:
                results.append({
                    "type": "infra", "title": a.name,
                    "subtitle": a.provider,
                    "link": "/infrastructure",
                })

        return Response({"results": results})