"""Phase 6: Google Calendar suggestions endpoint."""
import datetime

import pytest


pytestmark = pytest.mark.django_db


def test_calendar_events_requires_date(api, make_user):
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    res = api.get("/api/calendar/events")
    assert res.status_code == 400


def test_calendar_events_not_connected(api, make_user):
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    res = api.get("/api/calendar/events?date=2026-06-01")
    assert res.status_code == 200
    assert res.json() == {"connected": False, "events": []}


def test_calendar_events_returns_service_events(api, make_user, monkeypatch):
    user = make_user("dev@astro.test", role="dev")
    api.force_authenticate(user)

    def fake_fetch(fetch_user, work_date):
        assert fetch_user == user
        assert work_date == datetime.date(2026, 6, 1)
        return [
            {
                "id": "evt-1",
                "title": "Weekly Sync",
                "start": "2026-06-01T09:00:00+07:00",
                "end": "2026-06-01T10:00:00+07:00",
                "hours": "1.0",
                "html_link": "https://calendar.google.com/event",
            }
        ]

    monkeypatch.setattr("apps.calendar_sync.views.fetch_primary_events", fake_fetch)
    res = api.get("/api/calendar/events?date=2026-06-01")
    assert res.status_code == 200
    body = res.json()
    assert body["connected"] is True
    assert body["events"][0]["title"] == "Weekly Sync"
