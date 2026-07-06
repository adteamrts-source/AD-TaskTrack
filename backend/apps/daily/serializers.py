from decimal import Decimal
import re

from rest_framework import serializers

from apps.projects.models import Project
from apps.settings_app.services import is_working_day
from apps.tasks.models import Task

from .models import DailyEntry


def _title_from_detail(detail):
    """Derive the required compact DB title from the first useful Markdown line."""
    for raw_line in detail.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = re.sub(r"^(?:#{1,6}\s+|[-+*]\s+|\d+[.)]\s+|>\s*)", "", line)
        line = re.sub(r"!?\[([^\]]*)\]\([^)]+\)", r"\1", line)
        line = re.sub(r"[*_~`]", "", line).strip()
        if line:
            return line[:500]
    return "บันทึกงาน"


def _validate_hours(value):
    if value is None:
        return value
    if value < Decimal("0.5"):
        raise serializers.ValidationError("ชั่วโมงขั้นต่ำ 0.5")
    if (value * 2) % 1 != 0:  # must be a multiple of 0.5
        raise serializers.ValidationError("ชั่วโมงต้องเป็นพหุคูณของ 0.5")
    return value


class DailyEntrySerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.project_name", read_only=True, default="")
    task_title = serializers.CharField(source="task.title", read_only=True, default="")

    class Meta:
        model = DailyEntry
        fields = [
            "id",
            "user",
            "work_date",
            "task",
            "task_title",
            "project",
            "project_name",
            "source",
            "title",
            "detail",
            "status_snapshot",
            "hours",
            "is_ot",
            "calendar_event_id",
            "created_at",
        ]
        read_only_fields = fields


class DailyCreateSerializer(serializers.Serializer):
    work_date = serializers.DateField()
    source = serializers.ChoiceField(choices=["manual", "meeting", "plan"], default="manual")
    title = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    detail = serializers.CharField(required=False, allow_blank=True, default="")
    task_id = serializers.PrimaryKeyRelatedField(
        queryset=Task.objects.all(), source="task", required=False, allow_null=True
    )
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), source="project", required=False, allow_null=True
    )
    hours = serializers.DecimalField(max_digits=4, decimal_places=1, default=Decimal("1.0"))
    is_ot = serializers.BooleanField(required=False, allow_null=True, default=None)
    calendar_event_id = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_hours(self, value):
        return _validate_hours(value)

    def validate(self, attrs):
        task = attrs.get("task")
        title = (attrs.get("title") or "").strip()
        detail = (attrs.get("detail") or "").strip()
        # Manual entries use one editor. The compact DB title is derived later.
        if not task and not title and not detail and attrs.get("source") != "meeting":
            raise serializers.ValidationError({"detail": "กรอกรายละเอียดงาน"})
        return attrs

    def create(self, validated):
        user = self.context["request"].user
        task = validated.get("task")
        project = validated.get("project")
        title = (validated.get("title") or "").strip()
        detail = (validated.get("detail") or "").strip()
        source = validated.get("source", "manual")
        is_ot = validated.get("is_ot")

        status_snapshot = None
        if task:
            # Type A — inherit project/title, snapshot status (PRD §6.8).
            project = task.project
            title = title or task.title
            status_snapshot = task.status
            source = "plan" if task.source == "plan" else "manual"
        else:
            title = title or _title_from_detail(detail)

        if is_ot is None:
            # Default OT on holidays / non-working days (MW-13).
            is_ot = not is_working_day(validated["work_date"])

        return DailyEntry.objects.create(
            user=user,
            work_date=validated["work_date"],
            task=task,
            project=project,
            source=source,
            title=title,
            detail=detail,
            status_snapshot=status_snapshot,
            hours=validated.get("hours") or Decimal("1.0"),
            is_ot=is_ot,
            calendar_event_id=validated.get("calendar_event_id", ""),
        )


class DailyUpdateSerializer(serializers.Serializer):
    """PATCH — re-tag project / adjust hours / OT (FN-MW-04/05). Tagging a
    project never creates a Task (PRD §6.8)."""

    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), source="project", required=False, allow_null=True
    )
    hours = serializers.DecimalField(max_digits=4, decimal_places=1, required=False)
    is_ot = serializers.BooleanField(required=False)
    title = serializers.CharField(max_length=500, required=False)
    detail = serializers.CharField(required=False, allow_blank=True)

    def validate_hours(self, value):
        return _validate_hours(value)

    def update(self, instance, validated):
        if "project" in validated:
            # Only entries without a Task may be re-tagged (keep type A intact).
            if instance.task_id is not None:
                raise serializers.ValidationError(
                    {"project_id": "เปลี่ยนโครงการของ entry ที่ผูก Task ไม่ได้"}
                )
            instance.project = validated["project"]
        for f in ("hours", "is_ot", "title", "detail"):
            if f in validated:
                setattr(instance, f, validated[f])
        instance.save()
        return instance
