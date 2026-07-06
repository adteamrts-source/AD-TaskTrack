"""
Inbound payloads (create-only, v1). Client resolution: match by
client_abbreviation (iexact) first, then client_name (iexact); otherwise the
client is auto-created — the caller shouldn't need to sync the client master
before pushing a project.
"""
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.accounts.models import User
from apps.clients.models import Client
from apps.projects.models import Project, ProjectPhase
from apps.tasks.models import Task, TaskState


class ExternalClientSerializer(serializers.Serializer):
    client_name = serializers.CharField(max_length=255)
    client_abbreviation = serializers.CharField(
        max_length=64, required=False, allow_blank=True, allow_null=True
    )


class ExternalProjectCreateSerializer(serializers.Serializer):
    project_name = serializers.CharField(max_length=255)
    project_code = serializers.CharField(
        max_length=64, required=False, allow_blank=True, allow_null=True
    )
    client = ExternalClientSerializer()
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    project_phase = serializers.ChoiceField(
        choices=ProjectPhase.choices, required=False, default=ProjectPhase.PRE_SALE
    )

    def to_internal_value(self, data):
        # Accept `"client": "Beta Co"` shorthand alongside the nested object.
        if isinstance(data.get("client"), str):
            data = {**data, "client": {"client_name": data["client"]}}
        return super().to_internal_value(data)

    def validate_project_code(self, value):
        if value in ("", None):
            return None
        if Project.all_objects.filter(project_code__iexact=value).exists():
            # View maps this marker to 409 Conflict.
            raise serializers.ValidationError("duplicate_project_code")
        return value

    def validate(self, attrs):
        start, end = attrs.get("start_date"), attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม"})
        return attrs

    def create(self, validated_data):
        client_data = validated_data.pop("client")
        abbreviation = client_data.get("client_abbreviation") or None
        client = None
        if abbreviation:
            client = Client.objects.filter(
                client_abbreviation__iexact=abbreviation
            ).first()
        if client is None:
            client = Client.objects.filter(
                client_name__iexact=client_data["client_name"]
            ).first()
        client_created = client is None
        if client_created:
            client = Client.objects.create(
                client_name=client_data["client_name"],
                client_abbreviation=abbreviation,
            )
        project = Project.objects.create(client=client, **validated_data)
        project._client_created = client_created  # for the response payload
        return project


class ExternalTaskCreateSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=False)
    project_code = serializers.CharField(max_length=64, required=False)
    title = serializers.CharField(max_length=255)
    detail = serializers.CharField(required=False, allow_blank=True, default="")
    state = serializers.ChoiceField(
        choices=TaskState.choices, required=False, default=TaskState.GET_REQ
    )
    assignee_email = serializers.EmailField(required=False, allow_null=True)
    estimated_manday = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, allow_null=True
    )
    scheduled_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("project_id") and not attrs.get("project_code"):
            raise serializers.ValidationError(
                {"project_code": "ต้องระบุ project_code หรือ project_id อย่างใดอย่างหนึ่ง"}
            )
        return attrs

    def create(self, validated_data):
        code = validated_data.pop("project_code", None)
        project_id = validated_data.pop("project_id", None)
        qs = Project.objects.all()
        project = (
            qs.filter(project_code__iexact=code).first()
            if code
            else qs.filter(pk=project_id).first()
        )
        if project is None:
            raise NotFound("ไม่พบโครงการตาม project_code / project_id ที่ระบุ")

        assignee = None
        email = validated_data.pop("assignee_email", None)
        if email:
            assignee = User.objects.filter(email__iexact=email, is_active=True).first()

        task = Task.objects.create(
            project=project,
            assigned_to=assignee,
            source="external",
            **validated_data,
        )
        task._assignee_matched = bool(assignee) if email else None
        return task
