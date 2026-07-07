"""Phase 5: DailyEntry 3 types, OT default, hours rules, snapshot, self-scope."""
import datetime

import pytest

from apps.clients.models import Client
from apps.daily.models import DailyEntry
from apps.projects.models import Project, ProjectTeamMember
from apps.settings_app.models import Holiday, SystemSetting
from apps.tasks.models import Task


pytestmark = pytest.mark.django_db

MONDAY = "2026-06-01"   # working day
SATURDAY = "2026-06-06"  # weekend


@pytest.fixture
def project(db):
    client = Client.objects.create(client_name="ACME", client_abbreviation="ACME")
    return Project.objects.create(project_name="P", client=client, project_phase="execution")


@pytest.fixture
def dev(make_user):
    return make_user("dev@astro.test", role="dev")


# --- manual entry = type C (general), OT default by day --------------------
def test_manual_entry_general_no_ot_on_workday(api, matrix, dev):
    api.force_authenticate(dev)
    res = api.post(
        "/api/daily",
        {"work_date": MONDAY, "source": "manual", "title": "เขียนรายงาน", "hours": "2.0"},
        format="json",
    )
    assert res.status_code == 201
    body = res.json()
    assert body["task"] is None
    assert body["project"] is None
    assert body["status_snapshot"] is None
    assert body["is_ot"] is False  # weekday default


def test_manual_entry_preserves_markdown_detail(api, matrix, dev):
    api.force_authenticate(dev)
    detail = "**เสร็จแล้ว**\n\n- ตรวจ API\n- อัปเดตเอกสาร"
    res = api.post(
        "/api/daily",
        {
            "work_date": MONDAY,
            "source": "manual",
            "detail": detail,
            "hours": "2.0",
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["title"] == "เสร็จแล้ว"
    assert res.json()["detail"] == detail
    assert DailyEntry.objects.get(id=res.json()["id"]).detail == detail


def test_manual_entry_rejects_empty_single_editor(api, matrix, dev):
    api.force_authenticate(dev)
    res = api.post(
        "/api/daily",
        {"work_date": MONDAY, "source": "manual", "detail": "", "hours": "1.0"},
        format="json",
    )
    assert res.status_code == 400
    assert "detail" in res.json()


def test_manual_entry_ot_default_on_weekend(api, matrix, dev):
    api.force_authenticate(dev)
    res = api.post(
        "/api/daily",
        {"work_date": SATURDAY, "source": "manual", "title": "งานเสาร์", "hours": "3.0"},
        format="json",
    )
    assert res.json()["is_ot"] is True  # holiday/weekend default


# --- type B (project tag, no status) ---------------------------------------
def test_project_entry_type_b(api, matrix, dev, project):
    ProjectTeamMember.objects.create(project=project, user=dev)
    api.force_authenticate(dev)
    res = api.post(
        "/api/daily",
        {"work_date": MONDAY, "source": "manual", "title": "ประชุมโครงการ", "project_id": project.id, "hours": "1.0"},
        format="json",
    )
    body = res.json()
    assert body["project"] == project.id
    assert body["task"] is None
    assert body["status_snapshot"] is None


def test_project_entry_rejects_project_outside_user_team(api, matrix, dev, project):
    api.force_authenticate(dev)
    res = api.post(
        "/api/daily",
        {"work_date": MONDAY, "source": "manual", "title": "ประชุมโครงการ", "project_id": project.id, "hours": "1.0"},
        format="json",
    )

    assert res.status_code == 400
    assert "project_id" in res.json()


# --- type A (task) keeps a status snapshot ---------------------------------
def test_task_entry_keeps_snapshot(api, matrix, dev, project):
    task = Task.objects.create(title="Build", project=project, assigned_to=dev, status="working")
    api.force_authenticate(dev)
    res = api.post(
        "/api/daily",
        {"work_date": MONDAY, "source": "manual", "task_id": task.id, "hours": "4.0"},
        format="json",
    )
    body = res.json()
    assert body["task"] == task.id
    assert body["project"] == project.id  # inherited
    assert body["status_snapshot"] == "working"
    # Snapshot is frozen: changing the task later doesn't change the entry.
    task.status = "done"
    task.save()
    assert DailyEntry.objects.get(id=body["id"]).status_snapshot == "working"


# --- hours validation -------------------------------------------------------
def test_hours_must_be_half_step(api, matrix, dev):
    api.force_authenticate(dev)
    bad = api.post(
        "/api/daily", {"work_date": MONDAY, "source": "manual", "title": "x", "hours": "0.7"}, format="json"
    )
    assert bad.status_code == 400
    low = api.post(
        "/api/daily", {"work_date": MONDAY, "source": "manual", "title": "x", "hours": "0.0"}, format="json"
    )
    assert low.status_code == 400


# --- re-tag project (FN-MW-04) does NOT create a Task ----------------------
def test_retag_project_no_task(api, matrix, dev, project):
    ProjectTeamMember.objects.create(project=project, user=dev)
    entry = DailyEntry.objects.create(user=dev, work_date=datetime.date(2026, 6, 1), title="t", hours=1)
    api.force_authenticate(dev)
    before = Task.objects.count()
    res = api.patch(f"/api/daily/{entry.id}", {"project_id": project.id}, format="json")
    assert res.status_code == 200
    assert res.json()["project"] == project.id
    assert Task.objects.count() == before  # no Task created


def test_retag_rejects_project_outside_user_team(api, matrix, dev, project):
    entry = DailyEntry.objects.create(user=dev, work_date=datetime.date(2026, 6, 1), title="t", hours=1)
    api.force_authenticate(dev)
    res = api.patch(f"/api/daily/{entry.id}", {"project_id": project.id}, format="json")

    assert res.status_code == 400
    assert "project_id" in res.json()


def test_cannot_retag_task_entry(api, matrix, dev, project):
    task = Task.objects.create(title="t", project=project, assigned_to=dev)
    entry = DailyEntry.objects.create(
        user=dev, work_date=datetime.date(2026, 6, 1), title="t", hours=1, task=task, project=project
    )
    api.force_authenticate(dev)
    res = api.patch(f"/api/daily/{entry.id}", {"project_id": project.id}, format="json")
    assert res.status_code == 400


# --- list + total hours + self scope ---------------------------------------
def test_list_returns_total_hours_and_is_self_scoped(api, matrix, dev, make_user):
    other = make_user("other@astro.test", role="dev")
    DailyEntry.objects.create(user=dev, work_date=datetime.date(2026, 6, 1), title="mine1", hours=2)
    DailyEntry.objects.create(user=dev, work_date=datetime.date(2026, 6, 1), title="mine2", hours=1.5)
    DailyEntry.objects.create(user=other, work_date=datetime.date(2026, 6, 1), title="theirs", hours=8)
    api.force_authenticate(dev)
    res = api.get("/api/daily?work_date=2026-06-01")
    body = res.json()
    assert len(body["results"]) == 2  # only own entries
    assert float(body["total_hours"]) == 3.5


def test_delete_own_entry(api, matrix, dev):
    entry = DailyEntry.objects.create(user=dev, work_date=datetime.date(2026, 6, 1), title="t", hours=1)
    api.force_authenticate(dev)
    assert api.delete(f"/api/daily/{entry.id}").status_code == 204
    assert not DailyEntry.objects.filter(id=entry.id).exists()  # real delete


def test_reminder_flags_missing_on_workday(api, matrix, dev):
    api.force_authenticate(dev)
    res = api.get("/api/daily/reminder")
    assert res.status_code == 200
    assert "needs_submission" in res.json()


def test_admin_can_manage_holidays_and_system_settings(api, matrix, make_user):
    api.force_authenticate(make_user("admin-settings@astro.test", role="admin"))
    holiday = api.post(
        "/api/holidays",
        {"holiday_date": "2026-07-29", "name": "หยุดบริษัท", "type": "company"},
        format="json",
    )
    assert holiday.status_code == 201
    assert Holiday.objects.filter(holiday_date="2026-07-29").exists()

    working_days = api.get("/api/calendar/working-days?from=2026-07-29&to=2026-07-29")
    assert working_days.json()[0]["is_working_day"] is False

    setting = api.patch(
        "/api/system-settings",
        {"key": "HOURS_PER_WORKING_DAY", "value": "7"},
        format="json",
    )
    assert setting.status_code == 200
    assert SystemSetting.objects.get(key="HOURS_PER_WORKING_DAY").value == "7"
