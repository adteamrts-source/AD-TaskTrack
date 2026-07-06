"""Client Master (PRD §6.3, §7). Managed mainly in Django Admin; the app
exposes a list (for dropdowns) and inline create from the Project form."""
from django.db import models

from apps.common.models import BaseModel


class Client(BaseModel):
    client_name = models.CharField(max_length=255)
    # Optional, but unique when present (stored NULL when blank so multiples
    # without an abbreviation don't collide).
    client_abbreviation = models.CharField(
        max_length=32, null=True, blank=True, unique=True
    )
    client_website = models.CharField(max_length=255, blank=True)  # not URL-validated (MVP)
    is_active = models.BooleanField(default=True)  # active_status

    class Meta:
        ordering = ["client_name"]

    def __str__(self):
        return self.client_abbreviation or self.client_name
