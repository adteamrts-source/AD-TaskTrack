from rest_framework import serializers

from apps.common.roles import can_see_money

from .models import CostItem, InfraAsset


class CostItemSerializer(serializers.ModelSerializer):
    """Full line item — only exposed to Admin/DM (FN-BUD-01)."""

    total = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)

    class Meta:
        model = CostItem
        fields = [
            "id",
            "project",
            "category",
            "label",
            "qty_or_units",
            "months",
            "rate",
            "total",
            "total_override",
            "is_outsource",
            "note",
        ]
        read_only_fields = ["id", "project", "total"]


class InfraAssetSerializer(serializers.ModelSerializer):
    """cost/billing stripped for non Admin/DM — everyone sees WHERE, not price."""

    project_name = serializers.CharField(source="project.project_name", read_only=True, default="")
    monthly_cost = serializers.SerializerMethodField()

    def get_monthly_cost(self, obj):
        return str(obj.monthly_cost())

    class Meta:
        model = InfraAsset
        fields = [
            "id",
            "name",
            "asset_type",
            "provider",
            "location",
            "environment",
            "project",
            "project_name",
            "cost",
            "billing_cycle",
            "monthly_cost",
            "start_date",
            "expires_at",
            "status",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if not (request and can_see_money(request.user)):
            data.pop("cost", None)
            data.pop("monthly_cost", None)
        return data


class CostItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CostItem
        fields = [
            "id",
            "category",
            "label",
            "qty_or_units",
            "months",
            "rate",
            "total_override",
            "is_outsource",
            "note",
        ]
        read_only_fields = ["id"]
