# ASTRO — Design Tokens & UI Contract (v0.2)
### คู่กับ PRD v1.3 (§5.8) — "ค่าจริง" ของหน้าตา: สี / contrast / typography / spacing / motion

| | |
|---|---|
| **เอกสารนี้คือ** | single source of truth ของค่าหน้าตา — PRD §5.8 อ้างอิงมาที่นี่ |
| **กฎเหล็ก** | dev ใช้ `var(--token)` เท่านั้น **ห้ามฮาร์ดโค้ดค่าสี/ระยะ**; เพิ่ม token ใหม่ที่เอกสารนี้ที่เดียว |
| **ขอบเขต** | ครอบทั้ง 2 ธีม — **Light = default**, Dark สลับได้ |

---

## 1. Theme & default

- ธีม **Space / Observatory** (glassmorphism + accent ฟ้า/ม่วง, ambient starfield — ดู §5.8)
- **ค่าเริ่มต้น = Light mode** ("cosmic dawn"); ผู้ใช้สลับ Dark ได้, จำค่าที่เลือกไว้

---

## 2. Color tokens

| Token | Light (default) | Dark |
|---|---|---|
| `--bg` | `#f8fafc` | `#050510` |
| `--txt` | `#1e293b` | `#e2e8f0` |
| `--txt-strong` | `#0f172a` | `#ffffff` |
| `--txt-dim` | `#475569` | `#94a3b8` |
| `--txt-faint` | `#64748b` | `#64748b` |
| `--panel` | `rgba(255,255,255,.82)` | `rgba(15,23,42,.66)` |
| `--card` | `rgba(255,255,255,.85)` | `rgba(30,41,59,.55)` |
| `--line` | `rgba(15,23,42,.10)` | `rgba(255,255,255,.08)` |
| `--field` | `#ffffff` | `rgba(2,6,23,.5)` |
| `--accent` | `#0e7490` | `#22d3ee` |
| `--accent-2` | `#2563eb` | `#3b82f6` |
| `--btn-grad` | `linear-gradient(120deg,#0e7490,#1d4ed8)` | `linear-gradient(120deg,#22d3ee,#38bdf8)` |
| `--on-btn` | `#ffffff` | `#04121a` |
| `--star` | `#94a3b8` | `#ffffff` |
| `--shoot-c` | `#0e7490` | `#22d3ee` |
| `--ok` | `#059669` | `#10b981` |
| `--danger` | `#e11d48` | `#f43f5e` |
| `--warn` (OT/missing/variance) | `#b45309` | `#fbbf24` |
| `--warn-bg` | `rgba(245,158,11,.12)` | `rgba(245,158,11,.16)` |
| `--chart-neutral` (General slice) | `#94a3b8` | `#64748b` |

โทนโครงการ (project accent — ใช้เป็นขอบ/จุด ไม่ใช้เป็นตัวอักษรบนพื้นอ่อน): AOT `#22d3ee` · PTTOR `#a855f7` · MRTA `#60a5fa` · ไปรษณีย์ไทย `#fb923c` · ASTRO `#f472b6`

**Data-viz (v0.2):** โดนัทสรุปชั่วโมง (Meeting Summary) ใช้ **โทนโครงการ** ต่อ slice ของแต่ละโครงการ + กลุ่ม **General = `--chart-neutral`** · **badge OT / missing-submission / variance** ใช้ `--warn` บน `--warn-bg` · status/health pill ใช้ `--ok` / `--warn` / `--danger` (ผ่าน AA)

---

## 3. Contrast contract ★ (กฎที่เคยพลาดจนปุ่มกลืนตัวอักษร)

**มาตรฐาน: WCAG 2.1 AA**
- ตัวอักษรปกติ **≥ 4.5:1**
- ตัวอักษรใหญ่ (≥ 24px ปกติ / ≥ 18.66px bold) และองค์ประกอบ UI (ขอบปุ่ม/ไอคอน) **≥ 3:1**

**ปุ่มหลัก (filled) — ต้องใช้ `--on-btn` คู่กับ `--btn-grad` เสมอ:**

| ธีม | พื้นปุ่ม | ตัวอักษร | อัตราส่วน |
|---|---|---|---|
| Light | `#0e7490 → #1d4ed8` | ขาว `#ffffff` | **~5.0–7.5:1** ✅ |
| Dark | `#22d3ee → #38bdf8` | ดำ `#04121a` | **~7.7–9.6:1** ✅ |

**ข้อห้าม:** ห้ามวางตัวอักษรเข้มบนปุ่มสี saturated โทนกลาง (ต้นเหตุที่ตัวอักษร "กลืน" กับปุ่ม) — ให้เลือกขาว/ดำตาม luminance ของพื้นปุ่มผ่าน `--on-btn` เท่านั้น

**ตัวอักษรบนพื้น (ผ่านทุกตัว):**
- `--txt-strong`, `--txt-dim` บน `--panel`/`--bg` → ≥ 7:1
- `--txt-faint` → light `#64748b` ≈ 4.6:1 (ห้ามใช้ `#94a3b8` กับ text เล็กบนพื้นขาว — ตก AA)
- `--accent` เป็นตัวอักษร (ลิงก์/ตัวเลขเด่น) → light `#0e7490` บนพื้นขาว ≈ 5:1

**Process:** ทุกคู่ text/bg ต้องผ่าน contrast checker ก่อน merge (เช่น axe DevTools / Stark) — ใส่ใน Definition of Done

---

## 4. Typography

- Font: **Inter** + Thai fallback (เช่น Noto Sans Thai / IBM Plex Sans Thai)
- Scale: heading 20–23 · body 13–14 · meta/label 10–11 · ช่องกรอก Daily Task 18 (ตั้งใจให้เด่น)
- Weight: 600 = เน้น, 700 = หัวข้อ/ปุ่ม · uppercase + letter-spacing .05em เฉพาะ label เล็ก

---

## 5. Spacing / radius / shadow

- Spacing base **4px** (gap หลัก 8/10/12/16/20/24)
- Radius: การ์ด 16 · panel/composer 22 · ปุ่ม 11–13 · pill/badge 999
- Border: 1px `--line` · ขอบซ้ายการ์ดงาน 4px = สีโครงการ
- Shadow: การ์ด hover ยกขึ้น + เงานุ่ม · ปุ่มหลักมี glow ฟ้า (ค่าเต็มอ้าง mockup)

---

## 6. Motion (สรุปจาก §5.8)

- Starfield: จุดสุ่ม กระพริบ fade/scale ~3s loop
- Shooting star: พาดเป็นระยะ
- **ปิด animation ที่เคลื่อนไหวเมื่อ `prefers-reduced-motion`**
- Light mode ลดความเข้ม ambient · ทั้งหมด `pointer-events:none` หลัง UI · ห้าม jank/เสีย contrast

---

## 7. Usage rule (ย้ำ)

1. ใช้ `var(--token)` เท่านั้น — ไม่ฮาร์ดโค้ด hex/px ใน component
2. ต้องการค่าใหม่ → เพิ่ม token ในเอกสารนี้ก่อน แล้วค่อยใช้
3. Component spec ทุกตัวอ้าง token จากที่นี่ (สี/ระยะ/รัศมี/เงา)
4. ทั้ง 2 ธีมต้องผ่าน contrast contract (§3) เสมอ

---

*ASTRO Design Tokens & UI Contract v0.2 — คู่กับ PRD v1.3 §5.8 · เพิ่ม data-viz & status tokens (โดนัทชั่วโมง · OT/missing/variance · ok/danger) · เป็น reference ที่ PRD ชี้มาหา*
