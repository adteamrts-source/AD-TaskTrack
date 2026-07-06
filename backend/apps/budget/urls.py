from django.urls import path

from .views import (
    BudgetExportView,
    BudgetView,
    CostItemCreateView,
    CostItemDetailView,
    InfraAssetDetailView,
    InfraAssetListCreateView,
)

urlpatterns = [
    path("projects/<int:pk>/budget", BudgetView.as_view(), name="budget"),
    path("projects/<int:pk>/budget/export", BudgetExportView.as_view(), name="budget-export"),
    path("projects/<int:pk>/cost-items", CostItemCreateView.as_view(), name="cost-item-create"),
    path("cost-items/<int:pk>", CostItemDetailView.as_view(), name="cost-item-detail"),
    path("infra", InfraAssetListCreateView.as_view(), name="infra-list"),
    path("infra/<int:pk>", InfraAssetDetailView.as_view(), name="infra-detail"),
]
