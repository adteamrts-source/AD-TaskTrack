import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import "./rangepicker.css";

export interface RangeValue {
  preset: string; // preset key, or "custom"
  from: string;
  to: string;
}

/**
 * Query params for a range value: explicit {from,to} only when the custom
 * range is complete; otherwise fall back to the preset so an incomplete
 * custom pick never triggers a bad fetch.
 */
export function rangeParams(value: RangeValue, fallbackPreset = "1w"): Record<string, string> {
  if (value.preset === "custom") {
    if (value.from && value.to && value.from <= value.to) {
      return { from: value.from, to: value.to };
    }
    return { preset: fallbackPreset };
  }
  return { preset: value.preset };
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtShort = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

const TH_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/**
 * Preset chips + a booking-style range calendar: open one calendar, click the
 * start day then the end day — the range highlights and applies immediately.
 */
export default function RangePicker({
  presets,
  value,
  onChange,
}: {
  presets: { key: string; label: string }[];
  value: RangeValue;
  onChange: (value: RangeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btn = (active: boolean) =>
    "min-h-11 rounded-btn border px-3 py-2 text-2xs font-bold transition " +
    (active
      ? "border-transparent [background:var(--btn-grad)] [color:var(--on-btn)]"
      : "border-line bg-card text-txt-dim hover:border-accent");

  const customLabel =
    value.preset === "custom" && value.from && value.to
      ? `${fmtShort(value.from)} – ${fmtShort(value.to)}`
      : "กำหนดเอง";

  return (
    <div className="relative flex flex-col gap-2" ref={wrapRef}>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {presets.map((p) => (
          <button
            key={p.key}
            className={btn(value.preset === p.key)}
            onClick={() => {
              setOpen(false);
              onChange({ ...value, preset: p.key });
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          className={btn(value.preset === "custom") + " inline-flex items-center justify-center gap-1.5"}
          onClick={() => {
            onChange({ ...value, preset: "custom" });
            setOpen((v) => !v);
          }}
          aria-expanded={open}
        >
          <CalendarRange size={14} /> {customLabel}
        </button>
      </div>

      {open && (
        <RangeCalendar
          from={value.from}
          to={value.to}
          onPick={(from, to) => {
            onChange({ preset: "custom", from, to });
            if (from && to) setOpen(false); // ครบสองวัน = ใช้ช่วงนี้เลย
          }}
        />
      )}
    </div>
  );
}

function RangeCalendar({
  from,
  to,
  onPick,
}: {
  from: string;
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  const anchor = from ? new Date(`${from}T00:00:00`) : new Date();
  const [year, setYear] = useState(anchor.getFullYear());
  const [month, setMonth] = useState(anchor.getMonth());
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = toISO(new Date());

  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(year, month, i + 1))),
  ];

  function move(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function pick(day: string) {
    if (!from || (from && to)) {
      onPick(day, ""); // เริ่มเลือกใหม่
    } else if (day < from) {
      onPick(day, ""); // คลิกก่อนวันเริ่ม = ย้ายวันเริ่ม
    } else {
      onPick(from, day);
    }
  }

  // ช่วง preview ระหว่างเลือก (เริ่มแล้ว ยังไม่จบ) ตามตำแหน่ง hover
  const previewEnd = from && !to && hoverDay && hoverDay >= from ? hoverDay : null;
  const inRange = (day: string) => {
    if (from && to) return day >= from && day <= to;
    if (from && previewEnd) return day >= from && day <= previewEnd;
    return false;
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rp-cal" role="dialog" aria-label="เลือกช่วงวันที่">
      <div className="rp-cal-head">
        <button className="ui-icon-action" onClick={() => move(-1)} aria-label="เดือนก่อนหน้า"><ChevronLeft size={16} /></button>
        <span className="rp-cal-month">{monthLabel}</span>
        <button className="ui-icon-action" onClick={() => move(1)} aria-label="เดือนถัดไป"><ChevronRight size={16} /></button>
      </div>

      <div className="rp-cal-grid rp-cal-dows">
        {TH_DOW.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="rp-cal-grid" onMouseLeave={() => setHoverDay(null)}>
        {cells.map((day, i) =>
          day === null ? (
            <span key={`e${i}`} />
          ) : (
            <button
              key={day}
              className={
                "rp-day" +
                (inRange(day) ? " in-range" : "") +
                (day === from ? " is-start" : "") +
                (day === to || (previewEnd !== null && day === previewEnd) ? " is-end" : "") +
                (day === todayISO ? " is-today" : "")
              }
              onClick={() => pick(day)}
              onMouseEnter={() => setHoverDay(day)}
            >
              {Number(day.slice(8))}
            </button>
          ),
        )}
      </div>

      <div className="rp-cal-foot">
        <span className="text-2xs text-txt-faint">
          {!from
            ? "แตะวันเริ่มต้น"
            : !to
              ? `เริ่ม ${fmtShort(from)} — แตะวันสิ้นสุด`
              : `${fmtShort(from)} – ${fmtShort(to)}`}
        </span>
        {(from || to) && (
          <button className="text-2xs font-bold text-accent" onClick={() => onPick("", "")}>ล้าง</button>
        )}
      </div>
    </div>
  );
}
