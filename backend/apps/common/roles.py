"""
Confidentiality helpers (PRD §6.4 / §6.11).

Pre-sale money — project value and Manpower salary/rate — is visible only to
Admin/DM. Headcount and category totals are broader. Keep the rule in one place
so Project and Budget serializers agree.
"""

MONEY_ROLES = {"admin", "dm"}


def can_see_money(user) -> bool:
    """True if the user may see confidential pre-sale money (value/rate/salary)."""
    return bool(user and getattr(user, "role", None) in MONEY_ROLES)
