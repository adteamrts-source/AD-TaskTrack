from django.contrib import admin

from .models import Project, ProjectTeamMember


class ProjectTeamMemberInline(admin.TabularInline):
    model = ProjectTeamMember
    extra = 0
    autocomplete_fields = ("user",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "project_name",
        "project_code",
        "client",
        "project_phase",
        "health_status",
        "deleted_at",
    )
    list_filter = ("project_phase", "health_status")
    search_fields = ("project_name", "project_code")
    autocomplete_fields = ("client", "po_user")
    readonly_fields = ("health_status", "health_reason", "delay_days", "created_at", "updated_at")
    inlines = [ProjectTeamMemberInline]

    def get_queryset(self, request):
        # Admin should see soft-deleted rows too.
        return Project.all_objects.all()
