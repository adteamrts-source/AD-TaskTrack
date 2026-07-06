"""
DailyEntry — the heart of ASTRO (PRD §6.8, §7).

Three kinds (set on save):
  A. has task_id      -> keeps status_snapshot (status of the Task when logged)
  B. has project only -> tagged to a project, no status
  C. general          -> neither

The kind is derived from task_id/project_id; it is not stored separately.

hours = actual effort, step 0.5, min 0.5. is_ot defaults True on a
holiday/non-working day (Working-Day Calendar) and can be toggled. Real delete
(it's the user's own row), not soft-delete.
"""
from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class DailySource(models.TextChoices):
    MANUAL = "manual", "Manual"
    MEETING = "meeting", "Meeting"
    PLAN = "plan", "Plan"


class DailyEntry(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_entries"
    )
    work_date = models.DateField()
    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="daily_entries"
    )
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="daily_entries"
    )
    source = models.CharField(max_length=8, choices=DailySource.choices, default=DailySource.MANUAL)
    title = models.CharField(max_length=500)
    detail = models.TextField(blank=True)
    # Task status captured at log time (type A only) — Meeting Summary uses this.
    status_snapshot = models.CharField(max_length=12, null=True, blank=True)
    hours = models.DecimalField(max_digits=4, decimal_places=1, default=1.0)
    is_ot = models.BooleanField(default=False)
    calendar_event_id = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "work_date"])]

    def __str__(self):
        return f"{self.user_id} · {self.work_date} · {self.title[:30]}"


class WorkSummaryNote(BaseModel):
    """
    ประเด็นนำเสนอ — the talking points a user prepares next to their
    per-project work table in "สรุปงานของฉัน" (issues, extra requests, next
    steps). A period LOG: many notes per (user, project), each stamped by
    created_at; writing in a new period adds a note, history is preserved.
    project=NULL is the general bucket. body holds rich-text HTML from the
    TipTap editor (sanitized client-side on render; legacy rows may be plain
    text). My-summary and Meeting Summary filter by created_at in range.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="work_summary_notes"
    )
    project = models.ForeignKey(
        "projects.Project",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="work_summary_notes",
    )
    body = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id} · {self.project_id or 'general'} · {self.body[:30]}"
