"""Calendar suggestion API (FN-CAL-01)."""
from datetime import datetime

from google.auth.exceptions import GoogleAuthError
from googleapiclient.errors import HttpError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import CalendarNotConnected, fetch_primary_events


def _parse_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


class CalendarEventsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        work_date = _parse_date(request.query_params.get("date"))
        if not work_date:
            return Response(
                {"detail": "ต้องระบุ date เป็นวันที่ ISO (YYYY-MM-DD)"},
                status=400,
            )

        try:
            events = fetch_primary_events(request.user, work_date)
        except CalendarNotConnected:
            return Response({"connected": False, "events": []})
        except (GoogleAuthError, HttpError):
            return Response(
                {
                    "connected": True,
                    "events": [],
                    "detail": "ดึงข้อมูล Google Calendar ไม่สำเร็จ",
                },
                status=502,
            )

        return Response({"connected": True, "events": events})
