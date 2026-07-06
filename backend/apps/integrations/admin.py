from django.contrib import admin, messages

from .models import APIKey


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ("name", "key_prefix", "is_active", "last_used_at", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "key_prefix")
    readonly_fields = ("key_prefix", "hashed_key", "last_used_at", "created_at", "updated_at")
    fields = ("name", "is_active", "key_prefix", "last_used_at", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        if change:
            super().save_model(request, obj, form, change)
            return
        # New key: generate via the classmethod and surface the raw key ONCE.
        instance, raw_key = APIKey.generate(name=obj.name, created_by=request.user)
        instance.is_active = obj.is_active
        instance.save(update_fields=["is_active", "updated_at"])
        obj.pk = instance.pk  # so the admin redirects to the saved row
        messages.success(
            request,
            f"API key ของ '{instance.name}': {raw_key} — จดเก็บทันที ระบบจะไม่แสดงซ้ำอีก",
        )

    def get_queryset(self, request):
        return APIKey.objects.all()
