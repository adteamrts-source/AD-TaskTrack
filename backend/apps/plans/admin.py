from django.contrib import admin

from .models import PlanItem, PlanItemDependency, PlanItemRevision


@admin.register(PlanItem)
class PlanItemAdmin(admin.ModelAdmin):
    list_display = ("phase", "task", "project", "manday", "start_date", "end_date", "is_milestone")
    list_filter = ("is_milestone", "input_mode")
    search_fields = ("phase", "task")
    autocomplete_fields = ("project",)


@admin.register(PlanItemDependency)
class PlanItemDependencyAdmin(admin.ModelAdmin):
    list_display = ("project", "predecessor", "successor", "relation_type", "lag_days")
    list_filter = ("relation_type",)


@admin.register(PlanItemRevision)
class PlanItemRevisionAdmin(admin.ModelAdmin):
    list_display = ("plan_item", "field_name", "old_value", "new_value", "changed_by", "changed_at")
    list_filter = ("field_name",)
    readonly_fields = ("changed_at",)
