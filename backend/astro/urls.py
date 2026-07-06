"""
Root URLConf.

- /admin/      Django Admin (user/role/client/holiday/settings backend, PRD §5.2)
- /accounts/   django-allauth (Google login)
- /api/        DRF API (mounted per-app in apps.api_urls)
- everything else -> React SPA (index.html), so client-side routes work.
"""
from django.contrib import admin
from django.urls import include, path, re_path

from apps.common.spa import spa_index

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/", include("apps.api_urls")),
    # SPA fallback: any non-/api, non-/admin path returns index.html.
    re_path(r"^(?!api/|admin/|accounts/|static/).*$", spa_index, name="spa"),
]
