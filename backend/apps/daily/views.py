"""
My Work / Daily Task API (FN-MW-01..07, FN-X-04).

Self-scoped: every endpoint reads/writes only the caller's own entries. Module
gating uses the matrix ("My Work"); object scope is enforced by filtering on
request.user.
"""
import datetime
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status as http
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasModulePermission
from apps.settings_app.services import is_working_day

from .models import DailyEntry, WorkSummaryNote
from .serializers import (
    DailyCreateSerializer,
    DailyEntrySerializer,
    DailyUpdateSerializer,
)


def _parse_date(s):
    try:
        return datetime.datetime.strptime(s, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


class DailyListCreateView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "My Work"
    permission_action_map = {"GET": "view", "POST": "create"}

    def get(self, request):
        work_date = _parse_date(request.query_params.get("work_date")) or datetime.date.today()
        qs = DailyEntry.objects.filter(user=request.user, work_date=work_date)
        total_hours = sum((e.hours for e in qs), Decimal("0"))
        return Response(
            {
                "results": DailyEntrySerializer(qs, many=True).data,
                "total_hours": total_hours,
                "work_date": work_date.isoformat(),
            }
        )

    def post(self, request):
        ser = DailyCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        entry = ser.save()
        return Response(DailyEntrySerializer(entry).data, status=http.HTTP_201_CREATED)


class DailyDetailView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "My Work"
    permission_action_map = {"PATCH": "edit", "DELETE": "delete"}

    def _own(self, request, pk):
        return get_object_or_404(DailyEntry, pk=pk, user=request.user)

    def patch(self, request, pk):
        entry = self._own(request, pk)
        ser = DailyUpdateSerializer(entry, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(DailyEntrySerializer(entry).data)

    def delete(self, request, pk):
        entry = self._own(request, pk)
        entry.delete()  # real delete — it's the user's own row
        return Response(status=http.HTTP_204_NO_CONTENT)


class ReminderView(APIView):
    """FN-X-04 — does the user still need to log today (working day, no entry)?"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = datetime.date.today()
        needs = False
        if is_working_day(today):
            needs = not DailyEntry.objects.filter(user=request.user, work_date=today).exists()
        return Response({"needs_submission": needs, "work_date": today.isoformat()})


SUMMARY_PRESET_DAYS = {"1w": 7, "2w": 14, "1m": 30}


class TeamUtilizationView(APIView):
    """
    GET /api/team/utilization — ภาระงานทีมในช่วงที่เลือก: ชม.ที่ log ต่อคนต่อวัน
    + OT รวม + capacity (วันทำงาน × HOURS_PER_WORKING_DAY) ให้ DM เห็นว่า
    ใครว่าง/ใครล้น และใช้สรุป OT ประจำเดือน. Module "Team Members" (view).
    """

    permission_classes = [HasModulePermission]
    permission_module = "Team Members"

    def get(self, request):
        from collections import defaultdict

        from apps.accounts.models import User
        from apps.settings_app.services import get_float_setting

        today = datetime.date.today()
        frm = _parse_date(request.query_params.get("from"))
        to = _parse_date(request.query_params.get("to"))
        if not (frm and to):
            days_n = SUMMARY_PRESET_DAYS.get(request.query_params.get("preset", "1w"), 7)
            frm, to = today - datetime.timedelta(days=days_n - 1), today

        days = []
        cur = frm
        while cur <= to:
            days.append({"date": cur.isoformat(), "working": is_working_day(cur)})
            cur += datetime.timedelta(days=1)
        working_days = sum(1 for d in days if d["working"])
        hours_per_day = get_float_setting("HOURS_PER_WORKING_DAY", 8.0)
        capacity = working_days * hours_per_day

        by_user_day = defaultdict(lambda: defaultdict(Decimal))
        ot_by_user = defaultdict(Decimal)
        total_by_user = defaultdict(Decimal)
        entries = DailyEntry.objects.filter(work_date__gte=frm, work_date__lte=to)
        for e in entries:
            by_user_day[e.user_id][e.work_date.isoformat()] += e.hours
            total_by_user[e.user_id] += e.hours
            if e.is_ot:
                ot_by_user[e.user_id] += e.hours

        users = []
        for u in User.objects.filter(is_active=True, is_allowed=True):
            total = total_by_user[u.id]
            users.append({
                "id": u.id,
                "full_name": u.full_name or u.email,
                "role": u.role,
                "hours_by_day": {d: str(h) for d, h in by_user_day[u.id].items()},
                "total_hours": str(total),
                "ot_hours": str(ot_by_user[u.id]),
                "utilization": round(float(total) / capacity * 100) if capacity > 0 else None,
            })
        users.sort(key=lambda x: -float(x["total_hours"]))

        return Response({
            "range": {"from": frm.isoformat(), "to": to.isoformat()},
            "days": days,
            "capacity_hours": capacity,
            "hours_per_day": hours_per_day,
            "users": users,
        })


class MyWorkSummaryView(APIView):
    """
    GET /api/my-summary — "สรุปงานของฉัน": the caller's daily entries in the
    selected range, grouped per project and ordered by date, plus their own
    per-project talking-point note. Built for presenting one's work in the
    team meeting (1-2 week cadence).
    """

    permission_classes = [HasModulePermission]
    permission_module = "My Work"

    def get(self, request):
        today = datetime.date.today()
        frm = _parse_date(request.query_params.get("from"))
        to = _parse_date(request.query_params.get("to"))
        if not (frm and to):
            days = SUMMARY_PRESET_DAYS.get(request.query_params.get("preset", "1w"), 7)
            frm, to = today - datetime.timedelta(days=days - 1), today

        entries = (
            DailyEntry.objects.select_related("project", "task")
            .filter(user=request.user, work_date__gte=frm, work_date__lte=to)
            .order_by("work_date", "created_at")
        )
        # Period log: only my notes written within the selected range.
        notes = (
            WorkSummaryNote.objects.select_related("project")
            .filter(user=request.user, created_at__date__gte=frm, created_at__date__lte=to)
            .order_by("created_at")
        )

        groups = {}
        total = Decimal("0")
        for e in entries:
            key = e.project_id or 0
            if key not in groups:
                name = e.project.project_name if e.project_id else "ทั่วไป / ไม่ผูกโครงการ"
                groups[key] = {
                    "project_id": e.project_id,
                    "project_name": name,
                    "hours": Decimal("0"),
                    "entries": [],
                    "notes": [],
                }
            groups[key]["entries"].append(
                {
                    "id": e.id,
                    "work_date": e.work_date.isoformat(),
                    "title": e.title,
                    "detail": e.detail,
                    "status_snapshot": e.status_snapshot,
                    "task_title": e.task.title if e.task_id else "",
                    "source": e.source,
                    "hours": str(e.hours),
                    "is_ot": e.is_ot,
                }
            )
            groups[key]["hours"] += e.hours
            total += e.hours

        # Attach notes; a note on a project with no entries still gets a group
        # (you may want to talk about a project you didn't log time on).
        for note in notes:
            key = note.project_id or 0
            if key not in groups:
                groups[key] = {
                    "project_id": note.project_id,
                    "project_name": note.project.project_name if note.project_id else "ทั่วไป / ไม่ผูกโครงการ",
                    "hours": Decimal("0"),
                    "entries": [],
                    "notes": [],
                }
            groups[key]["notes"].append(
                {
                    "id": note.id,
                    "body": note.body,
                    "created_at": note.created_at.isoformat(),
                    "updated_at": note.updated_at.isoformat(),
                }
            )

        group_list = sorted(
            [{**g, "hours": str(g["hours"])} for g in groups.values()],
            key=lambda g: (g["project_id"] is None, g["project_name"]),
        )
        return Response(
            {
                "range": {"from": frm.isoformat(), "to": to.isoformat()},
                "total_hours": str(total),
                "groups": group_list,
            }
        )


def _note_payload(note):
    return {
        "id": note.id,
        "project": note.project_id,
        "body": note.body,
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat(),
    }


class WorkSummaryNoteListView(APIView):
    """POST /api/my-summary/notes — add a talking-point note (period log)."""

    permission_classes = [HasModulePermission]
    permission_module = "My Work"
    permission_action_map = {"POST": "create"}

    def post(self, request):
        project_id = request.data.get("project")  # null/absent = general bucket
        body = (request.data.get("body") or "").strip()
        if not body:
            return Response({"body": ["กรุณากรอกประเด็น"]}, status=http.HTTP_400_BAD_REQUEST)
        if project_id is not None:
            from apps.projects.models import Project

            get_object_or_404(Project, pk=project_id)
        note = WorkSummaryNote.objects.create(
            user=request.user, project_id=project_id, body=body
        )
        return Response(_note_payload(note), status=http.HTTP_201_CREATED)


class WorkSummaryNoteDetailView(APIView):
    """PATCH/DELETE /api/my-summary/notes/<pk> — own notes only (others 404)."""

    permission_classes = [HasModulePermission]
    permission_module = "My Work"
    permission_action_map = {"PATCH": "edit", "DELETE": "delete"}

    def _own(self, request, pk):
        return get_object_or_404(WorkSummaryNote, pk=pk, user=request.user)

    def patch(self, request, pk):
        note = self._own(request, pk)
        body = (request.data.get("body") or "").strip()
        if not body:
            return Response({"body": ["กรุณากรอกประเด็น"]}, status=http.HTTP_400_BAD_REQUEST)
        note.body = body
        note.save(update_fields=["body", "updated_at"])
        return Response(_note_payload(note))

    def delete(self, request, pk):
        note = self._own(request, pk)
        note.delete()
        return Response(status=http.HTTP_204_NO_CONTENT)
