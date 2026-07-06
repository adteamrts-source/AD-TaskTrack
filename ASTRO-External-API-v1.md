# ASTRO External Inbound API — v1

Spec สำหรับระบบภายนอกที่ต้องการส่งข้อมูล **โครงการ (Project)** และ **งาน (Task)** เข้าสู่ ASTRO

- Base URL: `https://<astro-host>/api/external/v1`
- รูปแบบ: REST + JSON (UTF-8)
- ขอบเขต v1: **create-only** — สร้างข้อมูลใหม่เท่านั้น ไม่มี update/upsert (by design)
  การแก้ไขข้อมูลหลังส่งเข้า ทำในหน้า ASTRO โดยทีมภายใน

---

## 1. Authentication

ทุก request ต้องแนบ API key ที่ออกโดยผู้ดูแลระบบ ASTRO ใน header อย่างใดอย่างหนึ่ง:

```
X-API-Key: astro_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

หรือ

```
Authorization: Bearer astro_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Key lifecycle

- Key ออกให้ต่อระบบ (1 ระบบ = 1 key) ผ่านผู้ดูแลระบบ ASTRO
  (Django Admin หรือคำสั่ง `python manage.py create_api_key "<ชื่อระบบ>"`)
- ระบบเก็บ key แบบ **hash เท่านั้น** — ค่า key จริงแสดงครั้งเดียวตอนสร้าง
  **key หายต้องออกใหม่ (rotate)** กู้คืนไม่ได้
- ปิดใช้งาน key ได้ทันทีจาก Django Admin (`is_active = false` → ทุก request ตอบ 401)
- API key ใช้ได้เฉพาะ endpoints ใน spec นี้ ไม่สามารถเรียก API ส่วนอื่นของ ASTRO ได้
  และ session ผู้ใช้ปกติก็เรียก endpoints เหล่านี้ไม่ได้เช่นกัน

### Rate limit

**600 requests/ชั่วโมง ต่อ key** — เกินแล้วตอบ `429 Too Many Requests`
พร้อม header `Retry-After` (วินาที)

---

## 2. Endpoints

### 2.1 `GET /health` — ทดสอบการเชื่อมต่อ

ใช้ตรวจว่า key ใช้งานได้ก่อนเริ่มเชื่อมต่อจริง

**Response `200`**

```json
{ "status": "ok", "key_name": "ERP" }
```

---

### 2.2 `POST /projects` — สร้างโครงการ

**Request body**

| field | type | required | คำอธิบาย |
|---|---|---|---|
| `project_name` | string (≤255) | ✅ | ชื่อโครงการ |
| `project_code` | string (≤64) | – | รหัสโครงการ — **unique** ทั้งระบบ (ตรวจแบบไม่สนตัวพิมพ์) |
| `client` | object หรือ string | ✅ | ลูกค้า (ดูด้านล่าง) |
| `start_date` | date `YYYY-MM-DD` | – | วันเริ่ม |
| `end_date` | date `YYYY-MM-DD` | – | วันสิ้นสุด (ต้องไม่ก่อน `start_date`) |
| `project_phase` | string | – | `pre_sale` (default) / `execution` / `ma` / `closed` / `cancelled` |

**`client`** ส่งได้ 2 แบบ:

```json
"client": { "client_name": "Beta Co", "client_abbreviation": "BETA" }
```

```json
"client": "Beta Co"
```

การจับคู่ลูกค้า (ไม่สนตัวพิมพ์): หาโดย `client_abbreviation` ก่อน → ไม่เจอหาโดย `client_name` → **ไม่เจอทั้งคู่ระบบสร้าง client ใหม่ให้อัตโนมัติ** (ดูผลได้จาก `client.created` ใน response)

**ตัวอย่าง request**

```json
{
  "project_name": "New CRM",
  "project_code": "CRM-01",
  "client": { "client_name": "Beta Co", "client_abbreviation": "BETA" },
  "start_date": "2026-08-01",
  "end_date": "2026-12-30",
  "project_phase": "pre_sale"
}
```

**Response `201`**

```json
{
  "id": 9,
  "project_name": "New CRM",
  "project_code": "CRM-01",
  "client": {
    "id": 4,
    "client_name": "Beta Co",
    "client_abbreviation": "BETA",
    "created": true
  },
  "project_phase": "pre_sale",
  "start_date": "2026-08-01",
  "end_date": "2026-12-30"
}
```

**ข้อควรรู้:** `project_code` ซ้ำ → `409 Conflict` — ใช้เป็นกลไกกันส่งซ้ำได้ (ส่ง code เดิมซ้ำจะไม่เกิดรายการซ้ำ) ระบบต้นทางควรส่ง `project_code` เสมอ

---

### 2.3 `POST /tasks` — สร้างงาน

**Request body**

| field | type | required | คำอธิบาย |
|---|---|---|---|
| `project_code` | string | ✅* | อ้างอิงโครงการด้วยรหัส (แนะนำ, ไม่สนตัวพิมพ์) |
| `project_id` | integer | ✅* | หรืออ้างอิงด้วย id ของ ASTRO (*ต้องมีอย่างใดอย่างหนึ่ง) |
| `title` | string (≤255) | ✅ | ชื่องาน |
| `detail` | string | – | รายละเอียด |
| `state` | string | – | ขั้น SDLC: `get_req` (default) / `design` / `development` / `test` / `training` / `go_live` |
| `assignee_email` | email | – | อีเมลผู้รับผิดชอบ — จับคู่กับ user ใน ASTRO (ไม่สนตัวพิมพ์) |
| `estimated_manday` | decimal string | – | ประมาณการ manday เช่น `"2.5"` |
| `scheduled_date` | date `YYYY-MM-DD` | – | วันที่นัดหมาย |

งานที่สร้างจะมี `status = "not_started"` และ `source = "external"` เสมอ

**การจับคู่ `assignee_email`:** เจอ user → assign ให้เลย, ไม่เจอ → **ยังสร้างงานสำเร็จ (201)** แต่ไม่ assign (`assigned_to: null`, `assignee_matched: false`) ให้ทีมภายในมารับงานจาก Backlog เอง

**ตัวอย่าง request**

```json
{
  "project_code": "CRM-01",
  "title": "Import customer data",
  "detail": "โอนข้อมูลลูกค้าจากระบบเดิม",
  "state": "development",
  "assignee_email": "dev@example.com",
  "estimated_manday": "2.5",
  "scheduled_date": "2026-08-15"
}
```

**Response `201`**

```json
{
  "id": 31,
  "title": "Import customer data",
  "project": 9,
  "project_code": "CRM-01",
  "assigned_to": 5,
  "assignee_matched": true,
  "state": "development",
  "status": "not_started",
  "source": "external",
  "estimated_manday": "2.50",
  "scheduled_date": "2026-08-15"
}
```

---

## 3. Error codes

Error ทั้งหมดใช้รูปแบบมาตรฐาน DRF:

```json
{ "detail": "ข้อความอธิบาย" }
```

หรือ (validation error รายฟิลด์):

```json
{ "project_name": ["This field is required."] }
```

| status | ความหมาย | เจอเมื่อ |
|---|---|---|
| `400` | Validation error | ฟิลด์ขาด/รูปแบบผิด/ค่า enum ไม่ถูกต้อง/วันที่ย้อนกลับ |
| `401` | Unauthorized | ไม่แนบ key / key ผิด / key ถูกปิดใช้งาน |
| `404` | Not found | `project_code` หรือ `project_id` ที่อ้างในการสร้าง task ไม่มีในระบบ |
| `409` | Conflict | `project_code` ซ้ำกับที่มีอยู่แล้ว |
| `429` | Too many requests | เกิน rate limit (600/ชม./key) — ดู header `Retry-After` |

---

## 4. Versioning

- URL ระบุ version เสมอ (`/api/external/v1/…`) — การเปลี่ยนแปลงที่ไม่ backward-compatible จะออกเป็น `/v2` โดย v1 ยังใช้ต่อได้ระยะหนึ่ง
- v1 จงใจเป็น **create-only**: ไม่มี PUT/PATCH/DELETE และไม่มี upsert
  ถ้าต้องการความสามารถ update ในอนาคต จะพิจารณาใน v2 พร้อมกลไก external reference

## 5. Changelog

| วันที่ | รายการ |
|---|---|
| 2026-07-02 | v1 แรกเริ่ม — health / projects / tasks (create-only) |
