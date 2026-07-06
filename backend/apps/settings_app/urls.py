from django.urls import path

from .views import (
    HolidayDetailView,
    HolidayListCreateView,
    SystemSettingListView,
    WorkingDaysView,
)

urlpatterns = [
    path("calendar/working-days", WorkingDaysView.as_view(), name="working-days"),
    path("holidays", HolidayListCreateView.as_view(), name="holiday-list"),
    path("holidays/<int:pk>", HolidayDetailView.as_view(), name="holiday-detail"),
    path("system-settings", SystemSettingListView.as_view(), name="system-settings"),
]
