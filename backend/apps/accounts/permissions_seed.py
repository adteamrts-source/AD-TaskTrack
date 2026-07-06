"""
Default Simple Permission Matrix (PRD §4.1 / §4.2).

A row exists for every (role, module, action) so the Admin UI can toggle each;
`allowed` is seeded True for the grants below, False otherwise. DM is fully
under the matrix (no hardcoded bypass — PRD §5.4): it simply gets broad grants.

Notes on intentional gaps:
- User Management: Admin only.
- Budget for BSA/Dev = view only; salary/rate hidden at the serializer layer
  (FN-BUD-01), not via a separate matrix action.
- claim and own-task status changes are self-scoped capabilities
  handled in views, not Task:edit grants for everyone.
"""
from .models import PERMISSION_MODULES, RolePermission

ALL_ACTIONS = ["view", "create", "edit", "delete"]

# role -> module -> allowed actions
DEFAULT_MATRIX = {
    "admin": {m: list(ALL_ACTIONS) for m in PERMISSION_MODULES},
    "dm": {
        "Projects": ["view", "create", "edit", "delete"],
        "Task": ["view", "create", "edit", "delete"],
        "Plan/Timeline": ["view", "create", "edit", "delete"],
        "Budget": ["view", "create", "edit", "delete"],
        "My Work": ["view", "create", "edit", "delete"],
        "Meeting Summary": ["view"],
        "Client Master": ["view", "create", "edit"],
        "Team Members": ["view"],
    },
    "bsa": {
        "Projects": ["view", "edit"],
        "Task": ["view", "create", "edit", "delete"],
        "Plan/Timeline": ["view", "create", "edit", "delete"],
        "Budget": ["view"],
        "My Work": ["view", "create", "edit", "delete"],
        "Meeting Summary": ["view"],
        "Client Master": ["view", "create", "edit"],
        "Team Members": ["view"],
    },
    "dev": {
        "Projects": ["view"],
        "Task": ["view", "edit"],  # edit is object-scoped to own task in the view
        "Plan/Timeline": ["view"],
        "Budget": ["view"],
        "My Work": ["view", "create", "edit", "delete"],
        "Meeting Summary": ["view"],
        "Client Master": ["view"],
        "Team Members": ["view"],
    },
}

ROLES = ["admin", "dm", "bsa", "dev"]


def seed_role_permissions(model=RolePermission):
    """Idempotently ensure a row exists for every (role, module, action)."""
    for role in ROLES:
        granted = DEFAULT_MATRIX.get(role, {})
        for module in PERMISSION_MODULES:
            allowed_actions = set(granted.get(module, []))
            for action in ALL_ACTIONS:
                model.objects.update_or_create(
                    role=role,
                    module=module,
                    action=action,
                    defaults={"allowed": action in allowed_actions},
                )
