"""Phase 2: clients, projects (role-gated value), soft-delete, team."""
import pytest

from apps.clients.models import Client
from apps.projects.models import Project, ProjectTeamMember


pytestmark = pytest.mark.django_db


@pytest.fixture
def client_obj(db):
    return Client.objects.create(client_name="ACME", client_abbreviation="ACME")


# --- Clients ---------------------------------------------------------------
def test_client_list_defaults_to_active(api, matrix, make_user, client_obj):
    Client.objects.create(client_name="Old", client_abbreviation="OLD", is_active=False)
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    res = api.get("/api/clients")
    assert res.status_code == 200
    names = [c["client_abbreviation"] for c in res.json()["results"]]
    assert "ACME" in names and "OLD" not in names


def test_bsa_can_create_client_inline(api, matrix, make_user):
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    res = api.post(
        "/api/clients", {"client_name": "New Co", "client_abbreviation": "NEW"}, format="json"
    )
    assert res.status_code == 201


def test_duplicate_abbreviation_rejected(api, matrix, make_user, client_obj):
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    res = api.post(
        "/api/clients", {"client_name": "Dup", "client_abbreviation": "ACME"}, format="json"
    )
    assert res.status_code == 400


def test_bsa_can_edit_client_master(api, matrix, make_user, client_obj):
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    res = api.patch(
        f"/api/clients/{client_obj.id}",
        {"client_name": "ACME Updated", "client_abbreviation": "ACM", "is_active": False},
        format="json",
    )
    assert res.status_code == 200
    client_obj.refresh_from_db()
    assert client_obj.client_name == "ACME Updated"
    assert client_obj.client_abbreviation == "ACM"
    assert client_obj.is_active is False


# --- Projects: role gating + value confidentiality -------------------------
def test_dm_can_create_project_dev_cannot(api, matrix, make_user, client_obj):
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    payload = {"project_name": "P1", "client": client_obj.id}
    assert api.post("/api/projects", payload, format="json").status_code == 403

    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    res = api.post(
        "/api/projects",
        {"project_name": "P1", "client": client_obj.id, "value_thb": "1000000.00"},
        format="json",
    )
    assert res.status_code == 201


def test_value_thb_hidden_from_dev_visible_to_dm(api, matrix, make_user, client_obj):
    Project.objects.create(
        project_name="Secret", client=client_obj, value_thb="500000.00"
    )
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    dev_row = api.get("/api/projects").json()["results"][0]
    assert "value_thb" not in dev_row

    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    dm_row = api.get("/api/projects").json()["results"][0]
    assert dm_row["value_thb"] == "500000.00"


def test_project_list_mine_only_returns_po_or_team_projects(api, matrix, make_user, client_obj):
    dev = make_user("dev-mine@astro.test", role="dev")
    po_project = Project.objects.create(project_name="PO Project", client=client_obj, po_user=dev)
    team_project = Project.objects.create(project_name="Team Project", client=client_obj)
    other_project = Project.objects.create(project_name="Other Project", client=client_obj)
    ProjectTeamMember.objects.create(project=team_project, user=dev)

    api.force_authenticate(dev)
    body = api.get("/api/projects?mine=1").json()

    ids = {row["id"] for row in body["results"]}
    assert po_project.id in ids
    assert team_project.id in ids
    assert other_project.id not in ids


def test_project_code_unique(api, matrix, make_user, client_obj):
    Project.objects.create(project_name="A", client=client_obj, project_code="X-1")
    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    res = api.post(
        "/api/projects",
        {"project_name": "B", "client": client_obj.id, "project_code": "X-1"},
        format="json",
    )
    assert res.status_code == 400


def test_soft_delete_hides_project(api, matrix, make_user, client_obj):
    proj = Project.objects.create(project_name="Temp", client=client_obj)
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    assert api.delete(f"/api/projects/{proj.id}").status_code == 204
    # Gone from the list, but the row still exists (soft-deleted).
    assert api.get("/api/projects").json()["count"] == 0
    assert Project.all_objects.filter(id=proj.id, deleted_at__isnull=False).exists()


def test_bsa_can_edit_but_not_set_value(api, matrix, make_user, client_obj):
    proj = Project.objects.create(project_name="Edit me", client=client_obj)
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    res = api.patch(
        f"/api/projects/{proj.id}",
        {"project_phase": "execution", "value_thb": "999.00"},
        format="json",
    )
    assert res.status_code == 200
    proj.refresh_from_db()
    assert proj.project_phase == "execution"
    assert proj.value_thb is None  # BSA cannot set confidential value


# --- Team roster -----------------------------------------------------------
def test_team_members_list(api, matrix, make_user):
    make_user("a@astro.test", role="dev", full_name="Alice")
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    res = api.get("/api/team-members")
    assert res.status_code == 200
    assert res.json()["count"] >= 2
