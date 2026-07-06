from django.contrib.auth import get_user_model
from django.core.management import call_command


ADMIN_EMAIL = "tananya.th@rts2003.co.th"


def test_bootstrap_admin_creates_allowed_superuser(db):
    call_command("bootstrap_admin")

    user = get_user_model().objects.get(email=ADMIN_EMAIL)
    assert user.role == "admin"
    assert user.is_allowed is True
    assert user.is_active is True
    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.has_usable_password() is False


def test_bootstrap_admin_restores_existing_user(db):
    User = get_user_model()
    user = User.objects.create_user(
        email=ADMIN_EMAIL,
        role="dev",
        is_allowed=False,
        is_active=False,
    )

    call_command("bootstrap_admin")

    user.refresh_from_db()
    assert user.role == "admin"
    assert user.is_allowed is True
    assert user.is_active is True
    assert user.is_staff is True
    assert user.is_superuser is True
