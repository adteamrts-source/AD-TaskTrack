import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.permissions_seed import seed_role_permissions


@pytest.fixture
def matrix(db):
    """Ensure the default permission matrix exists for the test DB."""
    seed_role_permissions()


@pytest.fixture
def make_user(db):
    def _make(email, role="dev", **extra):
        return User.objects.create_user(email=email, role=role, password="x", **extra)

    return _make


@pytest.fixture
def api():
    return APIClient()
