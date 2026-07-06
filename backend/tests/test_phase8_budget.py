"""Phase 8: budget role-based visibility, totals, edit gating, export."""
import pytest

from apps.budget.models import CostItem
from apps.clients.models import Client
from apps.projects.models import Project


pytestmark = pytest.mark.django_db


@pytest.fixture
def project(db):
    c = Client.objects.create(client_name="ACME", client_abbreviation="ACME")
    return Project.objects.create(project_name="P", client=c)


@pytest.fixture
def budgeted(project):
    CostItem.objects.create(project=project, category="manpower", label="Senior Dev", qty_or_units=2, months=3, rate=100000)
    CostItem.objects.create(project=project, category="infra", label="VM", qty_or_units=1, months=12, rate=2000)
    return project


def _get(api, user, project):
    api.force_authenticate(user)
    return api.get(f"/api/projects/{project.id}/budget").json()


# --- visibility by role ----------------------------------------------------
def test_admin_sees_line_items_and_rate(api, matrix, make_user, budgeted):
    body = _get(api, make_user("admin@astro.test", role="admin"), budgeted)
    assert body["can_see_rate"] is True
    manpower = next(c for c in body["categories"] if c["category"] == "manpower")
    assert "items" in manpower
    assert float(manpower["items"][0]["rate"]) == 100000
    # 2*3*100000 = 600000
    assert float(manpower["total"]) == 600000


def test_bsa_sees_totals_and_headcount_no_rate(api, matrix, make_user, budgeted):
    body = _get(api, make_user("bsa@astro.test", role="bsa"), budgeted)
    assert body["can_see_rate"] is False
    manpower = next(c for c in body["categories"] if c["category"] == "manpower")
    assert "items" not in manpower          # no line items / rate
    assert manpower.get("headcount") == "2"  # headcount visible
    assert float(manpower["total"]) == 600000  # category total still shown


def test_dev_sees_totals_only_no_headcount(api, matrix, make_user, budgeted):
    body = _get(api, make_user("dev@astro.test", role="dev"), budgeted)
    assert body["can_see_rate"] is False
    assert body["show_headcount"] is False
    manpower = next(c for c in body["categories"] if c["category"] == "manpower")
    assert "items" not in manpower
    assert "headcount" not in manpower
    assert float(body["grand_total"]) == 624000  # 600000 + 24000


# --- edit gating -----------------------------------------------------------
def test_dev_cannot_create_cost_item(api, matrix, make_user, project):
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    res = api.post(
        f"/api/projects/{project.id}/cost-items",
        {"category": "infra", "label": "x", "qty_or_units": 1, "months": 1, "rate": 100},
        format="json",
    )
    assert res.status_code == 403


def test_dm_can_create_cost_item(api, matrix, make_user, project):
    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    res = api.post(
        f"/api/projects/{project.id}/cost-items",
        {"category": "infra", "label": "VM", "qty_or_units": 1, "months": 12, "rate": 2000},
        format="json",
    )
    assert res.status_code == 201


# --- export ----------------------------------------------------------------
def test_export_xlsx(api, matrix, make_user, budgeted):
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    res = api.get(f"/api/projects/{budgeted.id}/budget/export?format=xlsx")
    assert res.status_code == 200
    assert "spreadsheetml" in res["Content-Type"]
