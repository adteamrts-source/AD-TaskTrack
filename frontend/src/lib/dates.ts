// Local-date helpers (ISO YYYY-MM-DD, no timezone surprises).

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  return new Date(s + "T00:00:00");
}

/** Monday of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7; // Mon=0 .. Sun=6
  r.setDate(r.getDate() - dow);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Mon–Fri ISO dates for the week containing `d`. */
export function workWeek(d: Date): string[] {
  const mon = mondayOf(d);
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return toISO(x);
  });
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

const TH_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export function thaiDow(iso: string): string {
  return TH_DOW[fromISO(iso).getDay()];
}

export function isWeekend(iso: string): boolean {
  const dow = fromISO(iso).getDay();
  return dow === 0 || dow === 6;
}
