from django.contrib import admin

from .models import DailyEntry


@admin.register(DailyEntry)
class DailyEntryAdmin(admin.ModelAdmin):
    list_display = ("work_date", "user", "title", "project", "hours", "is_ot", "source")
    list_filter = ("source", "is_ot", "work_date")
    search_fields = ("title",)
    autocomplete_fields = ("user", "task", "project")
    date_hierarchy = "work_date"
