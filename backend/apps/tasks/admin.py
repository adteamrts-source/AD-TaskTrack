from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "state", "status", "assigned_to", "estimated_manday")
    list_filter = ("state", "status", "source")
    search_fields = ("title",)
    autocomplete_fields = ("project", "assigned_to", "plan_item")
    readonly_fields = ("created_at", "updated_at")

    def get_queryset(self, request):
        return Task.all_objects.all()
