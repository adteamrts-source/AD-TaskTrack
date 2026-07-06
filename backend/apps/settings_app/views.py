"""Working-Day Calendar read endpoint (FN-X-03). Login-only, read-only."""
from datetime import datetime

from django.conf import settings
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import HasModulePermission

from .models import Holiday, SystemSetting
from .serializers import HolidaySerializer, SystemSettingSerializer
from .services import working_days_in_range


def _parse(d):
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


class WorkingDaysView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = _parse(request.query_params.get("from"))
        end = _parse(request.query_params.get("to"))
        if not start or not end:
            return Response(
                {"detail": "ต้องระบุ from และ to เป็นวันที่ ISO (YYYY-MM-DD)"},
                status=400,
            )
        days = working_days_in_range(start, end)
        return Response(
            [{"date": d["date"].isoformat(), "is_working_day": d["is_working_day"]} for d in days]
        )


class HolidayListCreateView(generics.ListCreateAPIView):
    serializer_class = HolidaySerializer
    permission_classes = [HasModulePermission]
    permission_module = "User Management"

    def get_queryset(self):
        qs = Holiday.objects.all()
        year = self.request.query_params.get("year")
        typ = self.request.query_params.get("type")
        if year and year.isdigit():
            qs = qs.filter(holiday_date__year=int(year))
        if typ:
            qs = qs.filter(type=typ)
        return qs


class HolidayDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = HolidaySerializer
    permission_classes = [HasModulePermission]
    permission_module = "User Management"
    queryset = Holiday.objects.all()


class SystemSettingListView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = "User Management"

    def get(self, request):
        defaults = getattr(settings, "ASTRO_DEFAULTS", {})
        existing = {row.key: row for row in SystemSetting.objects.all()}
        rows = []
        for key in [
            "HOURS_PER_WORKING_DAY",
            "health_threshold_at_risk",
            "health_threshold_delay",
        ]:
            obj = existing.get(key)
            rows.append(
                {
                    "id": obj.id if obj else None,
                    "key": key,
                    "value": obj.value if obj else str(defaults.get(key, "")),
                    "updated_by": obj.updated_by_id if obj else None,
                    "updated_at": obj.updated_at.isoformat() if obj else None,
                }
            )
        return Response(rows)

    def patch(self, request):
        ser = SystemSettingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj, _ = SystemSetting.objects.update_or_create(
            key=ser.validated_data["key"],
            defaults={
                "value": ser.validated_data["value"],
                "updated_by": request.user,
            },
        )
        return Response(SystemSettingSerializer(obj).data)
