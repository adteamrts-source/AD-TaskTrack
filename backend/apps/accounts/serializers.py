from allauth.socialaccount.models import SocialToken
from rest_framework import serializers

from .models import PERMISSION_MODULES, PermissionAction, Role, RolePermission, User


class UserSerializer(serializers.ModelSerializer):
    """Read shape for user lists / detail (FN-USR-01)."""

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "position",
            "employment_type",
            "is_allowed",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserCreateSerializer(serializers.ModelSerializer):
    """Create user + allowlist entry (FN-USR-02). Email must be unique."""

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "position",
            "employment_type",
            "is_allowed",
        ]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("อีเมลนี้มีอยู่แล้ว")
        return value.lower()


class UserUpdateSerializer(serializers.ModelSerializer):
    """Edit role / type / allowlist (FN-USR-03). Email is immutable identity."""

    class Meta:
        model = User
        fields = ["full_name", "role", "position", "employment_type", "is_allowed"]


class MeSerializer(serializers.ModelSerializer):
    """Current user + the allowed (module, action) pairs the SPA uses to
    show/hide menus (FN-AUTH-05)."""

    permissions = serializers.SerializerMethodField()
    calendar_connected = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "position",
            "employment_type",
            "permissions",
            "calendar_connected",
        ]

    def get_permissions(self, obj):
        rows = RolePermission.objects.filter(role=obj.role, allowed=True).values(
            "module", "action"
        )
        return list(rows)

    def get_calendar_connected(self, obj):
        # Calendar access requires the OAuth token, not only a linked identity.
        return SocialToken.objects.filter(
            account__user=obj,
            account__provider="google",
        ).exists()


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ["id", "role", "module", "action", "allowed"]
        read_only_fields = ["id"]


class RolePermissionUpsertSerializer(serializers.Serializer):
    """Input for toggling one matrix cell (FN-USR-06). A plain Serializer so the
    ModelSerializer's UniqueTogetherValidator doesn't block upserting an
    existing (role, module, action) row."""

    role = serializers.ChoiceField(choices=Role.choices)
    module = serializers.CharField()
    action = serializers.ChoiceField(choices=PermissionAction.choices)
    allowed = serializers.BooleanField()

    def validate_module(self, value):
        if value not in PERMISSION_MODULES:
            raise serializers.ValidationError("ไม่รู้จัก module นี้")
        return value
