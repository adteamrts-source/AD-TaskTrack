"""
Task management API (FN-TASK-01..08).

Permission model:
- module "Task" via the matrix (Dev has view+edit; BSA/DM/Admin full).
- Object/field rules layered on top: a Dev may only edit their OWN task and only
  its `status`, and cannot set `verified`. `verified` is reserved for verifier
  roles (admin/dm/bsa). claim is a self-scoped capability, not Task:edit.
"""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status as http
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.exceptions import Conflict
from apps.common.permissions import HasModulePermission
from apps.plans.services import refresh_health

from .models import Task
from .serializers import (
    TaskCreateSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
)

VERIFIER_ROLES = {"admin", "dm", "bsa"}


class TaskListCreateView(generics.ListCreateAPIView):
    permission_classes = [HasModulePermission]
    permission_module = "Task"

    def get_serializer_class(self):
        return TaskCreateSerializer if self.request.method == "POST" else TaskSerializer

    def get_queryset(self):
        qs = Task.objects.select_related("project", "assigned_to")
        p = self.request.query_params
        project = p.get("project")
        assignee = p.get("assignee")
        status_f = p.get("status")
        state_f = p.get("state")
        search = p.get("search")
        sort = p.get("sort")
        if project:
            qs = qs.filter(project_id=project)
        if assignee == "me":
            qs = qs.filter(assigned_to=self.request.user)
        elif assignee == "backlog":
            qs = qs.filter(assigned_to__isnull=True)
        elif assignee:
            qs = qs.filter(assigned_to_id=assignee)
        if status_f:
            qs = qs.filter(status=status_f)
        if state_f:
            qs = qs.filter(state=state_f)
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(detail__icontains=search)
                | Q(assigned_to__full_name__icontains=search)
                | Q(assigned_to__email__icontains=search)
            )
        if sort:
            qs = qs.order_by(sort)
        return qs

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        task = ser.save(source="manual")
        refresh_health(task.project)
        return Response(TaskSerializer(task).data, status=http.HTTP_201_CREATED)


class TaskDetailView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "Task"
    permission_action_map = {"GET": "view", "PATCH": "edit", "DELETE": "delete"}

    def get(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        return Response(TaskSerializer(task).data)

    def patch(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        role = request.user.role
        data = dict(request.data)

        if role == "dev":
            # Dev edits only their own task, and only its status.
            if task.assigned_to_id != request.user.id:
                raise PermissionDenied("แก้ได้เฉพาะงานของตัวเอง")
            data = {k: v for k, v in data.items() if k == "status"}

        # Only verifier roles may set Verified (assignee can reach Done).
        if data.get("status") == "verified" and role not in VERIFIER_ROLES:
            raise PermissionDenied("เฉพาะผู้ตรวจเท่านั้นที่ตั้งสถานะ Verified ได้")

        ser = TaskUpdateSerializer(task, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        status_changed = "status" in ser.validated_data
        ser.save()
        if status_changed:
            refresh_health(task.project)
        return Response(TaskSerializer(task).data)

    def delete(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        project = task.project
        task.delete()  # soft-delete
        refresh_health(project)
        return Response(status=http.HTTP_204_NO_CONTENT)


class ClaimView(APIView):
    """FN-TASK-06 — claim a backlog task (self capability). 409 if already taken."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        if task.assigned_to_id is not None:
            if task.assigned_to_id == request.user.id:
                return Response(TaskSerializer(task).data)
            raise Conflict("งานนี้ถูกรับไปแล้ว")
        task.assigned_to = request.user
        task.save(update_fields=["assigned_to", "updated_at"])
        return Response(TaskSerializer(task).data)
