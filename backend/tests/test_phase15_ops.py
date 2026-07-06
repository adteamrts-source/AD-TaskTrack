"""Phase 15: notifications bell, global search, team utilization, health cron."""
import datetime

import pytest
from django.core.management import call_command

from apps.budget.models import InfraAsset
from apps.clients.models import Client
from apps.daily.models import DailyEntry
from apps.plans.models import PlanItem
from apps.projects.models import Project
from apps.tasks.models import Task

pytestmark = pytest.mark.django_db

TODAY = datetime.date.today()


@pytest.fixture
def project(db):
    client = Client.objects.create(client_name="ACME")
    return Project.objects.create(project_name="Portal", client=client)


# --- notifications -----------------------------------------------------------
def test_notifications_aggregate(api, matrix, make_user, project):
    me = make_user("dm@astro.test", role="dm", full_name="DM One")
    Task.objects.create(project=project, title="เลยกำหนด", assigned_to=me,
                        status="working", scheduled_date=TODAY - datetime.timedelta(days=2))
    Task.objects.create(project=project, title="ติดหล่ม", status="stuck")
    Project.objects.filter(id=project.id).update(health_status="delay", health_reason="ช้า")
    InfraAsset.objects.create(name="VM", expires_at=TODAY + datetime.timedelta(days=10))

    api.force_authenticate(me)
    data = api.get("/api/notifications").json()
    types = [i["type"] for i in data["items"]]
    assert "task_overdue" in types
    assert "task_stuck" in types
    assert "project_delay" in types
    assert "infra_expiry" in types
    assert data["count"] == len(data["items"])


def test_notifications_daily_reminder_and_gating(api, matrix, make_user):
    from apps.accounts.models import RolePermission

    dev = make_user("dev@astro.test", role="dev")
    RolePermission.objects.filter(role="dev").update(allowed=False)  # ปิดทุก module
    api.force_authenticate(dev)
    data = api.get("/api/notifications").json()
    # เหลือได้แค่ daily reminder (ไม่ผูก matrix); ส่วนอื่นถูก gate หมด
    assert all(i["type"] == "daily" for i in data["items"])


# --- global search -----------------------------------------------------------
def test_search_across_sections(api, matrix, make_user, project):
    Task.objects.create(project=project, title="Portal API integration")
    InfraAsset.objects.create(name="Portal VM", provider="AWS")
    api.force_authenticate(make_user("dm@astro.test", role="dm"))

    types = {r["type"] for r in api.get("/api/search", {"q": "portal"}).json()["results"]}
    assert {"project", "task", "infra"} <= types
    # สั้นเกิน → ไม่ค้น
    assert api.get("/api/search", {"q": "p"}).json()["results"] == []


def test_search_respects_matrix(api, matrix, make_user, project):
    from apps.accounts.models import RolePermission

    dev = make_user("dev@astro.test", role="dev")
    RolePermission.objects.filter(role="dev", module="Projects", action="view").update(allowed=False)
    api.force_authenticate(dev)
    types = {r["type"] for r in api.get("/api/search", {"q": "Portal"}).json()["results"]}
    assert "project" not in types


# --- team utilization --------------------------------------------------------
def test_utilization_math(api, matrix, make_user, project):
    a = make_user("a@astro.test", role="dev", full_name="A")
    make_user("b@astro.test", role="dev", full_name="B")
    DailyEntry.objects.create(user=a, work_date=TODAY, project=project, title="x", hours="6.0")
    DailyEntry.objects.create(user=a, work_date=TODAY, title="ot", hours="2.0", is_ot=True)

    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    data = api.get("/api/team/utilization", {"from": TODAY.isoformat(), "to": TODAY.isoformat()}).json()
    row = next(u for u in data["users"] if u["full_name"] == "A")
    assert row["total_hours"] == "8.0"
    assert row["ot_hours"] == "2.0"
    assert row["hours_by_day"][TODAY.isoformat()] == "8.0"
    assert len(data["days"]) == 1


# --- recompute_health command -------------------------------------------------
def test_recompute_health_catches_stale_delay(api, matrix, make_user, project):
    # milestone เลยกำหนดไปแล้ว แต่ health ค้างเป็น not_started (ไม่มีใครแตะ)
    PlanItem.objects.create(
        project=project, phase="P", task="MS", is_milestone=True,
        start_date=TODAY - datetime.timedelta(days=30),
        end_date=TODAY - datetime.timedelta(days=5), manday=5,
    )
    assert project.health_status == "not_started"

    call_command("recompute_health")
    project.refresh_from_db()
    assert project.health_status == "delay"
    assert project.delay_days == 5
