from rest_framework import serializers

from .models import PlanItem, PlanItemDependency, PlanItemRevision
from .services import plan_item_progress


class PlanItemSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            "id",
            "project",
            "phase",
            "task",
            "manday",
            "start_date",
            "end_date",
            "input_mode",
            "is_milestone",
            "sort_order",
            "progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "input_mode", "created_at", "updated_at"]

    def get_progress(self, obj):
        return plan_item_progress(obj)


class PlanItemWriteSerializer(serializers.ModelSerializer):
    # Not a model field — required only when changing key fields (FN-PLAN-03).
    change_reason = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = PlanItem
        fields = [
            "id",
            "phase",
            "task",
            "manday",
            "start_date",
            "end_date",
            "is_milestone",
            "sort_order",
            "change_reason",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม"})
        return attrs


class DependencySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanItemDependency
        fields = [
            "id",
            "project",
            "predecessor",
            "successor",
            "relation_type",
            "lag_days",
            "created_at",
        ]
        read_only_fields = ["id", "project", "created_at"]


class RevisionSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(
        source="changed_by.full_name", read_only=True, default=""
    )

    class Meta:
        model = PlanItemRevision
        fields = [
            "id",
            "plan_item",
            "field_name",
            "old_value",
            "new_value",
            "change_reason",
            "changed_by",
            "changed_by_name",
            "changed_at",
        ]


class GenerateTasksSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["all", "selected"])
    plan_item_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    # BSA chooses the SDLC state explicitly (NOT auto from phase, PRD §6.7).
    state = serializers.ChoiceField(
        choices=["get_req", "design", "development", "test", "training", "go_live"],
        default="get_req",
    )
