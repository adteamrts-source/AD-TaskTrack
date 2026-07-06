"""
Auth + User/Permission management API (FN-AUTH-04/05, FN-USR-01..06).

User Management endpoints are guarded by the matrix (module="User Management").
Lockout guards (409) stop an Admin from disabling the last remaining Admin or
removing the matrix rights needed to manage the matrix itself.
"""
from django.contrib.auth import logout as django_logout
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.exceptions import Conflict
from apps.common.permissions import HasModulePermission

from .models import RolePermission, User
from .serializers import (
    MeSerializer,
    RolePermissionSerializer,
    RolePermissionUpsertSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _active_admin_count(exclude_id=None):
    qs = User.objects.filter(role="admin", is_allowed=True, is_active=True)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    return qs.count()


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [HasModulePermission]
    permission_module = "User Management"

    def get_queryset(self):
        qs = User.objects.all()
        search = self.request.query_params.get("search")
        role = self.request.query_params.get("role")
        is_allowed = self.request.query_params.get("is_allowed")
        if search:
            from django.db.models import Q

            qs = qs.filter(Q(full_name__icontains=search) | Q(email__icontains=search))
        if role:
            qs = qs.filter(role=role)
        if is_allowed in ("true", "false"):
            qs = qs.filter(is_allowed=(is_allowed == "true"))
        return qs

    def get_serializer_class(self):
        return UserCreateSerializer if self.request.method == "POST" else UserSerializer


class UserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [HasModulePermission]
    permission_module = "User Management"
    queryset = User.objects.all()
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        return UserUpdateSerializer if self.request.method == "PATCH" else UserSerializer

    def perform_update(self, serializer):
        user = self.get_object()
        new_role = serializer.validated_data.get("role", user.role)
        new_allowed = serializer.validated_data.get("is_allowed", user.is_allowed)

        # Guard: don't disable / demote the last active Admin (FN-USR-03/04).
        demoting_last_admin = (
            user.role == "admin"
            and (new_role != "admin" or new_allowed is False)
            and _active_admin_count(exclude_id=user.id) == 0
        )
        if demoting_last_admin:
            raise Conflict("ไม่สามารถปิดสิทธิ์ Admin คนสุดท้ายได้")
        serializer.save()


class TeamMembersListView(generics.ListAPIView):
    """Roster of team members (FN-TEAM-01). Read-only; module=Team Members."""

    serializer_class = UserSerializer
    permission_classes = [HasModulePermission]
    permission_module = "Team Members"

    def get_queryset(self):
        qs = User.objects.filter(is_active=True)
        role = self.request.query_params.get("role")
        emp = self.request.query_params.get("employment_type")
        if role:
            qs = qs.filter(role=role)
        if emp:
            qs = qs.filter(employment_type=emp)
        return qs


class RolePermissionView(APIView):
    """GET full matrix; PATCH upserts one (role, module, action) cell."""

    permission_classes = [HasModulePermission]
    permission_module = "User Management"

    def get(self, request):
        rows = RolePermission.objects.all()
        return Response(RolePermissionSerializer(rows, many=True).data)

    def patch(self, request):
        ser = RolePermissionUpsertSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        role, module, action, allowed = (
            data["role"],
            data["module"],
            data["action"],
            data["allowed"],
        )

        # Lockout guard: Admin must keep User Management edit/view (FN-USR-06).
        if (
            role == "admin"
            and module == "User Management"
            and action in ("view", "edit")
            and allowed is False
        ):
            raise Conflict("ห้ามปิดสิทธิ์ที่ Admin ใช้จัดการ matrix")

        obj, _ = RolePermission.objects.update_or_create(
            role=role, module=module, action=action, defaults={"allowed": allowed}
        )
        return Response(RolePermissionSerializer(obj).data)
