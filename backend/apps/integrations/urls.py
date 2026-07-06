from django.urls import path

from .views import ExternalHealthView, ExternalProjectCreateView, ExternalTaskCreateView, SpecView

urlpatterns = [
    path("health", ExternalHealthView.as_view(), name="external-health"),
    path("projects", ExternalProjectCreateView.as_view(), name="external-project-create"),
    path("tasks", ExternalTaskCreateView.as_view(), name="external-task-create"),
    path("spec", SpecView.as_view(), name="external-spec"),
]
