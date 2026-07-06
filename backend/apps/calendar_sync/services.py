"""Google Calendar read-only integration (FN-CAL-01).

Uses the Google OAuth token stored by django-allauth for the current user.
The endpoint only reads events from the user's primary calendar and formats
them as Daily Task suggestions; it never writes back to Google Calendar.
"""
from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from allauth.socialaccount.models import SocialToken
from django.conf import settings
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
BANGKOK = ZoneInfo("Asia/Bangkok")


class CalendarNotConnected(Exception):
    """Raised when the user has not granted Google Calendar access."""


def _latest_google_token(user):
    return (
        SocialToken.objects.select_related("account")
        .filter(account__user=user, account__provider="google")
        .order_by("-id")
        .first()
    )


def _google_app_config():
    app = settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]
    return app["client_id"], app["secret"]


def credentials_for_user(user) -> Credentials:
    token = _latest_google_token(user)
    if token is None:
        raise CalendarNotConnected()

    client_id, client_secret = _google_app_config()
    creds = Credentials(
        token=token.token,
        refresh_token=token.token_secret or None,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=[CALENDAR_SCOPE],
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token.token = creds.token
        if creds.refresh_token:
            token.token_secret = creds.refresh_token
        token.expires_at = creds.expiry
        token.save(update_fields=["token", "token_secret", "expires_at"])

    if not creds.valid:
        raise CalendarNotConnected()
    return creds


def _parse_google_datetime(value: dict):
    """Return (datetime, is_all_day). Timed events use `dateTime`; all-day
    events use `date` (whole-day) — we now surface both."""
    raw = value.get("dateTime")
    if raw:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(BANGKOK), False
    day = value.get("date")
    if day:
        return datetime.combine(date.fromisoformat(day), time.min, tzinfo=BANGKOK), True
    return None, False


def _duration_hours(start: datetime, end: datetime) -> float:
    raw_hours = max(0, (end - start).total_seconds() / 3600)
    half_steps = max(1, int(math.floor(raw_hours * 2 + 0.5)))
    return half_steps / 2


def fetch_primary_events(user, work_date: date) -> list[dict]:
    from apps.settings_app.services import hours_per_working_day

    creds = credentials_for_user(user)
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    start = datetime.combine(work_date, time.min, tzinfo=BANGKOK)
    end = start + timedelta(days=1)
    result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    default_all_day_hours = float(hours_per_working_day())
    events = []
    for item in result.get("items", []):
        # Skip events the user declined.
        if item.get("status") == "cancelled":
            continue
        start_dt, s_all_day = _parse_google_datetime(item.get("start", {}))
        end_dt, e_all_day = _parse_google_datetime(item.get("end", {}))
        if not start_dt or not end_dt:
            continue
        all_day = s_all_day or e_all_day
        hours = default_all_day_hours if all_day else _duration_hours(start_dt, end_dt)
        events.append(
            {
                "id": item["id"],
                "title": item.get("summary") or "(ไม่มีชื่อ)",
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "hours": f"{hours:.1f}",
                "all_day": all_day,
                "html_link": item.get("htmlLink", ""),
            }
        )
    return events
