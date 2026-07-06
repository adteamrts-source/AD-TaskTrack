"""
Working-Day Calendar + system config (PRD §5.7, §6.15).

Holiday: Thai public + company holidays, managed in Django Admin. Working day =
Mon–Fri not in this list. Used by manday calc, delay_days/health, missing
submission, and the Daily Task day picker / is_ot default.

SystemSetting: key–value config (HOURS_PER_WORKING_DAY, health thresholds).
"""
from django.conf import settings
from django.db import models


class HolidayType(models.TextChoices):
    PUBLIC = "public", "วันหยุดราชการ"
    COMPANY = "company", "วันหยุดบริษัท"


class Holiday(models.Model):
    holiday_date = models.DateField(unique=True)
    name = models.CharField(max_length=255)
    type = models.CharField(
        max_length=10, choices=HolidayType.choices, default=HolidayType.PUBLIC
    )

    class Meta:
        ordering = ["holiday_date"]

    def __str__(self):
        return f"{self.holiday_date} — {self.name}"


class SystemSetting(models.Model):
    key = models.CharField(max_length=64, unique=True)
    value = models.CharField(max_length=255)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"{self.key} = {self.value}"
