"""Phase 3: plan items (auto-manday, revisions), dependencies, progress, health."""
import datetime

import pytest

from apps.clients.models import Client
from apps.plans.models import PlanItem
from apps.plans.services import compute_health, plan_item_progress, project_progress
from apps.projects.models import Project
from apps.tasks.models import Task


pytestmark = pytest.mark.django_db


@pytest.fixture
def project(db):
    client = Client.objects.create(client_name="ACME", client_abbreviation="ACME")
    return Project.objects.create(project_name="P", client=client, project_phase="execution")


@pytest.fixture
def bsa(make_user):
    return make_user("bsa@astro.test", role="bsa")


# --- auto-manday (working days) --------------------------------------------
def test_create_plan_item_auto_manday(api, matrix, bsa, project):
    api.force_authenticate(bsa)
    # Mon 2026-06-01 .. Fri 2026-06-05 = 5 working days
    res = api.post(
        f"/api/projects/{project.id}/plan-items",
        {"phase": "Dev", "task": "Build", "start_date": "2026-06-01", "end_date": "2026-06-05"},
        format="json",
    )
    assert res.status_code == 201
    body = res.json()
    assert float(body["manday"]) == 5.0
    assert body["input_mode"] == "date"


def test_plan_item_manday_only(api, matrix, bsa, project):
    api.force_authenticate(bsa)
    res = api.post(
        f"/api/projects/{project.id}/plan-items",
        {"phase": "Dev", "task": "Estimate", "manday": "12.5"},
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["input_mode"] == "manday"
    assert float(res.json()["manday"]) == 12.5


# --- revision requires reason for key fields -------------------------------
def test_edit_manday_requires_reason(api, matrix, bsa, project):
    item = PlanItem.objects.create(project=project, phase="Dev", task="X", manday=10)
    api.force_authenticate(bsa)
    no_reason = api.patch(f"/api/plan-items/{item.id}", {"manday": "20"}, format="json")
    assert no_reason.status_code == 400

    ok = api.patch(
        f"/api/plan-items/{item.id}",
        {"manday": "20", "change_reason": "scope เพิ่ม"},
        format="json",
    )
    assert ok.status_code == 200
    assert item.revisions.filter(field_name="manday").count() == 1


# --- progress: N/A when no children, weighted rollup -----------------------
def test_plan_item_progress_na_without_children(project):
    item = PlanItem.objects.create(project=project, phase="P", task="T", manday=5)
    assert plan_item_progress(item) is None


def test_progress_weighted_by_estimated_manday(project):
    item = PlanItem.objects.create(project=project, phase="P", task="T", manday=10)
    Task.objects.create(title="a", project=project, plan_item=item, estimated_manday=3, status="verified")
    Task.objects.create(title="b", project=project, plan_item=item, estimated_manday=1, status="working")
    # 3 verified of 4 total => 0.75
    assert plan_item_progress(item) == pytest.approx(0.75)


def test_project_rollup_single_denominator(project):
    a = PlanItem.objects.create(project=project, phase="P", task="A", manday=10)
    b = PlanItem.objects.create(project=project, phase="P", task="B", manday=30)
    PlanItem.objects.create(project=project, phase="P", task="NoChild", manday=100)  # N/A excluded
    Task.objects.create(title="a", project=project, plan_item=a, estimated_manday=1, status="verified")
    Task.objects.create(title="b", project=project, plan_item=b, estimated_manday=1, status="not_started")
    # a=1.0(w10), b=0.0(w30) => 10/40 = 0.25 ; NoChild excluded from denominator
    assert project_progress(project) == pytest.approx(0.25)


# --- health: milestone over plan => delay ----------------------------------
def test_health_delay_when_milestone_overdue(project):
    PlanItem.objects.create(
        project=project,
        phase="Test",
        task="Milestone",
        manday=5,
        start_date=datetime.date(2020, 1, 1),
        end_date=datetime.date(2020, 1, 10),
        is_milestone=True,
    )
    status, reason, delay_days = compute_health(project, today=datetime.date(2020, 1, 20))
    assert status == "delay"
    assert delay_days == 10
    assert "เกินแผน" in reason


def test_health_not_started_before_first_start(project):
    PlanItem.objects.create(
        project=project, phase="P", task="T", manday=5,
        start_date=datetime.date(2030, 1, 1), end_date=datetime.date(2030, 1, 10),
    )
    status, _, _ = compute_health(project, today=datetime.date(2029, 1, 1))
    assert status == "not_started"


# --- dependency circular guard ---------------------------------------------
def test_dependency_rejects_cycle(api, matrix, bsa, project):
    a = PlanItem.objects.create(project=project, phase="P", task="A")
    b = PlanItem.objects.create(project=project, phase="P", task="B")
    api.force_authenticate(bsa)
    r1 = api.post(
        f"/api/projects/{project.id}/dependencies",
        {"predecessor": a.id, "successor": b.id, "relation_type": "finish_to_start"},
        format="json",
    )
    assert r1.status_code == 201
    # b -> a would close a cycle
    r2 = api.post(
        f"/api/projects/{project.id}/dependencies",
        {"predecessor": b.id, "successor": a.id, "relation_type": "finish_to_start"},
        format="json",
    )
    assert r2.status_code == 409


@pytest.mark.parametrize(
    "relation_type",
    ["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"],
)
def test_dependency_accepts_all_standard_relation_types(api, matrix, bsa, project, relation_type):
    a = PlanItem.objects.create(project=project, phase="P", task="A")
    b = PlanItem.objects.create(project=project, phase="P", task="B")
    api.force_authenticate(bsa)

    res = api.post(
        f"/api/projects/{project.id}/dependencies",
        {"predecessor": a.id, "successor": b.id, "relation_type": relation_type, "lag_days": -2},
        format="json",
    )

    assert res.status_code == 201
    assert res.json()["relation_type"] == relation_type
    assert res.json()["lag_days"] == -2


def test_dependency_relation_and_lag_can_be_updated(api, matrix, bsa, project):
    a = PlanItem.objects.create(project=project, phase="P", task="A")
    b = PlanItem.objects.create(project=project, phase="P", task="B")
    api.force_authenticate(bsa)
    created = api.post(
        f"/api/projects/{project.id}/dependencies",
        {"predecessor": a.id, "successor": b.id, "relation_type": "finish_to_start"},
        format="json",
    )

    res = api.patch(
        f"/api/dependencies/{created.json()['id']}",
        {"relation_type": "start_to_start", "lag_days": -3},
        format="json",
    )

    assert res.status_code == 200
    assert res.json()["relation_type"] == "start_to_start"
    assert res.json()["lag_days"] == -3


# --- generate tasks from plan ----------------------------------------------
def test_generate_tasks_all(api, matrix, bsa, project):
    PlanItem.objects.create(project=project, phase="P", task="A", manday=5)
    PlanItem.objects.create(project=project, phase="P", task="B", manday=8)
    api.force_authenticate(bsa)
    res = api.post(
        f"/api/projects/{project.id}/tasks/generate",
        {"mode": "all", "state": "development"},
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["count"] == 2
    assert Task.objects.filter(project=project, source="plan", state="development").count() == 2


def test_generate_tasks_is_idempotent(api, matrix, bsa, project):
    """กดซ้ำต้องไม่สร้าง Task ซ้ำจากแผนเดิม — สร้างเฉพาะแผนที่ยังไม่มี Task."""
    a = PlanItem.objects.create(project=project, phase="P", task="A", manday=5)
    PlanItem.objects.create(project=project, phase="P", task="B", manday=8)
    api.force_authenticate(bsa)
    payload = {"mode": "all", "state": "development"}

    first = api.post(f"/api/projects/{project.id}/tasks/generate", payload, format="json")
    assert first.json()["count"] == 2

    # กดซ้ำ → ข้ามหมด ไม่มีของใหม่
    second = api.post(f"/api/projects/{project.id}/tasks/generate", payload, format="json")
    assert second.json()["count"] == 0
    assert second.json()["skipped"] == 2
    assert Task.objects.filter(project=project, source="plan").count() == 2

    # เพิ่มแผนใหม่ 1 รายการ → กดอีกครั้งสร้างเฉพาะรายการใหม่
    PlanItem.objects.create(project=project, phase="P", task="C", manday=3)
    third = api.post(f"/api/projects/{project.id}/tasks/generate", payload, format="json")
    assert third.json()["count"] == 1
    assert third.json()["skipped"] == 2

    # ลบ Task ของแผน A (soft-delete) → generate ใหม่ได้เฉพาะ A
    Task.objects.get(plan_item=a).delete()
    fourth = api.post(f"/api/projects/{project.id}/tasks/generate", payload, format="json")
    assert fourth.json()["count"] == 1
    assert Task.objects.filter(project=project, source="plan").count() == 3
