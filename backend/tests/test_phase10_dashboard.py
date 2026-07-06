"""Phase 10: dashboard — portfolio snapshot with team + activity rollups."""
import datetime

import pytest

from apps.accounts.models import RolePermission
from apps.clients.models import Client
from apps.daily.models import DailyEntry
from apps.projects.models import Project, ProjectTeamMember
from apps.tasks.models import Task

pytestmark = pytest.mark.django_db


@pytest.fixture
def client_obj(db):
    return Client.objects.create(client_name="ACME", client_abbreviation="ACME")


@pytest.fixture
def project(client_obj):
    return Project.objects.create(
        project_name="Portal", project_code="POR-1", client=client_obj,
        project_phase="execution", health_status="at_risk",
    )


def test_dashboard_returns_team_and_task_counts(api, matrix, make_user, project):
    dev = make_user("dev@astro.test", role="dev", full_name="Dev One")
    ProjectTeamMember.objects.create(project=project, user=dev, role_in_project="Dev")
    Task.objects.create(project=project, title="A", status="working")
    Task.objects.create(project=project, title="B", status="verified")
    Task.objects.create(project=project, title="C", status="working")

    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    res = api.get("/api/dashboard")
    assert res.status_code == 200
    row = res.json()["projects"][0]
    assert row["project_name"] == "Portal"
    assert row["client_name"] == "ACME"
    assert row["task_counts"]["total"] == 3
    assert row["task_counts"]["working"] == 2
    assert row["task_counts"]["verified"] == 1
    assert row["team"] == [
        {
            "user": dev.id,
            "full_name": "Dev One",
            "email": "dev@astro.test",
            "role_in_project": "Dev",
            "allocation_percentage": None,
        }
    ]


def test_dashboard_rollups(api, matrix, make_user, client_obj):
    Project.objects.create(project_name="A", client=client_obj, project_phase="execution", health_status="on_plan")
    Project.objects.create(project_name="B", client=client_obj, project_phase="execution", health_status="delay")
    Project.objects.create(project_name="C", client=client_obj, project_phase="pre_sale")

    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    rollups = api.get("/api/dashboard").json()["rollups"]
    assert rollups["total"] == 3
    assert rollups["by_health"]["on_plan"] == 1
    assert rollups["by_health"]["delay"] == 1
    assert rollups["by_phase"]["execution"] == 2
    assert rollups["by_phase"]["pre_sale"] == 1


def test_recent_activity_window(api, matrix, make_user, project):
    dev = make_user("dev@astro.test", role="dev", full_name="Dev One")
    today = datetime.date.today()
    DailyEntry.objects.create(user=dev, work_date=today, project=project, title="recent", hours="2.5")
    DailyEntry.objects.create(
        user=dev, work_date=today - datetime.timedelta(days=30),
        project=project, title="old", hours="8.0",
    )

    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    row = api.get("/api/dashboard").json()["projects"][0]
    assert row["recent_activity"] == [
        {"user": dev.id, "full_name": "Dev One", "last_date": today.isoformat(), "hours": "2.5"}
    ]


def test_value_thb_only_for_money_roles(api, matrix, make_user, client_obj):
    Project.objects.create(project_name="Secret", client=client_obj, value_thb="500000.00")
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    assert "value_thb" not in api.get("/api/dashboard").json()["projects"][0]

    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    assert api.get("/api/dashboard").json()["projects"][0]["value_thb"] == "500000.00"


def test_search_filter(api, matrix, make_user, client_obj):
    Project.objects.create(project_name="CRM Portal", client=client_obj)
    Project.objects.create(project_name="Mobile App", client=client_obj)
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    data = api.get("/api/dashboard", {"search": "crm"}).json()
    assert data["rollups"]["total"] == 1
    assert data["projects"][0]["project_name"] == "CRM Portal"


def test_dashboard_rides_on_projects_view(api, matrix, make_user, project):
    dev = make_user("dev@astro.test", role="dev")
    api.force_authenticate(dev)
    assert api.get("/api/dashboard").status_code == 200

    RolePermission.objects.filter(role="dev", module="Projects", action="view").update(allowed=False)
    assert api.get("/api/dashboard").status_code == 403


def test_phase_filter(api, matrix, make_user, client_obj):
    Project.objects.create(project_name="Exec", client=client_obj, project_phase="execution")
    Project.objects.create(project_name="Pre", client=client_obj, project_phase="pre_sale")

    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    data = api.get("/api/dashboard", {"phase": "execution"}).json()
    assert data["rollups"]["total"] == 1
    assert data["projects"][0]["project_name"] == "Exec"


def test_soft_deleted_project_excluded(api, matrix, make_user, project):
    project.delete()  # soft-delete
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    assert api.get("/api/dashboard").json()["rollups"]["total"] == 0
