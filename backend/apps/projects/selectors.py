from django.db.models import Q

from .models import Project


def user_project_scope(user) -> Q:
    return Q(po_user=user) | Q(team_members__user=user)


def projects_for_user(user):
    if not user or not user.is_authenticated:
        return Project.objects.none()
    return Project.objects.filter(user_project_scope(user)).distinct()
