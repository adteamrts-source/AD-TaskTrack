"""Phase 7: meeting summary aggregation + missing submission."""
import datetime

import pytest

from apps.clients.models import Client
from apps.daily.models import DailyEntry
from apps.projects.models import Project


pytestmark = pytest.mark.django_db


@pytest.fixture
def project(db):
    c = Client.objects.create(client_name="ACME", client_abbreviation="ACME")
    return Project.objects.create(project_name="ACME Portal", client=c)


def test_summary_groups_by_project_with_general(api, matrix, make_user, project):
    u = make_user("dev@astro.test", role="dev")
    today = datetime.date.today()
    DailyEntry.objects.create(user=u, work_date=today, title="dev work", hours=3, project=project)
    DailyEntry.objects.create(user=u, work_date=today, title="general task", hours=2)  # General
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))

    res = api.get("/api/meeting-summary?preset=1w")
    assert res.status_code == 200
    body = res.json()
    assert float(body["total_hours"]) == 5.0
    names = {g["project_name"] for g in body["groups"]}
    assert "ACME Portal" in names
    assert any("ทั่วไป" in n for n in names)  # General group present


def test_summary_hours_by_project_for_donut(api, matrix, make_user, project):
    u = make_user("dev@astro.test", role="dev")
    today = datetime.date.today()
    DailyEntry.objects.create(user=u, work_date=today, title="a", hours=4, project=project)
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    body = api.get("/api/meeting-summary?preset=1w").json()
    assert any(float(h["hours"]) == 4.0 for h in body["hours_by_project"])


def test_summary_status_snapshot_shown(api, matrix, make_user, project):
    u = make_user("dev@astro.test", role="dev")
    today = datetime.date.today()
    DailyEntry.objects.create(
        user=u, work_date=today, title="task work", hours=1, project=project,
        status_snapshot="working",
    )
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    body = api.get("/api/meeting-summary?preset=1w").json()
    entry = body["groups"][0]["entries"][0]
    assert entry["status_snapshot"] == "working"


def test_summary_requires_permission(api, matrix, make_user):
    # Dev has Meeting Summary:view in the seed matrix -> allowed.
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    assert api.get("/api/meeting-summary?preset=1w").status_code == 200


def test_missing_submission_lists_users_without_entries(api, matrix, make_user):
    # A user with no entries should appear in missing for a working-day range.
    make_user("idle@astro.test", role="dev", full_name="Idle Dev")
    api.force_authenticate(make_user("bsa@astro.test", role="bsa"))
    # Use a known working-day window (Mon–Fri).
    res = api.get("/api/meeting-summary/missing?from=2026-06-01&to=2026-06-05")
    assert res.status_code == 200
    body = res.json()
    assert len(body["working_days"]) == 5
    names = {m["full_name"] for m in body["missing"]}
    assert "Idle Dev" in names
