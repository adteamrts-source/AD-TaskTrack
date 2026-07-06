from django.urls import path

from .views import (
    DashboardView,
    ProjectDetailView,
    ProjectListCreateView,
    ProjectTeamMemberDetailView,
    ProjectTeamView,
    RiskDetailView,
    RiskListCreateView,
    RiskLogListView,
)

urlpatterns = [
    path("dashboard", DashboardView.as_view(), name="dashboard"),
    path("projects", ProjectListCreateView.as_view(), name="project-list"),
    path("projects/<int:pk>", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/<int:pk>/team", ProjectTeamView.as_view(), name="project-team"),
    path("projects/<int:pk>/risks", RiskListCreateView.as_view(), name="project-risks"),
    path("risks/<int:pk>", RiskDetailView.as_view(), name="risk-detail"),
    path("risks/<int:pk>/logs", RiskLogListView.as_view(), name="risk-logs"),
    path(
        "project-team/<int:pk>",
        ProjectTeamMemberDetailView.as_view(),
        name="project-team-detail",
    ),
]
