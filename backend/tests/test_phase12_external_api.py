"""Phase 12: external inbound API — API-key auth, create-only projects/tasks."""
import pytest

from apps.clients.models import Client
from apps.integrations.models import APIKey
from apps.projects.models import Project
from apps.tasks.models import Task

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_key(db):
    """Returns (instance, raw_key)."""
    return APIKey.generate(name="ERP")


@pytest.fixture
def keyed(api, api_key):
    api.credentials(HTTP_X_API_KEY=api_key[1])
    return api


PROJECT_PAYLOAD = {
    "project_name": "New CRM",
    "project_code": "CRM-01",
    "client": {"client_name": "Beta Co", "client_abbreviation": "BETA"},
    "start_date": "2026-08-01",
    "end_date": "2026-12-30",
    "project_phase": "pre_sale",
}


# --- Auth --------------------------------------------------------------------
def test_missing_or_bad_key_rejected(api, db):
    assert api.post("/api/external/v1/projects", PROJECT_PAYLOAD, format="json").status_code == 401
    api.credentials(HTTP_X_API_KEY="astro_wrong")
    assert api.post("/api/external/v1/projects", PROJECT_PAYLOAD, format="json").status_code == 401


def test_inactive_key_rejected(api, api_key):
    instance, raw = api_key
    instance.is_active = False
    instance.save(update_fields=["is_active"])
    api.credentials(HTTP_X_API_KEY=raw)
    assert api.get("/api/external/v1/health").status_code == 401


def test_session_user_without_key_rejected(api, matrix, make_user):
    # force_authenticate marks the request authenticated, so DRF answers 403
    # (not 401) — either way a human session must not reach external endpoints.
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    res = api.post("/api/external/v1/projects", PROJECT_PAYLOAD, format="json")
    assert res.status_code in (401, 403)
    assert not Project.objects.filter(project_code="CRM-01").exists()


def test_bearer_header_variant(api, api_key):
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {api_key[1]}")
    res = api.get("/api/external/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "key_name": "ERP"}


def test_last_used_at_updated(keyed, api_key):
    instance, _ = api_key
    assert instance.last_used_at is None
    keyed.get("/api/external/v1/health")
    instance.refresh_from_db()
    assert instance.last_used_at is not None


# --- Projects ------------------------------------------------------------------
def test_create_project_autocreates_client(keyed):
    res = keyed.post("/api/external/v1/projects", PROJECT_PAYLOAD, format="json")
    assert res.status_code == 201
    data = res.json()
    assert data["project_code"] == "CRM-01"
    assert data["client"]["created"] is True
    assert Client.objects.filter(client_abbreviation="BETA").exists()
    assert Project.objects.filter(project_code="CRM-01").exists()


def test_existing_client_matched_case_insensitive(keyed):
    Client.objects.create(client_name="Beta Co", client_abbreviation="BETA")
    payload = {**PROJECT_PAYLOAD, "client": {"client_name": "beta co", "client_abbreviation": "beta"}}
    res = keyed.post("/api/external/v1/projects", payload, format="json")
    assert res.status_code == 201
    assert res.json()["client"]["created"] is False
    assert Client.objects.count() == 1


def test_client_string_shorthand(keyed):
    payload = {"project_name": "Mini", "client": "Gamma Ltd"}
    res = keyed.post("/api/external/v1/projects", payload, format="json")
    assert res.status_code == 201
    assert res.json()["client"]["client_name"] == "Gamma Ltd"


def test_duplicate_project_code_conflict(keyed):
    assert keyed.post("/api/external/v1/projects", PROJECT_PAYLOAD, format="json").status_code == 201
    assert keyed.post("/api/external/v1/projects", PROJECT_PAYLOAD, format="json").status_code == 409


def test_project_validation_error(keyed):
    res = keyed.post("/api/external/v1/projects", {"client": "X"}, format="json")
    assert res.status_code == 400  # missing project_name


# --- Tasks -------------------------------------------------------------------
@pytest.fixture
def project(db):
    client = Client.objects.create(client_name="ACME")
    return Project.objects.create(project_name="Portal", project_code="POR-1", client=client)


def test_create_task_by_project_code(keyed, project):
    res = keyed.post(
        "/api/external/v1/tasks",
        {"project_code": "por-1", "title": "Import data", "state": "development"},
        format="json",
    )
    assert res.status_code == 201
    data = res.json()
    assert data["source"] == "external"
    assert data["project"] == project.id
    assert data["status"] == "not_started"
    assert Task.objects.get(id=data["id"]).source == "external"


def test_assignee_email_matching(keyed, project, make_user):
    dev = make_user("dev@astro.test", role="dev")
    res = keyed.post(
        "/api/external/v1/tasks",
        {"project_code": "POR-1", "title": "A", "assignee_email": "DEV@astro.test"},
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["assigned_to"] == dev.id
    assert res.json()["assignee_matched"] is True

    res = keyed.post(
        "/api/external/v1/tasks",
        {"project_code": "POR-1", "title": "B", "assignee_email": "nobody@astro.test"},
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["assigned_to"] is None
    assert res.json()["assignee_matched"] is False


def test_task_unknown_project_404(keyed):
    res = keyed.post(
        "/api/external/v1/tasks", {"project_code": "NOPE", "title": "X"}, format="json"
    )
    assert res.status_code == 404


def test_task_requires_project_ref(keyed):
    assert keyed.post("/api/external/v1/tasks", {"title": "X"}, format="json").status_code == 400


def test_task_invalid_state(keyed, project):
    res = keyed.post(
        "/api/external/v1/tasks",
        {"project_code": "POR-1", "title": "X", "state": "nonsense"},
        format="json",
    )
    assert res.status_code == 400
