from django.contrib import admin

from .models import CostItem


@admin.register(CostItem)
class CostItemAdmin(admin.ModelAdmin):
    list_display = ("project", "category", "label", "qty_or_units", "months", "rate", "is_outsource")
    list_filter = ("category", "is_outsource")
    search_fields = ("label",)
    autocomplete_fields = ("project",)
