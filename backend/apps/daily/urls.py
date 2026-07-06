from django.urls import path

from .views import (
    DailyDetailView,
    DailyListCreateView,
    MyWorkSummaryView,
    ReminderView,
    TeamUtilizationView,
    WorkSummaryNoteDetailView,
    WorkSummaryNoteListView,
)

urlpatterns = [
    path("daily", DailyListCreateView.as_view(), name="daily-list"),
    path("daily/reminder", ReminderView.as_view(), name="daily-reminder"),
    path("daily/<int:pk>", DailyDetailView.as_view(), name="daily-detail"),
    path("my-summary", MyWorkSummaryView.as_view(), name="my-work-summary"),
    path("my-summary/notes", WorkSummaryNoteListView.as_view(), name="my-work-summary-notes"),
    path("my-summary/notes/<int:pk>", WorkSummaryNoteDetailView.as_view(), name="my-work-summary-note-detail"),
    path("team/utilization", TeamUtilizationView.as_view(), name="team-utilization"),
]
