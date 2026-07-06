"""
Allauth social adapter — allowlist enforcement + first-login provisioning
(FN-AUTH-01 / FN-AUTH-03, PRD §6.1).

Allowlist model: the User table itself is the allowlist. An Admin pre-creates a
User (email + is_allowed=True, default role=dev) via User Management; the first
Google login matches that record by email and connects to it. No matching
allowed record => login is refused. New accounts are never auto-created here.
"""
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import render


def _deny(request):
    login_url = getattr(settings, "ACCOUNT_LOGOUT_REDIRECT_URL", "/login") or "/login"
    return ImmediateHttpResponse(
        render(request, "account/not_allowed.html", {"login_url": login_url}, status=403)
    )


class AstroSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_connect_redirect_url(self, request, socialaccount):
        # If allauth ever refreshes an account connection, return to the same
        # post-login destination instead of its account-management page.
        return getattr(settings, "LOGIN_REDIRECT_URL", "/my-work") or "/my-work"

    def is_open_for_signup(self, request, sociallogin):
        # Never auto-create; the account must already be on the allowlist.
        return False

    def pre_social_login(self, request, sociallogin):
        email = (sociallogin.user.email or "").strip().lower()
        if not email:
            raise _deny(request)

        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise _deny(request)

        if not user.is_allowed or not user.is_active:
            raise _deny(request)

        # Fill name from Google on first login if Admin left it blank.
        google_name = (sociallogin.account.extra_data.get("name") or "").strip()
        if google_name and not user.full_name:
            user.full_name = google_name
            user.save(update_fields=["full_name", "updated_at"])

        # Email authentication can resolve an existing allowlisted User before
        # this hook runs. The provider account is still unsaved in that case,
        # so explicitly connect it here to persist both SocialAccount and the
        # Calendar OAuth token supplied by this same Google login.
        if sociallogin.account.pk is None:
            sociallogin.connect(request, user)
