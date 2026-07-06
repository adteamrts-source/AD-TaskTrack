# ASTRO — Sitemap & Screen Spec (v0.2)
### คู่กับ PRD v1.3 — มุมมอง "ราย หน้า" (Information Architecture + Screen Spec)

| | |
|---|---|
| **เอกสารนี้ตอบ** | แต่ละ route มีหน้าอะไร · บนหน้ามีอะไร · ทำอะไรได้ (functions) · เห็นข้อมูลอะไร · ใครเข้าได้ · state ตอนว่าง/โหลด/error |
| **คู่กับ** | PRD (module capabilities + data model + rules) และ Design tokens/Component spec (หน้าตาเป๊ะ) |
| **กฎ** | หน้าทุกหน้าผูกกลับ PRD ด้วย ID (เช่น MW-1, PL-3) — ไม่ซ้ำ requirement แค่บอกว่ามันอยู่หน้าไหน |

---

## 0. Template ต่อหนึ่งหน้า (ใช้ขยายหน้าใหม่)

ทุกหน้าต้องระบุ 8 ช่องนี้ให้ครบ:

1. **Route / ชื่อหน้า**
2. **เข้าได้โดย (role)** — Admin / DM / BSA / Dev
3. **จุดประสงค์** — 1 ประโยค
4. **ส่วนประกอบบนหน้า (sections)** — block อะไรบ้าง เรียงตามลำดับสายตา
5. **ฟังก์ชัน / การกระทำ (actions)** — กดอะไรได้ + ผูก PRD ID
6. **ข้อมูล / API** — แสดงข้อมูลอะไร ดึงจาก endpoint ไหน
7. **States** — empty / loading / error / no-permission
8. **ทางเข้า-ออก (navigation)**

> ถ้าหน้าใหม่ระบุ 8 ช่องนี้ไม่ครบ = ยังไม่พร้อมส่ง dev

---

## 1. Sitemap (route tree)

```
/login                         เข้าระบบ (Google + allowlist)            [public]
│
├── /my-work                   งานของฉัน · Daily Task                   [ทุก role]   ← หน้าหลัก
│
├── /projects                  โครงการ (รายการ)                         [ทุก role]
│   ├── /projects/new          สร้าง/ประเมินโครงการ (pre-sale)          [DM, Admin]
│   └── /projects/:id          รายละเอียด + ภาพรวมโครงการ               [ทุก role]
│         ├── ?tab=tasks         งาน (Task list · filter/sort) [default]
│         ├── ?tab=plan          แผนงาน / Timeline (Gantt)
│         ├── ?tab=team          ทีมโครงการ
│         └── ?tab=budget        งบประมาณ (ตามสิทธิ์)
│
├── /meeting-summary           สรุปประชุม (รวม Daily Task ทั้งทีม)       [ทุก role]
├── /team                      ทีม (Team Members)                       [ทุก role ดู · Admin แก้]
└── /admin                     ระบบ (Django Admin: users/roles · clients · holidays · settings)[Admin]
```

หมายเหตุ IA:
- **แผนงาน + งบประมาณ เป็นของราย "โครงการ" → อยู่เป็น tab ใน `/projects/:id`** ไม่ใช่เมนู top-level (กัน dev สับสนเรื่อง "แผนงานของโครงการไหน")
- top-level nav แนะนำ: งานของฉัน · โครงการ · สรุปประชุม · ทีม · (Admin) — ถ้าต้องการ shortcut "แผนงาน/งบประมาณ" บน nav ให้ลิงก์ไปที่ project ล่าสุด/ที่เลือกไว้ (optional)
- **Overview Dashboard = post-MVP** (ตัดออก MVP — ภาพรวมดูจาก `/projects` + filter ไปก่อน)
- **Client Master + System Settings + วันหยุด (Holiday) จัดการผ่าน Django Admin** (`/admin`) ไม่มีหน้า custom ในแอป MVP — สร้าง client ใหม่ทำ **inline จาก `/projects/new`** ได้

---

## 2. Global Shell (มีในทุกหน้าหลัง login)

- **Sidebar (ซ้าย):** โลโก้ ASTRO · เมนู (งานของฉัน/โครงการ/สรุปประชุม/ทีม · Admin เฉพาะ Admin) · บล็อกผู้ใช้ (ชื่อ + role) · ปุ่มย่อ/ออกจากระบบ — เมนูที่ไม่มีสิทธิ์ให้ **ซ่อน** ไม่ใช่ disable
- **Topbar:** ชื่อหน้า + วันที่ · **reminder pill กรอกงานวันนี้** (MW-6: แดง/เหลือง "ยังไม่กรอก" ↔ เขียว "กรอกแล้ว N") · สลับ Light/Dark · avatar
- **Theme/Motion:** ตาม §5.8 ของ PRD + **Design Tokens & UI Contract** (default = **Light mode**, ปุ่มใช้ `--btn-grad`/`--on-btn`, contrast ผ่าน WCAG AA, starfield + shooting star เป็น ambient)

---

## 3. Page Specs

### P0 · `/login` — เข้าระบบ
- **เข้าได้โดย:** public
- **จุดประสงค์:** ยืนยันตัวตนด้วย Google เฉพาะ user ที่อยู่ใน allowlist
- **Sections:** โลโก้/แบรนด์ · ปุ่ม "เข้าสู่ระบบด้วย Google" · ข้อความสถานะ/error
- **Functions:**
  - กด Google login → OAuth (AUTH-1)
  - ถ้า email ไม่อยู่ allowlist → ปฏิเสธ + ข้อความ (UI-permission)
  - user ใหม่ที่ผ่าน allowlist ครั้งแรก → default role = `dev` (Bootstrap, §6.1)
- **Data/API:** Google OAuth ผ่าน **django-allauth** (ไม่มี endpoint custom) → session + role · `GET /api/me` คืน role/permissions
- **States:** loading (กำลังยืนยัน) · error (ไม่อยู่ allowlist / OAuth ล้มเหลว)
- **Nav:** สำเร็จ → `/my-work`

---

### P1 · `/my-work` — งานของฉัน (Daily Task) ★ หน้าหลัก / หน้าแรกหลัง login
- **เข้าได้โดย:** ทุก role
- **จุดประสงค์ (หัวใจของทั้งระบบ):** ให้ทุกคน **กรอกงานที่ทำวันนี้ได้เร็วที่สุด** — ช่องกรอกคือพระเอกและเป็นสิ่งแรกที่เห็น ไม่ใช่ dashboard
- **หลักการออกแบบ:** 1 คนทำได้ **หลายโครงการพร้อมกัน** (แต่ละบันทึกผูกคนละโครงการ) · **คลิกน้อยที่สุด** (แตะแหล่ง = ลงทันที) · กรอกซ้ำได้รัว
- **Layout (entry-first — multi-column ได้ ไม่บังคับ single):** entry-first วัดที่ **พฤติกรรม** ไม่ใช่จำนวนคอลัมน์ (ดู PRD MW-12)
  - **คอลัมน์หลัก:** (1) ตัวเลือกวัน **5 วันทำงาน จ–ศ** (เลือกวันอื่น/เสาร์-อาทิตย์ผ่าน date picker เพื่อลง OT) บนสุด → (2) **กล่องกรอก Daily Task (composer · พระเอก) แบบ inline** (มี **checkbox OT**) → (3) **บันทึกของวันนี้** โผล่ **ติดใต้ composer ทันที** (ใหม่สุดอยู่บน) + ผลรวม ชม.
  - **side rail (เห็นตลอด — ไม่ใช่ tab/modal):** 2 แหล่งแตะลง — **ประชุมวันนี้ (ปฏิทิน)** + **งานที่มอบหมายให้ฉัน** · ใต้สุด **Backlog · รับงาน** (รอง)
  - ❌ ไม่มีแผง "สถานะทีมส่งงานวันนี้" ในหน้านี้ (เป็นเรื่องของ Meeting Summary/หัวหน้า) · ❌ ไม่ซ่อนแหล่งไว้ใน tab · ❌ ไม่กรอกผ่าน modal
- **3 ทางป้อนเข้า → ลงช่องเดียวกัน (เด่นเท่ากัน · เห็นพร้อมกัน):**
  1. **พิมพ์เอง (manual)** — ช่องใหญ่ในคอลัมน์หลัก พิมพ์ + Enter ลงทันที; **จำโครงการล่าสุด** ลงต่อเนื่องไม่ต้องเลือกซ้ำ
  2. **จากปฏิทิน (Google Calendar)** — แผงใน rail แสดง meeting วันนี้ → **แตะ = ลงทันที** เป็นบันทึกทั่วไป; **ดึงชั่วโมงจากเวลาใน meet อัตโนมัติ** (แก้เองได้ภายหลัง · ผูกโครงการทีหลัง, CAL-4)
  3. **งานที่มอบหมาย** — แผงใน rail แสดง task ที่ assign ให้เรา → **แตะ = ลงทันที** (โครงการ+สถานะติดมาให้, MW-1)
- **Functions:**
  - บันทึก entry (พิมพ์/แตะแหล่ง) → ลงรายการของวันที่เลือก (MW-4) · entry แบบโครงการ = เก็บ **status snapshot ณ เวลากรอก** (read-only ในล็อก, §6.8/ข้อ 13) · entry ทั่วไป = ไม่มีสถานะ
  - **ป้ายโครงการบนแต่ละ entry = แก้ได้ในคลิกเดียว** (dropdown) → รองรับสลับ/ผูกโครงการต่อรายการ (multi-project)
  - **ระยะเวลาที่ใช้ทำ (ชั่วโมง) ต่อ entry — หน่วยย่อยสุด 0.5** (stepper +/−): กรอกตอนบันทึก, แก้ภายหลังได้, one-tap ใช้ค่าเริ่มต้นแล้วปรับ; หัวข้อ "บันทึกวันนี้" แสดง **ผลรวม ชม. ต่อวัน** (MW-11) — **ไม่มีเพดาน ชม.**
  - **OT:** checkbox "OT" ตอนกรอก (`is_ot`) — **default ติ๊กอัตโนมัติถ้าเลือกวันหยุด/นอกวันทำงาน**, วันธรรมดาไม่ติ๊ก, สลับเองได้; กรอกเสาร์-อาทิตย์/วันหยุดได้ผ่าน date picker (MW-13)
  - เลือกวันใน week calendar → กรอง + กรอกย้อน/ล่วงหน้า (MW-3)
  - งานที่มอบหมาย: กด badge วนสถานะ ns→working→stuck→done (Dev ตั้ง Verified ไม่ได้ — เป็นของ BSA)
  - Backlog: **รับงาน** (claim) → ย้ายมาเป็นงานของฉัน (MW-2)
- **คลิกเป้าหมาย (UX budget):** ลง 1 รายการ = **1 แตะ** (จากแหล่ง) หรือ พิมพ์ + Enter; ผูกโครงการให้ entry = +1 คลิก (ไม่ต้องเปิด modal)
- **Data/API:** `GET /api/daily?work_date=&user=me` · `POST /api/daily` (มี `hours`,`is_ot`) · `PATCH /api/daily/:id` (แก้โครงการ/`hours`/`is_ot`) · `DELETE /api/daily/:id` · `GET /api/tasks?assignee=me` · `GET /api/tasks?assignee=backlog` · `POST /api/tasks/:id/claim` · `GET /api/calendar/events?date=`
- **States:**
  - empty (ยังไม่มี entry วันนี้) → กล่องชวน "พิมพ์เอง · จากปฏิทิน · หรือจากงานที่มอบหมาย"
  - empty backlog → "ไม่มีงานค้างให้รับ" · empty ปฏิทิน/งานมอบหมาย → ข้อความในแผง (rail)
  - loading skeleton · error
- **Theme/contrast:** ตาม Design Tokens & UI Contract (ปุ่มหลัก `--btn-grad`+`--on-btn`, default Light)
- **Nav:** คลิกโครงการบน entry/task → `/projects/:id`

---

### P2 · `/projects` — โครงการ (รายการ)
- **เข้าได้โดย:** ทุก role (มูลค่าโครงการเห็นเฉพาะ Admin/DM)
- **จุดประสงค์:** ภาพรวมทุกโครงการ + สถานะสุขภาพ
- **Sections:** แถบ filter/ค้นหา (phase, health) · grid การ์ดโครงการ
- **Functions:**
  - ค้นหา/กรองตาม phase, health (PRO-list)
  - คลิกการ์ด → เปิดรายละเอียด
  - ปุ่ม "+ สร้างโครงการ" (เฉพาะ DM/Admin) → `/projects/new`
- **Data/API:** `GET /api/projects` → ต่อการ์ด: ชื่อ, ลูกค้า, `project_phase`, `health_status`+เหตุผล, progress, (value เฉพาะ Admin/DM)
- **States:** empty (ยังไม่มีโครงการ) · loading (skeleton cards) · error · **pagination** เมื่อเยอะ (NFR)
- **Nav:** การ์ด → `/projects/:id` · ปุ่มสร้าง → `/projects/new`

---

### P3 · `/projects/:id` — รายละเอียดโครงการ
- **เข้าได้โดย:** ทุก role (เนื้อหาแต่ละ tab ตามสิทธิ์)
- **จุดประสงค์:** ศูนย์รวมของโครงการเดียว — งาน/แผน/ทีม/งบ
- **Header หน้า:** ชื่อ + code + ลูกค้า · badge `project_phase` + `health_status` · ข้อมูลภาพรวมถาวร ได้แก่ progress, วันที่เริ่ม/สิ้นสุด, PO, `delay_days`, เหตุผลสถานะ และมูลค่า (Admin/DM)

ข้อมูลภาพรวมไม่แยกเป็น tab เพื่อให้ผู้ใช้เห็นบริบทโครงการตลอดเวลา ฟอร์มแก้ข้อมูลโครงการเปิดแบบ inline เหนือ tab งาน

**ลำดับ Tab:** งาน → แผนงาน → ทีม → งบประมาณ (`tasks` เป็นค่าเริ่มต้น; URL เดิม `overview` เปลี่ยนไป `tasks`)

**Tab: งาน (tasks)** — ผูก §6.7
- แสดง: responsive Task work list **group ตาม Stage** (Get Req → Design → Development → Test → Training → Go Live) และเรียงความเร่งด่วนในกลุ่มเป็น Stuck → Working → Not Started → Done → Verified · ค้นหา title/detail/assignee + filter + pagination
- Functions: สร้าง/แก้ task แบบ inline · assign/reassign (BSA) · เปลี่ยน status แบบเร็ว (Verified = BSA) · รับงานที่ยังไม่มีผู้รับ · generate จากแผน — **BSA เลือก `state` เอง (ไม่ auto จาก phase)** · งานที่มีผู้รับแล้วเปลี่ยนเป็นผู้ใช้อื่นได้แต่ล้างผู้รับผิดชอบกลับเป็นว่างไม่ได้
- Data: `GET /api/tasks?project=:id&search=&status=&state=&assignee=&page=` · `POST/PATCH /api/tasks` · `POST /api/projects/:id/tasks/generate` · `POST /api/tasks/:id/claim`

**Tab: แผนงาน / Timeline (plan)** — ผูก PL-*
- แสดง: Gantt ตาม phase → PlanItem (manday, start/end, สถานะ), milestone (`is_milestone`), เส้น dependency
- Functions:
  - เพิ่ม/แก้ PlanItem; กรอก manday เอง หรือ auto จาก start/end (working days, §6.5)
  - กำหนด dependency แบบ FS/SS/FF/SF พร้อม lag/lead + กัน circular (PL-*)
  - generate task ย่อยจาก PlanItem
  - export Plan/Gantt เป็น PDF (ฟอนต์ไทย, §9)
- Data: `GET /api/projects/:id/plan-items` · `POST /api/projects/:id/plan-items` · `PATCH /api/plan-items/:id`
- States: empty (ยังไม่มีแผน) · เตือนเมื่อแก้วันแล้ว dependency ขัด

**Tab: ทีมโครงการ (team)**
- แสดง: สมาชิกในโครงการ + บทบาท + allocation
- Functions: เพิ่ม/นำออกสมาชิก (DM/Admin)

**Tab: งบประมาณ (budget)** — ผูก §6.11 + v0.6 secrecy
- แสดง **ตามสิทธิ์:** Admin/DM เห็นเต็ม (รวมเงินเดือน/rate) · BSA เห็นยอดรวมต่อหมวด + **จำนวนคน** (ไม่เห็นเงินเดือน) · Dev เห็นเฉพาะ **ยอดรวมต่อหมวด + Grand Total**
- Functions: แก้ line item (Admin/DM) · export Excel (ไทย) · งบเป็น estimation-only ไม่ผูก execution
- States: no-permission (ส่วนเงินเดือนถูกซ่อน + หมายเหตุ)

- **Nav:** breadcrumb กลับ `/projects` · tab สลับด้วย query param

---

### P4 · `/projects/new` — สร้าง/ประเมินโครงการ (pre-sale)
- **เข้าได้โดย:** DM, Admin
- **จุดประสงค์:** ตั้งโครงการใหม่ + ประเมิน manday/งบ ช่วงก่อนขาย
- **Sections:** ฟอร์มข้อมูลโครงการ (ชื่อ/ลูกค้า/มูลค่า) · ร่างแผน (phase + PlanItem + manday) · ร่างงบ (หมวด + เงินเดือน/rate)
- **Functions:** สร้างโครงการ (phase=`pre_sale`) · กรอกแผน+งบประเมิน · บันทึก
- **Data/API:** `POST /api/projects` · `POST /api/projects/:id/plan-items` · `POST /api/projects/:id/cost-items`
- **States:** validation ฟอร์ม · loading บันทึก
- **Nav:** สำเร็จ → `/projects/:id`

---

### P5 · `/meeting-summary` — สรุปประชุม (หน้า review)
- **เข้าได้โดย:** ทุก role
- **จุดประสงค์:** ใช้ **ในประชุมทีม** — ดูว่าแต่ละคนทำงานอะไรมาบ้างในช่วงที่เลือก + สรุปชั่วโมง (อ้าง layout จาก dashboard จริงที่ทีมใช้)
- **Layout (2 ส่วน):**
  - **rail ซ้าย — filter + summary:** ช่วงเวลา preset (**1 สัปดาห์ / 2 สัปดาห์ / 1 เดือน / ทั้งหมด**, default 1 สัปดาห์) + custom range · **เลือกคน** (จัดกลุ่มตามทีม เช่น Develop/BSA · คนเดียวหรือทุกคน) · **สรุปชั่วโมง**: ตัวเลขรวมเด่น + **โดนัทแยกตามโครงการ** (% · มี pagination ถ้าเยอะ)
  - **เนื้อหาขวา — รายการงาน group ตามโครงการ:** หัวข้อ = ชื่อโครงการ (+ กลุ่ม General แยก) · ใต้แต่ละโครงการ = ตาราง **วันที่ · รายละเอียดงาน · หมายเหตุ** (+ สถานะ snapshot ถ้าเป็น Task) · ปรับ **ขนาดอักษรตาราง (− / +)** ได้
- **Functions:**
  - filter ช่วงเวลา (preset/custom) + เลือกคน (MS-1, MS-2)
  - สรุป **ชม. รวม** + breakdown **ตามโครงการ** (โดนัท) (MS-3)
  - รายการ **group ตามโครงการ** เป็นตาราง date/detail/note (+ snapshot status) (MS-4, MS-6); รวม General (MS-5)
  - เห็น **missing submission** (ใครยังไม่กรอกในช่วงที่เลือก) — อิง Working-Day Calendar §5.7 (MS-8)
  - ปรับขนาดอักษรตาราง (MS-7) · filter เสริม optional: role/project/source/status/keyword
- **Data/API:** `GET /api/meeting-summary?preset=&from=&to=&user=` → คืน entries จัดกลุ่มตามโครงการ + รวม ชม. ต่อโครงการ (สำหรับโดนัท)
- **States:** empty (ช่วงที่เลือกไม่มีข้อมูล) · loading · pagination (โดนัท/รายการ)
- **Nav:** คลิกโครงการ → `/projects/:id` (optional)

---

### P6 · `/team` — ทีม (Team Members)
- **เข้าได้โดย:** ทุก role ดู · Admin แก้ (ผ่าน Django Admin)
- **จุดประสงค์:** ทะเบียนสมาชิกทีม (ทะเบียนล้วน — การติดตามว่าใครกรอกงานแล้ว/ยังไม่กรอก อยู่ที่ **Meeting Summary** MS-8)
- **Sections:** ตาราง/การ์ดสมาชิก
- **Functions:** ดู ชื่อ/role/ตำแหน่ง/ประเภท (Permanent/Contractor) · (Admin) จัดการสมาชิก/role/allowlist ผ่าน **Django Admin**
- **Data/API:** `GET /api/team-members`
- **States:** loading · error
- **Nav:** —

---

### P7 · `/admin` — ระบบ (Django Admin)
- **เข้าได้โดย:** Admin
- **จุดประสงค์:** จัดการ backend — users, roles/permissions (RolePermission), allowlist, **Client Master**, **วันหยุด (Holiday / Working-Day Calendar §5.7)**, **System config (`SystemSetting`: `HOURS_PER_WORKING_DAY`, health thresholds §3.2)**
- **Functions:** CRUD ตามสิทธิ์ Django Admin · กำหนด role ให้ user ใหม่ · จัดการ client/holiday/config (ไม่มีหน้า custom ในแอป — §6.3/§6.15)
- **หมายเหตุ:** authority ของ permission = ตาราง `RolePermission` ตอน request; Django perms ใช้คุมหน้า Admin เท่านั้น (§5.4)

---

## 4. Cross-cutting: state conventions (ใช้ทุกหน้า)

| State | แนวทาง |
|---|---|
| **Loading** | skeleton ของ block นั้น ๆ (ไม่ใช่ spinner เต็มจอ) แสดงข้อมูลที่มาก่อนได้เลย |
| **Empty** | ไอคอน + ข้อความสั้น + CTA หลัก (เช่น "กรอกงานแรก") ไม่ปล่อยว่างเปล่า |
| **Error** | ข้อความเป็นมิตร + ปุ่มลองใหม่ ไม่โชว์ stack/technical |
| **No-permission** | **ซ่อน** ส่วนที่ไม่มีสิทธิ์ (เมนู/ปุ่ม/คอลัมน์) — ไม่ disable; ถ้าจำเป็นต้องบอก ใช้หมายเหตุสั้น |
| **List ยาว** | pagination ทุก list ที่โตได้ (projects/tasks/daily/meeting summary) |

---

*ASTRO Sitemap & Screen Spec v0.3 — คู่กับ PRD v1.3 · endpoint sync เป็น `/api/*` · P1 เพิ่ม OT (checkbox + date picker) · P3 เพิ่ม tab งาน + daily activity · Overview เป็น post-MVP · Client/Settings/Holiday → Django Admin*
