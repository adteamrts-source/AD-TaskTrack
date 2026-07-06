# ASTRO SYSTEM — Functions Design (v0.1)
### เอกสารออกแบบฟังก์ชันระดับ Dev-Handoff · คู่กับ PRD v1.3 + Sitemap & Screen Spec v0.3

| | |
|---|---|
| **เวอร์ชันเอกสาร** | v0.1 |
| **อ้างอิง** | PRD v1.3 (ครอบ v0.7) · Sitemap & Screen Spec v0.3 · Data Model PRD §7 · Design Tokens v0.2 |
| **ขอบเขต** | ทั้งระบบ (§6.1–6.14) — เขียนเต็มทีละโมดูล |
| **ระดับรายละเอียด** | Dev-handoff: Input / Validation / Process-Logic / API / Error ครบต่อฟังก์ชัน |
| **สถานะรอบนี้** | ✅ ครบทุกโมดูล §6.1–6.15 + Cross-cutting (dev-handoff) · synced กับ PRD v1.3 (Settings/Client → Django Admin · Overview post-MVP) |

> เอกสารนี้ตอบ **"แต่ละฟังก์ชันทำงานยังไง"** (PRD = what/why, ScreenSpec = หน้าไหนมีอะไร, เอกสารนี้ = logic + API ต่อฟังก์ชัน)

---

## สถานะการเขียนรายโมดูล

| โมดูล (PRD) | รหัส FN | สถานะ |
|---|---|---|
| Cross-cutting | FN-X-* | ✅ รอบนี้ |
| §6.1 Authentication | FN-AUTH-* | ✅ รอบนี้ |
| §6.2 User & Permission | FN-USR-* | ✅ รอบนี้ |
| §6.8 My Work / Daily Task | FN-MW-* | ✅ รอบนี้ |
| §6.3 Client Master | FN-CLI-* | ✅ |
| §6.4 Projects | FN-PRJ-* | ✅ |
| §6.5 Plan / Timeline | FN-PLAN-* | ✅ |
| §6.6 PlanItem → Task | FN-PT-* | ✅ |
| §6.7 Task Management | FN-TASK-* | ✅ |
| §6.9 Google Calendar | FN-CAL-* | ✅ |
| §6.10 Meeting Summary | FN-MS-* | ✅ |
| §6.11 Budget | FN-BUD-* | ✅ |
| §6.12 / 6.14 Project Detail / Team | FN-PRJD-*/FN-TEAM-* | ✅ |
| §6.13 Overview Dashboard | FN-OVW-* | ⏸️ post-MVP |
| §6.15 Settings & Working-Day Calendar | FN-SET-* | ✅ (Django Admin) |

---

## 1. บทนำ

ASTRO SYSTEM เป็นระบบบันทึกงานประจำวัน (Daily Task) + ประเมินโครงการ (pre-sale) + จัดการแผน/งานของทีมซอฟต์แวร์ภายในองค์กร เอกสารนี้แตกแต่ละความสามารถใน PRD ออกเป็น **ฟังก์ชัน** ที่ dev นำไปสร้าง API + UI behavior ได้ตรง โดยอ้าง field จาก Data Model (PRD §7) และกฎจาก Module Requirements (PRD §6)

**วิธีอ่าน:** ทุกฟังก์ชันมีรหัส `FN-<โมดูล>-<เลข>` และผูกกลับไปยัง requirement ID เดิม (AUTH-*, UM-*, MW-*, CAL-*, MS-* …) เพื่อ trace ได้สองทาง

---

## 2. Conventions (กฎร่วมทั้งเอกสาร)

### 2.1 API
- Base path: **`/api/`** (Django REST Framework)
- รูปแบบ resource: REST (`GET` list/detail, `POST` create, `PATCH` partial update, `DELETE`)
- **Auth = session cookie** (Google Login ผ่าน `django-allauth`) — DRF `SessionAuthentication`; method ที่เปลี่ยนข้อมูล (`POST/PATCH/DELETE`) ต้องแนบ **CSRF token**
- วันที่ใช้ ISO `YYYY-MM-DD`; เวลา timezone `Asia/Bangkok`; เลขเงิน/ชม. เป็น decimal

### 2.2 รูปแบบ Response
- **detail:** คืน object ของ resource ตรงๆ
- **list:** paginated → `{ count, next, previous, results:[...] }` (ทุก list หลักมี pagination ตาม PRD)
- **success ของ action:** คืน object ที่เปลี่ยนแล้ว (เช่น entry ที่เพิ่ง insert)

### 2.3 รูปแบบ Error (มาตรฐาน DRF)
| HTTP | กรณี | body |
|---|---|---|
| 400 | validation ไม่ผ่าน | `{ "<field>": ["ข้อความ"] }` หรือ `{ "detail": "..." }` |
| 401 | ยังไม่ login / session หมด | `{ "detail": "ยังไม่ได้เข้าสู่ระบบ" }` |
| 403 | login แล้วแต่ไม่มีสิทธิ์ (RBAC) | `{ "detail": "ไม่มีสิทธิ์ใช้งานส่วนนี้" }` |
| 404 | ไม่พบ / ถูก soft-delete | `{ "detail": "ไม่พบข้อมูล" }` |
| 409 | ชนกฎ business (เช่น claim ซ้ำ) | `{ "detail": "..." }` |

### 2.4 สิทธิ์ (RBAC)
- ทุก endpoint ตรวจผ่าน DRF permission class → เทียบ **`RolePermission(role, module, action)`** (source of truth ตอน request — PRD §5.4)
- `module`/`action` (`view/create/edit/delete`) ตาม Permission Matrix (PRD §4.1)
- Django `User/Group/Permission` ใช้คุมเฉพาะหน้า Django Admin ไม่ใช่ API หลัก
- **module ใน matrix (PRD §4.1):** Projects · **Task** · Plan/Timeline · Budget · My Work · Meeting Summary · Client Master · User Management · Team Members
- **นอก matrix:** **Calendar (อ่าน) + Daily entry = self-scoped** (ตรวจแค่ login, เขียนได้เฉพาะของตัวเอง) · **claim = capability เฉพาะ Dev** (ของตัวเอง — ไม่ใช่ `Task:edit` เต็ม) · **Settings / Client Master / Holiday = Django Admin** (ไม่อยู่ใน matrix แอป)

### 2.5 Audit / Soft-delete
- ทุก entity มี `created_at` / `updated_at` (อัตโนมัติ)
- `Project`, `Task` ใช้ **soft-delete** ผ่าน `deleted_at` — query หลักกรอง `deleted_at IS NULL` เสมอ
- `DailyEntry` ลบจริงได้ (เป็นของผู้ใช้เอง) — ไม่ใช่ soft-delete

### 2.6 สัญกรณ์ Input
`field — type, required/optional, rule, default` · enum เขียนเป็น `a/b/c`

### 2.7 Config ระบบ
| key | default | ใช้ที่ |
|---|---|---|
| `HOURS_PER_WORKING_DAY` | 8 | แปลง actual hours ↔ manday **เฉพาะตอนเทียบ Manday Variance** (PRD §6.6); ปิด/ไม่ใช้ได้ถ้าไม่เทียบ manday |
| working days / holidays | จ–ศ + วันหยุดที่ตั้ง | Working-Day Calendar (FN-X-03): manday, missing submission, ตัวเลือกวันใน My Work, default ค่า `is_ot` |

---

## 3. Actors & Permission Quick-Ref (จาก PRD §4)

| Role | สรุปสิทธิ์ |
|---|---|
| **Admin** | จัดการ user/permission/ตั้งค่าระบบ + เห็น/แก้ข้อมูลหลัก (รวมเงินเดือนใน Budget) |
| **DM** | สร้าง project, ทำ timeline/budget pre-sale, เห็นภาพรวมทั้งหมด (รวมเงินเดือน) — *อยู่ใต้ matrix ไม่ hardcode bypass* |
| **BSA** | แก้ plan/timeline, แตก task, assign, verify; Budget เห็นยอดรวม+จำนวนคน **ไม่เห็นเงินเดือน** |
| **Dev** | ดู/claim task, ทำงาน, กรอก Daily Task; Budget เห็นยอดรวมต่อหมวด+Grand Total เท่านั้น |

> ทุกคนต้องกรอก Daily Task ในวันทำงาน (MW-5) — รวม Admin/DM/BSA

---

## 4. Cross-cutting Functions (FN-X-*)

#### FN-X-01 · Auth Guard (ตรวจ session ทุก request)
- **Ref:** §5.3, §6.1 | **Actor:** ระบบ
- **Process:** ทุก `/api/*` ตรวจ session → ไม่มี/หมดอายุ → `401`; มี → แนบ `request.user` (+ role) ให้ permission class ใช้ต่อ
- **Related:** FN-X-02, FN-AUTH-01/04

#### FN-X-02 · RBAC Check (ตรวจสิทธิ์ราย module/action)
- **Ref:** §4.1, §5.4 | **Actor:** ระบบ
- **Input:** `(role, module, action)` จาก request + endpoint metadata
- **Process:** lookup `RolePermission` ที่ `role=role AND module=module AND action=action AND allowed=true` → ไม่พบ → `403`
- **Note:** caching matrix ต่อ request ได้ แต่ source of truth คือ DB
- **API:** ภายใน (permission class) | **Related:** FN-USR-05/06

#### FN-X-03 · Working-Day Calendar Lookup
- **Ref:** §5.7 | **Actor:** ระบบ
- **Input:** `date` หรือ `range`
- **Process:** คืนว่าวันนั้นเป็น **วันทำงาน** หรือไม่ (จ–ศ หักวันหยุดที่ตั้งไว้) — ใช้ร่วมโดย: คำนวณ manday, delay_days, missing submission, ตัวเลือกวันใน My Work (5 วันทำงาน)
- **API:** `GET /api/calendar/working-days?from=&to=` → res `[{date, is_working_day}]`
- **Related:** FN-MW-07, FN-MS-08

#### FN-X-04 · In-app Reminder (ยังไม่กรอก Daily Task)
- **Ref:** MW-6, MW-7 | **Actor:** ระบบ → user
- **Process:** ถ้าวันนี้เป็นวันทำงาน (FN-X-03) และ user ยังไม่มี DailyEntry ของวันนี้ → แสดง reminder ใน UI; ออกแบบ payload ให้รองรับ email channel ในอนาคต (MW-7) แต่ MVP ส่งเฉพาะ in-app
- **API:** `GET /api/daily/reminder` → res `{ needs_submission: bool, work_date }`
- **Related:** FN-MW-09

#### FN-X-05 · Soft-delete + Audit (pattern)
- **Ref:** §2.5 | **Actor:** ระบบ
- **Process:** `DELETE` ของ Project/Task = ตั้ง `deleted_at=now()` (ไม่ลบจริง); ทุก write set `updated_at`; query หลักกรอง `deleted_at IS NULL`
- **Related:** FN-PRJ-*, FN-TASK-*

---

## 5. §6.1 Authentication (FN-AUTH-*)

#### FN-AUTH-01 · Google Login + Allowlist Check
- **หน้า/Ref:** P0 Login · AUTH-1, allowlist (§6.1) | **Actor:** ผู้ใช้ที่ยังไม่ login | **Trigger:** กดปุ่ม "เข้าสู่ระบบด้วย Google"
- **Input:** OAuth flow ของ `django-allauth` (ไม่มี field ฝั่งเรา)
- **Process:**
  1. redirect ไป Google OAuth → callback คืน Google account (email)
  2. หา `User` ที่ `email` ตรง
     - พบ และ `is_allowed=true` → สร้าง session → เข้าระบบ
     - พบ แต่ `is_allowed=false` → ปฏิเสธ (ไม่สร้าง session)
     - ไม่พบ → ไป **FN-AUTH-03** (provisioning ครั้งแรก) แล้วประเมิน allowlist อีกครั้ง
  3. สำเร็จ → redirect `/my-work` (ScreenSpec P0 → P1)
- **Output:** session cookie + redirect หน้าหลัก
- **Validation/Error:** ไม่อยู่ allowlist → หน้า login แสดง "อีเมลนี้ยังไม่ได้รับอนุญาตให้เข้าระบบ ติดต่อผู้ดูแล" (ไม่ระบุว่ามี/ไม่มีบัญชี — กันการคาดเดา)
- **API:** จัดการโดย allauth (`/accounts/google/login/…`)
- **Permission:** public (ก่อน login)
- **Related:** FN-AUTH-02, FN-AUTH-03, FN-AUTH-05

#### FN-AUTH-02 · Grant + เชื่อม Google Calendar (read-only)
- **Ref:** AUTH-2, §5.3 | **Actor:** user ที่ login แล้ว | **Trigger:** ครั้งแรกที่เปิด My Work / กด grant
- **Process:** ขอ scope calendar (read-only) ผ่าน allauth → เก็บ token; ใช้ดึง event เป็น suggestion เท่านั้น (MVP ไม่เขียนกลับ)
- **Output:** สถานะ `calendar_connected=true`
- **Validation/Error:** ผู้ใช้ปฏิเสธ scope → rail "ประชุมวันนี้" แสดงปุ่มเชื่อมต่อแทนรายการ (ไม่บล็อกการกรอก manual)
- **API:** allauth scope grant; ฝั่งเรา `GET /api/me` คืน `calendar_connected`
- **Related:** FN-CAL-01, FN-MW-02

#### FN-AUTH-03 · First-login Provisioning (default role = dev)
- **Ref:** §6.1 bootstrap | **Actor:** ระบบ | **Trigger:** Google login สำเร็จแต่ยังไม่มี User record
- **Process:** ถ้า email อยู่ใน allowlist ที่ Admin เตรียมไว้ (`is_allowed=true` ถูกตั้งล่วงหน้า) → สร้าง `User{email, full_name จาก Google, role="dev", is_allowed=true}`; ถ้าไม่ถูกเตรียม → ไม่สร้าง session (เหมือน FN-AUTH-01 เคสไม่อยู่ allowlist)
- **Note:** Admin คนแรกมาจาก `createsuperuser` (นอก flow นี้)
- **Related:** FN-USR-02 (Admin เพิ่ม user/allowlist ล่วงหน้า)

#### FN-AUTH-04 · Logout
- **Ref:** §6.1 | **Actor:** user | **Trigger:** ปุ่ม "ออกจากระบบ" ใน sidebar
- **Process:** ลบ session → redirect หน้า Login
- **API:** `POST /api/auth/logout` (หรือ allauth logout) → 204
- **Related:** FN-X-01

#### FN-AUTH-05 · Get Current User (`/me`)
- **Ref:** §4, §6.1 | **Actor:** user | **Trigger:** หลัง login / โหลดแอป
- **Process:** คืนข้อมูล user ปัจจุบัน + role + ชุดสิทธิ์ที่ frontend ใช้ซ่อน/แสดงเมนู (เมนูไม่มีสิทธิ์ให้ **ซ่อน** ไม่ใช่ disable — ScreenSpec §2)
- **Output:** `{ id, full_name, role, position, employment_type, calendar_connected, permissions:[{module,action}] }`
- **API:** `GET /api/me`
- **Permission:** login เท่านั้น
- **Related:** FN-X-02, FN-USR-05

---

## 6. §6.2 User & Permission Management (FN-USR-*)

> Module = `User Management` · เข้าได้เฉพาะ role ที่ matrix เปิดให้ (ปกติ Admin) · UI ต่อยอดบน Django Admin (§5.2)

#### FN-USR-01 · List Users
- **หน้า/Ref:** P7 Admin · UM-1 | **Actor:** Admin | **Trigger:** เปิดหน้าจัดการผู้ใช้
- **Input (query):** `search?` (ชื่อ/email), `role?`, `is_allowed?`, `page?`
- **Process:** คืนรายชื่อ user (paginated) + ฟิลด์สรุป (full_name, email, role, position, employment_type, is_allowed)
- **API:** `GET /api/users?search=&role=&is_allowed=&page=`
- **Permission:** `User Management:view`
- **Related:** FN-USR-02/03

#### FN-USR-02 · Create User (+ allowlist)
- **Ref:** UM-1/2/3, allowlist | **Actor:** Admin | **Trigger:** ปุ่ม "เพิ่มผู้ใช้"
- **Input:**
  - `full_name` — text, required
  - `email` — email, required, **unique**
  - `role` — admin/dm/bsa/dev, required (default dev)
  - `position` — text, optional
  - `employment_type` — permanent/contractor, required
  - `is_allowed` — boolean, default true (เปิดให้ login ได้)
- **Process:** validate email unique → สร้าง User → (ผู้ใช้ login ด้วย Google ครั้งแรกจะ match record นี้ผ่าน FN-AUTH-01)
- **Output:** user object ที่สร้าง
- **Validation/Error:** email ซ้ำ → `400 {"email":["อีเมลนี้มีอยู่แล้ว"]}` · role ไม่อยู่ใน enum → 400
- **API:** `POST /api/users`
- **Permission:** `User Management:create`
- **Related:** FN-AUTH-03

#### FN-USR-03 · Edit User (role / type / allowlist)
- **Ref:** UM-1/2/3 | **Actor:** Admin | **Trigger:** แก้ไขในแถวผู้ใช้
- **Input (partial):** `full_name? / position? / role? / employment_type? / is_allowed?` (email แก้ไม่ได้หลังสร้าง — เป็น identity ของ Google login)
- **Process:** update field ที่ส่งมา; ถ้าเปลี่ยน `role` → สิทธิ์ของ user มีผลทันทีรอบ request ถัดไป (อิง matrix ของ role ใหม่)
- **Output:** user ที่อัปเดต
- **Validation/Error:** ปิด `is_allowed` ของตัวเอง/Admin คนสุดท้าย → เตือน/บล็อก (กันล็อกตัวเองออกจากระบบ) `409`
- **API:** `PATCH /api/users/:id`
- **Permission:** `User Management:edit`
- **Related:** FN-X-02

#### FN-USR-04 · Disable / Remove User
- **Ref:** UM-1 | **Actor:** Admin | **Trigger:** ปุ่มปิดการใช้งาน
- **Process:** MVP ใช้ **ตั้ง `is_allowed=false`** (กันข้อมูล Daily Task/ประวัติหาย) แทนการลบจริง; ผู้ใช้ที่ถูกปิด login ไม่ได้ทันที
- **Validation/Error:** เป็น Admin คนสุดท้าย → บล็อก `409`
- **API:** `PATCH /api/users/:id` `{is_allowed:false}`
- **Related:** FN-USR-03

#### FN-USR-05 · View Permission Matrix
- **Ref:** UM-4, §4.1 | **Actor:** Admin | **Trigger:** เปิดแท็บ Permission
- **Process:** คืน matrix ทั้งหมด `role × module × action` พร้อมสถานะ `allowed` — แสดงเป็นตาราง toggle
- **Output:** `[{role, module, action, allowed}]`
- **API:** `GET /api/role-permissions`
- **Permission:** `User Management:view`
- **Related:** FN-X-02, FN-USR-06

#### FN-USR-06 · Edit Permission Matrix (toggle สิทธิ์)
- **Ref:** UM-4 | **Actor:** Admin | **Trigger:** กด toggle ช่อง role×module×action
- **Input:** `role`, `module`, `action`, `allowed`
- **Process:** upsert แถว RolePermission → มีผล **ทันที** ตอน request ถัดไปของผู้ใช้ role นั้น (source of truth — FN-X-02)
- **Output:** แถวที่อัปเดต
- **Validation/Error:** ปิดสิทธิ์ที่ทำให้ Admin เข้าจัดการ matrix ไม่ได้ → เตือน/กันพลาด (กัน lockout) `409`
- **API:** `PATCH /api/role-permissions` `{role, module, action, allowed}`
- **Permission:** `User Management:edit`
- **Related:** FN-USR-05

---

## 7. §6.8 My Work / Daily Task (FN-MW-*)

> **หัวใจของระบบ** — หน้าแรกหลัง login (ScreenSpec P1) · entry-first วัดที่พฤติกรรม (composer inline + 3 แหล่งเห็นพร้อมกัน + รายการติด composer + ≤1 แตะ) ไม่ใช่จำนวนคอลัมน์ (PRD MW-12)
>
> **DailyEntry 3 ชนิด (PRD §6.8):** A = มี `task_id` (เก็บ `status_snapshot`) · B = มี `project_id` เดี่ยว (ไม่มี status) · C = General (ไม่มีทั้งคู่). *การ tag โครงการ = ตั้ง `project_id` เท่านั้น ไม่สร้าง Task*
>
> **OT (PRD MW-13):** ทุก create (FN-MW-01/02/03) รับ `is_ot` — checkbox ตอนกรอก; **default = true ถ้า `work_date` เป็นวันหยุด/นอกวันทำงาน** (FN-X-03), false ถ้าวันทำงานปกติ; สลับเองได้. **ไม่มีเพดาน ชม./วัน**

#### FN-MW-01 · บันทึก Daily Task — พิมพ์เอง (manual)
- **หน้า/Ref:** P1 · MW-8, MW-10, MW-11 | **Actor:** ทุก role | **Trigger:** พิมพ์ใน composer → Enter/ปุ่มบันทึก | **Pre:** login + เลือกวัน (default วันนี้)
- **Input:**
  - `text` — string, required, 1–500 ตัวอักษร → ไป `title`
  - `project_id` — FK Project | "general" | ว่าง, optional, **default = โครงการล่าสุดที่ผู้ใช้เลือก**
  - `hours` — decimal, required, step 0.5, **min 0.5**, default 1.0 (ค่า config "ชม./working day")
  - `is_ot` — boolean, default = (true ถ้าวันที่เลือกเป็นวันหยุด/นอกวันทำงาน, ไม่งั้น false); checkbox "OT" สลับได้ (MW-13)
  - *ไม่มี `status` — manual ไม่มี `task_id` → ชนิด B/C ไม่เก็บ `status_snapshot`*
- **Process:**
  1. validate `text` ไม่ว่าง, `hours ≥ 0.5` (และเป็นพหุคูณ 0.5)
  2. สร้าง `DailyEntry{ user=me, work_date=วันที่เลือก, source="manual", title, project_id, hours, task_id=null, status_snapshot=null }` โดยชนิด General derive จาก `task_id=null` และ `project_id=null`
  3. จำ `project_id` เป็น "ล่าสุด" สำหรับ entry ถัดไป
  4. prepend เข้า list ของวัน → แสดงใต้ composer ทันที + อัปเดตผลรวม ชม. (FN-MW-09)
- **Output:** entry ใหม่อยู่บนสุดของ "บันทึกของวันนี้" + toast
- **Validation/Error:** `text` ว่าง → inline "กรอกรายละเอียดงาน"; `hours<0.5` คุมที่ stepper (กดต่ำกว่าไม่ได้)
- **API:** `POST /api/daily` req `{work_date, source:"manual", title, project_id?, hours, is_ot}` → res `{entry}`
- **Permission:** `My Work:create` (เฉพาะของตัวเอง — เขียนแทนคนอื่นไม่ได้)
- **Related:** FN-MW-02/03/04/05

#### FN-MW-02 · บันทึกจากปฏิทิน (one-tap · auto hours)
- **หน้า/Ref:** P1 · CAL-4, MW-10 | **Actor:** ทุก role | **Trigger:** แตะการ์ด meeting ใน rail | **Pre:** login + grant calendar (FN-AUTH-02) + เลือกวัน
- **Input:** `calendar_event_id` (จากการ์ด); `title`, `hours` ดึงจาก event — **`hours = (end−start) ปัดเป็นพหุคูณ 0.5`** (เช่น 09:30–10:00 = 0.5 ชม.)
- **Process:**
  1. map event → `DailyEntry{ source="meeting", work_date, title=event.title, calendar_event_id, hours=duration, project_id=null, task_id=null }` (เป็น General โดย derivation)
  2. insert → **ชนิด C (General by default)** ตาม §6.8 (ไม่บังคับเลือกโครงการตอนเพิ่ม)
  3. prepend + อัปเดตผลรวม ชม.
- **Output:** entry ใหม่บนสุด + toast; ผูกโครงการภายหลังได้ (FN-MW-04); แก้ชม.ได้ (FN-MW-05)
- **Validation/Error:** ยังไม่ grant calendar → rail แสดงปุ่มเชื่อมต่อแทนรายการ; แตะ event เดิมซ้ำในวันเดียว → ไม่บล็อก (อนุญาตซ้ำ) แต่เตือนเบาๆ
- **API:** `POST /api/daily` req `{work_date, source:"meeting", calendar_event_id, title, hours}` → res `{entry}`
- **Permission:** `My Work:create` (ของตัวเอง)
- **Related:** FN-CAL-01, FN-AUTH-02, FN-MW-04/05

#### FN-MW-03 · บันทึกจากงานที่มอบหมาย (one-tap · snapshot status)
- **หน้า/Ref:** P1 · MW-1, MW-10 | **Actor:** ทุก role (ปกติ Dev) | **Trigger:** แตะการ์ดงานใน rail "งานที่มอบหมายให้ฉัน"
- **Input:** `task_id` (จากการ์ด); `project_id`/`title` ติดมาจาก Task; `hours` default 1.0 (ปรับได้)
- **Process:**
  1. อ่าน Task → สร้าง `DailyEntry{ source="plan"/"manual"(ตามที่มางาน), task_id, project_id=task.project_id, title=task.title, hours }`
  2. **เก็บ `status_snapshot = สถานะ Task ณ ตอนกรอก`** → ชนิด A (read-only ในล็อก; Meeting Summary ใช้ค่านี้ ไม่ใช่ status ล่าสุด — §6.8)
  3. prepend + อัปเดตผลรวม ชม.
- **Output:** entry ใหม่บนสุด (มี badge สถานะ snapshot) + toast
- **Validation/Error:** Task ถูกปิด/ลบไปแล้ว → 404 + รีเฟรช rail
- **API:** `POST /api/daily` req `{work_date, source, task_id, hours}` (backend เติม project_id/title/status_snapshot เอง) → res `{entry}`
- **Permission:** `My Work:create` (ของตัวเอง)
- **Related:** FN-TASK-*, FN-MW-04/05

#### FN-MW-04 · แก้/ผูกโครงการของ entry (set project_id — ไม่สร้าง Task)
- **หน้า/Ref:** P1 · MW-9 | **Actor:** เจ้าของ entry | **Trigger:** เลือก dropdown โครงการบนการ์ด entry
- **Input:** `project_id` — FK Project | "general"/null
- **Process:**
  1. set `project_id` ของ entry → ถ้ามีค่า: ชนิด B (ยังไม่มี `task_id` → ไม่มี status); ถ้า null/"general": ชนิด C โดย derive จาก `task_id=null` และ `project_id=null`
  2. **ไม่สร้าง Project Task ใหม่** (กัน backlog รก — §6.8)
  3. ถ้า entry เป็นชนิด A (มี task_id) การเปลี่ยนโครงการไม่ควรหลุดจาก task — UI จำกัดให้เปลี่ยนได้เฉพาะ entry ที่ไม่มี task_id
- **Output:** entry อัปเดต (ป้ายโครงการเปลี่ยน) — 1 คลิก ไม่เปิด modal
- **Validation/Error:** project ถูกลบ → ไม่ขึ้นใน dropdown
- **API:** `PATCH /api/daily/:id` `{project_id}` → res `{entry}`
- **Permission:** `My Work:edit` (เฉพาะ entry ของตัวเอง)
- **Related:** FN-MW-01/02

#### FN-MW-05 · แก้ชั่วโมงของ entry (stepper 0.5)
- **หน้า/Ref:** P1 · MW-11 | **Actor:** เจ้าของ entry | **Trigger:** กด +/− บนการ์ด entry
- **Input:** `hours` — decimal, step 0.5, min 0.5
- **Process:** update `hours` → อัปเดตผลรวม ชม.ต่อวันทันที (FN-MW-09)
- **Output:** entry อัปเดต + ผลรวมเปลี่ยน
- **Validation/Error:** ต่ำกว่า 0.5 กดไม่ได้ (คุมที่ stepper)
- **API:** `PATCH /api/daily/:id` `{hours}` → res `{entry}`
- **Permission:** `My Work:edit` (ของตัวเอง)
- **Related:** FN-MW-09

#### FN-MW-06 · ลบ entry
- **หน้า/Ref:** P1 | **Actor:** เจ้าของ entry | **Trigger:** ปุ่มลบบนการ์ด
- **Process:** ลบจริง (ไม่ soft-delete) → ออกจาก list + อัปเดตผลรวม ชม.
- **Output:** 204 + การ์ดหายจาก list
- **Validation/Error:** ลบ entry ของคนอื่น → 403
- **API:** `DELETE /api/daily/:id`
- **Permission:** `My Work:delete` (ของตัวเอง)
- **Related:** FN-MW-09

#### FN-MW-07 · เลือกวัน (5 วันทำงาน) → โหลด entries ของวัน
- **หน้า/Ref:** P1 · MW-3 | **Actor:** ผู้ใช้ | **Trigger:** แตะวันใน week strip
- **Input:** `work_date` (จ–ศ ของสัปดาห์ที่เลือก) + ปุ่มเลื่อนสัปดาห์
- **Process:**
  1. week strip แสดง **5 วันทำงาน จ–ศ** เป็นค่าหลัก (อ้าง FN-X-03 / §5.7); เลื่อนสัปดาห์ได้
  1b. **เลือกวันอื่น (รวมเสาร์-อาทิตย์/วันหยุด) ผ่าน date picker** เพื่อลง OT ของวันนั้น — เมื่อ `work_date` เป็นวันหยุด/นอกวันทำงาน entry ที่กรอกวันนั้น default `is_ot=true` (MW-13)
  2. โหลด DailyEntry ของ `work_date` + คำนวณผลรวม ชม.
  3. composer ผูกกับ `work_date` ที่เลือก (กรอกย้อน/ล่วงหน้าได้)
- **Output:** list entries ของวัน + ผลรวม ชม. + วันที่ถูกไฮไลต์
- **API:** `GET /api/daily?work_date=&user=me` → res `{ results:[entry], total_hours }`
- **Permission:** `My Work:view` (ของตัวเอง)
- **Related:** FN-MW-09, FN-X-03

#### FN-MW-08 · Claim งานจาก Backlog
- **หน้า/Ref:** P1 · MW-2 | **Actor:** Dev | **Trigger:** ปุ่ม "รับงาน" บนการ์ด backlog (ส่วนรองด้านล่าง)
- **Input:** `task_id`
- **Process:** assign Task ให้ผู้ใช้ (claim) → ย้ายจาก backlog มาอยู่ "งานที่มอบหมายให้ฉัน" (rail) → ใช้กรอก Daily Task ต่อ (FN-MW-03)
- **Output:** Task ถูก claim + rail อัปเดต
- **Validation/Error:** ถูกคนอื่น claim ไปก่อน → `409 "งานนี้ถูกรับไปแล้ว"`
- **API:** `POST /api/tasks/:id/claim`
- **Permission:** **Dev claim capability (เฉพาะของตัวเอง)**
- **Related:** FN-TASK-06, FN-MW-03

#### FN-MW-09 · สรุปผลรวมชั่วโมงต่อวัน + Reminder
- **หน้า/Ref:** P1 · MW-6, MW-11 | **Actor:** ระบบ → user
- **Process:** หัวข้อ "บันทึกของวันนี้" แสดงจำนวน entry + **ผลรวม ชม.** (Σ `hours`); ถ้าวันทำงานนี้ยังไม่มี entry → แสดง reminder (FN-X-04)
- **Output:** ตัวเลขสรุป + reminder chip
- **API:** ใช้ `total_hours` จาก FN-MW-07 + `GET /api/daily/reminder` (FN-X-04)
- **Related:** FN-X-04, FN-MW-05/06

---

## 8. §6.3 Client Master (FN-CLI-*)
> **จัดการเต็ม (เพิ่ม/แก้/ปิดใช้งาน) ผ่าน Django Admin** (CL-2) · แอปมีเฉพาะ **list สำหรับ dropdown** (FN-CLI-01) + **inline create จาก Project** (FN-CLI-04)

#### FN-CLI-01 · List Clients
- **Ref:** CL-1 | **Actor:** login(view) | **Trigger:** เปิดหน้า Client / dropdown ตอนสร้าง Project
- **Input(query):** `search?`(name/abbr), `active?`, `page?`
- **Process:** คืนรายการ client (paginated)
- **API:** `GET /api/clients?search=&active=&page=` | **Permission:** `Client Master:view` | **Related:** FN-PRJ-02

#### FN-CLI-02 · Create / Manage Client — Django Admin
- **Ref:** CL-2 | **Actor:** Admin/DM/BSA | **ที่:** Django Admin (+ inline จาก Project = FN-CLI-04)
- **Fields:** `client_name` required; `client_abbreviation` optional **unique ถ้ามี**; `client_website` optional; `active_status` default active
- **Validation:** abbr ซ้ำ → form error
- **API:** — (Django Admin) | **Permission:** Django Admin

#### FN-CLI-03 · Edit / Deactivate Client — Django Admin
- **Ref:** CL-2 | **Actor:** Admin/DM/BSA | **ที่:** Django Admin
- **Process:** แก้/ตั้ง inactive → inactive ไม่ขึ้นใน dropdown สร้าง Project ใหม่ (project เดิมยังอ้างได้)
- **API:** — (Django Admin) | **Permission:** Django Admin

#### FN-CLI-04 · Create Client inline (จาก modal สร้าง Project)
- **Ref:** CL-4 | **Actor:** ผู้สร้าง Project | **Trigger:** ปุ่ม "เพิ่มลูกค้าใหม่" ใน modal Project
- **Process:** เหมือน FN-CLI-02 แต่ return client แล้ว **auto-select ใน form Project ทันที** (ไม่ออกจาก flow)
- **API:** `POST /api/clients` (reuse) | **Permission:** `Client Master:create` | **Related:** FN-PRJ-02

---

## 9. §6.4 Projects (FN-PRJ-*)
> Module = `Projects` · soft-delete (`deleted_at`) · `health_status`/`delay_days` = derived

#### FN-PRJ-01 · List Projects (grid + filter)
- **Ref:** §6.4 Project Views | **Actor:** login(view) | **Trigger:** เปิดหน้าโครงการ (P2)
- **Input(query):** `search?`(name/code/client), `project_phase?`, `health_status?`, `page?`
- **Process:** คืน project ที่ `deleted_at IS NULL` (paginated) + progress + health + phase; `value_thb` เฉพาะ Admin/DM
- **API:** `GET /api/projects?search=&phase=&health=&page=` | **Permission:** `Projects:view`

#### FN-PRJ-02 · Create Project
- **Ref:** §6.4 | **Actor:** DM (Admin) | **Trigger:** ปุ่มสร้างโครงการ (P4)
- **Input:** `project_name` required; `project_code` optional **unique ถ้ามี**; `client_id` required (เพิ่ม inline ได้ FN-CLI-04); `value_thb?`(Admin/DM); `start_date?/end_date?`; `po_user_id?`; `project_phase` default pre_sale
- **Process:** validate code unique(ถ้ามี) → create; health/delay = derived (เริ่มตาม phase)
- **Error:** code ซ้ำ → `400`
- **API:** `POST /api/projects` | **Permission:** `Projects:create`

#### FN-PRJ-03 · Project Detail (รวม sub-data)
- **Ref:** §6.12 | **Actor:** login(view) | **Trigger:** คลิกการ์ดโครงการ → `/projects/:id` (ScreenSpec P3)
- **Process:** คืน summary + client + phase + health(+เหตุผล) + progress; sub-resource แยก endpoint ตาม tab
- **API:** `GET /api/projects/:id` (core); tab อื่น → FN-PLAN-01 / FN-TASK-01 / FN-TEAM-01 / FN-BUD-01 / FN-PRJD-01
- **Permission:** `Projects:view` (budget tab เช็คเพิ่มตามสิทธิ์)

#### FN-PRJ-04 · Edit Project
- **Ref:** §6.4 | **Actor:** DM/Admin (BSA ตาม matrix)
- **Input(partial):** ทุก field; เปลี่ยน `project_phase` ได้; `value_thb` แก้ได้เฉพาะ Admin/DM
- **API:** `PATCH /api/projects/:id` | **Permission:** `Projects:edit`

#### FN-PRJ-05 · Delete Project (soft)
- **Ref:** §2.5 | **Actor:** Admin/DM | **Process:** `deleted_at=now()` (FN-X-05) — หายจาก list, ข้อมูลคงอยู่
- **API:** `DELETE /api/projects/:id` | **Permission:** `Projects:delete`

#### FN-PRJ-06 · Project Status / Health (derived)
- **Ref:** §3.1/§3.2 | **Actor:** ระบบ
- **Process:** `health_status` คำนวณจาก milestone planned vs actual (`PlanItem.is_milestone`) + expected progress เชิงเส้นถ่วง manday เทียบ actual (FN-PT-02) ตาม threshold §3.2; `delay_days` deterministic จาก milestone — **ห้ามกรอกมือ**; refresh เมื่อ plan/task/progress เปลี่ยน
- **API:** อ่านผ่าน FN-PRJ-01/03 (ไม่มี endpoint set) | **Related:** FN-PT-02

---

## 10. §6.5 Plan / Timeline (FN-PLAN-*)
> per-project · ตาราง Plan แสดง start/end/manday ทุกแถว (PL-2) · revision บังคับเหตุผลบาง field

#### FN-PLAN-01 · List PlanItems + Gantt
- **Ref:** PL-1..PL-4 | **Actor:** login(view) | **Trigger:** tab แผนงานใน Project Detail
- **Process:** คืน PlanItem ของ project เรียง `sort_order` + **start/end/manday ทุกแถว (PL-2)** + รวม manday ต่อ phase และทั้ง project (PL-3) + dependencies (วาดเส้น Gantt, PL-4/PL-9)
- **API:** `GET /api/projects/:id/plan-items` → `{items[], totals_by_phase, total_manday, dependencies[]}` | **Permission:** `Plan/Timeline:view`

#### FN-PLAN-02 · Create / Edit PlanItem (auto-manday)
- **Ref:** PL-1, Plan Input Rules | **Actor:** DM(pre-sale)/BSA(execution) | **Trigger:** เพิ่ม/แก้แถวในตาราง Plan
- **Input:** `phase` required; `task` required; `manday?`; `start_date?`; `end_date?`; `is_milestone?`; `sort_order`
- **Process (input_mode):**
  1. มี start+end → **คำนวณ `manday` = working days (จ–ศ หักวันหยุด, FN-X-03) inclusive** → `input_mode=date/auto`
  2. มีแต่ manday → ใช้ค่านั้น (date ว่างได้) → `input_mode=manday`
  3. แก้ date ภายหลัง → คำนวณ manday ใหม่
  4. ทุกการแก้ → บันทึก `PlanItemRevision` (FN-PLAN-03); field สำคัญ (manday/start/end/phase/scope) **บังคับ `change_reason`**
- **Error:** end < start → `400`; แก้ field สำคัญไม่ใส่เหตุผล → `400`
- **API:** `POST /api/projects/:id/plan-items` · `PATCH /api/plan-items/:id` (แนบ `change_reason` ถ้าจำเป็น) | **Permission:** `Plan/Timeline:create`/`:edit`

#### FN-PLAN-03 · PlanItem Revision History
- **Ref:** Plan Revision | **Actor:** ระบบ + view โดยผู้มีสิทธิ์
- **Process:** ทุก write ที่เปลี่ยนค่า → insert `PlanItemRevision{field_name, old, new, change_reason?, changed_by, changed_at}`; field สำคัญต้องมี reason
- **API:** `GET /api/plan-items/:id/revisions` | **Permission:** `Plan/Timeline:view`

#### FN-PLAN-04 · Dependency (add/edit/remove · FS/SS/FF/SF · กัน circular)
- **Ref:** PL-9, Dependency | **Actor:** DM/BSA | **Trigger:** ลากเชื่อม/ฟอร์มใน Gantt
- **Input:** `predecessor_plan_item_id`, `successor_plan_item_id` (**project เดียวกัน**), `relation_type` (`finish_to_start`/`start_to_start`/`finish_to_finish`/`start_to_finish`), `lag_days` default 0 (ค่าติดลบใช้เป็น lead)
- **Process:** ตรวจ same-project; **ตรวจ circular (ปฏิเสธถ้าเกิดวงรอบ)**; insert; ถ้าวันที่ขัด dependency → คืน warning (ไม่บล็อก, ไม่ auto-reschedule — P-9)
- **Error:** ข้าม project → `400`; circular → `409 "เกิด dependency วนรอบ"`
- **API:** `POST /api/projects/:id/dependencies` · `PATCH/DELETE /api/dependencies/:id` | **Permission:** `Plan/Timeline:edit`

#### FN-PLAN-05 · Export Plan (Excel / PDF-Gantt)
- **Ref:** PL-7/PL-8 | **Actor:** ผู้มีสิทธิ์ view
- **Process:** render plan+gantt เป็น `.xlsx` (PL-7) หรือ PDF/Gantt (PL-8) — **PDF embed ฟอนต์ไทย + ตัดคำ (libthai/ICU)**
- **API:** `GET /api/projects/:id/plan/export?format=xlsx|pdf` | **Permission:** `Plan/Timeline:view`

---

## 11. §6.6 PlanItem → Execution Task (FN-PT-*)

#### FN-PT-01 · Generate Tasks จาก PlanItem (All / Selected)
- **Ref:** Creation Modes | **Actor:** BSA | **Trigger:** ปุ่ม "สร้าง Task จากแผน" (เมื่อ project = execution)
- **Input:** `mode = all | selected`; `plan_item_ids[]` (ถ้า selected)
- **Process:** ต่อ PlanItem → สร้าง `Task{ source="plan", plan_item_id, project_id, estimated_manday, state = **BSA เลือกเอง (ไม่ auto จาก phase)**, status="Not Started" }`; 1 PlanItem แตกได้หลาย Task
- **API:** `POST /api/projects/:id/tasks/generate {mode, plan_item_ids?}` | **Permission:** `Task:create` | **Related:** FN-TASK-*, FN-PT-02

#### FN-PT-02 · Progress Calculation (PlanItem & Project)
- **Ref:** Progress Calculation | **Actor:** ระบบ
- **Process:**
  - `plan_item_progress = Σ(estimated_manday ของ child task **Verified**) / Σ(estimated_manday child ทั้งหมด)`
  - **ไม่มี child task → `N/A`** (ไม่ใช่ 0, ไม่เข้า rollup)
  - `project_progress = Σ(plan_item_progress × PlanItem.manday เฉพาะที่มี child) / Σ(PlanItem.manday ที่มี child)` — **ฐานตัวหารคงที่ ห้ามสลับ**
- **API:** อ่านผ่าน FN-PLAN-01 / FN-PRJ-03 | **Related:** FN-PRJ-06

#### FN-PT-03 · Manday Variance
- **Ref:** Manday Variance | **Actor:** ระบบ + BSA
- **Process:** ถ้า `Σ(child Task.estimated_manday) > PlanItem.manday` → warning/variance; BSA เลือก: ปรับ PlanItem.manday (บังคับ reason → FN-PLAN-03) หรือยอม overrun; เทียบ actual ใช้ config `HOURS_PER_WORKING_DAY` (§2.7)
- **API:** ค่า variance อ่านผ่าน FN-PLAN-01 | **Related:** FN-PLAN-02

---

## 12. §6.7 Task Management (FN-TASK-*)
> **2 แกนแยกกัน:** `state` (SDLC: Get Req/Design/Development/Test/Training/Go Live) · `status` (work: Not Started/Working/Stuck/Done/Verified)

#### FN-TASK-01 · List Tasks (search/filter/sort)
- **Ref:** §6.7 | **Actor:** login(view) | **Trigger:** tab งานใน Project Detail / My Work rail
- **Input(query):** `project_id?`, `search?` (title/detail/assignee), `assignee?`(=me/backlog/user id), `status?`, `state?`, `sort?`, `page?`
- **Process:** คืน task (`deleted_at IS NULL`) ตามคำค้นและ filter; backlog = `assigned_to IS NULL`
- **API:** `GET /api/tasks?project=&search=&assignee=&status=&state=&sort=&page=` | **Permission:** `Task:view`

#### FN-TASK-02 · Create / Edit Task
- **Ref:** Task Fields | **Actor:** BSA
- **Input:** `title` required; `project_id` required(Project Task); `detail?`; `estimated_manday?`; `state?` (**BSA เลือกเอง — ไม่ auto จาก phase**); `scheduled_date?`; `assigned_to?` — `source="manual"` ถ้าสร้างเอง
- **API:** `POST /api/tasks` · `PATCH /api/tasks/:id` | **Permission:** `Task:create`/`:edit`

#### FN-TASK-03 · Change Status (work state)
- **Ref:** Task Status | **Actor:** assignee(ของตัวเอง) / BSA(ใน project)
- **Input:** `status` = Not Started/Working/Stuck/Done/Verified
- **Process:** assignee เปลี่ยนได้ถึง **Done** (ตั้ง Verified ไม่ได้); **Verified ตั้งได้เฉพาะ BSA/ผู้ตรวจ** (Done→Verified); progress นับเฉพาะ Verified (FN-PT-02)
- **Error:** assignee ตั้ง Verified → `403`; แก้ task ที่ไม่ใช่ของตัวเองและไม่ใช่ BSA → `403`
- **API:** `PATCH /api/tasks/:id {status}` | **Permission:** `Task:edit` (+ เงื่อนไข role สำหรับ Verified)

#### FN-TASK-04 · Change State (SDLC stage)
- **Ref:** Task Fields(state) | **Actor:** BSA | **Input:** `state` enum
- **Process:** แก้ SDLC stage (คนละแกนกับ status); BSA เลือกตอน generate/แก้ (ไม่ auto จาก phase)
- **API:** `PATCH /api/tasks/:id {state}` | **Permission:** `Task:edit`

#### FN-TASK-05 · Assign Task
- **Ref:** §6.7 | **Actor:** BSA | **Input:** `assigned_to` (FK User)
- **Process:** set assigned_to → ออกจาก backlog
- **API:** `PATCH /api/tasks/:id {assigned_to}` | **Permission:** `Task:edit`

#### FN-TASK-06 · Claim (จาก backlog) — *canonical ของ FN-MW-08*
- **Ref:** Claim | **Actor:** Dev
- **Process:** `assigned_to=ผู้ claim` ทันที (ไม่ต้อง approval); `409` ถ้าถูก claim แล้ว
- **API:** `POST /api/tasks/:id/claim` | **Permission:** **Dev claim capability (เฉพาะของตัวเอง — ไม่ใช่ `Task:edit` เต็ม)**

#### FN-TASK-08 · Delete Task (soft)
- **Process:** `deleted_at=now()` (FN-X-05) | **API:** `DELETE /api/tasks/:id` | **Permission:** `Task:delete`

---

## 13. §6.9 Google Calendar (FN-CAL-*)
> read-only suggestion · ไม่เขียนกลับ Google

#### FN-CAL-01 · Fetch Calendar Events (วันที่เลือก)
- **Ref:** CAL-1/CAL-2 | **Actor:** user(login+grant) | **Trigger:** โหลด My Work / เปลี่ยนวัน
- **Input(query):** `date`
- **Process:** ดึง event ของวันนั้นจาก Google (read-only, FN-AUTH-02) → คืน `{id(=calendar_event_id), title, start, end, hours=(end−start) ปัด 0.5}`; **ไม่ auto-create entry · ไม่เดา project**
- **Error:** ยังไม่ grant → `200 {connected:false}` (UI แสดงปุ่มเชื่อมต่อ)
- **API:** `GET /api/calendar/events?date=` | **Permission:** login(ของตัวเอง) | **Related:** FN-MW-02

#### FN-CAL-02 · ใช้ event เป็น suggestion → log
- **Ref:** CAL-3/CAL-4 | = **FN-MW-02** (แตะ = สร้าง entry `source="meeting"` General by default) | **Related:** FN-MW-02/04

---

## 14. §6.10 Meeting Summary (FN-MS-*)
> หน้า review (ScreenSpec P5) · data = DailyEntry · status = snapshot

#### FN-MS-01 · Get Summary (filter ช่วงเวลา + คน)
- **Ref:** MS-1/MS-2 | **Actor:** login(view) | **Trigger:** เปิดหน้า / เปลี่ยน filter
- **Input(query):** `preset = 1w|2w|1m|all` (default 1w) **หรือ** `from`+`to` (custom); `user?`(คนเดียว)/ว่าง=ทุกคน; optional `role/project/source/status/keyword`
- **Process:** ดึง DailyEntry ในช่วง + ตาม user → **group ตามโครงการ** (General เป็นกลุ่มแยก); แต่ละ entry: `work_date/title/detail(note)/status_snapshot/hours/is_ot`
- **Output:** `{ groups:[{project, entries[]}], total_hours, hours_by_project[] }`
- **API:** `GET /api/meeting-summary?preset=&from=&to=&user=&...` | **Permission:** `Meeting Summary:view`

#### FN-MS-02 · Hours Breakdown (โดนัทตามโครงการ)
- **Ref:** MS-3 | **Actor:** ระบบ
- **Process:** `Σ hours` ของ filter ปัจจุบัน + แตกเป็น % ต่อโครงการ (รวม General) สำหรับโดนัท; pagination ถ้าโครงการเยอะ
- **API:** รวมใน FN-MS-01 (`hours_by_project[]`) หรือ `GET /api/meeting-summary/hours?...` | **Permission:** `Meeting Summary:view`

#### FN-MS-03 · Missing Submission
- **Ref:** MS-8 | **Actor:** ระบบ
- **Process:** เทียบรายชื่อทีม vs DailyEntry ในช่วง (เฉพาะวันทำงาน FN-X-03) → ใครไม่กรอกครบ → list
- **API:** `GET /api/meeting-summary/missing?preset=&from=&to=` | **Permission:** `Meeting Summary:view`
- *(ปรับขนาดอักษรตาราง MS-7 = client-side ไม่มี API)*

---

## 15. §6.11 Budget / Cost Estimation (FN-BUD-*)
> per-project · **visibility ตาม role เป็นหัวใจ** (เงินเดือน/rate = Admin/DM เท่านั้น)

#### FN-BUD-01 · Get Budget (role-filtered)
- **Ref:** Visibility | **Actor:** login(view) | **Trigger:** tab งบประมาณใน Project Detail
- **Process:** คืน CostItem ของ project **ตามสิทธิ์ (ตัด field ลับใน serializer):**
  - **Admin/DM** → line item เต็ม (รวม rate/เงินเดือน) + รวมต่อหมวด + Grand Total + headcount
  - **BSA** → รวมต่อหมวด + Grand Total + **จำนวนคน** (ไม่มี rate/เงินเดือน)
  - **Dev** → รวมต่อหมวด + Grand Total เท่านั้น
  - VAT 7% เป็นหมายเหตุหมวดที่เกี่ยว (BG-4)
- **API:** `GET /api/projects/:id/budget` (shape ต่างตาม role) | **Permission:** `Budget:view` (+ field-level filter)

#### FN-BUD-02 · Create / Edit CostItem
- **Ref:** BG-1/2/3/5 | **Actor:** Admin/DM | **Trigger:** เพิ่ม/แก้แถวงบ
- **Input:** `category`(manpower/infra/subscription/system/custom); `label`; `qty_or_units`; `months`; `rate`; `is_outsource?`; `note?` — `total` = derived (`qty×months×rate`) หรือ manual
- **Process:** create/update → คำนวณรวมต่อหมวด (BG-2) + Grand Total (BG-6); custom category เพิ่มได้ (BG-5)
- **API:** `POST /api/projects/:id/cost-items` · `PATCH /api/cost-items/:id` | **Permission:** `Budget:edit` (Admin/DM)

#### FN-BUD-03 · Delete CostItem
- **API:** `DELETE /api/cost-items/:id` | **Permission:** `Budget:edit` (Admin/DM)

#### FN-BUD-04 · Export Budget (Excel)
- **Ref:** BG-7 | **Actor:** Admin/DM | **Process:** export `.xlsx` (line item ตามสิทธิ์ผู้ขอ)
- **API:** `GET /api/projects/:id/budget/export?format=xlsx` | **Permission:** `Budget:view` (+ field ตาม role)

---

## 16. §6.12 Project Details (FN-PRJD-*)

#### FN-PRJD-01 · Daily Activity Summary (ย่อ ในหน้า Project)
- **Ref:** §6.12 | **Actor:** login(view) | **Trigger:** tab ภาพรวมใน Project Detail
- **Process:** สรุป DailyEntry ของ project นั้น (ช่วงล่าสุด) แบบย่อ — ใครทำอะไร/ชม.รวม (mini ของ Meeting Summary, scope = project เดียว)
- **API:** `GET /api/projects/:id/daily-summary?preset=` | **Permission:** `Projects:view`
- *(sub-data อื่นของ Project Detail ใช้ FN-PLAN-01 / FN-TASK-01 / FN-TEAM-01 / FN-BUD-01)*

---

## 17. §6.13 Overview Dashboard (FN-OVW-*) — ⏸️ post-MVP

> **เลื่อนเป็น post-MVP** (sync v1.3) — ไม่อยู่ในขอบเขต MVP; ภาพรวมดูจาก `/projects` + filter ไปก่อน

#### FN-OVW-01 · Get Overview (ทุก project) — *post-MVP*
- **Ref:** §6.13 | **Actor:** DM/Admin (เฟสถัดไป)
- **Process (เฟสถัดไป):** aggregate ทุก project: count ตาม phase/health, progress รวม, delay/at-risk, MA; budget summary ตามสิทธิ์
- **API:** `GET /api/overview` *(ยังไม่ทำใน MVP)* | **Permission:** ตาม matrix

---

## 18. §6.14 Team Members (FN-TEAM-*)

#### FN-TEAM-01 · List Team Members
- **Ref:** §6.14 | **Actor:** login(view) | **Trigger:** หน้าทีม / tab ทีมโครงการ
- **Input(query):** `role?`, `employment_type?`, `project_id?` (ถ้า scope=โครงการ → ใช้ ProjectTeamMember)
- **Process:** คืนรายชื่อ (`full_name, role, position, employment_type`); ถ้า project scope → join `ProjectTeamMember` (`role_in_project, responsibilities, allocation_percentage`)
- **API:** `GET /api/team-members?role=&employment_type=` · `GET /api/projects/:id/team` | **Permission:** `Team Members:view`

#### FN-TEAM-02 · Manage Project Team (add/remove member)
- **Ref:** §6.12 Team | **Actor:** DM/BSA
- **Input:** `user_id`, `role_in_project`, `responsibilities?`, `allocation_percentage?`
- **Process:** add/update/remove `ProjectTeamMember` ของ project
- **API:** `POST /api/projects/:id/team` · `PATCH/DELETE /api/project-team/:id` | **Permission:** `Projects:edit`

---

## 19. §6.15 System Settings & Working-Day Calendar (FN-SET-*)
> **จัดการผ่าน Django Admin ทั้งหมด** (ไม่มี custom UI/endpoint ใน MVP — ตัดสินใจ sync v1.3) · backing entities: `Holiday` + `SystemSetting` (PRD §7) · แอปอ่านค่าไปใช้ภายใน

#### FN-SET-01 · จัดการวันหยุด (Holiday) — Django Admin
- **Ref:** SET-1/SET-2/SET-3 | **Actor:** Admin | **ที่:** Django Admin
- **Process:** Admin เพิ่ม/แก้/ลบ `Holiday{holiday_date(unique), name, type=public/company}`; วันทำงานพื้นฐาน = จ–ศ หักวันหยุดเหล่านี้
- **App-side (read):** **FN-X-03** อ่านวันทำงาน/วันหยุดภายใน — ไม่มี endpoint สาธารณะ
- **ผลกระทบ:** แก้วันหยุดย้อนหลัง → manday/health/missing **re-derive ตอนอ่าน** แต่ **ไม่ rewrite `DailyEntry.is_ot`** ที่กรอกไปแล้ว
- **API:** — (Django Admin) | **Permission:** Django Admin (Admin)

#### FN-SET-02 · จัดการ System Config (`SystemSetting`) — Django Admin
- **Ref:** SET-4/SET-5 | **Actor:** Admin | **ที่:** Django Admin
- **Process:** Admin แก้ key–value: `HOURS_PER_WORKING_DAY` (int >0, default 8), `health_threshold_*` (§3.2)
- **App-side (read):** config loader อ่านค่าไปใช้ภายใน (manday variance FN-PT-03, health FN-PRJ-06) — ไม่มี endpoint สาธารณะ
- **Validation:** `HOURS_PER_WORKING_DAY ≤ 0` / threshold ไม่เรียง → Django Admin form error
- **API:** — (Django Admin) | **Permission:** Django Admin (Admin)

---

## 20. Function Index (รวมทุกโมดูล)

| FN | ชื่อ | หน้า/Ref | Method · Endpoint | สิทธิ์ |
|---|---|---|---|---|
| FN-X-01 | Auth Guard | §5.3 | (permission layer) | — |
| FN-X-02 | RBAC Check | §4.1/§5.4 | (permission layer) | — |
| FN-X-03 | Working-Day Lookup | §5.7 | GET /api/calendar/working-days | login |
| FN-X-04 | Reminder | MW-6 | GET /api/daily/reminder | self |
| FN-X-05 | Soft-delete/Audit | §2.5 | (pattern) | — |
| FN-AUTH-01 | Google Login + allowlist | P0 | allauth callback | public |
| FN-AUTH-02 | Grant Calendar | §5.3 | allauth scope | self |
| FN-AUTH-03 | First-login provisioning | §6.1 | (internal) | — |
| FN-AUTH-04 | Logout | §6.1 | POST /api/auth/logout | self |
| FN-AUTH-05 | Current user (/me) | §4/§6.1 | GET /api/me | login |
| FN-USR-01 | List users | P7 | GET /api/users | UserMgmt:view |
| FN-USR-02 | Create user | UM-1 | POST /api/users | UserMgmt:create |
| FN-USR-03 | Edit user | UM-1/2/3 | PATCH /api/users/:id | UserMgmt:edit |
| FN-USR-04 | Disable user | UM-1 | PATCH /api/users/:id | UserMgmt:edit |
| FN-USR-05 | View matrix | UM-4 | GET /api/role-permissions | UserMgmt:view |
| FN-USR-06 | Edit matrix | UM-4 | PATCH /api/role-permissions | UserMgmt:edit |
| FN-MW-01 | บันทึก manual | MW-8/10/11 | POST /api/daily | MyWork:create |
| FN-MW-02 | บันทึกจากปฏิทิน | CAL-4 | POST /api/daily | MyWork:create |
| FN-MW-03 | บันทึกจากงานมอบหมาย | MW-1 | POST /api/daily | MyWork:create |
| FN-MW-04 | แก้โครงการ entry | MW-9 | PATCH /api/daily/:id | MyWork:edit |
| FN-MW-05 | แก้ชั่วโมง | MW-11 | PATCH /api/daily/:id | MyWork:edit |
| FN-MW-06 | ลบ entry | — | DELETE /api/daily/:id | MyWork:delete |
| FN-MW-07 | เลือกวัน + โหลด | MW-3 | GET /api/daily | MyWork:view |
| FN-MW-08 | Claim backlog | MW-2 | POST /api/tasks/:id/claim | Dev claim (self) |
| FN-MW-09 | ผลรวม ชม. + reminder | MW-6/11 | (compose) | self |
| FN-CLI-01 | List clients | CL-1 | GET /api/clients | Client:view |
| FN-CLI-02 | Create/Manage client | CL-2 | Django Admin (+ inline FN-CLI-04) | Admin/DM/BSA |
| FN-CLI-03 | Edit/Deactivate client | CL-2 | Django Admin | Admin/DM/BSA |
| FN-CLI-04 | Create client inline | CL-4 | POST /api/clients | Client:create |
| FN-PRJ-01 | List projects | §6.4 | GET /api/projects | Projects:view |
| FN-PRJ-02 | Create project | §6.4 | POST /api/projects | Projects:create |
| FN-PRJ-03 | Project detail | §6.12 | GET /api/projects/:id | Projects:view |
| FN-PRJ-04 | Edit project | §6.4 | PATCH /api/projects/:id | Projects:edit |
| FN-PRJ-05 | Delete project (soft) | §2.5 | DELETE /api/projects/:id | Projects:delete |
| FN-PRJ-06 | Status/Health (derived) | §3.2 | (derived) | — |
| FN-PLAN-01 | List plan + gantt | PL-1..4 | GET /api/projects/:id/plan-items | Plan:view |
| FN-PLAN-02 | Create/Edit plan item | PL-1 | POST/PATCH /api/plan-items | Plan:create/edit |
| FN-PLAN-03 | Revision history | Plan Rev | GET /api/plan-items/:id/revisions | Plan:view |
| FN-PLAN-04 | Dependency (FS) | PL-9 | POST/DELETE /api/.../dependencies | Plan:edit |
| FN-PLAN-05 | Export plan | PL-7/8 | GET /api/projects/:id/plan/export | Plan:view |
| FN-PT-01 | Generate tasks from plan | §6.6 | POST /api/projects/:id/tasks/generate | Task:create |
| FN-PT-02 | Progress calc | §6.6 | (derived) | — |
| FN-PT-03 | Manday variance | §6.6 | (derived) | — |
| FN-TASK-01 | List tasks | §6.7 | GET /api/tasks | Task:view |
| FN-TASK-02 | Create/Edit task | §6.7 | POST/PATCH /api/tasks | Task:create/edit |
| FN-TASK-03 | Change status | §6.7 | PATCH /api/tasks/:id | Task:edit (+role) |
| FN-TASK-04 | Change state (SDLC) | §6.7 | PATCH /api/tasks/:id | Task:edit |
| FN-TASK-05 | Assign task | §6.7 | PATCH /api/tasks/:id | Task:edit |
| FN-TASK-06 | Claim | §6.7 | POST /api/tasks/:id/claim | Dev claim (self) |
| FN-TASK-08 | Delete task (soft) | §2.5 | DELETE /api/tasks/:id | Task:delete |
| FN-CAL-01 | Fetch events | CAL-1 | GET /api/calendar/events | self |
| FN-CAL-02 | Event → log | CAL-4 | =FN-MW-02 | self |
| FN-MS-01 | Get summary | MS-1/2 | GET /api/meeting-summary | MeetingSummary:view |
| FN-MS-02 | Hours by project | MS-3 | (in MS-01)/GET .../hours | MeetingSummary:view |
| FN-MS-03 | Missing submission | MS-8 | GET /api/meeting-summary/missing | MeetingSummary:view |
| FN-BUD-01 | Get budget (role) | §6.11 | GET /api/projects/:id/budget | Budget:view |
| FN-BUD-02 | Create/Edit cost item | BG-1 | POST/PATCH /api/cost-items | Budget:edit |
| FN-BUD-03 | Delete cost item | §6.11 | DELETE /api/cost-items/:id | Budget:edit |
| FN-BUD-04 | Export budget | BG-7 | GET /api/projects/:id/budget/export | Budget:view |
| FN-PRJD-01 | Daily activity (project) | §6.12 | GET /api/projects/:id/daily-summary | Projects:view |
| FN-OVW-01 | Overview | §6.13 | ⏸️ post-MVP | — |
| FN-TEAM-01 | List team | §6.14 | GET /api/team-members · /projects/:id/team | Team:view |
| FN-TEAM-02 | Manage project team | §6.12 | POST/PATCH/DELETE /api/.../team | Projects:edit |
| FN-SET-01 | จัดการวันหยุด (Holiday) | SET-1/2/3 | Django Admin | Admin |
| FN-SET-02 | จัดการ System config | SET-4/5 | Django Admin | Admin |

---

## 21. Resolved Decisions (จาก Open Questions รอบ v0.1)

| # | ประเด็น | สรุป |
|---|---|---|
| FD-1 | OT เสาร์-อาทิตย์ | ✅ ใช้ **checkbox `is_ot` ตอนกรอก** (default true ถ้าวันหยุด/นอกวันทำงาน, สลับได้); **กรอกเสาร์-อาทิตย์ได้** ผ่าน date picker (FN-MW-07) — PRD v1.1 MW-13 |
| FD-2 | เพดาน ชม./วัน | ✅ **ไม่มีเพดาน** — แสดงผลรวมเฉยๆ ไม่เตือน/บล็อก (FN-MW-09) |
| FD-3 | ชม./working day แปลง manday | ✅ config **`HOURS_PER_WORKING_DAY=8`** (ปรับได้) ใช้เฉพาะเทียบ Manday Variance; ปิดได้ถ้าไม่เทียบ (§2.7) |
| FD-4 | unclaim | ✅ **ยกเลิก** — งานที่มีผู้รับแล้ว reassign ได้ แต่ล้างผู้รับผิดชอบกลับเป็นว่างไม่ได้ |

---

*ASTRO Functions Design v0.1 — **ครบทุกโมดูล §6.1–6.15 + Cross-cutting** (dev-handoff) · synced กับ PRD v1.3 / ScreenSpec v0.3 / Tokens v0.2 · Settings·Client·Holiday = Django Admin · Overview = post-MVP · claim = capability เฉพาะ Dev (ดู Function Index §20)*
