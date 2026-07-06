from rest_framework import serializers

from .models import Holiday, SystemSetting


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "holiday_date", "name", "type"]
        read_only_fields = ["id"]


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ["id", "key", "value", "updated_by", "updated_at"]
        read_only_fields = ["id", "updated_by", "updated_at"]

    def validate_key(self, value):
        allowed = {
            "HOURS_PER_WORKING_DAY",
            "health_threshold_at_risk",
            "health_threshold_delay",
        }
        if value not in allowed:
            raise serializers.ValidationError("ไม่รู้จัก setting นี้")
        return value
