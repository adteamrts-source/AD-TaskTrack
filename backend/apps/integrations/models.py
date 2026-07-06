"""
APIKey — machine credentials for the external inbound API (/api/external/v1/).

Keys are stored hashed (SHA-256); the raw key (astro_<token>) is shown exactly
once at creation (Django Admin message or the create_api_key command). A lost
key is rotated, never recovered. key_prefix is kept for display/lookup.
"""
import hashlib
import secrets

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel

KEY_PREFIX = "astro_"
PREFIX_DISPLAY_LEN = 12


def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


class APIKey(BaseModel):
    name = models.CharField(max_length=128, help_text="ระบบภายนอกที่ถือ key นี้")
    key_prefix = models.CharField(max_length=16, db_index=True, editable=False)
    hashed_key = models.CharField(max_length=64, unique=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.key_prefix}…)"

    @classmethod
    def generate(cls, name: str, created_by=None) -> tuple["APIKey", str]:
        """Create a key; returns (instance, raw_key). Raw key is never stored."""
        raw_key = KEY_PREFIX + secrets.token_urlsafe(32)
        instance = cls.objects.create(
            name=name,
            key_prefix=raw_key[:PREFIX_DISPLAY_LEN],
            hashed_key=hash_key(raw_key),
            created_by=created_by,
        )
        return instance, raw_key
