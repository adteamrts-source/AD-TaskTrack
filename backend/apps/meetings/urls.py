from django.urls import path

from .views import MeetingSummaryView, MissingSubmissionView

urlpatterns = [
    path("meeting-summary", MeetingSummaryView.as_view(), name="meeting-summary"),
    path("meeting-summary/missing", MissingSubmissionView.as_view(), name="meeting-summary-missing"),
]
