import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { api } from "../lib/api";
import Donut, { type DonutSlice } from "../components/Donut";
import LazyMarkdownContent from "../components/LazyMarkdownContent";
import RangePicker, { rangeParams, type RangeValue } from "../components/RangePicker";
import RichText from "../components/RichText";
import SortableTh, { type SortDir } from "../components/SortableTh";
import {
  TASK_STATUS_LABEL,
  type MeetingSummary as Summary,
  type MissingSubmission,
  type Paginated,
  type SummaryEntry,
  type TeamMember,
} from "../lib/types";

const PRESETS = [
  { key: "1w", label: "1 สัปดาห์" },
  { key: "2w", label: "2 สัปดาห์" },
  { key: "1m", label: "1 เดือน" },
  { key: "all", label: "ทั้งหมด" },
];
const PALETTE = ["var(--accent)", "var(--proj-pttor)", "var(--accent-2)", "var(--proj-thp)", "var(--ok)", "var(--warn)", "var(--proj-mrta)"];
const ROLE_LABEL: Record<string, string> = { admin: "Admin", dm: "DM", bsa: "BSA", dev: "Dev" };

function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

type EntrySortKey = "work_date" | "user_name" | "status_snapshot" | "hours";

/** Per-project entries table — sortable by header, same UX as สรุปงานของฉัน. */
function GroupTable({ entries, fontScale }: { entries: SummaryEntry[]; fontScale: number }) {
  const [sortKey, setSortKey] = useState<EntrySortKey>("work_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo(() => {
    const sorted = [...entries];
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      if (sortKey === "hours") return (Number(a.hours) - Number(b.hours)) * dir;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return sorted;
  }, [entries, sortKey, sortDir]);

  function toggleSort(key: EntrySortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="responsive-table-wrap">
      <table className="responsive-table responsive-table--embedded w-full border-t border-line" style={{ fontSize: `${fontScale}px` }}>
        <thead>
          <tr className="border-b border-line bg-panel text-left text-2xs uppercase tracking-wide text-txt-faint">
            <SortableTh label="วันที่" k="work_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="คน" k="user_name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            <th className="px-4 py-2 font-semibold">รายละเอียดงาน</th>
            <SortableTh label="สถานะ" k="status_snapshot" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="ชม." k="hours" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-line last:border-0">
              <td data-label="วันที่" className="px-4 py-2 text-txt-dim">{e.work_date}</td>
              <td data-label="คน" className="px-4 py-2 break-words text-txt-dim">{e.user_name}</td>
              <td data-label="รายละเอียดงาน" className="px-4 py-2 text-txt-strong">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {e.detail ? <LazyMarkdownContent value={e.detail} compact /> : e.title}
                  </div>
                  {e.is_ot && <span className="shrink-0 rounded-pill bg-warn-bg px-1.5 py-0.5 text-[10px] font-bold text-warn">OT</span>}
                </div>
              </td>
              <td data-label="สถานะ" className="px-4 py-2 text-txt-dim">{e.status_snapshot ? TASK_STATUS_LABEL[e.status_snapshot] : "—"}</td>
              <td data-label="ชม." className="px-4 py-2 text-right text-txt-dim">{Number(e.hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MeetingSummary() {
  const [range, setRange] = useState<RangeValue>({ preset: "1w", from: "", to: "" });
  const [user, setUser] = useState("");
  const [fontScale, setFontScale] = useState(13);

  const params = useMemo(() => {
    const p: Record<string, string> = rangeParams(range);
    if (user) p.user = user;
    return p;
  }, [range, user]);
  const missingParams = useMemo(() => rangeParams(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["meeting-summary", params],
    queryFn: async () => (await api.get<Summary>("/meeting-summary", { params })).data,
  });
  const { data: missing } = useQuery({
    queryKey: ["meeting-missing", missingParams],
    queryFn: async () => (await api.get<MissingSubmission>("/meeting-summary/missing", { params: missingParams })).data,
  });
  const { data: team } = useQuery({
    queryKey: ["team-members-all"],
    queryFn: async () => (await api.get<Paginated<TeamMember>>("/team-members")).data.results,
  });

  const teamByRole = useMemo(() => {
    const m: Record<string, TeamMember[]> = {};
    (team ?? []).forEach((t) => (m[t.role] ??= []).push(t));
    return m;
  }, [team]);

  const slices: DonutSlice[] = (data?.hours_by_project ?? []).map((h, i) => ({
    label: h.project_name,
    value: Number(h.hours),
    color: h.project_id == null ? "var(--chart-neutral)" : PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* Left rail */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <h1 className="text-2xl font-bold text-txt-strong">สรุปประชุม</h1>

        <RangePicker presets={PRESETS} value={range} onChange={setRange} />

        <div>
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-txt-faint">เลือกคน</label>
          <select className="ui-input w-full" value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">ทุกคน</option>
            {Object.entries(teamByRole).map(([role, members]) => (
              <optgroup key={role} label={ROLE_LABEL[role] || role}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="ui-card p-5 text-center">
          <div className="mb-3 text-sm text-txt-dim">
            <span className="text-2xl font-bold text-accent">{data ? Number(data.total_hours) : 0}</span> ชม. รวม
          </div>
          <Donut slices={slices} />
        </div>

        {missing && missing.missing.length > 0 && (
          <div className="ui-card p-4">
            <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-warn">ยังไม่กรอก ({missing.missing.length})</h3>
            <ul>
              {missing.missing.map((m) => (
                <li key={m.user} className="flex justify-between py-0.5 text-2xs">
                  <span className="text-txt-strong">{m.full_name}</span>
                  <span className="text-warn">ขาด {m.missing_count} วัน</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Right content */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-2xs text-txt-faint">{data ? `${data.range.from} → ${data.range.to}` : ""}</span>
          <div className="flex items-center gap-2 text-2xs text-txt-faint">
            ขนาดอักษร
            <button className="ui-icon-action border border-line bg-card" aria-label="ลดขนาดอักษร" onClick={() => setFontScale((s) => Math.max(10, s - 1))}><Minus size={15} /></button>
            <button className="ui-icon-action border border-line bg-card" aria-label="เพิ่มขนาดอักษร" onClick={() => setFontScale((s) => Math.min(20, s + 1))}><Plus size={15} /></button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-txt-dim">กำลังโหลด…</p>}
        {data && data.groups.length === 0 && <div className="ui-card p-5 text-sm text-txt-dim">ช่วงนี้ยังไม่มีข้อมูล</div>}

        {data?.groups.map((g) => (
          <div key={g.project_id ?? "general"} className="ui-card overflow-hidden">
            <div className="flex items-baseline justify-between px-4 py-3">
              <h3 className="font-bold text-txt-strong">{g.project_name}</h3>
              <span className="font-bold text-accent">{Number(g.hours)} ชม.</span>
            </div>
            {g.entries.length > 0 && <GroupTable entries={g.entries} fontScale={fontScale} />}

            {/* ประเด็นนำเสนอ — ที่แต่ละคนเตรียมไว้ในหน้า "สรุปงานของฉัน" */}
            {(g.notes ?? []).length > 0 && (
              <div className="border-t border-line px-4 py-3" style={{ fontSize: `${fontScale}px` }}>
                <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-warn">
                  ประเด็นนำเสนอ ({g.notes.length})
                </h4>
                <ul className="flex flex-col gap-3">
                  {g.notes.map((n) => (
                    <li key={n.id}>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-txt-strong">{n.user_name}</span>
                        <span className="text-2xs text-txt-faint">บันทึก {formatNoteDate(n.created_at)}</span>
                      </div>
                      <div className="min-w-0 text-txt-dim">
                        <RichText html={n.body} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
