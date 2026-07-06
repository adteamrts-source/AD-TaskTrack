"""Phase 13: lightweight risk register + change log."""
import pytest

from apps.accounts.models import RolePermission
from apps.clients.models import Client
from apps.projects.models import Project, Risk, RiskLog

pytestmark = pytest.mark.django_db


@pytest.fixture
def project(db):
    client = Client.objects.create(client_name="ACME")
    return Project.objects.create(project_name="Portal", client=client)


def test_create_risk_appends_created_log(api, matrix, make_user, project):
    dm = make_user("dm@astro.test", role="dm", full_name="DM One")
    api.force_authenticate(dm)
    res = api.post(
        f"/api/projects/{project.id}/risks",
        {"title": "ลูกค้าเลื่อน UAT", "severity": "high", "mitigation": "นัดใหม่ภายใน 2 สัปดาห์"},
        format="json",
    )
    assert res.status_code == 201
    data = res.json()
    assert data["severity"] == "high"
    assert data["status"] == "open"
    assert data["created_by_name"] == "DM One"
    assert [log["action"] for log in data["logs"]] == ["created"]


def test_tracked_changes_append_logs(api, matrix, make_user, project):
    dm = make_user("dm@astro.test", role="dm")
    risk = Risk.objects.create(project=project, title="R1", severity="medium", mitigation="เดิม")
    api.force_authenticate(dm)

    res = api.patch(
        f"/api/risks/{risk.id}",
        {"severity": "high", "status": "monitoring", "mitigation": "ใหม่"},
        format="json",
    )
    assert res.status_code == 200
    actions = set(RiskLog.objects.filter(risk=risk).values_list("action", flat=True))
    assert actions == {"severity", "status", "mitigation"}
    sev_log = RiskLog.objects.get(risk=risk, action="severity")
    assert sev_log.detail == "medium → high"

    # PATCH ที่ไม่เปลี่ยนค่า → ไม่เพิ่ม log
    count = RiskLog.objects.filter(risk=risk).count()
    api.patch(f"/api/risks/{risk.id}", {"severity": "high"}, format="json")
    assert RiskLog.objects.filter(risk=risk).count() == count

    # title เปลี่ยนได้แต่ไม่ log (track เฉพาะ severity/status/mitigation)
    api.patch(f"/api/risks/{risk.id}", {"title": "R1 แก้ชื่อ"}, format="json")
    assert RiskLog.objects.filter(risk=risk).count() == count


def test_role_permissions(api, matrix, make_user, project):
    dev = make_user("dev@astro.test", role="dev")
    bsa = make_user("bsa@astro.test", role="bsa")
    risk = Risk.objects.create(project=project, title="R1")

    # dev: อ่านได้ เขียนไม่ได้ (Projects: view เท่านั้น)
    api.force_authenticate(dev)
    assert api.get(f"/api/projects/{project.id}/risks").status_code == 200
    assert api.post(f"/api/projects/{project.id}/risks", {"title": "x"}, format="json").status_code == 403
    assert api.patch(f"/api/risks/{risk.id}", {"status": "closed"}, format="json").status_code == 403
    assert api.delete(f"/api/risks/{risk.id}").status_code == 403

    # bsa: บันทึก/แก้ได้ (POST map เป็น Projects:edit) แต่ลบไม่ได้ (ไม่มี Projects:delete)
    api.force_authenticate(bsa)
    assert api.post(f"/api/projects/{project.id}/risks", {"title": "จาก BSA"}, format="json").status_code == 201
    assert api.patch(f"/api/risks/{risk.id}", {"status": "monitoring"}, format="json").status_code == 200
    assert api.delete(f"/api/risks/{risk.id}").status_code == 403


def test_delete_cascades_logs(api, matrix, make_user, project):
    admin = make_user("admin@astro.test", role="admin")
    risk = Risk.objects.create(project=project, title="R1")
    RiskLog.objects.create(risk=risk, action="created")
    api.force_authenticate(admin)
    assert api.delete(f"/api/risks/{risk.id}").status_code == 204
    assert not RiskLog.objects.filter(risk_id=risk.id).exists()


def test_list_embeds_latest_5_logs_and_full_history_endpoint(api, matrix, make_user, project):
    dm = make_user("dm@astro.test", role="dm")
    risk = Risk.objects.create(project=project, title="R1")
    for i in range(7):
        RiskLog.objects.create(risk=risk, action="status", detail=f"log {i}")

    api.force_authenticate(dm)
    row = api.get(f"/api/projects/{project.id}/risks").json()[0]
    assert len(row["logs"]) == 5  # embed เฉพาะล่าสุด

    full = api.get(f"/api/risks/{risk.id}/logs").json()
    assert len(full) == 7


def test_invalid_severity_rejected(api, matrix, make_user, project):
    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    res = api.post(
        f"/api/projects/{project.id}/risks", {"title": "x", "severity": "extreme"}, format="json"
    )
    assert res.status_code == 400
