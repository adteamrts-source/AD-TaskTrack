from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "client_name",
            "client_abbreviation",
            "client_website",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_client_abbreviation(self, value):
        # Treat empty string as "no abbreviation" so the unique constraint
        # only applies to real values (PRD §6.3).
        if value in ("", None):
            return None
        qs = Client.objects.filter(client_abbreviation__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("ตัวย่อลูกค้านี้ถูกใช้แล้ว")
        return value
