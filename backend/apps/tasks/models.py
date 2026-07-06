"""
Task (PRD §6.7, §7). Two independent axes:
- state  = SDLC stage, chosen by BSA when splitting/creating (NOT auto from phase)
- status = work state; PlanItem progress counts only `verified`.
Soft-deleted via deleted_at.
"""
from django.conf import settings
from django.db import models

from apps.common.models import SoftDeleteModel


class TaskState(models.TextChoices):
    GET_REQ = "get_req", "Get Req"
    DESIGN = "design", "Design"
    DEVELOPMENT = "development", "Development"
    TEST = "test", "Test"
    TRAINING = "training", "Training"
    GO_LIVE = "go_live", "Go Live"


class TaskStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not Started"
    WORKING = "working", "Working"
    STUCK = "stuck", "Stuck"
    DONE = "done", "Done"
    VERIFIED = "verified", "Verified"


class TaskSource(models.TextChoices):
    MANUAL = "manual", "Manual"
    MEETING = "meeting", "Meeting"
    PLAN = "plan", "Plan"
    EXTERNAL = "external", "External"  # pushed in via /api/external/v1


class Task(SoftDeleteModel):
    title = models.CharField(max_length=255)
    detail = models.TextField(blank=True)
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="tasks"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_tasks",
    )
    plan_item = models.ForeignKey(
        "plans.PlanItem",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks",
    )
    state = models.CharField(
        max_length=12, choices=TaskState.choices, default=TaskState.GET_REQ
    )
    status = models.CharField(
        max_length=12, choices=TaskStatus.choices, default=TaskStatus.NOT_STARTED
    )
    source = models.CharField(
        max_length=8, choices=TaskSource.choices, default=TaskSource.MANUAL
    )
    estimated_manday = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    scheduled_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
