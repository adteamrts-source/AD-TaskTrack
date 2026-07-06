from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.project_name", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return ""
        return obj.assigned_to.full_name or obj.assigned_to.email

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "detail",
            "project",
            "project_name",
            "assigned_to",
            "assigned_to_name",
            "plan_item",
            "state",
            "status",
            "source",
            "estimated_manday",
            "scheduled_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "source", "created_at", "updated_at"]


class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "detail",
            "project",
            "assigned_to",
            "plan_item",
            "state",  # BSA chooses (not auto from phase)
            "estimated_manday",
            "scheduled_date",
        ]
        read_only_fields = ["id"]


class TaskUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "title",
            "detail",
            "assigned_to",
            "state",
            "status",
            "estimated_manday",
            "scheduled_date",
        ]

    def validate_assigned_to(self, value):
        if self.instance and self.instance.assigned_to_id is not None and value is None:
            raise serializers.ValidationError("กรุณาเลือกผู้รับผิดชอบคนใหม่")
        return value
