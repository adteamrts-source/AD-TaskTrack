"""
CostItem — pre-sale cost estimation (PRD §6.11, §7).

Estimation-only (not linked to execution). Salary/rate within Manpower is
confidential to Admin/DM; category totals and headcount are broader. The
serializer/view layer enforces that visibility (FN-BUD-01).
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class CostCategory(models.TextChoices):
    MANPOWER = "manpower", "Manpower / LOE"
    INFRA = "infra", "Server / Infrastructure"
    SUBSCRIPTION = "subscription", "Subscription / Tools"
    SYSTEM = "system", "System / Custom"
    CUSTOM = "custom", "Custom"


class AssetType(models.TextChoices):
    SERVER = "server", "Server"
    SUBSCRIPTION = "subscription", "Subscription"
    DOMAIN = "domain", "Domain"
    LICENSE = "license", "License"
    OTHER = "other", "อื่นๆ"


class AssetEnvironment(models.TextChoices):
    DEV = "dev", "Dev"
    UAT = "uat", "UAT"
    PROD = "prod", "Production"


class BillingCycle(models.TextChoices):
    ONE_TIME = "one_time", "จ่ายครั้งเดียว"
    MONTHLY = "monthly", "รายเดือน"
    YEARLY = "yearly", "รายปี"


class AssetStatus(models.TextChoices):
    ACTIVE = "active", "ใช้งานอยู่"
    CANCELLED = "cancelled", "ยกเลิกแล้ว"


class InfraAsset(BaseModel):
    """
    ทะเบียนทรัพยากรที่ซื้อ/เช่ามาจริง (actuals — คู่กับ CostItem ที่เป็นประมาณการ):
    server / subscription / domain / license อยู่ provider ไหน environment อะไร
    หมดอายุเมื่อไหร่. cost is confidential (Admin/DM) but everyone may see
    WHERE things run — the Infrastructure dashboard answers "งานอยู่ที่ไหน".
    project=NULL = ของกลางบริษัท ไม่ผูกโครงการ.
    """

    name = models.CharField(max_length=255)
    asset_type = models.CharField(max_length=16, choices=AssetType.choices, default=AssetType.SERVER)
    provider = models.CharField(max_length=128, blank=True)  # AWS / DO / on-prem ลูกค้า
    location = models.CharField(max_length=255, blank=True)  # URL / IP / host detail
    environment = models.CharField(max_length=8, choices=AssetEnvironment.choices, blank=True)
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="infra_assets"
    )
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)  # confidential
    billing_cycle = models.CharField(
        max_length=10, choices=BillingCycle.choices, default=BillingCycle.MONTHLY
    )
    start_date = models.DateField(null=True, blank=True)
    expires_at = models.DateField(null=True, blank=True)  # วันหมดอายุ/ต่ออายุ
    status = models.CharField(max_length=10, choices=AssetStatus.choices, default=AssetStatus.ACTIVE)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["expires_at", "-created_at"]

    def __str__(self):
        return f"[{self.asset_type}] {self.name}"

    def monthly_cost(self) -> Decimal:
        """Normalized cost per month; one-time purchases contribute 0."""
        if self.billing_cycle == BillingCycle.MONTHLY:
            return self.cost or Decimal("0")
        if self.billing_cycle == BillingCycle.YEARLY:
            return (self.cost or Decimal("0")) / Decimal("12")
        return Decimal("0")


class CostItem(BaseModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="cost_items"
    )
    category = models.CharField(max_length=16, choices=CostCategory.choices)
    label = models.CharField(max_length=255)
    qty_or_units = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    months = models.DecimalField(max_digits=6, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=14, decimal_places=2, default=0)  # confidential
    total_override = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    is_outsource = models.BooleanField(default=False)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["category", "id"]

    @property
    def total(self) -> Decimal:
        if self.total_override is not None:
            return self.total_override
        return (self.qty_or_units or 0) * (self.months or 0) * (self.rate or 0)

    def __str__(self):
        return f"{self.category} · {self.label}"
