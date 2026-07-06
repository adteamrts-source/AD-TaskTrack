"""
Recompute health_status/delay_days for all live projects.

health depends on TODAY (expected progress moves daily) but is only refreshed
on writes — an untouched project would never turn "ล่าช้า" on its own. Run this
daily, e.g. crontab:

    0 6 * * * cd /path/to/backend && ./venv/bin/python manage.py recompute_health
"""
from django.core.management.base import BaseCommand

from apps.plans.services import refresh_health
from apps.projects.models import Project


class Command(BaseCommand):
    help = "คำนวณสถานะสุขภาพโครงการใหม่ทุกโครงการที่ยังไม่ปิด (ควรตั้ง cron รันทุกเช้า)"

    def handle(self, *args, **options):
        qs = Project.objects.exclude(project_phase__in=["closed", "cancelled"])
        changed = 0
        for project in qs:
            before = (project.health_status, project.delay_days)
            refresh_health(project)
            if (project.health_status, project.delay_days) != before:
                changed += 1
                self.stdout.write(
                    f"  {project.project_name}: {before[0]} -> {project.health_status}"
                )
        self.stdout.write(self.style.SUCCESS(f"ตรวจ {qs.count()} โครงการ, เปลี่ยน {changed}"))
