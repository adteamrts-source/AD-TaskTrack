"""
Seed demo data for local development (idempotent).

Creates the permission matrix, the initial Client Master (PRD §6.3), a few Thai
holidays, demo users for each role, and one sample project. Safe to re-run.

    python manage.py seed_demo
"""
import datetime

from django.core.management.base import BaseCommand
from django.db import transaction

# (client_name, abbreviation, website) — PRD §6.3 initial seed.
CLIENTS = [
    ("บริษัท ปตท. น้ำมันและการค้าปลีก จำกัด (มหาชน)", "PTTOR", "https://www.pttor.com"),
    ("บริษัท ไปรษณีย์ไทย จำกัด (มหาชน)", "THP", "https://www.thailandpost.co.th"),
    ("การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย", "MRTA", "https://www.mrta.co.th"),
    ("บริษัท ท่าอากาศยานไทย จำกัด (มหาชน)", "AOT", "https://www.airportthai.co.th"),
    ("สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน)", "DGA", "https://www.dga.or.th"),
    ("บริษัท อาร์ทีเอส (2003) จำกัด", "RTS", "https://www.rts2003.co.th"),
    ("ธนาคารกสิกรไทย จำกัด (มหาชน)", "KBank", "https://www.kasikornbank.com/"),
    ("TBD", "AES", ""),
    ("บริษัท อสมท จำกัด (มหาชน)", "MCOT", "https://www.mcot.net/"),
    ("บริษัท ทิพยประกันภัย จำกัด (มหาชน)", "TIP", "www.tipinsure.com/"),
]

HOLIDAYS_2026 = [
    (datetime.date(2026, 1, 1), "วันขึ้นปีใหม่", "public"),
    (datetime.date(2026, 4, 13), "วันสงกรานต์", "public"),
    (datetime.date(2026, 4, 14), "วันสงกรานต์", "public"),
    (datetime.date(2026, 4, 15), "วันสงกรานต์", "public"),
    (datetime.date(2026, 12, 31), "วันสิ้นปี", "public"),
]

DEMO_USERS = [
    ("admin@astro.local", "ผู้ดูแลระบบ", "admin"),
    ("dm@astro.local", "Delivery Manager", "dm"),
    ("bsa@astro.local", "Business Analyst", "bsa"),
    ("dev@astro.local", "นักพัฒนา", "dev"),
]


class Command(BaseCommand):
    help = "Seed demo data (clients, holidays, users, sample project)."

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.accounts.models import User
        from apps.accounts.permissions_seed import seed_role_permissions
        from apps.clients.models import Client
        from apps.projects.models import Project
        from apps.settings_app.models import Holiday

        seed_role_permissions()
        self.stdout.write("✓ permission matrix")

        for name, abbr, site in CLIENTS:
            Client.objects.get_or_create(
                client_abbreviation=abbr,
                defaults={"client_name": name, "client_website": site},
            )
        self.stdout.write(f"✓ {len(CLIENTS)} clients")

        for d, name, typ in HOLIDAYS_2026:
            Holiday.objects.get_or_create(
                holiday_date=d, defaults={"name": name, "type": typ}
            )
        self.stdout.write(f"✓ {len(HOLIDAYS_2026)} holidays")

        for email, full_name, role in DEMO_USERS:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"full_name": full_name, "role": role, "is_allowed": True},
            )
            if created:
                user.set_password("astro1234")  # dev only
                user.save(update_fields=["password"])
        self.stdout.write(f"✓ {len(DEMO_USERS)} demo users (password: astro1234)")

        client = Client.objects.filter(client_abbreviation="AOT").first()
        if client:
            project, _ = Project.objects.get_or_create(
                project_code="AOT-OSHA",
                defaults={
                    "project_name": "ระบบประเมินความเสี่ยง OSHA",
                    "client": client,
                    "project_phase": "execution",
                },
            )
            self._seed_plan(project)
            self._seed_budget(project)
            self.stdout.write("✓ sample project AOT-OSHA + plan + budget")

        self.stdout.write(self.style.SUCCESS("เสร็จสิ้น seed_demo"))

    def _seed_plan(self, project):
        from datetime import date

        from apps.plans.models import PlanItem
        from apps.plans.services import refresh_health

        # (phase, task, start, end, is_milestone, sort) — CostIT-style plan.
        rows = [
            ("1. เตรียมการ+ออกแบบ", "Project Plan / SA & Design", date(2026, 6, 1), date(2026, 6, 19), False, 1),
            ("1. เตรียมการ+ออกแบบ", "ICD & Architecture", date(2026, 6, 22), date(2026, 6, 26), True, 2),
            ("2. Development", "Master Data / Assessment Engine", date(2026, 6, 29), date(2026, 8, 7), False, 3),
            ("2. Development", "Reporting / Administrator", date(2026, 8, 10), date(2026, 9, 4), False, 4),
            ("3. ทดสอบ+ติดตั้ง", "Test / Training / Go Live", date(2026, 9, 7), date(2026, 9, 25), True, 5),
        ]
        for phase, task, sd, ed, ms, order in rows:
            from apps.settings_app.services import working_days_between

            PlanItem.objects.get_or_create(
                project=project,
                phase=phase,
                task=task,
                defaults={
                    "start_date": sd,
                    "end_date": ed,
                    "manday": working_days_between(sd, ed),
                    "input_mode": "date",
                    "is_milestone": ms,
                    "sort_order": order,
                },
            )
        refresh_health(project)

    def _seed_budget(self, project):
        from apps.budget.models import CostItem

        # (category, label, qty, months, rate, outsource)
        rows = [
            ("manpower", "Senior Developer", 2, 6, 120000, False),
            ("manpower", "Business Analyst", 1, 6, 90000, False),
            ("manpower", "QA (outsource)", 1, 3, 60000, True),
            ("infra", "VM 8 vCPU / 32GB", 1, 12, 3500, False),
            ("subscription", "GitHub Enterprise", 5, 12, 200, False),
        ]
        for cat, label, qty, months, rate, out in rows:
            CostItem.objects.get_or_create(
                project=project,
                category=cat,
                label=label,
                defaults={"qty_or_units": qty, "months": months, "rate": rate, "is_outsource": out},
            )
