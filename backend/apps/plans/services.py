"""
Derived metrics: PlanItem/Project progress (FN-PT-02), expected progress and
health/delay_days (FN-PRJ-06, PRD §3.2). All deterministic and read-only —
never user-entered.

Progress weights by child Task.estimated_manday (Verified only); project rollup
weights by PlanItem.manday on a single, consistent denominator (PlanItems that
have child tasks). PlanItems with no child task => N/A (excluded from rollup).
"""
from datetime import date

from apps.settings_app.services import get_float_setting, working_days_between


def _f(value, default=0.0):
    return float(value) if value is not None else default


# --- Progress (FN-PT-02) --------------------------------------------------
def plan_item_progress(plan_item):
    """Verified-weighted progress for one PlanItem, or None if no child tasks."""
    children = list(plan_item.tasks.all())  # Task.objects hides soft-deleted
    if not children:
        return None
    total = sum(_f(t.estimated_manday) for t in children)
    if total <= 0:
        return None
    verified = sum(
        _f(t.estimated_manday) for t in children if t.status == "verified"
    )
    return verified / total


def project_progress(project):
    """manday-weighted rollup over PlanItems that have child tasks, or None."""
    numerator = 0.0
    denominator = 0.0
    for item in project.plan_items.all():
        prog = plan_item_progress(item)
        if prog is None or item.manday is None:
            continue
        w = _f(item.manday)
        numerator += prog * w
        denominator += w
    if denominator <= 0:
        return None
    return numerator / denominator


# --- Expected progress baseline (PRD §3.2) --------------------------------
def _expected_for_item(item, on: date):
    """Linear-by-working-days expected fraction for one PlanItem at date `on`."""
    if not item.start_date or not item.end_date:
        return None
    if on < item.start_date:
        return 0.0
    if on >= item.end_date:
        return 1.0
    total = working_days_between(item.start_date, item.end_date)
    if total <= 0:
        return 1.0
    elapsed = working_days_between(item.start_date, on)
    return max(0.0, min(1.0, elapsed / total))


def project_expected_progress(project, on: date):
    """manday-weighted expected progress across items with start+end+manday."""
    numerator = 0.0
    denominator = 0.0
    for item in project.plan_items.all():
        exp = _expected_for_item(item, on)
        if exp is None or item.manday is None:
            continue
        w = _f(item.manday)
        numerator += exp * w
        denominator += w
    if denominator <= 0:
        return None
    return numerator / denominator


# --- Health + delay_days (FN-PRJ-06) --------------------------------------
def compute_health(project, today: date = None):
    """Return (health_status, reason, delay_days) — deterministic."""
    today = today or date.today()
    items = list(project.plan_items.all())
    if not items:
        return ("not_started", "ยังไม่มีแผนงาน", 0)

    starts = [i.start_date for i in items if i.start_date]
    if starts and today < min(starts):
        return ("not_started", "ยังไม่ถึงวันเริ่มของแผนแรก", 0)

    milestones = [i for i in items if i.is_milestone]

    # delay_days: a milestone past its planned end and not yet complete.
    delay_days = 0
    for m in milestones:
        if m.end_date and today > m.end_date:
            prog = plan_item_progress(m)
            if prog is None or prog < 1:
                delay_days = max(delay_days, (today - m.end_date).days)

    # completed: every milestone fully verified.
    if milestones and all(plan_item_progress(m) == 1 for m in milestones):
        return ("completed", "ทุก milestone ตรวจครบแล้ว", 0)

    if delay_days > 0:
        return ("delay", f"milestone เกินแผน {delay_days} วัน", delay_days)

    actual = project_progress(project)
    expected = project_expected_progress(project, today)
    if actual is None or expected is None:
        return ("on_plan", "ยังไม่มีข้อมูล progress เพียงพอ", 0)

    gap = expected - actual
    at_risk_t = get_float_setting("health_threshold_at_risk", 0.05)
    delay_t = get_float_setting("health_threshold_delay", 0.15)
    a, e = round(actual * 100), round(expected * 100)
    if gap > delay_t:
        return ("delay", f"Delay เพราะ verified ({a}%) ต่ำกว่า expected ({e}%) เกิน {round(delay_t*100)}%", 0)
    if gap > at_risk_t:
        return ("at_risk", f"At Risk เพราะ verified ({a}%) ต่ำกว่า expected ({e}%)", 0)
    return ("on_plan", f"On Plan — verified ({a}%) ใกล้เคียง expected ({e}%)", 0)


def refresh_health(project):
    """Recompute and persist health_status/health_reason/delay_days."""
    status, reason, delay_days = compute_health(project)
    project.health_status = status
    project.health_reason = reason
    project.delay_days = delay_days
    project.save(update_fields=["health_status", "health_reason", "delay_days", "updated_at"])
    return project
