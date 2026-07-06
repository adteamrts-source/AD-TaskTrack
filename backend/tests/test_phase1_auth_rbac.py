"""Phase 1: auth, RBAC matrix enforcement, working-day calendar."""
import datetime
from urllib.parse import parse_qs, urlparse

import pytest
from allauth.socialaccount.models import SocialAccount, SocialLogin, SocialToken
from django.test import RequestFactory

from apps.accounts.adapters import AstroSocialAccountAdapter
from apps.accounts.models import RolePermission
from apps.settings_app.models import Holiday
from apps.settings_app.services import working_days_between


pytestmark = pytest.mark.django_db


# --- Google OAuth flow -----------------------------------------------------
def test_google_login_keeps_offline_access_without_forcing_consent(client):
    response = client.get("/accounts/google/login/")

    assert response.status_code == 302
    params = parse_qs(urlparse(response["Location"]).query)
    assert params["access_type"] == ["offline"]
    assert "prompt" not in params


# --- /api/me + permissions -------------------------------------------------
def test_me_requires_login(api):
    assert api.get("/api/me").status_code == 403  # DRF default for unauthenticated


def test_me_returns_role_and_permissions(api, matrix, make_user):
    user = make_user("dev@astro.test", role="dev")
    api.force_authenticate(user)
    res = api.get("/api/me")
    assert res.status_code == 200
    body = res.json()
    assert body["role"] == "dev"
    perms = {(p["module"], p["action"]) for p in body["permissions"]}
    assert ("My Work", "create") in perms
    assert ("User Management", "view") not in perms  # dev has no user mgmt


def test_google_login_connects_existing_allowlisted_user_and_stores_token(make_user):
    user = make_user("dev@astro.test", role="dev", full_name="")
    sociallogin = SocialLogin(
        user=user,
        account=SocialAccount(
            provider="google",
            uid="google-uid-1",
            extra_data={"email": user.email, "name": "Google Dev"},
        ),
    )
    # OAuth2CallbackView assigns the parsed token after constructing SocialLogin.
    sociallogin.token = SocialToken(token="access-token", token_secret="refresh-token")

    AstroSocialAccountAdapter().pre_social_login(
        RequestFactory().get("/accounts/google/login/callback/"),
        sociallogin,
    )

    account = SocialAccount.objects.get(provider="google", uid="google-uid-1")
    token = SocialToken.objects.get(account=account)
    user.refresh_from_db()
    assert account.user == user
    assert token.token == "access-token"
    assert token.token_secret == "refresh-token"
    assert user.full_name == "Google Dev"


def test_me_calendar_connected_requires_google_token(api, make_user):
    user = make_user("dev@astro.test", role="dev")
    account = SocialAccount.objects.create(
        user=user,
        provider="google",
        uid="google-uid-1",
    )
    api.force_authenticate(user)

    assert api.get("/api/me").json()["calendar_connected"] is False

    SocialToken.objects.create(account=account, token="access-token")
    assert api.get("/api/me").json()["calendar_connected"] is True


# --- RBAC enforcement on User Management ----------------------------------
def test_dev_cannot_list_users(api, matrix, make_user):
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    assert api.get("/api/users").status_code == 403


def test_admin_can_list_users(api, matrix, make_user):
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    assert api.get("/api/users").status_code == 200


def test_admin_creates_user_and_rejects_duplicate_email(api, matrix, make_user):
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    payload = {
        "full_name": "New Dev",
        "email": "new@astro.test",
        "role": "dev",
        "employment_type": "permanent",
    }
    assert api.post("/api/users", payload, format="json").status_code == 201
    dup = api.post("/api/users", payload, format="json")
    assert dup.status_code == 400
    assert "email" in dup.json()


# --- last-admin lockout guard (FN-USR-03/04) ------------------------------
def test_cannot_disable_last_admin(api, matrix, make_user):
    admin = make_user("admin@astro.test", role="admin")
    api.force_authenticate(admin)
    res = api.patch(f"/api/users/{admin.id}", {"is_allowed": False}, format="json")
    assert res.status_code == 409


def test_can_disable_admin_when_another_exists(api, matrix, make_user):
    admin1 = make_user("a1@astro.test", role="admin")
    make_user("a2@astro.test", role="admin")
    api.force_authenticate(admin1)
    res = api.patch(f"/api/users/{admin1.id}", {"is_allowed": False}, format="json")
    assert res.status_code == 200


# --- Permission matrix toggle (FN-USR-06) ---------------------------------
def test_toggle_matrix_cell(api, matrix, make_user):
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    res = api.patch(
        "/api/role-permissions",
        {"role": "dev", "module": "Projects", "action": "create", "allowed": True},
        format="json",
    )
    assert res.status_code == 200
    assert RolePermission.objects.get(
        role="dev", module="Projects", action="create"
    ).allowed is True


def test_cannot_revoke_admin_user_management(api, matrix, make_user):
    api.force_authenticate(make_user("admin@astro.test", role="admin"))
    res = api.patch(
        "/api/role-permissions",
        {"role": "admin", "module": "User Management", "action": "edit", "allowed": False},
        format="json",
    )
    assert res.status_code == 409


# --- Working-Day Calendar (FN-X-03) ---------------------------------------
def test_working_days_between_excludes_weekends():
    # Mon 2026-06-01 .. Sun 2026-06-07 => 5 working days
    assert working_days_between(datetime.date(2026, 6, 1), datetime.date(2026, 6, 7)) == 5


def test_working_days_between_excludes_holidays(db):
    Holiday.objects.create(
        holiday_date=datetime.date(2026, 6, 3), name="ทดสอบวันหยุด", type="company"
    )
    # Same Mon–Fri week now has one holiday in the middle => 4
    assert working_days_between(datetime.date(2026, 6, 1), datetime.date(2026, 6, 5)) == 4


def test_working_days_endpoint(api, make_user):
    api.force_authenticate(make_user("dev@astro.test", role="dev"))
    res = api.get("/api/calendar/working-days?from=2026-06-01&to=2026-06-02")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["is_working_day"] is True
