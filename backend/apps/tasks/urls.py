from django.urls import path

from .views import (
    ClaimView,
    TaskDetailView,
    TaskListCreateView,
)

urlpatterns = [
    path("tasks", TaskListCreateView.as_view(), name="task-list"),
    path("tasks/<int:pk>", TaskDetailView.as_view(), name="task-detail"),
    path("tasks/<int:pk>/claim", ClaimView.as_view(), name="task-claim"),
]
