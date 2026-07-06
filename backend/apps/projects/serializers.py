from rest_framework import serializers

from apps.common.roles import can_see_money

from .models import Project, ProjectTeamMember, Risk, RiskLog


class ProjectSerializer(serializers.ModelSerializer):
    """List / detail. value_thb is stripped for non Admin/DM (PRD §6.4)."""

    client_name = serializers.CharField(source="client.client_name", read_only=True)
    client_abbreviation = serializers.CharField(
        source="client.client_abbreviation", read_only=True
    )
    po_name = serializers.CharField(source="po_user.full_name", read_only=True, default="")
    # Progress is computed in Phase 3; null until PlanItems/Tasks exist.
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "project_name",
            "project_code",
            "client",
            "client_name",
            "client_abbreviation",
            "value_thb",
            "po_user",
            "po_name",
            "start_date",
            "end_date",
            "project_phase",
            "health_status",
            "health_reason",
            "delay_days",
            "progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "health_status",
            "health_reason",
            "delay_days",
            "created_at",
            "updated_at",
        ]

    def get_progress(self, obj):
        from apps.plans.services import project_progress

        return project_progress(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if not (request and can_see_money(request.user)):
            data.pop("value_thb", None)
        return data


class ProjectWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "project_name",
            "project_code",
            "client",
            "value_thb",
            "po_user",
            "start_date",
            "end_date",
            "project_phase",
        ]
        read_only_fields = ["id"]

    def validate_project_code(self, value):
        if value in ("", None):
            return None
        qs = Project.all_objects.filter(project_code__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("รหัสโครงการนี้ถูกใช้แล้ว")
        return value

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม"}
            )
        # Only Admin/DM may set the confidential project value (PRD §6.4).
        request = self.context.get("request")
        if "value_thb" in attrs and not (request and can_see_money(request.user)):
            attrs.pop("value_thb")
        return attrs


class RiskLogSerializer(serializers.ModelSerializer):
    by_name = serializers.SerializerMethodField()

    def get_by_name(self, obj):
        if not obj.by:
            return ""
        return obj.by.full_name or obj.by.email

    class Meta:
        model = RiskLog
        fields = ["id", "action", "detail", "by", "by_name", "at"]


class RiskSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    logs = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return obj.created_by.full_name or obj.created_by.email

    def get_logs(self, obj):
        # Latest 5 embedded; full history via /api/risks/<id>/logs.
        return RiskLogSerializer(obj.logs.all()[:5], many=True).data

    class Meta:
        model = Risk
        fields = [
            "id",
            "project",
            "title",
            "detail",
            "severity",
            "status",
            "mitigation",
            "created_by",
            "created_by_name",
            "logs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "created_by", "created_at", "updated_at"]


class RiskWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Risk
        fields = ["title", "detail", "severity", "status", "mitigation"]


class ProjectTeamMemberSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    user_role = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model = ProjectTeamMember
        fields = [
            "id",
            "project",
            "user",
            "full_name",
            "email",
            "user_role",
            "role_in_project",
            "responsibilities",
            "allocation_percentage",
        ]
        read_only_fields = ["id", "project"]
