from django.urls import path

from .views import (
    DependencyCreateView,
    DependencyDetailView,
    GenerateTasksView,
    PlanExportView,
    PlanItemDetailView,
    PlanItemListCreateView,
    ProgressReportView,
    RevisionListView,
)

urlpatterns = [
    path("projects/<int:pk>/plan-items", PlanItemListCreateView.as_view(), name="plan-items"),
    path("projects/<int:pk>/plan/export", PlanExportView.as_view(), name="plan-export"),
    path("projects/<int:pk>/progress-report", ProgressReportView.as_view(), name="progress-report"),
    path("plan-items/<int:pk>", PlanItemDetailView.as_view(), name="plan-item-detail"),
    path("plan-items/<int:pk>/revisions", RevisionListView.as_view(), name="plan-item-revisions"),
    path("projects/<int:pk>/dependencies", DependencyCreateView.as_view(), name="dependency-create"),
    path("dependencies/<int:pk>", DependencyDetailView.as_view(), name="dependency-detail"),
    path("projects/<int:pk>/tasks/generate", GenerateTasksView.as_view(), name="generate-tasks"),
]
