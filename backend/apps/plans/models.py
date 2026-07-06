"""
Plan / Timeline (PRD §6.5, §7).

PlanItem: Phase -> task with manday. manday auto-computes from start/end as
working days (§6.5) when both are present; otherwise the user-entered manday is
the effort estimate. is_milestone marks the items health status is measured at.

PlanItemDependency: supports the four standard dependency relations (FS, SS,
FF, SF), including positive lag and negative lead. Circular dependencies are
rejected at the API layer.

PlanItemRevision: audit of every change; change_reason is required for key
fields (manday/dates/phase/scope).
"""
from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class InputMode(models.TextChoices):
    MANDAY = "manday", "Manday"
    DATE = "date", "Date"
    AUTO = "auto", "Auto"


class RelationType(models.TextChoices):
    FINISH_TO_START = "finish_to_start", "Finish to Start"
    START_TO_START = "start_to_start", "Start to Start"
    FINISH_TO_FINISH = "finish_to_finish", "Finish to Finish"
    START_TO_FINISH = "start_to_finish", "Start to Finish"


# Fields whose change requires a reason (PRD §6.5 Plan Revision).
REVISION_REQUIRED_FIELDS = {"manday", "start_date", "end_date", "phase", "task"}


class PlanItem(BaseModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="plan_items"
    )
    phase = models.CharField(max_length=255)  # free-text phase name (Thai)
    task = models.CharField(max_length=255)
    manday = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    input_mode = models.CharField(
        max_length=8, choices=InputMode.choices, default=InputMode.MANDAY
    )
    is_milestone = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.phase} · {self.task}"


class PlanItemDependency(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="dependencies"
    )
    predecessor = models.ForeignKey(
        PlanItem, on_delete=models.CASCADE, related_name="successor_links"
    )
    successor = models.ForeignKey(
        PlanItem, on_delete=models.CASCADE, related_name="predecessor_links"
    )
    relation_type = models.CharField(
        max_length=16, choices=RelationType.choices, default=RelationType.FINISH_TO_START
    )
    lag_days = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("predecessor", "successor")

    def __str__(self):
        return f"{self.predecessor_id} -> {self.successor_id}"


class PlanItemRevision(models.Model):
    plan_item = models.ForeignKey(
        PlanItem, on_delete=models.CASCADE, related_name="revisions"
    )
    field_name = models.CharField(max_length=64)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    change_reason = models.CharField(max_length=255, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]

    def __str__(self):
        return f"{self.plan_item_id}.{self.field_name} @ {self.changed_at:%Y-%m-%d}"
