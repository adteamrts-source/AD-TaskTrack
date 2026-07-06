"""Phase 11 (rev.3): สรุปงานของฉัน — work summary + period-log notes."""
import datetime

import pytest

from apps.accounts.models import RolePermission
from apps.clients.models import Client
from apps.daily.models import DailyEntry, WorkSummaryNote
from apps.projects.models import Project

pytestmark = pytest.mark.django_db


@pytest.fixture
def project(db):
    client = Client.objects.create(client_name="ACME", client_abbreviation="ACME")
    return Project.objects.create(project_name="Portal", client=client)


TODAY = datetime.date.today()


def backdate(note, days):
    WorkSummaryNote.objects.filter(id=note.id).update(
        created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    )


def test_summary_groups_own_entries_by_project_ordered(api, matrix, make_user, project):
    me = make_user("dev@astro.test", role="dev")
    other = make_user("other@astro.test", role="dev")
    DailyEntry.objects.create(user=me, work_date=TODAY, project=project, title="วันนี้", hours="2.0")
    DailyEntry.objects.create(
        user=me, work_date=TODAY - datetime.timedelta(days=2), project=project, title="เมื่อวานซืน", hours="3.0"
    )
    DailyEntry.objects.create(user=me, work_date=TODAY, title="งานทั่วไป", hours="1.0")
    DailyEntry.objects.create(user=other, work_date=TODAY, project=project, title="ของคนอื่น", hours="8.0")

    api.force_authenticate(me)
    data = api.get("/api/my-summary", {"preset": "1w"}).json()
    assert data["total_hours"] == "6.0"
    assert len(data["groups"]) == 2  # Portal + ทั่วไป (ของคนอื่นไม่ปน)
    portal = next(g for g in data["groups"] if g["project_id"] == project.id)
    assert [e["title"] for e in portal["entries"]] == ["เมื่อวานซืน", "วันนี้"]
    assert portal["hours"] == "5.0"


def test_summary_custom_range(api, matrix, make_user, project):
    me = make_user("dev@astro.test", role="dev")
    DailyEntry.objects.create(
        user=me, work_date=TODAY - datetime.timedelta(days=30), project=project, title="เก่า", hours="4.0"
    )
    api.force_authenticate(me)
    assert api.get("/api/my-summary", {"preset": "1w"}).json()["groups"] == []
    frm = (TODAY - datetime.timedelta(days=40)).isoformat()
    assert len(api.get("/api/my-summary", {"from": frm, "to": TODAY.isoformat()}).json()["groups"]) == 1


# --- Notes: period log --------------------------------------------------------
def test_notes_are_a_log_multiple_per_project(api, matrix, make_user, project):
    me = make_user("dev@astro.test", role="dev")
    api.force_authenticate(me)

    r1 = api.post("/api/my-summary/notes", {"project": project.id, "body": "<p>สัปดาห์นี้ติดปัญหา API</p>"}, format="json")
    r2 = api.post("/api/my-summary/notes", {"project": project.id, "body": "<p>ขอ access UAT</p>"}, format="json")
    assert r1.status_code == 201 and r2.status_code == 201
    assert WorkSummaryNote.objects.filter(user=me, project=project).count() == 2  # ไม่ทับกัน

    group = api.get("/api/my-summary", {"preset": "1w"}).json()["groups"][0]
    assert [n["id"] for n in group["notes"]] == [r1.json()["id"], r2.json()["id"]]  # เรียงตามเวลาเขียน


def test_notes_filtered_by_created_range(api, matrix, make_user, project):
    me = make_user("dev@astro.test", role="dev")
    old = WorkSummaryNote.objects.create(user=me, project=project, body="<p>ช่วงก่อน</p>")
    backdate(old, 20)
    recent = WorkSummaryNote.objects.create(user=me, project=project, body="<p>ช่วงนี้</p>")

    api.force_authenticate(me)
    group = api.get("/api/my-summary", {"preset": "1w"}).json()["groups"][0]
    assert [n["id"] for n in group["notes"]] == [recent.id]  # ประวัติเก่าไม่โผล่ในช่วงนี้ แต่ยังอยู่ใน DB

    # เลือกช่วงเก่า → เห็น note เก่า (ประวัติไม่หาย)
    frm = (TODAY - datetime.timedelta(days=25)).isoformat()
    to = (TODAY - datetime.timedelta(days=15)).isoformat()
    group = api.get("/api/my-summary", {"from": frm, "to": to}).json()["groups"][0]
    assert [n["id"] for n in group["notes"]] == [old.id]


def test_note_validation_and_general_bucket(api, matrix, make_user):
    me = make_user("dev@astro.test", role="dev")
    api.force_authenticate(me)
    assert api.post("/api/my-summary/notes", {"body": "  "}, format="json").status_code == 400
    assert api.post("/api/my-summary/notes", {"project": 999, "body": "x"}, format="json").status_code == 404

    res = api.post("/api/my-summary/notes", {"body": "<p>เรื่องทั่วไป</p>"}, format="json")
    assert res.status_code == 201 and res.json()["project"] is None
    group = api.get("/api/my-summary", {"preset": "1w"}).json()["groups"][0]
    assert group["project_id"] is None and group["entries"] == []  # note-only group


def test_note_edit_delete_own_only(api, matrix, make_user, project):
    me = make_user("dev@astro.test", role="dev")
    other = make_user("other@astro.test", role="dev")
    note = WorkSummaryNote.objects.create(user=me, project=project, body="<p>ของฉัน</p>")

    api.force_authenticate(other)
    assert api.patch(f"/api/my-summary/notes/{note.id}", {"body": "x"}, format="json").status_code == 404
    assert api.delete(f"/api/my-summary/notes/{note.id}").status_code == 404

    api.force_authenticate(me)
    res = api.patch(f"/api/my-summary/notes/{note.id}", {"body": "<p>แก้แล้ว</p>"}, format="json")
    assert res.status_code == 200 and res.json()["body"] == "<p>แก้แล้ว</p>"
    assert api.delete(f"/api/my-summary/notes/{note.id}").status_code == 204
    assert not WorkSummaryNote.objects.filter(id=note.id).exists()


def test_summary_requires_my_work_permission(api, matrix, make_user):
    me = make_user("dev@astro.test", role="dev")
    RolePermission.objects.filter(role="dev", module="My Work").update(allowed=False)
    api.force_authenticate(me)
    assert api.get("/api/my-summary").status_code == 403
    assert api.post("/api/my-summary/notes", {"body": "x"}, format="json").status_code == 403


# --- Meeting Summary integration --------------------------------------------
def test_meeting_summary_shows_notes_in_range(api, matrix, make_user, project):
    dev = make_user("dev@astro.test", role="dev", full_name="Dev One")
    note = WorkSummaryNote.objects.create(user=dev, project=project, body="<p>ขอ access UAT</p>")
    old = WorkSummaryNote.objects.create(user=dev, project=project, body="<p>เก่ามาก</p>")
    backdate(old, 60)

    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    groups = api.get("/api/meeting-summary", {"preset": "1w"}).json()["groups"]
    assert len(groups) == 1  # group เกิดแม้ไม่มี daily entry
    g = groups[0]
    assert [n["id"] for n in g["notes"]] == [note.id]  # created_at นอกช่วงไม่โผล่
    assert g["notes"][0]["user_name"] == "Dev One"
    assert "created_at" in g["notes"][0]


def test_meeting_summary_notes_user_filter_and_key(api, matrix, make_user, project):
    u1 = make_user("a@astro.test", role="dev")
    u2 = make_user("b@astro.test", role="dev")
    WorkSummaryNote.objects.create(user=u1, project=project, body="<p>ของ a</p>")
    WorkSummaryNote.objects.create(user=u2, project=project, body="<p>ของ b</p>")
    DailyEntry.objects.create(user=u1, work_date=TODAY, project=project, title="งาน", hours="2.0")

    api.force_authenticate(make_user("dm@astro.test", role="dm"))
    g = api.get("/api/meeting-summary", {"preset": "1w", "user": u1.id}).json()["groups"][0]
    assert len(g["notes"]) == 1 and g["notes"][0]["user"] == u1.id
    assert "notes" in g and "entries" in g
