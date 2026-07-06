from django.urls import path

from .views import (
    LogoutView,
    MeView,
    RolePermissionView,
    TeamMembersListView,
    UserDetailView,
    UserListCreateView,
)

urlpatterns = [
    path("me", MeView.as_view(), name="me"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("users", UserListCreateView.as_view(), name="user-list"),
    path("users/<int:pk>", UserDetailView.as_view(), name="user-detail"),
    path("role-permissions", RolePermissionView.as_view(), name="role-permissions"),
    path("team-members", TeamMembersListView.as_view(), name="team-members"),
]
