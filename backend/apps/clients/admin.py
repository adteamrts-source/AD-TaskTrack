from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("client_name", "client_abbreviation", "client_website", "is_active")
    list_filter = ("is_active",)
    search_fields = ("client_name", "client_abbreviation")
    list_editable = ("is_active",)
