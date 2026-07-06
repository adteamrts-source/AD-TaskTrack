from django.contrib import admin

from .models import Holiday, SystemSetting


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("holiday_date", "name", "type")
    list_filter = ("type",)
    search_fields = ("name",)
    ordering = ("holiday_date",)
    date_hierarchy = "holiday_date"


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_by", "updated_at")
    search_fields = ("key",)
    readonly_fields = ("updated_at",)

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
