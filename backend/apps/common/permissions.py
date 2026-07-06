"""
RBAC permission classes (FN-X-02, PRD §5.4).

The `RolePermission` table is the source of truth at request time. A view
declares which module it belongs to and (optionally) overrides the
HTTP-method -> action mapping; this class looks up
RolePermission(role, module, action, allowed=True) for the caller's role.

Django's own User/Group/Permission system is NOT consulted here — it only
guards the Django Admin site (avoids dual-authority drift).
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

# Default HTTP method -> matrix action mapping.
METHOD_ACTION = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "create",
    "PUT": "edit",
    "PATCH": "edit",
    "DELETE": "delete",
}


def role_allowed(role: str, module: str, action: str) -> bool:
    """True if the matrix grants (role, module, action). Imported lazily."""
    from apps.accounts.models import RolePermission

    return RolePermission.objects.filter(
        role=role, module=module, action=action, allowed=True
    ).exists()


class HasModulePermission(BasePermission):
    """
    Configure on the view:
        permission_module = "Projects"
        permission_action_map = {"POST": "create", ...}   # optional override
    """

    message = "ไม่มีสิทธิ์ใช้งานส่วนนี้"

    def _action_for(self, view, method):
        mapping = getattr(view, "permission_action_map", None) or METHOD_ACTION
        return mapping.get(method, "view")

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        module = getattr(view, "permission_module", None)
        if module is None:
            # No module declared => fall back to authenticated-only.
            return True
        action = self._action_for(view, request.method)
        return role_allowed(user.role, module, action)


class IsSelfScoped(BasePermission):
    """
    For Daily entries / calendar (PRD §4.1): any logged-in user may act, but
    only on their own rows. Object-level check compares `obj.user`.
    """

    message = "เข้าถึงได้เฉพาะข้อมูลของตัวเอง"

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, "user", None) or getattr(obj, "user_id", None)
        owner_id = owner.id if hasattr(owner, "id") else owner
        return owner_id == request.user.id


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
