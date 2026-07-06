# PRD — ASTRO SYSTEM (v1.3)
### Project Management & Bid-Estimation System for Software Teams

| | |
|---|---|
| **เวอร์ชันเอกสาร** | v1.3 |
| **อัปเดตจาก** | v1.2 + sync pass: เพิ่ม module `Task` ใน matrix · `Task.state` ให้ BSA เลือกเอง (ไม่ auto จาก phase) · Settings/Client/Holiday จัดการผ่าน Django Admin · Overview Dashboard เลื่อนเป็น post-MVP · claim เป็น capability เฉพาะ Dev · ยกเลิก unclaim |
| **สถานะเอกสาร** | core flow ของ Daily Task ตรงกับ design จริง + สอดคล้องกับเอกสารคู่ทั้งชุด |
| **เอกสารคู่** | *Sitemap & Screen Spec v0.3* · *Design Tokens & UI Contract v0.2* · *Functions Design v0.1* (logic + API ราย ฟังก์ชัน) |
| **ที่มา** | React prototype (My Work) + Full system spec + User journey + ชีต CostIT (AOT-OSHA) + decision session + review session + design/mockup session |

> **ป้ายสถานะ build:** ✅ มีใน prototype · 🟡 มีแต่ต่างจากเป้า · 📋 อยู่ในสเปก · 🆕 เพิ่ม/ปรับจาก decision session

---

## 1. ภาพรวมผลิตภัณฑ์

**ASTRO** คือระบบบริหารโครงการสำหรับทีมพัฒนาซอฟต์แวร์ ใช้กันเองภายในทีม ครอบคลุมตั้งแต่ **ช่วงประเมินงานก่อนยื่นประมูล**
ไปจนถึง **ช่วงทำงานจริง** และมี phase สำหรับ **MA (Maintenance)** หลังส่งมอบงาน

เป้าหมายหลักของระบบ:

- ช่วย DM ประเมิน timeline, manday, resource และ budget ในช่วง pre-sale
- ช่วย BSA แตก plan เป็น task จริง และ assign/จัดการงานในช่วง execution
- ช่วย Dev ดูงานที่ได้รับมอบหมาย เลือกงานจาก backlog และกรอก Daily Task
- ช่วยทีมสรุป Daily Task เป็น Meeting Summary dashboard ตามช่วงเวลาที่เลือก
- ใช้ Google Login และดึง Google Calendar เพื่อแสดง meeting เป็น suggestion สำหรับ Daily Task
- รองรับ Light/Dark และ Responsive บน Mobile/Desktop

---

## 2. Product Scope สำหรับ MVP

### 2.1 In Scope

- Authentication ด้วย Google Login
- User Management และ Simple Permission Matrix ราย role
- Client Master แบบง่าย
- Project Management
- Plan / Timeline / Gantt
- PlanItem → Execution Task
- Budget / Cost Estimation
- My Work / Daily Task
- Google Calendar meeting suggestion
- Meeting Summary dashboard + table + filter
- Overview Dashboard
- Team Members
- Export Budget เป็น Excel
- Export Plan/Timeline เป็น Excel และ PDF/Gantt
- Project phase รองรับ MA แต่ยังไม่ทำรายละเอียด workflow ของ MA

### 2.2 Out of Scope สำหรับ MVP

- MA workflow แบบละเอียด เช่น ticket type, SLA, support queue
- Meeting Summary export
- Budget revision history
- Project phase history/audit log
- Permission scope ระดับ department/division
- Auto-generate project code
- URL validation ของ client website
- Email notification จริงใน MVP

---

## 3. Lifecycle ของ Project

ระบบแยก **phase ของโครงการ** ออกจาก **health/status ของโครงการ**

### 3.1 Project Phase

`project_phase` คือ lifecycle/business phase ของ project

| Phase | ความหมาย |
|---|---|
| `pre_sale` | ช่วงประเมินก่อนยื่นงาน |
| `execution` | ช่วงทำงานจริงหลังได้งาน |
| `ma` | Maintenance / ดูแลหลัง Go Live |
| `closed` | ปิดโครงการ |
| `cancelled` | ยกเลิกโครงการ |

สิทธิ์เปลี่ยน `project_phase`:

- Admin
- DM
- BSA

ข้อกำหนด MVP:

- การเปลี่ยน phase ไม่ต้องกรอกเหตุผล
- ไม่ต้องเก็บ phase history ใน MVP
- MA เป็น phase ต่อจาก execution ใน project เดิม
- MVP ยังไม่ทำรายละเอียด workflow ของ MA เพิ่มเติม

### 3.2 Health Status

`health_status` คือสถานะสุขภาพของ project และเป็นค่า derived ที่ระบบคำนวณ ไม่ให้ผู้ใช้กรอกเอง

| Health Status | ความหมาย |
|---|---|
| `not_started` | ยังไม่เริ่มทำงานจริง |
| `on_plan` | อยู่ในแผน |
| `at_risk` | มีความเสี่ยงจะล่าช้า |
| `delay` | ล่าช้า |
| `completed` | เสร็จสมบูรณ์ |

การคำนวณใช้หลายปัจจัยร่วมกัน:

- milestone planned/actual date — นับเฉพาะ PlanItem ที่ `is_milestone = true` (ดู §7) ไม่ใช่ทุก PlanItem
- verified progress เทียบกับ **expected progress** (นิยามด้านล่าง)
- `delay_days` (derived, ดู §7)
- phase ปัจจุบันของ project

**Expected progress** (baseline ที่ใช้เทียบ):

ณ วันที่ `d` ของแต่ละ PlanItem ที่มี `start_date`/`end_date`:

```text
expected_progress(PlanItem, d) =
  clamp( (d - start_date) / (end_date - start_date), 0, 1 )   # เชิงเส้นตาม working days
```

Expected progress ระดับ project = ผลรวม `expected_progress × PlanItem.manday` หารด้วยผลรวม `PlanItem.manday` (ถ่วงน้ำหนักด้วย manday ฐานเดียวกับ verified progress)

**Threshold (ค่าเริ่มต้น ปรับได้ในตั้งค่าระบบ):**

| เงื่อนไข | ผลลัพธ์ |
|---|---|
| ยังไม่ถึง start_date ของ PlanItem แรก | `not_started` |
| verified ≥ expected − 5% และไม่มี milestone เกินแผน | `on_plan` |
| verified ต่ำกว่า expected 5–15% **หรือ** มี milestone ใกล้ครบกำหนดและยังไม่ verified | `at_risk` |
| verified ต่ำกว่า expected เกิน 15% **หรือ** มี milestone เกิน planned date (`delay_days > 0`) | `delay` |
| ทุก PlanItem ที่เป็น milestone verified ครบ | `completed` |

> ระบบต้องแสดงเหตุผลประกอบ health status เช่น "Delay เพราะ milestone Test เกินแผน 5 วัน" หรือ "At Risk เพราะ verified progress (62%) ต่ำกว่า expected (74%)"

---

## 4. Roles & Permissions

ระบบใช้ role หลัก 4 แบบ

| Role | หน้าที่หลัก |
|---|---|
| **Admin** | จัดการผู้ใช้, permission, ตั้งค่าระบบ, เห็นและแก้ข้อมูลหลัก |
| **DM** | สร้าง project, ทำ timeline/budget ช่วง pre-sale, ดูภาพรวม |
| **BSA** | แก้ plan/timeline, แตก task, assign งาน, ตรวจ/verify งาน |
| **Dev** | ดู task, claim task, ทำงาน, กรอก Daily Task |

### 4.1 Permission Model สำหรับ MVP

ใช้ **Simple Permission Matrix**:

- กำหนดสิทธิ์ราย role
- ระดับ `module + action`
- action พื้นฐาน: `view`, `create`, `edit`, `delete`
- ยังไม่ทำ scope ซับซ้อน เช่น department/division

ตัวอย่าง module:

- Projects
- Task
- Plan/Timeline
- Budget
- My Work
- Meeting Summary
- Client Master
- User Management
- Team Members
- Settings (Working-Day Calendar + System config — จัดการผ่าน Django Admin)

> **หมายเหตุ matrix:** `Task` รวม claim — **Dev claim งานที่ยังไม่มีผู้รับได้** (capability เฉพาะ ไม่เท่ากับสิทธิ์ `edit` งานคนอื่น) · **Calendar (อ่านอย่างเดียว) + Daily entry = self-scoped** ตรวจแค่ login ไม่อยู่ใน matrix · Settings / Client Master / Holiday จัดการผ่าน **Django Admin**

ข้อกำหนดสำคัญ:

- ระบบใช้กันเองภายในทีม จึงไม่ต้องมี `department` / `division` ใน User สำหรับ MVP
- DM อยู่ใต้ Permission Matrix เหมือน role อื่น โดยตั้งค่าให้เปิดสิทธิ์ "เห็นภาพรวมทั้งหมด" ครบใน matrix — ไม่ hardcode bypass (ดู §5.4 เรื่อง authority)
- Permission Matrix มี UI สำหรับเปิด/ปิดสิทธิ์ราย role

### 4.2 Permission สำคัญที่ล็อกแล้ว

| เรื่อง | Decision |
|---|---|
| Budget summary | ทุก role เห็นยอดรวมต่อหมวด + Grand Total |
| Budget detail | Admin/DM เห็น line item ทั้งหมดและแก้ได้ |
| Budget edit | เฉพาะ Admin/DM |
| Client Master add/edit | Admin/DM/BSA |
| Client Master view/select | ทุก role |
| Project phase change | Admin/DM/BSA |
| Task status change | Assignee + BSA |
| Task verify | BSA หรือ role ที่มีสิทธิ์ตรวจงาน |

---

## 5. สถาปัตยกรรม & เทคโนโลยี

### 5.1 Technology Stack

| ชั้นเทคโนโลยี | Decision |
|---|---|
| **Backend** | Django + Django REST Framework เป็น API หลักภายใต้ path `/api/...` |
| **Frontend** | React โดย build แล้วให้ Django เสิร์ฟ static/frontend bundle |
| **Auth** | Google Login ผ่าน `django-allauth` และดึง Google Calendar |
| **Database** | Postgres โดยตัวเลือกฟรีคือ Neon free tier หรือ self-host บน AWS |
| **RBAC** | ใช้ระบบ users / groups / permissions ของ Django และใช้ Django Admin เป็นฐานของ User & Permission Management |
| **Realtime** | ใช้ polling/refresh เป็นหลัก และใช้ Django Channels (WebSocket) เฉพาะจุดที่ต้อง live จริง |
| **Theme / Responsive** | Light/Dark และรองรับ Mobile + Desktop |

### 5.2 Backend / API

- ใช้ Django เป็น backend application หลัก
- ใช้ Django REST Framework สำหรับ REST API ภายใต้ `/api/...`
- ใช้ Django ORM เชื่อมกับ Postgres
- ใช้ Django Admin เป็นฐานสำหรับจัดการข้อมูลหลังบ้านและต่อยอดหน้า User & Permission Management
- React frontend build แล้ว deploy เป็น static files ที่ Django serve

### 5.3 Auth / Calendar

- ใช้ Google Login ผ่าน `django-allauth`
- หลัง login และ user grant permission แล้ว ระบบดึง Google Calendar event มาใช้เป็น meeting suggestion ใน Daily Task
- MVP ใช้ Calendar แบบ read-only สำหรับดึง event ไม่สร้าง/แก้ event กลับไปที่ Google Calendar

### 5.4 RBAC

- ตาราง `RolePermission` (role × module × action) เป็น **source of truth ตอน request จริง** ตรวจผ่าน DRF permission class
- Django `User`/`Group`/`Permission` ใช้เป็นฐานสำหรับ **Django Admin backend เท่านั้น** ไม่ใช่ตัวตัดสินสิทธิ์ของ API หลัก (กัน dual-authority drift)
- ไม่จำเป็นต้อง sync RolePermission กลับเข้า Django perms แบบ 1:1 — แยก concern ชัด: matrix คุม API, Django perms คุมหน้า Admin
- Django Admin ใช้เป็น backend management surface สำหรับ Admin/ทีมดูแลระบบ

### 5.5 Realtime Strategy

- MVP ใช้ polling/refresh เป็นหลัก เช่น refresh dashboard, meeting summary, task list
- ใช้ Django Channels เฉพาะ feature ที่ต้อง live จริงในอนาคต เช่น live task board หรือ notification แบบทันที
- ไม่บังคับ WebSocket ทุก module ใน MVP

### 5.6 Deployment / Infra Notes

- ระบบต้องใช้งานผ่าน domain + HTTPS เมื่อเปิดให้ใช้งานจริง
- **ไม่ expose เป็น public เต็มตัว** — วางหลัง gated access (Google IAP / Cloudflare Access / IP allowlist) เนื่องจากเป็น internal tool และยังไม่มี dedicated security owner (P-5)
- ต้องเลือก database hosting ระหว่าง Neon free tier หรือ Postgres self-host บน AWS
- ต้องกำหนด backup/restore, monitoring/logging, SSL/domain ownership และ production security owner ก่อน production จริง

### 5.7 Working-Day Calendar

ระบบมี **ปฏิทินวันทำงาน/วันหยุดกลาง** เป็น component เดียว ใช้ร่วมกันหลายฟีเจอร์ (กัน logic ซ้ำ)

ใช้โดย:

- คำนวณ `manday` จาก date range (§6.5)
- คำนวณ `delay_days` และ health status (§3.2)
- ตรวจ missing submission ของ Daily Task — รู้ว่าวันไหนคือ "วันทำงาน" ที่ทุกคนต้องกรอก (§6.10)

ข้อกำหนด:

- เก็บรายการวันหยุดราชการไทย + วันหยุดบริษัทแบบแก้ไขได้ (entity `Holiday`, ดู §7)
- กำหนด working day = จันทร์–ศุกร์ ที่ไม่อยู่ในรายการวันหยุด
- Admin แก้ไขรายการวันหยุดได้ผ่าน Django Admin

---

### 5.8 UI Theme & Motion (Visual Identity)

ธีมหลัก: **Space / Observatory** — โทนเข้ม deep indigo/navy (ไม่ใช่ดำสนิท) + accent cyan/violet, glassmorphism, รองรับ Light ("cosmic dawn") / Dark สลับได้

> ค่าจริงทั้งหมด (สี, contrast, ระยะ, timing) อยู่ใน **Design Tokens & UI Contract** (เอกสารคู่) เป็น single source of truth — ไม่ระบุค่า pixel ใน PRD เพื่อกัน spec drift; layout/flow ราย หน้า อยู่ใน **Sitemap & Screen Spec**

| ID | ความสามารถ |
|---|---|
| UI-1 | มี ambient **ดาวกระพริบ** (starfield) — จุดสุ่มตำแหน่ง กระพริบช้า (fade/scale loop ~3s) |
| UI-2 | มี **ดาวตก** (shooting star) วิ่งพาดเป็นระยะ (เส้น cyan ไล่เฉด พุ่งทแยง ลูปทุกไม่กี่วินาที) |
| UI-3 | ambient ทั้งหมดเป็น decorative — อยู่หลัง UI, `pointer-events: none`, ห้ามบัง/รบกวนการกดปุ่มหรือกรอกงาน |
| UI-4 | เคารพ `prefers-reduced-motion` — ปิด animation ที่เคลื่อนไหว (ดาวตก/ลูกเล่นที่วิ่ง) เมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว |
| UI-5 | Light mode ลด/ซ่อน ambient ที่อ่านยากบนพื้นสว่าง ให้สบายตา |
| UI-6 | ต้องไม่กระทบ performance หรือ contrast — หน้าหลัก (โดยเฉพาะ Daily Task) ห้ามกระตุกหรืออ่านยากเพราะ ambient |

ขอบเขต: ลูกเล่นเพิ่ม (จรวด / UFO / ดาวเคราะห์) เป็น **optional / post-MVP** ถ้าใส่ให้ยึด UI-3/UI-4/UI-6 เดียวกัน

เกณฑ์ผ่าน (acceptance):

- ดาวกระพริบ + ดาวตกแสดงผลทั้ง Dark/Light ตรงตาม reference
- เปิด reduced-motion แล้ว ambient ที่เคลื่อนที่หยุดหมด ไม่มีองค์ประกอบค้างกลางจอ
- คลิก/โฟกัส element ทุกตัวทำงานปกติ (ambient ไม่บัง)
- ไม่มี jank บนเครื่อง mid-tier; ตัวอักษรผ่านเกณฑ์ contrast อ่านง่าย

---

## 6. Module Requirements

## 6.1 Authentication

| ID | ความสามารถ |
|---|---|
| AUTH-1 | Login ด้วย Google |
| AUTH-2 | ดึงข้อมูล Google Calendar หลัง user grant permission |
| AUTH-3 | ผูก user เข้ากับ role ในระบบ |
| AUTH-4 | ใช้ permission matrix ควบคุมสิทธิ์เข้าถึง module/action |

หมายเหตุ:

- Calendar integration ใช้สำหรับดึง event มาเป็น suggestion ใน Daily Task
- MVP ไม่สร้าง/แก้ event กลับไปยัง Google Calendar
- **User allowlist:** อนุญาต login เฉพาะ user ที่ถูก pre-approve ในระบบเท่านั้น (ไม่ใช่จำกัดแค่ domain) — Google account ที่ไม่อยู่ใน allowlist ล็อกอินไม่ได้
- **Bootstrap role แรก:** Admin คนแรกสร้างจาก Django superuser (`createsuperuser`); user ใหม่ที่ผ่าน allowlist + Google login ครั้งแรกได้ default role = `dev` รอ Admin กำหนด role จริง

---

## 6.2 User & Permission Management

| ID | ความสามารถ |
|---|---|
| UM-1 | เพิ่ม/แก้ไข/ลบผู้ใช้ |
| UM-2 | กำหนด role ให้ user |
| UM-3 | กำหนดประเภทพนักงาน `Permanent` / `Contractor` |
| UM-4 | ตั้งค่า Simple Permission Matrix ราย role |

User fields:

- full name
- email
- role
- position
- employment type

MVP ไม่ต้องมี:

- department
- division

---

## 6.3 Client Master

MVP ต้องมี Client Master แบบง่าย เพราะ client ถูกใช้ซ้ำหลาย project และมีข้อมูล master ชัดเจน

### Client Fields

| Field | Required | Rule |
|---|---:|---|
| Client Name | Yes | ชื่อลูกค้า |
| Client Abbreviation | No | ถ้ามีค่าต้อง unique |
| Client Website | No | optional text, ไม่ validate URL ใน MVP |
| Active Status | Yes | active/inactive |

### Client Workflow

| ID | ความสามารถ |
|---|---|
| CL-1 | ดูรายการ Client Master |
| CL-2 | จัดการ Client Master (เพิ่ม/แก้/ปิดใช้งาน) ผ่าน **Django Admin** (Admin/DM/BSA) |
| CL-3 | เลือก client ตอนสร้าง Project |
| CL-4 | เพิ่ม client ใหม่ได้จาก modal สร้าง Project |

### Initial Client Seed

| Client Name | Abbreviation | Website |
|---|---|---|
| บริษัท ปตท. น้ำมันและการค้าปลีก จำกัด (มหาชน) | PTTOR | https://www.pttor.com |
| บริษัท ไปรษณีย์ไทย จำกัด (มหาชน) | THP | https://www.thailandpost.co.th |
| การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย | MRTA | https://www.mrta.co.th |
| บริษัท ท่าอากาศยานไทย จำกัด (มหาชน) | AOT | https://www.airportthai.co.th |
| สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน) | DGA | https://www.dga.or.th |
| บริษัท อาร์ทีเอส (2003) จำกัด | RTS | https://www.rts2003.co.th |
| ธนาคารกสิกรไทย จำกัด (มหาชน) | KBank | https://www.kasikornbank.com/ |
| TBD | AES |  |
| บริษัท อสมท จำกัด (มหาชน) | MCOT | https://www.mcot.net/ |
| บริษัท ทิพยประกันภัย จำกัด (มหาชน) | TIP | www.tipinsure.com/ |

หมายเหตุ:

- รายการ `AES` ยังข้อมูลไม่ครบ ต้องเติม Client Name ภายหลัง
- Website เป็น text จึงเก็บได้ทั้ง URL เต็มและข้อความแบบ `www...`

---

## 6.4 Projects

### Project Fields

| Field | Rule |
|---|---|
| Project Name | required |
| Project Code | optional, แต่ถ้ามีค่าต้อง unique |
| Client | เลือกจาก Client Master |
| Project Value | optional; เห็นเฉพาะ Admin/DM (ชุดความลับเดียวกับ budget detail) |
| Start Date | optional/required ตาม flow |
| End Date | optional/required ตาม flow |
| PM/PO | optional |
| Project Phase | `pre_sale/execution/ma/closed/cancelled` |
| Health Status | derived |

### Project Code

- ผู้ใช้กรอกเองทั้งหมด
- ระบบไม่ auto-generate ใน MVP
- optional field
- ถ้ามีค่าต้อง unique

### Project Views

- Grid card
- Filter ตาม `project_phase`
- Filter ตาม `health_status`
- Search จาก project name, project code, client
- Overview progress

---

## 6.5 Plan / Timeline

ที่มา: ชีต CostIT tab `ProjectPlan`

โครงสร้างหลัก:

> Phase → PlanItem → Manday/Date → Gantt

### PlanItem Requirements

| ID | ความสามารถ |
|---|---|
| PL-1 | สร้าง Plan แบบ Phase → Task/PlanItem → Manday |
| PL-2 | ตาราง Plan ต้องแสดงทั้ง 3 columns เสมอ: Start Date, End Date, Manday |
| PL-3 | คำนวณ manday รวมต่อ phase และรวมทั้ง project |
| PL-4 | แสดง Gantt Chart จากข้อมูลจริง |
| PL-5 | Plan เดียวต่อเนื่องจาก pre-sale ไป execution |
| PL-6 | BSA สามารถแก้ plan/timeline ใน execution ตาม permission |
| PL-7 | Export Plan/Timeline เป็น Excel |
| PL-8 | Export Plan/Timeline เป็น PDF/Gantt |
| PL-9 | กำหนด relation/dependency ระหว่าง PlanItem ได้ และแสดงใน Gantt |

### Plan Input Rules

- Plan table ต้องแสดง `start_date`, `end_date`, และ `manday` พร้อมกันทุกแถว
- ไม่บังคับให้กรอกทั้ง 3 ค่าในทุก PlanItem
- ถ้าผู้ใช้กรอก `start_date` และ `end_date` ครบ ระบบต้องคำนวณ `manday` ให้อัตโนมัติ
- ถ้าผู้ใช้กรอกเฉพาะ `manday` ระบบใช้ค่านั้นเป็น effort estimate โดยที่ `start_date` / `end_date` ยังว่างได้
- ถ้าผู้ใช้แก้ `start_date` หรือ `end_date` ภายหลัง ระบบต้องคำนวณ `manday` ใหม่ตาม date range ล่าสุด
- ค่า `manday` ที่คำนวณได้ต้องนำไปใช้รวมยอดต่อ phase, รวมทั้ง project และใช้เป็น baseline สำหรับเทียบกับ execution task

**สูตรคำนวณ manday จาก date range (ล็อกแล้ว — แก้ P-8):**

```text
manday = จำนวน working days ระหว่าง start_date ถึง end_date (inclusive)
working day = จันทร์–ศุกร์ และไม่ใช่วันหยุดตาม Working-Day Calendar (ดู §5.7)
```

- ใช้ **working days** ไม่ใช่ calendar days
- วันหยุดราชการไทย/วันหยุดบริษัท ดึงจาก Working-Day Calendar กลาง (§5.7)
- ยังไม่หักวันลารายบุคคลใน MVP (manday เป็น effort ระดับแผน ไม่ใช่ actual คนต่อคน)

### PlanItem Relation / Dependency

Project Plan ต้องรองรับการใส่ relation ระหว่าง task/PlanItem เพื่อบอกลำดับงานและ dependency ใน Gantt

ข้อกำหนด:

- ผู้ใช้สามารถกำหนด predecessor/successor ระหว่าง PlanItem ใน project เดียวกันได้
- รองรับ relation มาตรฐาน 4 แบบ: `finish_to_start`, `start_to_start`, `finish_to_finish`, `start_to_finish`
- ผู้ใช้เลือกและแก้ relation type ได้จากแผนงาน โดย UI แสดงตัวย่อ FS/SS/FF/SF พร้อมคำอธิบาย
- รองรับ `lag_days` เป็นจำนวนวันหน่วงระหว่างงาน และค่าติดลบเป็น lead เช่น `2` = หน่วง 2 วัน, `-2` = เริ่ม/จบก่อนจุดอ้างอิง 2 วัน
- Gantt ต้องแสดงเส้น relation/dependency ระหว่าง PlanItem
- ระบบต้องป้องกัน circular dependency เช่น A ขึ้นกับ B และ B กลับมาขึ้นกับ A
- ถ้ามีการแก้วันที่แล้ว dependency ขัดแย้ง ระบบต้องแสดง warning ให้ผู้ใช้เห็น
- ระบบยังไม่ auto-reschedule task ทั้งชุดจาก dependency ให้ถือเป็น pending decision (P-9)

ตัวอย่าง phase จาก CostIT:

| ระยะ | งาน (ย่อ) | Manday |
|---|---|---:|
| 1. เตรียมการ+ออกแบบ | Project Plan / SA & Design / ICD & Architecture | 25 |
| 2. Development | Master Data / Assessment Engine / Control & Action Plan / Reporting / Administrator | 95 |
| 3. ทดสอบ+ติดตั้ง+นำส่ง | ติดตั้ง / Test / Training / Go Live | 30 |
| | **รวม** | **150** |

### Plan Revision

ระบบต้องเก็บ revision history ทุกครั้งที่แก้ PlanItem

เก็บอย่างน้อย:

- plan item id
- field ที่แก้
- old value
- new value
- changed by
- changed at
- change reason ถ้าบังคับ

การแก้ที่ต้องบังคับกรอกเหตุผล:

- manday
- start date
- end date
- phase
- task/scope สำคัญ

การแก้ typo หรือ field เล็กน้อยไม่ต้องบังคับ reason

---

## 6.6 PlanItem → Execution Task

เมื่อ project เข้าสู่ execution, BSA สามารถสร้าง execution task จาก PlanItem ได้

### Creation Modes

| Mode | รายละเอียด |
|---|---|
| Generate All | สร้าง task จาก PlanItem ทั้งหมด |
| Generate Selected | เลือก PlanItem บางรายการมาสร้าง task |

### Relationship

> 1 PlanItem เป็น parent/reference และแตกเป็น execution Task ย่อยได้หลายรายการ

Task ที่เกิดจาก PlanItem จะมี:

- `source = plan`
- `plan_item_id`
- `estimated_manday`

### Progress Calculation

PlanItem progress คำนวณจาก Task ย่อยที่มี status = `Verified` เท่านั้น โดยใช้ `estimated_manday` เป็นน้ำหนัก

สูตร:

```text
plan_item_progress =
  sum(estimated_manday ของ child task ที่ status = Verified)
  /
  sum(estimated_manday ของ child task ทั้งหมดใน PlanItem)
```

**Edge cases (ล็อกแล้ว):**

- PlanItem ที่ยัง **ไม่มี child task** → progress = `N/A` (ไม่ใช่ 0 และไม่ใช่ 0÷0) และไม่นำเข้า project rollup
- **Project-level progress** ถ่วงน้ำหนักด้วย `PlanItem.manday` เป็นฐานเดียวกันทุก PlanItem:

```text
project_progress =
  sum(plan_item_progress × PlanItem.manday ของ PlanItem ที่มี child task)
  /
  sum(PlanItem.manday ของ PlanItem ที่มี child task)
```

- ห้ามสลับฐานตัวหารระหว่าง task-sum กับ plan-manday ข้าม PlanItem (กันยอดรวมเพี้ยน)

### Manday Variance

ถ้า `sum(Task.estimated_manday)` เกิน `PlanItem.manday`:

- ระบบแสดง warning/variance
- BSA เลือกได้ว่าจะ:
  - ปรับ PlanItem manday
  - หรือยอมให้เป็น overrun โดยไม่แก้ PlanItem

ถ้า BSA ปรับ PlanItem manday ต้องบันทึก revision history และกรอกเหตุผล

**แปลง actual hours → manday (config):** Daily Task เก็บ effort เป็น **ชั่วโมง** ส่วน Plan/estimate เป็น **manday** เมื่อต้องเทียบ "ใช้จริง vs ประเมิน" ระบบแปลงผ่านค่า config **`HOURS_PER_WORKING_DAY`** (default **8**, ปรับได้) → `actual_manday = total_hours / HOURS_PER_WORKING_DAY` — **ใช้เฉพาะการเทียบ variance เท่านั้น**; ถ้าทีมไม่ต้องการเทียบ manday ปิด/ไม่ใช้ได้ (Daily Task ยังเก็บเป็น ชม. ตามปกติ ไม่ต้องแปลง)

---

## 6.7 Task Management

### Task Fields

| Field | Rule |
|---|---|
| title | required |
| detail | optional |
| project_id | required สำหรับ Project Task |
| assigned_to | optional จนกว่าจะ assign/claim |
| plan_item_id | optional |
| source | `manual/meeting/plan` |
| state | `Get Req/Design/Development/Test/Training/Go Live` — SDLC stage; **BSA เลือกเองตอนแตก/สร้าง Task (ไม่ auto จาก phase)** |
| status | `Not Started/Working/Stuck/Done/Verified` — work state (คนละแกนกับ state) |
| estimated_manday | required สำหรับ task ที่ใช้คำนวณ progress |
| scheduled_date | optional |

> **3 แกน "phase/state" (อย่าสับสน):** `Project.project_phase` = วงจรโครงการ (pre_sale/execution/ma/closed/cancelled) · `PlanItem.phase` = ชื่อเฟสในแผน (free text ไทย) · `Task.state` = SDLC stage (enum ข้างบน) — **ทั้งสามแยกกัน**; ตอนแตก Task จากแผน **BSA เลือก `state` เอง** ระบบไม่ map จาก `PlanItem.phase` ให้ (กันการเดาผิดเพราะ phase เป็น free text)

### Task Status

| Status | ความหมาย |
|---|---|
| Not Started | ยังไม่เริ่ม |
| Working | กำลังทำ |
| Stuck | ติดปัญหา |
| Done | Assignee ทำเสร็จแล้ว |
| Verified | BSA/ผู้ตรวจยืนยันแล้ว |

ข้อกำหนด:

- Assignee เปลี่ยน status ของ task ตัวเองได้
- BSA เปลี่ยน status task ใน project ที่ดูแลได้
- Assignee mark `Done` ได้
- BSA/ผู้มีสิทธิ์ตรวจ เปลี่ยนจาก `Done` เป็น `Verified` ได้
- Progress ของ PlanItem นับเฉพาะ `Verified`

### Claim

Dev เห็นได้:

- task ที่ assign ให้ตัวเอง
- task ใน project backlog ที่ยังไม่มี assignee

Workflow:

- Dev claim task จาก backlog ได้ทันที ไม่ต้อง approval
- เมื่อ claim แล้ว `assigned_to` เป็น Dev คนนั้นทันที
- เมื่อ task มีผู้รับผิดชอบแล้ว ผู้มีสิทธิ์แก้ไขสามารถ reassign ให้ผู้ใช้อื่นได้ แต่ล้างผู้รับผิดชอบกลับเป็นว่างไม่ได้

> **สิทธิ์ claim:** เป็น **capability เฉพาะ** — Dev รับ task ใน backlog ได้ **โดยไม่ต้องมีสิทธิ์ `Task:edit` เต็ม** (ซึ่งจะแก้งานคนอื่นได้) แยกจาก assign (BSA) ชัดเจน

---

## 6.8 My Work / Daily Task

Daily Task คือรายการสิ่งที่ user กรอกว่าทำในวันนั้น — **เป็นวัตถุประสงค์หลักของทั้งระบบ** หน้าแรกหลัง login คือหน้านี้ และช่องกรอกเป็นองค์ประกอบหลัก (entry-first) — รายละเอียด layout/flow ดู *Sitemap & Screen Spec — P1*

### Daily Task Requirements

| ID | ความสามารถ |
|---|---|
| MW-1 | แสดง task ที่ได้รับมอบหมาย |
| MW-2 | แสดง backlog task ที่ Dev claim ได้ |
| MW-3 | เลือกวันเพื่อดู/กรอกงานของวันนั้น |
| MW-4 | จัด task เข้า daily list |
| MW-5 | ทุก role ต้องกรอก Daily Task ในวันทำงาน |
| MW-6 | มี in-app reminder ถ้ายังไม่กรอก |
| MW-7 | ออกแบบ notification ให้รองรับ email ในอนาคต |
| MW-8 | หน้าแรกหลัง login = หน้ากรอก Daily Task; **3 ทางป้อนเข้าเด่นเท่ากัน** (พิมพ์เอง / จากปฏิทิน / จากงานที่มอบหมาย) ป้อนลงรายการเดียวกัน |
| MW-9 | 1 คนทำได้หลายโครงการต่อวัน — แต่ละ entry ผูกโครงการอิสระ และ **แก้/ผูกโครงการของ entry ได้ภายหลัง** (ไม่สร้าง Task ใหม่) |
| MW-10 | UX budget: ลง 1 รายการ **≤ 1 แตะ** (แตะจากแหล่ง) หรือ พิมพ์ + Enter; ระบบจำโครงการล่าสุด |
| MW-11 | ทุก entry เก็บ **ระยะเวลาที่ใช้ทำ (ชั่วโมง) หน่วยย่อยสุด 0.5** — กรอกตอนบันทึก, ปรับ +/− ทีละ 0.5 ได้ภายหลัง; one-tap ใช้ค่าเริ่มต้นแล้วปรับได้; แสดงผลรวม ชม. ต่อวัน |
| MW-12 | **Layout = entry-first วัดที่พฤติกรรม ไม่ใช่จำนวนคอลัมน์** — composer แบบ inline ในพื้นที่หลัก (ห้ามซ่อนการกรอกหลัง modal/ปุ่ม "+"), 3 แหล่งเห็นพร้อมกัน (ห้าม tab), รายการวันนี้โผล่ติด composer; **multi-column ได้** ถ้าคอลัมน์หลัก = composer + รายการ และ source เป็น side rail ที่เห็นตลอด |
| MW-13 | **OT marked ที่ entry** — checkbox "OT" ตอนกรอก (`is_ot`); default = **true ถ้าวันนั้นเป็นวันหยุด/นอกวันทำงาน** (Working-Day Calendar §5.7), false ถ้าวันทำงานปกติ — ผู้ใช้สลับเองได้ (เช่น OT เย็นวันธรรมดา); **กรอกวันเสาร์-อาทิตย์/วันหยุดได้** ผ่านตัวเลือกวันอื่น; **ไม่มีเพดาน ชม./วัน** |

### Layout Principle — entry-first ≠ single column

entry-first วัดที่ **พฤติกรรมการกรอก** ไม่ใช่จำนวนคอลัมน์:

- ช่องพิมพ์ (composer) เป็น **inline** อยู่ในพื้นที่โฟกัสหลัก — **ห้ามซ่อนการกรอกไว้หลัง modal / ปุ่ม "+"**
- **3 แหล่งเห็นพร้อมกัน** — ห้ามเอา "จากปฏิทิน / จากงานที่มอบหมาย" ไปซ่อนใน tab หรือ modal
- รายการที่เพิ่งกรอกของวันนั้นโผล่ **ติดกับ composer** (feedback ทันที) ไม่ไปอยู่ท้ายหน้า
- ลง 1 รายการ **≤ 1 แตะ**

**Layout ที่อนุญาต:** multi-column ได้ ถ้า **คอลัมน์หลัก = composer + รายการวันนี้** และ source เป็น **side rail ที่เห็นตลอด** (ไม่ใช่ tab/modal) — *single column ไม่ใช่ข้อบังคับ* (เหตุผล: ตรงกลางที่โฟกัสไม่ใช่ปัญหา ปัญหาคือ "กรอกผ่าน modal + แหล่งกระจายคนละคอลัมน์") — ดู *Sitemap & Screen Spec — P1* สำหรับ layout อ้างอิง

### Daily Task Structure

Daily Task ต่อคนต่อวันเป็น **list ของหลายรายการ**

รายการอาจเป็น:

- Project Task
- General/Non-project entry

### Source ของ Daily Task

| Source | ความหมาย |
|---|---|
| `manual` | ผู้ใช้พิมพ์เอง |
| `meeting` | มาจาก Google Calendar event ที่ user เลือก |
| `plan` | task ที่แตกมาจาก PlanItem |

### ประเภทของ Daily Entry (3 แบบ)

| แบบ | เงื่อนไข | status |
|---|---|---|
| **A. งาน Task ของโครงการ** | มี `task_id` (มาจาก assigned / plan) | เก็บ **snapshot ณ ตอนกรอก** ใน `status_snapshot` |
| **B. ผูกโครงการแต่ไม่ใช่ Task** | มี `project_id` เดี่ยว ไม่มี `task_id` (เช่น meeting หรือพิมพ์เองแล้ว tag โครงการ) | **ไม่มี status** |
| **C. ทั่วไป (General)** | ไม่มีทั้ง `project_id` และ `task_id` | ไม่มี status |

> **สำคัญ:** การผูก/แก้โครงการให้ daily entry = ตั้งค่า `project_id` เท่านั้น **ไม่สร้าง Project Task ใหม่** (Task เกิดจาก Plan หรือการ assign เท่านั้น) — กัน backlog รก และรองรับการกรอกแบบคลิกเดียว

**Snapshot (เฉพาะแบบ A):**

- เก็บสถานะ ณ วันที่กรอกใน `status_snapshot` — **Meeting Summary (ประชุมรายสัปดาห์ / biweekly) ใช้ค่า snapshot นี้ ไม่ใช่ status ล่าสุดของ Task** เพื่อให้รายงานตรงกับสิ่งที่ทำในวันนั้นจริง ไม่เปลี่ยนย้อนหลัง
- status ปัจจุบัน (live) ยังดูได้จากหน้า Task list โดยตรง — แต่ Daily Task / Meeting Summary ใช้ snapshot เสมอ

### OT (งานล่วงเวลา)

- ทุก entry มี flag **`is_ot`** — ติ๊ก checkbox "OT" ตอนกรอกได้
- **Default:** `is_ot=true` อัตโนมัติเมื่อ `work_date` เป็น **วันหยุด/นอกวันทำงาน** (จาก Working-Day Calendar §5.7); วันทำงานปกติ default `false` — ผู้ใช้สลับเองได้ทุกกรณี (เช่น OT เย็นวันธรรมดา = ติ๊กเอง)
- **กรอกวันเสาร์-อาทิตย์/วันหยุดได้** — week strip โชว์ จ–ศ เป็นหลัก แต่เลือกวันอื่น (รวมวันหยุด) ผ่านตัวเลือกวันเพื่อลง OT ของวันนั้น
- OT นับรวมใน `hours` ปกติ + แสดง badge "OT" ที่ entry; กรอง/สรุป OT แยกได้ (เพิ่มภายหลัง)
- **ไม่มีเพดานชั่วโมงต่อวัน** — ผลรวม ชม. แสดงเฉยๆ ไม่เตือน/ไม่บล็อกเมื่อสูง (รองรับ OT)

---

## 6.9 Google Calendar

MVP ใช้ Google Calendar เพื่อดึง meeting/event มาเป็น suggestion

| ID | ความสามารถ |
|---|---|
| CAL-1 | ดึง event จาก Google Calendar |
| CAL-2 | แสดง event เป็น suggestion ใน Daily Task |
| CAL-3 | ผู้ใช้เลือกเองว่าจะเพิ่ม event ใดเข้า Daily Task |
| CAL-4 | เพิ่ม event ได้ใน **1 แตะ** → เป็น General entry โดย default; ผูก Project ภายหลังได้ (ไม่บังคับเลือกตอนเพิ่ม) |

ข้อกำหนด:

- ไม่ auto-create Daily Task จากทุก calendar event
- ไม่เดา Project จากชื่อ meeting ใน MVP
- แตะ event = สร้าง daily entry `source = meeting` (General by default) ทันที — **ไม่สร้าง Project Task**
- ผูกโครงการให้ entry ภายหลังได้ (ตั้ง `project_id`) — ดู §6.8 ประเภท B

---

## 6.10 Meeting Summary

Meeting Summary คือหน้า **review** ที่ใช้ในประชุมทีมเป็นหลัก — ดูว่าแต่ละคนทำงานอะไรมาบ้างในช่วงเวลาที่เลือก พร้อมสรุปชั่วโมงรวม (อ้างอิง layout จาก **dashboard จริงที่ทีมใช้อยู่**)

> Data source = Daily Task entries (ไม่ใช่ task backlog ทั้งหมด) · status ที่แสดง = `status_snapshot` ของวันที่กรอก (ดู §6.8) — รายงานตรงกับสิ่งที่ทำวันนั้นจริง ไม่เปลี่ยนย้อนหลัง

### โครงสร้างหน้า (2 ส่วน)

**A. Filter + Summary rail (ฝั่งซ้าย)**

- **ช่วงเวลา (preset):** 1 สัปดาห์ / 2 สัปดาห์ / 1 เดือน / ทั้งหมด (default = 1 สัปดาห์) + เลือก custom range ได้
- **เลือกคน:** รายชื่อจัดกลุ่มตามทีม (เช่น Develop Team / BSA Team) — เลือกคนเดียว หรือทุกคน
- **สรุปชั่วโมง:** ตัวเลข **ชม. รวม** ของ filter ปัจจุบัน (เด่น) + **โดนัทแยกตามโครงการ** (% ต่อโครงการ) — มี pagination ถ้าโครงการเยอะ

**B. รายการงาน (ฝั่งขวา) — group ตามโครงการ**

- หัวข้อกลุ่ม = ชื่อโครงการ (รวมกลุ่ม General/Non-project เป็นอีกหนึ่งกลุ่ม)
- ใต้แต่ละโครงการ = ตาราง **วันที่ · รายละเอียดงาน · หมายเหตุ** (+ สถานะ snapshot ถ้าเป็น Project Task) เรียงตามวันที่ได้
- มีตัวปรับ **ขนาดอักษรของตาราง** (− / +) สำหรับอ่านบนจอตอนประชุม

### Requirements

| ID | ความสามารถ |
|---|---|
| MS-1 | filter ช่วงเวลาแบบ preset (1สัปดาห์ / 2สัปดาห์ / 1เดือน / ทั้งหมด) + custom range |
| MS-2 | เลือกคน (จัดกลุ่มตามทีม) — คนเดียวหรือทุกคน |
| MS-3 | สรุป **ชั่วโมงรวม** ของ filter ปัจจุบัน + breakdown **ตามโครงการ** (โดนัท %) |
| MS-4 | รายการงาน **group ตามโครงการ** แต่ละโครงการเป็นตาราง date / detail / note (+ snapshot status ถ้าเป็น Task) |
| MS-5 | รวม General/Non-project เป็นกลุ่มหนึ่งด้วย |
| MS-6 | status ที่แสดง = `status_snapshot` ของวันที่กรอก (ไม่ใช่ status ล่าสุดของ Task) |
| MS-7 | ปรับขนาดอักษรของตารางได้ (อ่านบนจอประชุม) |
| MS-8 | แสดง **missing submission** — ใครยังไม่กรอกในช่วงที่เลือก |
| MS-9 | ไม่ต้อง export ใน MVP |

### Filter เพิ่มเติม (optional ใน MVP)

ใช้ทับ filter หลักได้: role · project เจาะจง · source (`manual/meeting/plan`) · status · keyword

ข้อกำหนด:

- แสดงทุกอย่างที่ผู้ใช้กรอกใน Daily Task — General/Non-project ต้องแสดงด้วย
- ถ้าคนไม่กรอก Daily Task → แสดงใน missing submission
- ไม่ต้อง export Meeting Summary ใน MVP

---

## 6.11 Budget / Cost Estimation

Budget ใช้ประเมินต้นทุนช่วง pre-sale โดย DM/Admin เป็นหลัก

### Visibility

Budget เป็น **ข้อมูลประเมินต้นทุนของ pre-sale เท่านั้น ไม่ผูกกับ execution** (plan manday ไม่นำมาผูก rate)

| Role | เห็นอะไร |
|---|---|
| Admin | เห็น line item ทั้งหมด รวมเงินเดือน/rate และแก้ได้ |
| DM | เห็น line item ทั้งหมด รวมเงินเดือน/rate และแก้ได้ (DM คือ pre-sale ในระบบ) |
| BSA | เห็นยอดรวมต่อหมวด + Grand Total + จำนวนคนต่อโครงการ แต่ **ไม่เห็นเงินเดือน/rate** |
| Dev | เห็นยอดรวมต่อหมวด + Grand Total |

หลักความลับ:

- **เงินเดือน/rate ของ Manpower เป็นความลับของ pre-sale (Admin/DM เท่านั้น)**
- **จำนวนคนในโครงการ** เปิดให้เห็นกว้างขึ้นได้ตามจริง (ถึงระดับ BSA)
- Server/Infra, Subscription และหมวดอื่น คำนวณตามจริง ไม่ใช่ความลับระดับเดียวกับเงินเดือน
- ไม่มี role `Sales` แยกใน MVP — DM ทำหน้าที่ pre-sale ที่เห็นข้อมูลลับ

### Categories

| Category | รายละเอียด |
|---|---|
| Manpower / LOE | ตำแหน่ง, LOE Manday, จำนวนเดือน, เงินเดือน/เดือน, รวม, outsource flag, note |
| Server / Infrastructure | VM, spec, instance, storage, cost/month, note |
| Subscription / Tools | category, cost/account/month, units, months, total, note |
| System / Custom | หมวดขยายเพิ่มได้ |

### Budget Requirements

| ID | ความสามารถ |
|---|---|
| BG-1 | กรอกต้นทุนแยกหมวด |
| BG-2 | คำนวณรวมต่อหมวด |
| BG-3 | รองรับ outsource flag + note |
| BG-4 | หมายเหตุ VAT 7% สำหรับหมวดที่เกี่ยวข้อง |
| BG-5 | เพิ่มหมวด custom ได้ |
| BG-6 | สรุป Grand Total รวมทุกหมวด |
| BG-7 | Export เป็น Excel |

ข้อกำหนด:

- Budget ไม่ต้องมี revision history ใน MVP
- BSA เห็นจำนวนคนต่อโครงการได้ แต่ไม่เห็นเงินเดือน/rate; Dev เห็นเฉพาะยอดรวมต่อหมวด
- เงินเดือน/rate (Manpower) เห็นเฉพาะ Admin/DM
- ทุก role เห็น budget summary (ยอดรวมต่อหมวด + Grand Total) ได้

---

## 6.12 Project Details

Project Details ควรประกอบด้วย:

- Project summary
- Client info
- Project phase
- Health status พร้อมเหตุผล
- Timeline/Gantt
- PlanItem list
- Team Members
- Responsive Task work list พร้อมค้นหา title/detail/assignee, filter/sort และ pagination
- Budget summary ตามสิทธิ์
- Daily activity summary แบบย่อ

---

## 6.13 Overview Dashboard

> ⏸️ **เลื่อนเป็น post-MVP (ไม่อยู่ในขอบเขต MVP)** — ตัดสินใจรอบ sync pass v1.3; ค่อยทำเฟสถัดไป (ข้อมูลภาพรวมดูจากหน้า /projects + filter ได้ก่อน)

Overview Dashboard (เฟสถัดไป) จะแสดงภาพรวมทุก project:

- จำนวน project ตาม phase
- จำนวน project ตาม health status
- progress รวม
- project ที่ delay / at risk
- project ที่อยู่ใน MA
- budget summary ตามสิทธิ์ผู้ใช้

---

## 6.14 Team Members

Team Members:

- รายชื่อคนในทีม
- role
- position
- employment type: Permanent/Contractor
- filter ตาม role/employment type

MVP ยังไม่ต้องมี department/division

---

## 6.15 System Settings & Working-Day Calendar Management

ตั้งค่าระดับระบบ (Admin) ที่โมดูลอื่นอ้างใช้ — **จัดการผ่าน Django Admin** (ไม่มีหน้า/endpoint custom ใน MVP); ฝั่งแอปอ่านค่าไปใช้ภายใน

### Working-Day Calendar Management (วันหยุด)

| ID | ความสามารถ |
|---|---|
| SET-1 | Admin จัดการ **วันหยุด** (`Holiday` — public/company) ผ่าน **Django Admin** (เพิ่ม/แก้/ลบ) |
| SET-2 | วันทำงานพื้นฐาน = จ–ศ; วันหยุดที่ตั้งถูกหักออกจากวันทำงาน |
| SET-3 | แอปอ่านวันทำงาน/วันหยุดภายใน (Working-Day Calendar §5.7) — ไม่มี endpoint สาธารณะ |

- ใช้ร่วมโดย: คำนวณ manday (§6.5), `delay_days`/health (§3.2), missing submission (§6.10), ตัวเลือกวัน + default `is_ot` ใน Daily Task (§6.8)
- การแก้วันหยุดย้อนหลังกระทบค่าที่ **derive** (manday/health คำนวณใหม่เมื่ออ่าน) แต่ **ไม่ rewrite `DailyEntry.is_ot` ที่ผู้ใช้กรอกไปแล้ว** (เก็บพฤติกรรมจริง ณ ตอนนั้น)

### System Settings (config)

| ID | ความสามารถ |
|---|---|
| SET-4 | Admin แก้ค่า config ผ่าน **Django Admin**: **`HOURS_PER_WORKING_DAY`** (default 8, ต้อง >0) ใช้แปลง hours↔manday (§6.6); **Health Status thresholds** (§3.2 — ปรับได้) |
| SET-5 | แอปโหลดค่า config ไปใช้ภายใน (manday variance §6.6, health §3.2) — ไม่มี endpoint สาธารณะ |

- เก็บใน entity `SystemSetting` (key–value); แก้แล้วมีผลกับการคำนวณรอบถัดไป
- จัดการเฉพาะ Admin ผ่าน Django Admin (ไม่อยู่ใน Permission Matrix หลักของแอป)

---

## 7. Data Model

### User

| Field | Type/Rule |
|---|---|
| id | system |
| full_name | text |
| email | unique |
| role | admin/dm/bsa/dev (default dev จนกว่า Admin จะกำหนด) |
| position | text |
| employment_type | permanent/contractor |
| is_allowed | boolean — allowlist; login ได้เฉพาะ true |
| created_at | datetime |
| updated_at | datetime |

### RolePermission

| Field | Type/Rule |
|---|---|
| role | admin/dm/bsa/dev |
| module | text |
| action | view/create/edit/delete |
| allowed | boolean |

### Client

| Field | Type/Rule |
|---|---|
| id | system |
| client_name | required |
| client_abbreviation | optional, unique if present |
| client_website | optional text |
| active_status | active/inactive |

### Project

| Field | Type/Rule |
|---|---|
| id | system |
| project_name | required |
| project_code | optional, unique if present |
| client_id | FK Client |
| value_thb | optional; เห็นเฉพาะ Admin/DM |
| po_user_id | optional FK User |
| start_date | optional |
| end_date | optional |
| project_phase | pre_sale/execution/ma/closed/cancelled |
| health_status | derived |
| delay_days | **derived only, deterministic** (คำนวณจาก milestone planned vs actual, ไม่ให้กรอกมือ) |
| created_at | datetime |
| updated_at | datetime |
| deleted_at | nullable datetime (soft-delete) |

### PlanItem

| Field | Type/Rule |
|---|---|
| id | system |
| project_id | FK Project |
| phase | text |
| task | text |
| manday | number, optional user input; auto-calculated (working days) when start_date + end_date are present |
| start_date | optional |
| end_date | optional |
| input_mode | manday/date/auto |
| is_milestone | boolean, default false — ใช้กำหนดจุดวัด health status (§3.2) |
| sort_order | number |
| created_at | datetime |
| updated_at | datetime |

### PlanItemDependency

| Field | Type/Rule |
|---|---|
| id | system |
| project_id | FK Project |
| predecessor_plan_item_id | FK PlanItem |
| successor_plan_item_id | FK PlanItem |
| relation_type | finish_to_start/start_to_start/finish_to_finish/start_to_finish |
| lag_days | number, default 0 |
| created_by | FK User |
| created_at | datetime |

ข้อกำหนด:

- predecessor และ successor ต้องอยู่ใน project เดียวกัน
- ห้ามสร้าง circular dependency
- relation นี้ใช้สำหรับแสดง dependency ใน Gantt และตรวจ warning เรื่องลำดับวันที่
- บันทึกและแสดงผล relation type ทั้ง 4 แบบใน Gantt (ดู §6.5)

### PlanItemRevision

| Field | Type/Rule |
|---|---|
| id | system |
| plan_item_id | FK PlanItem |
| field_name | text |
| old_value | text/json |
| new_value | text/json |
| change_reason | required เฉพาะ field สำคัญ |
| changed_by | FK User |
| changed_at | datetime |

### Task

| Field | Type/Rule |
|---|---|
| id | system |
| title | required |
| detail | optional |
| project_id | required สำหรับ Project Task |
| assigned_to | optional FK User |
| state | Get Req/Design/Development/Test/Training/Go Live — **BSA เลือกเองตอนแตก/สร้าง task (ไม่ auto จาก phase)** |
| status | Not Started/Working/Stuck/Done/Verified |
| source | manual/meeting/plan |
| plan_item_id | optional FK PlanItem |
| scheduled_date | optional |
| estimated_manday | number, decimal |
| created_at | datetime |
| updated_at | datetime |
| deleted_at | nullable datetime (soft-delete) |

### DailyEntry

| Field | Type/Rule |
|---|---|
| id | system |
| user_id | FK User |
| work_date | date |
| task_id | optional FK Task |
| project_id | optional FK Project |
| source | manual/meeting/plan |
| title | text |
| detail | optional |
| General classification | derived เมื่อ `task_id` และ `project_id` เป็น null (ไม่เก็บ field ซ้ำ) |
| status_snapshot | optional — สถานะ Task ณ ตอนกรอก (ใช้ใน Meeting Summary; null ถ้าเป็น General) |
| hours | decimal — **ระยะเวลาที่ใช้ทำ (ชั่วโมง), step 0.5, min 0.5** (actual effort ของวันนั้น) |
| is_ot | boolean — งานล่วงเวลา; default true ถ้า `work_date` เป็นวันหยุด/นอกวันทำงาน, false ถ้าวันทำงานปกติ; ผู้ใช้สลับได้ |
| calendar_event_id | optional |
| created_at | datetime |

หมายเหตุ:

- แบบ A (`task_id` มีค่า) → status มาจาก snapshot ของ Task ณ วันที่กรอก
- แบบ B (`project_id` เดี่ยว ไม่มี `task_id`) → ผูกโครงการ ไม่มี status (เช่น meeting/พิมพ์เองที่ tag โครงการ)
- แบบ C (ไม่มีทั้งคู่) → General ไม่มี status
- การ tag โครงการ = ตั้ง `project_id` เท่านั้น **ไม่สร้าง Task** (ดู §6.8)
- `hours` = effort จริงต่อ entry (หน่วย 0.5) — ใช้สรุปผลรวมต่อวัน/โครงการ และเทียบกับ estimated manday ได้; แปลงเป็น manday ผ่านค่า config "ชม. ต่อ working day" ถ้าต้องการ

### CostItem

| Field | Type/Rule |
|---|---|
| id | system |
| project_id | FK Project |
| category | manpower/infra/subscription/system/custom |
| label | text |
| qty_or_units | number |
| months | number |
| rate | number |
| total | derived/manual |
| is_outsource | boolean |
| note | optional |

### ProjectTeamMember

| Field | Type/Rule |
|---|---|
| project_id | FK Project |
| user_id | FK User |
| role_in_project | text |
| responsibilities | text |
| allocation_percentage | number |

### CalendarEvent

External/derived data จาก Google Calendar:

| Field | Type/Rule |
|---|---|
| external_event_id | Google Calendar event id |
| title | text |
| start_time | datetime |
| end_time | datetime |
| duration | number |
| attendees | optional |

### Holiday

ใช้โดย Working-Day Calendar (§5.7) สำหรับ manday calc, delay_days, missing submission

| Field | Type/Rule |
|---|---|
| id | system |
| holiday_date | date, unique |
| name | text |
| type | public/company |

### SystemSetting

key–value config ระดับระบบ (Admin แก้ — §6.15)

| Field | Type/Rule |
|---|---|
| key | text, unique (เช่น `HOURS_PER_WORKING_DAY`, `health_threshold_*`) |
| value | text/number/json |
| updated_by | FK User |
| updated_at | datetime |

---

## 8. Workflow Summary

### Pre-sale

1. DM สร้าง Project
2. เลือกหรือเพิ่ม Client จาก Client Master
3. กรอก Project Code เองถ้ามี
4. ทำ Plan/Timeline แบบ Phase → PlanItem
5. กรอก Budget
6. Export Budget เป็น Excel ได้
7. Export Plan/Timeline เป็น Excel หรือ PDF/Gantt ได้

### Execution

1. Admin/DM/BSA เปลี่ยน phase เป็น execution
2. BSA สร้าง Task จาก PlanItem แบบ generate all หรือ selected
3. BSA แตก PlanItem เป็นหลาย Task ย่อย
4. Dev เห็นงานที่ assign และ backlog ที่ยังไม่มี assignee
5. Dev claim task ได้ทันที
6. Assignee เปลี่ยน status ระหว่างทำงาน
7. Assignee mark Done
8. BSA verify เป็น Verified
9. PlanItem progress นับจาก Verified task เท่านั้น

### Daily Task

1. ทุกคนกรอก Daily Task ในวันทำงาน
2. Daily Task เป็น list หลายรายการ
3. รายการอาจมาจาก manual, meeting, หรือ plan
4. Calendar event แสดงเป็น suggestion
5. User เลือก event แล้วเลือก Project หรือ General เอง
6. In-app reminder แจ้งเตือนถ้ายังไม่กรอก

### Meeting Summary

1. เปิดหน้า default เป็น 7 วันล่าสุด
2. แสดงทุกคน ทุก project และ General
3. Dashboard สรุปภาพรวม
4. Table แสดงรายการ Daily Task ทั้งหมด
5. Filter/search ได้
6. Missing submission แสดงให้เห็นว่าใครยังไม่ได้กรอก

### MA

1. Admin/DM/BSA เปลี่ยน phase เป็น `ma`
2. MVP ยังไม่ทำ workflow เฉพาะของ MA
3. Task/Daily Task เดิมยังใช้ได้ตามปกติ

---

## 9. Non-functional Requirements

- Responsive: Mobile + Desktop
- Light/Dark mode — **ค่าเริ่มต้น = Light**
- **Accessibility:** contrast ตัวอักษร/ปุ่ม ผ่าน **WCAG 2.1 AA** (ตัวอักษรปกติ ≥ 4.5:1, UI/ตัวใหญ่ ≥ 3:1) ตาม *Design Tokens & UI Contract*; ใช้ token เท่านั้น ไม่ฮาร์ดโค้ดค่าสี
- **Usability:** Daily Task — ลง 1 รายการ ≤ 1 แตะ (หรือพิมพ์ + Enter)
- Google Login + user allowlist (login เฉพาะ user ที่ pre-approve)
- Google Calendar integration
- Realtime ใช้ polling/refresh เป็นหลัก และใช้ Django Channels เฉพาะจุดที่ต้อง live จริง
- Permission Matrix (`RolePermission`) เป็น authority ตอน request; ควบคุม action ราย role ได้จริง
- การคำนวณ manday, budget, progress และ health status ต้องถูกต้องตามสูตรที่ระบุใน §3.2, §6.5, §6.6
- ใช้ Working-Day Calendar กลาง (§5.7) ร่วมกันสำหรับ manday, delay_days และ missing submission
- วันที่ภายในใช้ ISO format; เวลาจาก Google Calendar normalize เป็น Asia/Bangkok
- **Export Excel** รองรับภาษาไทย (UTF-8)
- **Export PDF/Gantt** ต้อง embed ฟอนต์ไทย (Sarabun / Noto Sans Thai) และตัดคำไทยด้วย libthai/ICU — ห้ามพึ่งฟอนต์ default ของ PDF lib
- **Pagination** บน list ที่โตได้ (projects, tasks, daily entries, meeting summary table)
- ทุก entity หลักมี `created_at`/`updated_at`; Project/Task ใช้ soft-delete (`deleted_at`)
- Postgres ต้องมี backup และ restore plan ก่อน production
- ระบบวางหลัง gated access (IAP/Cloudflare Access/IP allowlist) ไม่ expose public เต็มตัว

---

## 10. Prototype Gaps ที่ต้องทำให้สมบูรณ์

จาก prototype เดิม:

1. manual login ยังไม่มี handler
2. mini calendar เลื่อนสัปดาห์ไม่ได้
3. Calendar view ตรึงเดือน October 2024
4. Gantt ยัง static
5. มาตรฐานวันที่ต้องเป็น ISO ภายใน

ปรับเพิ่มใน v0.5:

6. ต้องเชื่อม Gantt กับ PlanItem จริง
7. ต้องเพิ่ม Client Master
8. ต้องเพิ่ม PlanItem revision history
9. ต้องเพิ่ม Task status `Verified`
10. ต้องเพิ่ม DailyEntry สำหรับ General/Non-project
11. ต้องปรับ Meeting Summary เป็น dashboard + table + filter
12. ต้องเพิ่ม Budget visibility แยก detail/summary ตาม role

ปรับเพิ่มใน v0.6 (จาก review session — 20 ข้อ):

13. เพิ่ม `is_milestone` ใน PlanItem + นิยาม expected progress + threshold health status (§3.2)
14. ล็อกสูตร manday เป็น working days + Working-Day Calendar กลาง (§5.7, §6.5)
15. progress edge case: PlanItem ไม่มี child = N/A, project rollup ฐาน manday เดียวกัน (§6.6)
16. RolePermission เป็น authority; DM อยู่ใต้ matrix (§5.4, §4.1)
17. Budget เป็น estimation-only; เงินเดือนลับเฉพาะ Admin/DM; จำนวนคนเปิดถึง BSA (§6.11)
18. Project value เห็นเฉพาะ Admin/DM (§6.4)
19. Security: gated access + user allowlist (§5.6, §6.1)
20. Meeting Summary ใช้ status snapshot ณ วันที่กรอก (§6.8, §6.10)
21. delay_days derived only; **Task.state เลือกโดย BSA (ไม่ map จาก PlanItem.phase)**
22. soft-delete + created_at/updated_at + pagination; Thai PDF font embedding (§7, §9)
23. Gantt dependency รองรับ FS/SS/FF/SF พร้อม lag/lead และป้องกัน circular (§6.5)
24. Bootstrap: Admin แรก = superuser, user ใหม่ default role dev (§6.1)

ปรับเพิ่มใน v0.7 (UI):

25. เพิ่ม §5.8 UI Theme & Motion — ธีม Space, starfield + shooting star เป็น ambient decorative + reduced-motion-aware, ค่าจริงอ้าง design reference (mockup/Figma)

ปรับเพิ่มใน v0.8 (core flow + a11y):

26. §6.8 entry-first + MW-8/9/10 (3 แหล่งป้อนเด่นเท่ากัน, multi-project ต่อวัน, ลง ≤ 1 แตะ)
27. §6.8/§7 แยก daily entry เป็น 3 ประเภท (Task / project-only / general); tag โครงการ ≠ สร้าง Task
28. §6.9 CAL-4 เป็น one-tap (General by default, ผูกโครงการภายหลัง)
29. §9 NFR: default = Light + Accessibility WCAG AA + Usability budget
30. ผูกเอกสารคู่อย่างเป็นทางการ: Sitemap & Screen Spec + Design Tokens & UI Contract

ปรับเพิ่มใน v0.9 (time tracking):

31. เพิ่ม field `hours` ใน DailyEntry + MW-11 — ทุก entry เก็บระยะเวลาที่ใช้ทำ (ชม.) หน่วยย่อย 0.5, ปรับภายหลังได้, แสดงผลรวมต่อวัน (actual effort เทียบ estimated manday)

---

## 11. Decision Log จาก v0.5

| หมวด | Decision |
|---|---|
| Backend | Django + Django REST Framework เป็น API หลักภายใต้ `/api/...` |
| Frontend | React build แล้วให้ Django เสิร์ฟ |
| Auth | Google Login ผ่าน `django-allauth` + ดึง Google Calendar |
| Database | Postgres โดยเลือก Neon free tier หรือ self-host บน AWS |
| RBAC | Django users / groups / permissions + Django Admin เป็นฐาน |
| Realtime | polling/refresh เป็นหลัก; ใช้ Django Channels เฉพาะจุดที่ต้อง live |
| Infra | ต้องใช้งานผ่าน domain + HTTPS เมื่อ production |
| Access | เปิด public internet ด้วย domain + HTTPS |
| Infra owner | Dev ดูแลชั่วคราวจนกว่าจะมี IT/DevOps รับต่อ ไม่กำหนดเวลา |
| Permission | Simple Permission Matrix แบบ module + action |
| Department/Division | ยังไม่มีใน MVP |
| Plan input columns | แสดง Start Date, End Date, Manday ทั้ง 3 column เสมอ; ไม่บังคับกรอกครบทุกช่อง |
| Plan manday calculation | ถ้ากรอก Start Date + End Date ครบ ระบบคำนวณ Manday อัตโนมัติ |
| PlanItem dependency | Project Plan ต้องรองรับ relation/dependency ระหว่าง PlanItem และแสดงใน Gantt |
| Plan → Task | BSA generate all หรือ selected จาก PlanItem ได้ |
| PlanItem relationship | 1 PlanItem แตกเป็นหลาย Task ย่อยได้ |
| Task effort | ใช้ `estimated_manday` แบบทศนิยม |
| PlanItem progress | นับ Verified task แบบถ่วงน้ำหนักด้วย `estimated_manday` |
| Overrun | BSA เลือกปรับ PlanItem หรือยอมให้ overrun |
| Plan revision | เก็บ revision history ทุกครั้งที่แก้ PlanItem |
| Plan change reason | บังคับเฉพาะ manday/date/scope สำคัญ |
| Budget visibility | ทุก role เห็น summary; Admin/DM เห็น detail และแก้ได้ |
| Budget history | ไม่มีใน MVP |
| Budget export | Excel |
| Plan export | Excel และ PDF/Gantt |
| Daily Task | บังคับวันทำงาน + in-app reminder |
| Daily Task structure | list หลายรายการต่อวัน |
| General entry | ไม่มี status, เป็น daily entry เท่านั้น |
| Calendar event | เป็น suggestion; user เลือกเพิ่มเอง |
| Calendar project mapping | user เลือก Project/General เองทุกครั้ง |
| Dev claim | claim backlog task ได้ทันที ไม่ต้อง approval |
| Task status | Assignee + BSA เปลี่ยนได้ |
| Done/Verified | แยกสถานะ Done และ Verified |
| Meeting Summary | dashboard + table + filter จาก Daily Task entries |
| Meeting Summary default | 7 วันล่าสุด + ทุกคน + ทุก project + รวม General |
| Meeting Summary export | ไม่มีใน MVP |
| Project status | แยก project_phase กับ health_status |
| MA | เป็น project_phase ใน project เดิม ยังไม่ทำ workflow MA ใน MVP |
| Phase change | Admin/DM/BSA เปลี่ยนได้ |
| Phase note/history | ไม่ต้องมีใน MVP |
| Client | มี Client Master |
| Client add from project | เพิ่ม client จาก modal สร้าง Project ได้ |
| Client permission | Admin/DM/BSA เพิ่ม/แก้ได้ |
| Client abbreviation | optional แต่ถ้ามีต้อง unique |
| Client website | optional text ไม่ validate |
| Project code | user กรอกเอง, optional, unique if present |
| Health calc (v0.6) | milestone = PlanItem.is_milestone; expected progress เชิงเส้นถ่วง manday; threshold ตาม §3.2 |
| Manday formula (v0.6) | working days (จ–ศ หักวันหยุด) จาก Working-Day Calendar กลาง |
| Working calendar (v0.6) | component กลาง 1 ตัว ใช้ร่วม manday/delay/missing-submission |
| Progress edge (v0.6) | no-child = N/A; project rollup ถ่วง PlanItem.manday ฐานเดียว |
| RBAC authority (v0.6) | RolePermission เป็น source of truth ตอน request; Django perms ใช้แค่ Admin backend |
| DM permission (v0.6) | DM อยู่ใต้ matrix ไม่ hardcode bypass |
| Budget scope (v0.6) | estimation-only ไม่ผูก execution; ไม่มี role Sales แยก |
| Budget secrecy (v0.6) | เงินเดือน/rate = Admin/DM เท่านั้น; จำนวนคนเปิดถึง BSA; server/อื่นๆ ตามจริง |
| Project value (v0.6) | เห็นเฉพาะ Admin/DM |
| Access (v0.6) | gated access (IAP/Cloudflare/IP allowlist) ไม่ public เต็มตัว |
| Login allowlist (v0.6) | login เฉพาะ user ที่ pre-approve (user allowlist ไม่ใช่แค่ domain) |
| Bootstrap (v0.6) | Admin แรก = Django superuser; user ใหม่ default role = dev |
| Meeting status (v0.6) | snapshot status ณ ตอนกรอก daily entry (`status_snapshot`) |
| delay_days (v0.6) | derived only deterministic |
| Task.state (v1.3) | **BSA เลือกเองตอนแตก/สร้าง task** — ยกเลิก auto-map จาก PlanItem.phase (free text เดาผิด); 3 แกน phase/state แยกกัน |
| Soft-delete (v0.6) | Project/Task ใช้ deleted_at; ทุก entity มี created_at/updated_at |
| Gantt dependency | รองรับ FS/SS/FF/SF พร้อม lag/lead; ไม่ auto-reschedule; ป้องกัน circular |
| Thai PDF (v0.6) | embed ฟอนต์ไทย + ตัดคำ libthai/ICU |
| Pagination (v0.6) | list หลักมี pagination |
| UI theme (v0.7) | Space: starfield + shooting star เป็น ambient decorative, reduced-motion-aware; ค่าจริงอ้าง mockup (ดู §5.8) |
| Daily entry tag project (v0.8) | ผูกโครงการให้ entry = ตั้ง `project_id` เท่านั้น ไม่สร้าง Task ใหม่ |
| Daily entry hours (v0.9) | ทุก entry เก็บระยะเวลาที่ใช้ (ชม.) หน่วยย่อย 0.5; แสดงผลรวมต่อวัน; เป็น actual effort เทียบ estimated manday |
| Meeting Summary source (v0.8) | ใช้ `status_snapshot` ของวันที่กรอก ไม่ใช่ status ล่าสุดของ Task |
| Entry-first + UX (v0.8) | หน้าแรก = หน้ากรอก, 3 แหล่งป้อนเด่นเท่ากัน, 1 คนหลายโครงการ, ลง ≤ 1 แตะ |
| Default theme (v0.8) | Light เป็น default; contrast ผ่าน WCAG AA (ดู Design Tokens) |
| My Work layout (v1.0) | entry-first วัดที่พฤติกรรม (composer inline + 3 แหล่งเห็นพร้อมกัน + รายการติด composer + ≤1 แตะ) ไม่ใช่จำนวนคอลัมน์; **multi-column ได้** ถ้าคอลัมน์หลัก = composer+รายการ, source = side rail เห็นตลอด (single column ไม่บังคับ) |
| Meeting Summary (v1.0) | หน้า **review** แบบ dashboard จริง: filter ช่วงเวลา preset (1/2สัปดาห์,1เดือน,ทั้งหมด) + เลือกคน (กลุ่มตามทีม), group รายการ **ตามโครงการ** (ตาราง date/detail/note), สรุป **ชั่วโมงรวม + โดนัทตามโครงการ**; status = snapshot |
| OT (v1.1) | งานล่วงเวลา = flag `is_ot` ติ๊กตอนกรอก; default true ถ้าวันหยุด/นอกวันทำงาน (สลับเองได้); **กรอกเสาร์-อาทิตย์ได้** ผ่านตัวเลือกวัน; **ไม่มีเพดาน ชม./วัน** |
| Manday conversion (v1.1) | config `HOURS_PER_WORKING_DAY` default 8 (ปรับได้) ใช้แปลง hours↔manday **เฉพาะตอนเทียบ Manday Variance**; ปิดได้ถ้าไม่เทียบ |
| Unclaim (amendment) | ยกเลิก — งานที่มีผู้รับแล้วเปลี่ยนผู้รับได้ แต่ล้างกลับเป็น backlog ไม่ได้ |
| Settings module (v1.2) | เพิ่ม §6.15 — Admin จัดการ **วันหยุด** (`Holiday`, public/company) + **config** (`HOURS_PER_WORKING_DAY`, health thresholds) ใน entity `SystemSetting`; module `Settings` ใน matrix; แก้วันหยุดย้อนหลัง re-derive แต่ไม่แตะ `is_ot` ที่กรอกแล้ว |
| Sync pass (v1.3) | เพิ่ม module `Task` ใน matrix · Settings/Client/Holiday → **Django Admin** (ไม่มี custom UI/endpoint) · Overview Dashboard → **post-MVP** · **claim = capability เฉพาะ Dev** (ไม่ใช่ Task:edit) · Calendar+Daily = self-scoped นอก matrix |

---

## 12. Pending Decisions หลัง v0.5

| ID | เรื่อง | หมายเหตุ |
|---|---|---|
| P-1 | วิธี deploy Django production | server/runtime/reverse proxy/static files |
| P-2 | เลือก Postgres hosting | Neon free tier หรือ self-host บน AWS |
| P-3 | monitoring/logging | uptime, app logs, security logs |
| P-4 | health status threshold | ✅ resolved v0.6 — ดู §3.2 (threshold ค่าเริ่มต้น ปรับได้) |
| P-5 | production security owner ระยะยาว | ปัจจุบัน Dev ดูแลชั่วคราวไม่มีกำหนด |
| P-6 | Google Calendar scopes | ยืนยันสิทธิ์ที่ต้องขอจาก user |
| P-7 | MA รายละเอียดหลัง MVP | ticket type, SLA, support workflow |
| P-8 | สูตรคำนวณ manday จาก start/end date | ✅ resolved v0.6 — working days หักวันหยุด (Working-Day Calendar); ยังไม่หักวันลารายบุคคลใน MVP |
| P-9 | Dependency auto-reschedule | เมื่อ dependency ขัดแย้งจะให้ระบบเลื่อนวันที่อัตโนมัติหรือแค่ warning |

---

*PRD v1.3 — sync pass: module `Task` ใน matrix · `Task.state` BSA เลือกเอง (ไม่ auto จาก phase) · Settings/Client/Holiday → Django Admin · Overview → post-MVP · claim = capability เฉพาะ Dev · unclaim ยกเลิก · ต่อจาก v1.2*
