"""Phase 4: task CRUD, status/verify gating, and claim."""
import pytest

from apps.clients.models import Client
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


@pytest.fixture
def dev(make_user):
    return make_user("dev@astro.test", role="dev")


# --- create (BSA) / dev cannot create --------------------------------------
def test_bsa_creates_task_dev_cannot(api, matrix, project, bsa, dev):
    api.force_authenticate(dev)
    assert api.post("/api/tasks", {"title": "x", "project": project.id}, format="json").status_code == 403

    api.force_authenticate(bsa)
    res = api.post(
        "/api/tasks",
        {"title": "Build", "project": project.id, "state": "development", "estimated_manday": "3"},
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["source"] == "manual"


# --- status: assignee to Done, verifier-only Verified ----------------------
def test_dev_can_set_done_but_not_verified(api, matrix, project, dev):
    task = Task.objects.create(title="t", project=project, assigned_to=dev)
    api.force_authenticate(dev)
    assert api.patch(f"/api/tasks/{task.id}", {"status": "done"}, format="json").status_code == 200
    res = api.patch(f"/api/tasks/{task.id}", {"status": "verified"}, format="json")
    assert res.status_code == 403


def test_dev_cannot_edit_others_task(api, matrix, project, dev, make_user):
    other = make_user("other@astro.test", role="dev")
    task = Task.objects.create(title="t", project=project, assigned_to=other)
    api.force_authenticate(dev)
    assert api.patch(f"/api/tasks/{task.id}", {"status": "working"}, format="json").status_code == 403


def test_bsa_can_verify(api, matrix, project, bsa, dev):
    task = Task.objects.create(title="t", project=project, assigned_to=dev, status="done")
    api.force_authenticate(bsa)
    res = api.patch(f"/api/tasks/{task.id}", {"status": "verified"}, format="json")
    assert res.status_code == 200
    task.refresh_from_db()
    assert task.status == "verified"


# --- claim ------------------------------------------------------------------
def test_claim_backlog_then_conflict(api, matrix, project, dev, make_user):
    task = Task.objects.create(title="t", project=project)  # backlog
    api.force_authenticate(dev)
    assert api.post(f"/api/tasks/{task.id}/claim").status_code == 200
    task.refresh_from_db()
    assert task.assigned_to_id == dev.id
    # someone else tries to claim -> 409
    other = make_user("other@astro.test", role="dev")
    api.force_authenticate(other)
    assert api.post(f"/api/tasks/{task.id}/claim").status_code == 409


def test_claimed_task_cannot_return_to_backlog(api, matrix, project, dev, bsa):
    task = Task.objects.create(title="t", project=project, assigned_to=dev)
    api.force_authenticate(bsa)
    assert api.patch(f"/api/tasks/{task.id}", {"assigned_to": None}, format="json").status_code == 400
    assert api.post(f"/api/tasks/{task.id}/unclaim", {}, format="json").status_code == 404
    task.refresh_from_db()
    assert task.assigned_to_id == dev.id


# --- list filters -----------------------------------------------------------
def test_list_backlog_and_me(api, matrix, project, dev):
    Task.objects.create(title="backlog", project=project)
    Task.objects.create(title="mine", project=project, assigned_to=dev)
    api.force_authenticate(dev)
    backlog = api.get("/api/tasks?assignee=backlog").json()
    assert backlog["count"] == 1 and backlog["results"][0]["title"] == "backlog"
    mine = api.get("/api/tasks?assignee=me").json()
    assert mine["count"] == 1 and mine["results"][0]["title"] == "mine"


@pytest.mark.parametrize(
    ("search", "expected_title"),
    [("dashboard", "Build dashboard"), ("approval", "API"), ("Somchai", "Assigned")],
)
def test_list_searches_title_detail_and_assignee(api, matrix, project, dev, make_user, search, expected_title):
    assignee = make_user("somchai@astro.test", full_name="Somchai RTS")
    Task.objects.create(title="Build dashboard", project=project)
    Task.objects.create(title="API", detail="Waiting for approval", project=project)
    Task.objects.create(title="Assigned", project=project, assigned_to=assignee)
    api.force_authenticate(dev)

    result = api.get("/api/tasks", {"project": project.id, "search": search}).json()

    assert result["count"] == 1
    assert result["results"][0]["title"] == expected_title


# --- soft delete ------------------------------------------------------------
def test_soft_delete_task(api, matrix, project, bsa):
    task = Task.objects.create(title="t", project=project)
    api.force_authenticate(bsa)
    assert api.delete(f"/api/tasks/{task.id}").status_code == 204
    assert api.get("/api/tasks").json()["count"] == 0
    assert Task.all_objects.filter(id=task.id, deleted_at__isnull=False).exists()
