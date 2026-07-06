"""
Meeting Summary — review dashboard over Daily Task entries (FN-MS-01..03).

Data source = DailyEntry; the status shown is the frozen `status_snapshot`
(PRD §6.10), not the Task's latest status. Grouped by project (+ a General
group); hours rolled up per project for the donut. Missing-submission compares
the team against working days in range.
"""
import datetime
from collections import OrderedDict, defaultdict
from decimal import Decimal

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.common.permissions import HasModulePermission
from apps.daily.models import DailyEntry, WorkSummaryNote
from apps.settings_app.services import is_working_day

PRESET_DAYS = {"1w": 7, "2w": 14, "1m": 30}


def _resolve_range(params):
    """Return (from_date, to_date) from preset or explicit from/to."""
    today = datetime.date.today()
    frm = params.get("from")
    to = params.get("to")
    if frm and to:
        try:
            return (
                datetime.datetime.strptime(frm, "%Y-%m-%d").date(),
                datetime.datetime.strptime(to, "%Y-%m-%d").date(),
            )
        except ValueError:
            pass
    preset = params.get("preset", "1w")
    if preset == "all":
        return (datetime.date(2000, 1, 1), today)
    days = PRESET_DAYS.get(preset, 7)
    return (today - datetime.timedelta(days=days - 1), today)


def _filtered_entries(params):
    frm, to = _resolve_range(params)
    qs = DailyEntry.objects.select_related("project", "user").filter(
        work_date__gte=frm, work_date__lte=to
    )
    user = params.get("user")
    if user:
        qs = qs.filter(user_id=user)
    project = params.get("project")
    if project:
        qs = qs.filter(project_id=project)
    source = params.get("source")
    if source:
        qs = qs.filter(source=source)
    keyword = params.get("keyword")
    if keyword:
        qs = qs.filter(title__icontains=keyword)
    return qs, frm, to


class MeetingSummaryView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Meeting Summary"

    def get(self, request):
        qs, frm, to = _filtered_entries(request.query_params)
        groups = OrderedDict()  # key -> dict
        hours_by_project = defaultdict(Decimal)
        total = Decimal("0")

        for e in qs.order_by("project__project_name", "work_date"):
            key = e.project_id or 0
            name = e.project.project_name if e.project_id else "ทั่วไป / ไม่ผูกโครงการ"
            if key not in groups:
                groups[key] = {"project_id": e.project_id, "project_name": name, "hours": Decimal("0"), "entries": [], "notes": []}
            groups[key]["entries"].append(
                {
                    "id": e.id,
                    "user": e.user_id,
                    "user_name": e.user.full_name or e.user.email,
                    "work_date": e.work_date.isoformat(),
                    "title": e.title,
                    "detail": e.detail,
                    "status_snapshot": e.status_snapshot,
                    "hours": str(e.hours),
                    "is_ot": e.is_ot,
                }
            )
            groups[key]["hours"] += e.hours
            hours_by_project[key] += e.hours
            total += e.hours

        # ประเด็นนำเสนอ — each member's talking points from "สรุปงานของฉัน",
        # shown per project alongside the daily entries of the selected range.
        # Notes are a period log: match by when they were WRITTEN (created_at).
        notes_qs = WorkSummaryNote.objects.select_related("user", "project").filter(
            created_at__date__gte=frm, created_at__date__lte=to
        ).exclude(body="")
        user_f = request.query_params.get("user")
        if user_f:
            notes_qs = notes_qs.filter(user_id=user_f)
        project_f = request.query_params.get("project")
        if project_f:
            notes_qs = notes_qs.filter(project_id=project_f)

        for n in notes_qs.order_by("created_at"):
            key = n.project_id or 0
            if key not in groups:
                name = n.project.project_name if n.project_id else "ทั่วไป / ไม่ผูกโครงการ"
                groups[key] = {
                    "project_id": n.project_id,
                    "project_name": name,
                    "hours": Decimal("0"),
                    "entries": [],
                    "notes": [],
                }
            groups[key]["notes"].append(
                {
                    "id": n.id,
                    "user": n.user_id,
                    "user_name": n.user.full_name or n.user.email,
                    "body": n.body,
                    "created_at": n.created_at.isoformat(),
                    "updated_at": n.updated_at.isoformat(),
                }
            )

        group_list = [
            {**g, "hours": str(g["hours"])} for g in groups.values()
        ]
        hours_list = [
            {
                "project_id": g["project_id"],
                "project_name": g["project_name"],
                "hours": str(g["hours"]),
            }
            for g in group_list
        ]
        return Response(
            {
                "range": {"from": frm.isoformat(), "to": to.isoformat()},
                "total_hours": str(total),
                "groups": group_list,
                "hours_by_project": hours_list,
            }
        )


class MissingSubmissionView(APIView):
    """FN-MS-03 — who hasn't logged on which working days in range."""

    permission_classes = [HasModulePermission]
    permission_module = "Meeting Summary"

    def get(self, request):
        frm, to = _resolve_range(request.query_params)
        working_days = []
        cur = frm
        while cur <= to:
            if is_working_day(cur):
                working_days.append(cur)
            cur += datetime.timedelta(days=1)

        users = User.objects.filter(is_active=True, is_allowed=True)
        # (user_id, work_date) pairs that DO have an entry.
        logged = set(
            DailyEntry.objects.filter(work_date__gte=frm, work_date__lte=to).values_list(
                "user_id", "work_date"
            )
        )
        result = []
        for u in users:
            missing = [d.isoformat() for d in working_days if (u.id, d) not in logged]
            if missing:
                result.append(
                    {
                        "user": u.id,
                        "full_name": u.full_name or u.email,
                        "role": u.role,
                        "missing_dates": missing,
                        "missing_count": len(missing),
                    }
                )
        return Response({"working_days": [d.isoformat() for d in working_days], "missing": result})
