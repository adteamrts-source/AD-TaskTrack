"""
Plan / Timeline API (FN-PLAN-01..04, FN-PT-01).

manday auto-computes from start/end (working days). Every change is logged to
PlanItemRevision; key fields require change_reason. Dependencies support FS,
SS, FF and SF relations with lag/lead, and reject cycles.
"""
from collections import defaultdict
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.exceptions import Conflict
from apps.common.permissions import HasModulePermission
from apps.projects.models import Project
from apps.settings_app.services import working_days_between
from apps.tasks.models import Task

from .models import PlanItem, PlanItemDependency, REVISION_REQUIRED_FIELDS
from .serializers import (
    DependencySerializer,
    GenerateTasksSerializer,
    PlanItemSerializer,
    PlanItemWriteSerializer,
    RevisionSerializer,
)
from .services import refresh_health

TRACKED_FIELDS = ["phase", "task", "manday", "start_date", "end_date", "is_milestone", "sort_order"]


def _apply_manday(item):
    """Set manday + input_mode from current dates (working days) if both present."""
    if item.start_date and item.end_date:
        item.manday = Decimal(working_days_between(item.start_date, item.end_date))
        item.input_mode = "date"
    elif item.manday is not None:
        item.input_mode = "manday"


def _as_str(v):
    return "" if v is None else str(v)


class PlanItemListCreateView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Plan/Timeline"
    permission_action_map = {"GET": "view", "POST": "create"}

    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        items = list(project.plan_items.all())
        totals = defaultdict(float)
        total_manday = 0.0
        for it in items:
            md = float(it.manday) if it.manday is not None else 0.0
            totals[it.phase] += md
            total_manday += md
        deps = project.dependencies.all()
        return Response(
            {
                "items": PlanItemSerializer(items, many=True).data,
                "totals_by_phase": [{"phase": k, "manday": v} for k, v in totals.items()],
                "total_manday": total_manday,
                "dependencies": DependencySerializer(deps, many=True).data,
            }
        )

    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        ser = PlanItemWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        data.pop("change_reason", None)
        item = PlanItem(project=project, **data)
        _apply_manday(item)
        item.save()
        refresh_health(project)
        return Response(PlanItemSerializer(item).data, status=status.HTTP_201_CREATED)


class PlanItemDetailView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Plan/Timeline"
    permission_action_map = {"GET": "view", "PATCH": "edit", "DELETE": "delete"}

    def get(self, request, pk):
        item = get_object_or_404(PlanItem, pk=pk)
        return Response(PlanItemSerializer(item).data)

    def patch(self, request, pk):
        item = get_object_or_404(PlanItem, pk=pk)
        ser = PlanItemWriteSerializer(item, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        reason = ser.validated_data.pop("change_reason", "") or ""

        old = {f: getattr(item, f) for f in TRACKED_FIELDS}
        for field, value in ser.validated_data.items():
            setattr(item, field, value)
        # Recompute manday from dates unless the user is clearing them.
        _apply_manday(item)

        changed = [f for f in TRACKED_FIELDS if old[f] != getattr(item, f)]
        needs_reason = any(f in REVISION_REQUIRED_FIELDS for f in changed)
        if needs_reason and not reason.strip():
            return Response(
                {"change_reason": ["ต้องระบุเหตุผลเมื่อแก้ manday/วันที่/เฟส/งาน"]},
                status=400,
            )

        item.save()
        for f in changed:
            item.revisions.create(
                field_name=f,
                old_value=_as_str(old[f]),
                new_value=_as_str(getattr(item, f)),
                change_reason=reason if f in REVISION_REQUIRED_FIELDS else "",
                changed_by=request.user,
            )
        refresh_health(item.project)
        return Response(PlanItemSerializer(item).data)

    def delete(self, request, pk):
        item = get_object_or_404(PlanItem, pk=pk)
        project = item.project
        item.delete()
        refresh_health(project)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RevisionListView(generics.ListAPIView):
    serializer_class = RevisionSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Plan/Timeline"

    def get_queryset(self):
        return PlanItem.objects.get(pk=self.kwargs["pk"]).revisions.all()


def _creates_cycle(project, pred_id, succ_id, exclude_id=None):
    if pred_id == succ_id:
        return True
    edges = defaultdict(list)
    dependencies = PlanItemDependency.objects.filter(project=project)
    if exclude_id is not None:
        dependencies = dependencies.exclude(pk=exclude_id)
    for d in dependencies:
        edges[d.predecessor_id].append(d.successor_id)
    # A cycle forms if successor can already reach predecessor.
    stack, seen = [succ_id], set()
    while stack:
        node = stack.pop()
        if node == pred_id:
            return True
        if node in seen:
            continue
        seen.add(node)
        stack.extend(edges[node])
    return False


class DependencyCreateView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Plan/Timeline"
    permission_action_map = {"POST": "edit"}

    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        ser = DependencySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        pred = ser.validated_data["predecessor"]
        succ = ser.validated_data["successor"]
        if pred.project_id != project.id or succ.project_id != project.id:
            return Response({"detail": "PlanItem ต้องอยู่ในโครงการเดียวกัน"}, status=400)
        if PlanItemDependency.objects.filter(predecessor=pred, successor=succ).exists():
            return Response({"detail": "dependency ระหว่างงานคู่นี้มีอยู่แล้ว"}, status=400)
        if _creates_cycle(project, pred.id, succ.id):
            raise Conflict("เกิด dependency วนรอบ")
        dep = ser.save(project=project, created_by=request.user)
        return Response(DependencySerializer(dep).data, status=status.HTTP_201_CREATED)


class DependencyDetailView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Plan/Timeline"
    permission_action_map = {"PATCH": "edit", "DELETE": "edit"}

    def patch(self, request, pk):
        dep = get_object_or_404(PlanItemDependency, pk=pk)
        ser = DependencySerializer(dep, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        pred = ser.validated_data.get("predecessor", dep.predecessor)
        succ = ser.validated_data.get("successor", dep.successor)
        if pred.project_id != dep.project_id or succ.project_id != dep.project_id:
            return Response({"detail": "PlanItem ต้องอยู่ในโครงการเดียวกัน"}, status=400)
        if PlanItemDependency.objects.filter(predecessor=pred, successor=succ).exclude(pk=dep.pk).exists():
            return Response({"detail": "dependency ระหว่างงานคู่นี้มีอยู่แล้ว"}, status=400)
        if _creates_cycle(dep.project, pred.id, succ.id, exclude_id=dep.id):
            raise Conflict("เกิด dependency วนรอบ")
        dep = ser.save()
        return Response(DependencySerializer(dep).data)

    def delete(self, request, pk):
        dep = get_object_or_404(PlanItemDependency, pk=pk)
        dep.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GenerateTasksView(APIView):
    """
    FN-PT-01 — create execution Tasks from PlanItems (all / selected).

    Idempotent: a plan item that already has a linked (non-deleted) Task is
    skipped, so pressing the button repeatedly never duplicates the plan into
    tasks — matching real delivery flow where the plan is materialized once
    and only NEW plan items generate new tasks. (Deleting a task frees its
    plan item to be generated again.)
    """

    permission_classes = [HasModulePermission]
    permission_module = "Task"
    permission_action_map = {"POST": "create"}

    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        ser = GenerateTasksSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        mode = ser.validated_data["mode"]
        state = ser.validated_data["state"]
        items = project.plan_items.all()
        if mode == "selected":
            ids = ser.validated_data.get("plan_item_ids") or []
            items = items.filter(id__in=ids)

        # Task.objects (AliveManager) — soft-deleted tasks don't block regeneration.
        already_generated = set(
            Task.objects.filter(project=project, plan_item__isnull=False).values_list(
                "plan_item_id", flat=True
            )
        )

        created = []
        skipped = 0
        for it in items:
            if it.id in already_generated:
                skipped += 1
                continue
            task = Task.objects.create(
                title=it.task,
                project=project,
                plan_item=it,
                source="plan",
                state=state,
                status="not_started",
                estimated_manday=it.manday,
            )
            created.append(task.id)
        if created:
            refresh_health(project)
        return Response(
            {"created": created, "count": len(created), "skipped": skipped},
            status=201,
        )


class PlanExportView(APIView):
    """FN-PLAN-05 — export Plan/Timeline as .xlsx (PL-7) or PDF/Gantt (PL-8)."""

    permission_classes = [HasModulePermission]
    permission_module = "Plan/Timeline"

    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        fmt = request.query_params.get("format", "xlsx")
        from .exports import export_plan

        return export_plan(project, fmt)

class ProgressReportView(APIView):
    """รายงานความคืบหน้าสำหรับส่งลูกค้า — anyone who can view the project."""

    permission_classes = [HasModulePermission]
    permission_module = "Projects"

    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        from .exports import progress_report_pdf

        return progress_report_pdf(project)
