"""
Project + ProjectTeamMember (PRD §3, §6.4, §7).

project_phase = business lifecycle; health_status / delay_days are DERIVED
(system-maintained, never user-entered — §3.2). They are stored here as a
cache that Phase 3 refreshes when plan/task/progress change.
"""
from django.conf import settings
from django.db import models

from apps.common.models import BaseModel, SoftDeleteModel


class ProjectPhase(models.TextChoices):
    PRE_SALE = "pre_sale", "Pre-sale"
    EXECUTION = "execution", "Execution"
    MA = "ma", "MA"
    CLOSED = "closed", "Closed"
    CANCELLED = "cancelled", "Cancelled"


class HealthStatus(models.TextChoices):
    NOT_STARTED = "not_started", "ยังไม่เริ่ม"
    ON_PLAN = "on_plan", "ตามแผน"
    AT_RISK = "at_risk", "เสี่ยง"
    DELAY = "delay", "ล่าช้า"
    COMPLETED = "completed", "เสร็จสมบูรณ์"


class Project(SoftDeleteModel):
    project_name = models.CharField(max_length=255)
    project_code = models.CharField(max_length=64, null=True, blank=True, unique=True)
    client = models.ForeignKey(
        "clients.Client", on_delete=models.PROTECT, related_name="projects"
    )
    # Confidential — exposed only to Admin/DM (serializer-level, PRD §6.4).
    value_thb = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    po_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="po_projects",
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    project_phase = models.CharField(
        max_length=12, choices=ProjectPhase.choices, default=ProjectPhase.PRE_SALE
    )

    # --- derived (system-maintained) ---
    health_status = models.CharField(
        max_length=12, choices=HealthStatus.choices, default=HealthStatus.NOT_STARTED
    )
    health_reason = models.CharField(max_length=255, blank=True)
    delay_days = models.IntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.project_code or self.project_name


class RiskSeverity(models.TextChoices):
    LOW = "low", "ต่ำ"
    MEDIUM = "medium", "ปานกลาง"
    HIGH = "high", "สูง"


class RiskStatus(models.TextChoices):
    OPEN = "open", "เปิดอยู่"
    MONITORING = "monitoring", "เฝ้าระวัง"
    CLOSED = "closed", "ปิดแล้ว"


class Risk(BaseModel):
    """
    Lightweight per-project risk register: what the risk is, how severe, and
    how it's being handled. Every create / severity / status / mitigation
    change is appended to RiskLog so the history reads as a log.
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="risks")
    title = models.CharField(max_length=255)
    detail = models.TextField(blank=True)
    severity = models.CharField(
        max_length=8, choices=RiskSeverity.choices, default=RiskSeverity.MEDIUM
    )
    status = models.CharField(
        max_length=12, choices=RiskStatus.choices, default=RiskStatus.OPEN
    )
    mitigation = models.TextField(blank=True)  # จัดการยังไง
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.project_id} · [{self.severity}] {self.title[:40]}"


class RiskLog(models.Model):
    risk = models.ForeignKey(Risk, on_delete=models.CASCADE, related_name="logs")
    action = models.CharField(max_length=32)  # created | severity | status | mitigation
    detail = models.TextField(blank=True)  # "เก่า → ใหม่"
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]

    def __str__(self):
        return f"{self.risk_id} · {self.action} @ {self.at:%Y-%m-%d}"


class ProjectTeamMember(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="team_members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_memberships"
    )
    role_in_project = models.CharField(max_length=128, blank=True)
    responsibilities = models.TextField(blank=True)
    allocation_percentage = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        unique_together = ("project", "user")
        ordering = ["project", "user"]

    def __str__(self):
        return f"{self.user} @ {self.project}"
