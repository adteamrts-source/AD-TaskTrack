"""
Central Working-Day Calendar + config readers (PRD §5.7, §6.15 / FN-X-03).

Single source used by manday calc (§6.5), delay_days/health (§3.2), missing
submission (§6.10), and Daily Task day picker / is_ot default (§6.8). Keeping
this in one place avoids duplicated weekday/holiday logic across modules.
"""
from datetime import date, timedelta

from django.conf import settings

from .models import Holiday, SystemSetting


def _holiday_dates():
    return set(Holiday.objects.values_list("holiday_date", flat=True))


def is_working_day(d: date, holidays=None) -> bool:
    """Mon–Fri and not a holiday."""
    if d.weekday() >= 5:  # 5=Sat, 6=Sun
        return False
    if holidays is None:
        holidays = _holiday_dates()
    return d not in holidays


def working_days_between(start: date, end: date) -> int:
    """Inclusive count of working days in [start, end] (PRD §6.5 manday formula)."""
    if start is None or end is None or end < start:
        return 0
    holidays = _holiday_dates()
    count = 0
    cur = start
    while cur <= end:
        if is_working_day(cur, holidays):
            count += 1
        cur += timedelta(days=1)
    return count


def working_days_in_range(start: date, end: date):
    """List of {date, is_working_day} across [start, end] inclusive."""
    out = []
    if start is None or end is None or end < start:
        return out
    holidays = _holiday_dates()
    cur = start
    while cur <= end:
        out.append({"date": cur, "is_working_day": is_working_day(cur, holidays)})
        cur += timedelta(days=1)
    return out


# --- System config -------------------------------------------------------
def get_setting(key: str, default=None):
    """Read a SystemSetting, falling back to settings.ASTRO_DEFAULTS then `default`."""
    try:
        return SystemSetting.objects.get(key=key).value
    except SystemSetting.DoesNotExist:
        defaults = getattr(settings, "ASTRO_DEFAULTS", {})
        return defaults.get(key, default)


def get_int_setting(key: str, default: int) -> int:
    val = get_setting(key, default)
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def get_float_setting(key: str, default: float) -> float:
    val = get_setting(key, default)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def hours_per_working_day() -> int:
    """HOURS_PER_WORKING_DAY config (default 8) for hours<->manday (§6.6)."""
    return get_int_setting("HOURS_PER_WORKING_DAY", 8)
