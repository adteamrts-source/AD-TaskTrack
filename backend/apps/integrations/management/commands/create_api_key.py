"""
Issue an external API key:

    python manage.py create_api_key "ชื่อระบบภายนอก"

Prints the raw key once — it is stored hashed and cannot be recovered.
"""
from django.core.management.base import BaseCommand

from apps.integrations.models import APIKey


class Command(BaseCommand):
    help = "สร้าง API key สำหรับระบบภายนอก (แสดง raw key ครั้งเดียว)"

    def add_arguments(self, parser):
        parser.add_argument("name", help="ชื่อระบบภายนอกที่ถือ key")

    def handle(self, *args, **options):
        instance, raw_key = APIKey.generate(name=options["name"])
        self.stdout.write(self.style.SUCCESS(f"สร้าง key '{instance.name}' แล้ว"))
        self.stdout.write(f"API key: {raw_key}")
        self.stdout.write("จดเก็บทันที — ระบบเก็บเฉพาะค่า hash และจะไม่แสดงซ้ำอีก")
