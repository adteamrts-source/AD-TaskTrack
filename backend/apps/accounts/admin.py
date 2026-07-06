from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import RolePermission, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "full_name", "role", "employment_type", "is_allowed", "is_staff")
    list_filter = ("role", "employment_type", "is_allowed", "is_staff")
    search_fields = ("email", "full_name")
    ordering = ("full_name", "email")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("ข้อมูลส่วนตัว", {"fields": ("full_name", "position", "employment_type")}),
        ("สิทธิ์ ASTRO", {"fields": ("role", "is_allowed")}),
        ("สิทธิ์ Django", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("วันที่", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at", "last_login")
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name", "role", "employment_type", "is_allowed", "password1", "password2"),
        }),
    )


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "module", "action", "allowed")
    list_filter = ("role", "module", "allowed")
    list_editable = ("allowed",)
    search_fields = ("module",)
    ordering = ("role", "module", "action")
