"""Phase 13: client-facing progress report PDF."""
import datetime

import pytest

from apps.clients.models import Client
from apps.plans.models import PlanItem
from apps.projects.models import Project

pytestmark = pytest.mark.django_db


@pytest.fixture
def project(db, make_user):
    client = Client.objects.create(client_name="ACME จำกัด")
    po = make_user("po@astro.test", role="dm", full_name="พีโอ หนึ่ง")
    return Project.objects.create(
        project_name="ระบบ CRM", project_code="CRM-01", client=client, po_user=po,
        start_date=datetime.date(2026, 6, 1), end_date=datetime.date(2026, 12, 30),
    )


def test_progress_report_pdf_with_thai_font(api, matrix, make_user, project):
    PlanItem.objects.create(
        project=project, phase="ออกแบบ", task="ออกแบบหน้าจอ",
        start_date=datetime.date(2026, 6, 1), end_date=datetime.date(2026, 6, 30),
        manday=10, is_milestone=True,
    )
    PlanItem.objects.create(
        project=project, phase="พัฒนา", task="เขียนโปรแกรม",
        start_date=datetime.date(2026, 7, 1), end_date=datetime.date(2026, 9, 30),
        manday=40,
    )
    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    res = api.get(f"/api/projects/{project.id}/progress-report")
    assert res.status_code == 200
    assert res["Content-Type"] == "application/pdf"
    body = b"".join(res.streaming_content) if res.streaming else res.content
    assert body.startswith(b"%PDF-")
    assert b"Sarabun" in body


def test_report_without_plan_items_still_renders(api, matrix, make_user, project):
    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    res = api.get(f"/api/projects/{project.id}/progress-report")
    assert res.status_code == 200
    assert res.content.startswith(b"%PDF-")


def test_report_paginates_large_gantt(api, matrix, make_user, project):
    """A Drawing cannot split itself; a large plan must be chunked by page."""
    for index in range(40):
        PlanItem.objects.create(
            project=project,
            phase=f"Phase {index}",
            task=f"Task {index}",
            start_date=datetime.date(2026, 6, 1) + datetime.timedelta(days=index),
            end_date=datetime.date(2026, 6, 5) + datetime.timedelta(days=index),
            manday=5,
            sort_order=index,
        )

    api.force_authenticate(make_user("large-report@astro.test", role="dm"))
    res = api.get(f"/api/projects/{project.id}/progress-report")

    assert res.status_code == 200
    assert res["Content-Type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_report_permission_is_projects_view(api, matrix, make_user, project):
    # dev มี Projects:view → ออกเอกสารได้ (ทุกคนที่เปิดโครงการได้)
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    assert api.get(f"/api/projects/{project.id}/progress-report").status_code == 200


def test_report_requires_auth(api, matrix, project):
    res = api.get(f"/api/projects/{project.id}/progress-report")
    assert res.status_code in (401, 403)
