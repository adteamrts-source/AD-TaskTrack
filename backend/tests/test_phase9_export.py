"""Phase 9: Plan export (Excel + PDF with embedded Thai font)."""
import datetime

import pytest

from apps.clients.models import Client
from apps.plans.models import PlanItem
from apps.projects.models import Project


pytestmark = pytest.mark.django_db


@pytest.fixture
def project_with_plan(db):
    c = Client.objects.create(client_name="ACME", client_abbreviation="ACME")
    p = Project.objects.create(project_name="ระบบทดสอบ", client=c, project_code="T-1")
    PlanItem.objects.create(
        project=p, phase="เตรียมการ", task="ออกแบบระบบ",
        start_date=datetime.date(2026, 6, 1), end_date=datetime.date(2026, 6, 5),
        manday=5, is_milestone=True,
    )
    PlanItem.objects.create(project=p, phase="พัฒนา", task="เขียนโค้ด", manday=10)
    return p


def test_export_xlsx(api, matrix, make_user, project_with_plan):
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    res = api.get(f"/api/projects/{project_with_plan.id}/plan/export?format=xlsx")
    assert res.status_code == 200
    assert "spreadsheetml" in res["Content-Type"]
    assert res.content[:2] == b"PK"  # xlsx is a zip


def test_export_pdf_with_thai_font(api, matrix, make_user, project_with_plan):
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    res = api.get(f"/api/projects/{project_with_plan.id}/plan/export?format=pdf")
    assert res.status_code == 200
    assert res["Content-Type"] == "application/pdf"
    body = b"".join(res.streaming_content) if res.streaming else res.content
    assert body[:5] == b"%PDF-"
    # Sarabun font should be embedded in the PDF.
    assert b"Sarabun" in body


def test_export_requires_plan_view_permission(api, matrix, make_user, project_with_plan):
    # Dev has Plan/Timeline:view in the seed matrix -> allowed.
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    res = api.get(f"/api/projects/{project_with_plan.id}/plan/export?format=xlsx")
    assert res.status_code == 200
