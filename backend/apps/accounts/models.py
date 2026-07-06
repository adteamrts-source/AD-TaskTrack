"""
User + RolePermission (PRD §7, §4).

User: email-identified (Google login), carries the ASTRO `role`. The role is
what the RBAC matrix keys on — Django's is_staff/is_superuser only gate the
Admin site.

RolePermission: the Simple Permission Matrix (role x module x action) that is
the source of truth for the API (PRD §5.4).
"""
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.common.models import BaseModel

from .managers import UserManager


class Role(models.TextChoices):
    ADMIN = "admin", "Admin"
    DM = "dm", "DM"
    BSA = "bsa", "BSA"
    DEV = "dev", "Dev"


class EmploymentType(models.TextChoices):
    PERMANENT = "permanent", "Permanent"
    CONTRACTOR = "contractor", "Contractor"


class PermissionAction(models.TextChoices):
    VIEW = "view", "View"
    CREATE = "create", "Create"
    EDIT = "edit", "Edit"
    DELETE = "delete", "Delete"


# Modules covered by the matrix (PRD §4.1 / Functions Design §2.4).
PERMISSION_MODULES = [
    "Projects",
    "Task",
    "Plan/Timeline",
    "Budget",
    "My Work",
    "Meeting Summary",
    "Client Master",
    "User Management",
    "Team Members",
]


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.DEV)
    position = models.CharField(max_length=255, blank=True)
    employment_type = models.CharField(
        max_length=12,
        choices=EmploymentType.choices,
        default=EmploymentType.PERMANENT,
    )
    # Allowlist: only is_allowed users may log in (PRD §6.1).
    is_allowed = models.BooleanField(default=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django Admin access only

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # email + password only for createsuperuser

    class Meta:
        ordering = ["full_name", "email"]

    def __str__(self):
        return self.full_name or self.email

    def get_full_name(self):
        return self.full_name or self.email

    def get_short_name(self):
        return self.full_name.split(" ")[0] if self.full_name else self.email


class RolePermission(models.Model):
    """One row per (role, module, action); `allowed` toggles the grant."""

    role = models.CharField(max_length=10, choices=Role.choices)
    module = models.CharField(max_length=64)
    action = models.CharField(max_length=10, choices=PermissionAction.choices)
    allowed = models.BooleanField(default=False)

    class Meta:
        unique_together = ("role", "module", "action")
        ordering = ["role", "module", "action"]

    def __str__(self):
        mark = "✓" if self.allowed else "✗"
        return f"{mark} {self.role}:{self.module}:{self.action}"
