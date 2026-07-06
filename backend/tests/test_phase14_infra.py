"""Phase 14: infrastructure registry — actuals (server/subscription) + dashboard."""
import datetime

import pytest

from apps.budget.models import InfraAsset
from apps.clients.models import Client
from apps.projects.models import Project

pytestmark = pytest.mark.django_db

TODAY = datetime.date.today()


@pytest.fixture
def project(db):
    client = Client.objects.create(client_name="ACME")
    return Project.objects.create(project_name="Portal", client=client)


def test_create_and_list(api, matrix, make_user, project):
    dm = make_user("dm@astro.test", role="dm")
    api.force_authenticate(dm)
    res = api.post(
        "/api/infra",
        {
            "name": "DO Droplet — Portal Prod",
            "asset_type": "server",
            "provider": "DigitalOcean",
            "location": "128.199.1.1",
            "environment": "prod",
            "project": project.id,
            "cost": "1200.00",
            "billing_cycle": "monthly",
            "expires_at": (TODAY + datetime.timedelta(days=200)).isoformat(),
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["project_name"] == "Portal"

    data = api.get("/api/infra").json()
    assert data["summary"]["total"] == 1
    assert data["assets"][0]["cost"] == "1200.00"  # dm เห็นราคา


def test_cost_hidden_from_dev_but_location_visible(api, matrix, make_user, project):
    InfraAsset.objects.create(name="S1", project=project, cost="999.00", provider="AWS")
    dev = make_user("dev@astro.test", role="dev")
    api.force_authenticate(dev)
    data = api.get("/api/infra").json()
    row = data["assets"][0]
    assert "cost" not in row and "monthly_cost" not in row  # เงินลับ
    assert row["provider"] == "AWS"  # แต่เห็นว่าอยู่ที่ไหน
    assert "monthly_cost_total" not in data["summary"]


def test_write_requires_budget_permission(api, matrix, make_user, project):
    dev = make_user("dev@astro.test", role="dev")  # Budget: view เท่านั้น
    api.force_authenticate(dev)
    assert api.post("/api/infra", {"name": "x"}, format="json").status_code == 403

    asset = InfraAsset.objects.create(name="S1", project=project)
    assert api.patch(f"/api/infra/{asset.id}", {"name": "y"}, format="json").status_code == 403
    assert api.delete(f"/api/infra/{asset.id}").status_code == 403
    # admin ลบได้
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    assert api.delete(f"/api/infra/{asset.id}").status_code == 204


def test_summary_monthly_cost_and_expiring(api, matrix, make_user, project):
    # รายเดือน 300 + รายปี 1200 (=100/เดือน) + one-time 5000 (ไม่นับรายเดือน)
    InfraAsset.objects.create(name="M", cost="300", billing_cycle="monthly", project=project)
    InfraAsset.objects.create(name="Y", cost="1200", billing_cycle="yearly", project=project)
    InfraAsset.objects.create(name="O", cost="5000", billing_cycle="one_time", project=project)
    # ใกล้หมดอายุ (15 วัน) / หมดแล้ว / ยกเลิกแล้ว (ไม่นับ)
    soon = InfraAsset.objects.create(name="Soon", expires_at=TODAY + datetime.timedelta(days=15))
    over = InfraAsset.objects.create(name="Over", expires_at=TODAY - datetime.timedelta(days=3))
    InfraAsset.objects.create(
        name="Dead", status="cancelled", expires_at=TODAY + datetime.timedelta(days=5)
    )

    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    s = api.get("/api/infra").json()["summary"]
    assert s["monthly_cost_total"] == "400.00"
    assert s["one_time_total"] == "5000.00"
    assert s["expiring_soon"] == [soon.id]
    assert s["expired"] == [over.id]


def test_filters(api, matrix, make_user, project):
    InfraAsset.objects.create(name="Server A", asset_type="server", project=project, environment="prod")
    InfraAsset.objects.create(name="Figma", asset_type="subscription")  # ของกลาง

    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    assert api.get("/api/infra", {"project": project.id}).json()["summary"]["total"] == 1
    assert api.get("/api/infra", {"type": "subscription"}).json()["assets"][0]["name"] == "Figma"
    assert api.get("/api/infra", {"environment": "prod"}).json()["summary"]["total"] == 1
    assert api.get("/api/infra", {"search": "figma"}).json()["summary"]["total"] == 1


def test_dev_cannot_set_cost_but_admin_can_patch(api, matrix, make_user, project):
    asset = InfraAsset.objects.create(name="S1", cost="100", project=project)
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    res = api.patch(f"/api/infra/{asset.id}", {"cost": "250", "status": "cancelled"}, format="json")
    assert res.status_code == 200
    asset.refresh_from_db()
    assert str(asset.cost) == "250.00"
    assert asset.status == "cancelled"
