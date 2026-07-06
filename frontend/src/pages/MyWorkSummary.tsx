import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Maximize2, Minimize2, NotebookPen, Pencil, Save, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, EmptyState, Skeleton } from "../components/ui";
import LazyMarkdownContent from "../components/LazyMarkdownContent";
import RangePicker, { rangeParams, type RangeValue } from "../components/RangePicker";
import RichText, { isRichTextEmpty } from "../components/RichText";
import LazyRichTextEditor from "../components/LazyRichTextEditor";
import SortableTh, { type SortDir } from "../components/SortableTh";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_COLOR,
  type MySummaryEntry,
  type MySummaryGroup,
  type MySummaryNote,
  type MyWorkSummary,
} from "../lib/types";
import "./myworksummary.css";

const PRESETS = [
  { key: "1w", label: "1 สัปดาห์" },
  { key: "2w", label: "2 สัปดาห์" },
  { key: "1m", label: "1 เดือน" },
];

type SortKey = "work_date" | "hours" | "status_snapshot";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function MyWorkSummary() {
  const [range, setRange] = useState<RangeValue>({ preset: "1w", from: "", to: "" });
  const params = rangeParams(range);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-summary", params],
    queryFn: async () =>
      (await api.get<MyWorkSummary>("/my-summary", { params })).data,
  });

  return (
    <div>
      <PageHeader
        title="สรุปงานของฉัน"
        subtitle="เตรียมนำเสนองานรายโครงการ พร้อมประเด็นที่อยากบอกในที่ประชุม"
        action={<RangePicker presets={PRESETS} value={range} onChange={setRange} />}
      />

      {isLoading && <Skeleton rows={3} />}
      {isError && <Card>โหลดข้อมูลไม่สำเร็จ</Card>}

      {data && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-txt-dim">
            <span className="text-2xs text-txt-faint">
              {data.range.from} → {data.range.to}
            </span>
            <span className="ui-pill border border-line bg-card">
              <Clock3 size={13} /> รวม {Number(data.total_hours)} ชม.
            </span>
          </div>

          {data.groups.length === 0 && (
            <EmptyState
              title="ช่วงนี้ยังไม่มีบันทึกงาน"
              hint="กรอกงานในหน้า 'งานของฉัน' แล้วกลับมาเตรียมนำเสนอที่นี่"
            />
          )}

          <div className="flex flex-col gap-5">
            {data.groups.map((g) => (
              <ProjectSection key={g.project_id ?? "general"} group={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectSection({ group: g }: { group: MySummaryGroup }) {
  const [sortKey, setSortKey] = useState<SortKey>("work_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [noteWide, setNoteWide] = useState(false);

  const entries = useMemo(() => {
    const rows = [...g.entries];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortKey === "hours") return (Number(a.hours) - Number(b.hours)) * dir;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return rows;
  }, [g.entries, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <section className="ui-card overflow-hidden p-0">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
        <h2 className="font-bold text-txt-strong">{g.project_name}</h2>
        <span className="text-sm font-bold text-accent">{Number(g.hours)} ชม.</span>
      </header>

      <div className={"mws-layout border-t border-line" + (noteWide ? " note-wide" : "")}>
        {/* ตารางงาน (sort ได้) */}
        <div className="mws-table-wrap responsive-table-wrap">
          {entries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-txt-faint">
              ไม่มีบันทึกงานของโครงการนี้ในช่วงที่เลือก
            </p>
          ) : (
            <table className="responsive-table responsive-table--embedded w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left text-2xs uppercase tracking-wide text-txt-faint">
                  <SortableTh label="วันที่" k="work_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2 font-semibold">รายละเอียดงาน</th>
                  <SortableTh label="สถานะ" k="status_snapshot" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="ชม." k="hours" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* การ์ดประเด็นนำเสนอ — ย่อ/ขยายพื้นที่เทียบกับตารางงานได้ */}
        <NotesPanel projectId={g.project_id} notes={g.notes} wide={noteWide} onToggleWide={() => setNoteWide((v) => !v)} />
      </div>
    </section>
  );
}

function EntryRow({ entry: e }: { entry: MySummaryEntry }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td data-label="วันที่" className="whitespace-nowrap px-4 py-2 text-txt-dim">{formatDate(e.work_date)}</td>
      <td data-label="รายละเอียดงาน" className="px-4 py-2 text-txt-strong">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {e.detail ? <LazyMarkdownContent value={e.detail} compact /> : e.title}
          </div>
          {e.is_ot && (
            <span className="shrink-0 rounded-pill bg-warn-bg px-1.5 py-0.5 text-[10px] font-bold text-warn">OT</span>
          )}
        </div>
      </td>
      <td data-label="สถานะ" className="whitespace-nowrap px-4 py-2">
        {e.status_snapshot ? (
          <span style={{ color: TASK_STATUS_COLOR[e.status_snapshot] }}>
            {TASK_STATUS_LABEL[e.status_snapshot]}
          </span>
        ) : (
          <span className="text-txt-faint">—</span>
        )}
      </td>
      <td data-label="ชม." className="px-4 py-2 text-right text-txt-dim">{Number(e.hours)}</td>
    </tr>
  );
}

function NotesPanel({
  projectId, notes, wide, onToggleWide,
}: {
  projectId: number | null;
  notes: MySummaryNote[];
  wide: boolean;
  onToggleWide: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-summary"] });

  const create = useMutation({
    mutationFn: async () => api.post("/my-summary/notes", { project: projectId, body: draft }),
    onSuccess: () => {
      setDraft("");
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: string }) =>
      api.patch(`/my-summary/notes/${id}`, { body }),
    onSuccess: () => {
      setEditingId(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/my-summary/notes/${id}`),
    onSuccess: refresh,
  });

  return (
    <aside className="mws-note">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-txt-faint">
          <NotebookPen size={13} /> ประเด็นที่อยากบอก
        </h3>
        <button
          className="ui-icon-action hidden lg:grid"
          onClick={onToggleWide}
          aria-label={wide ? "ย่อพื้นที่ประเด็น" : "ขยายพื้นที่ประเด็น"}
          title={wide ? "ย่อพื้นที่ประเด็น" : "ขยายพื้นที่ประเด็น"}
        >
          {wide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {notes.length === 0 && (
        <p className="text-2xs text-txt-faint">ยังไม่มีประเด็นในช่วงนี้ — เขียนด้านล่างได้เลย</p>
      )}

      {notes.map((n) => (
        <div key={n.id} className="mws-note-item">
          <div className="flex items-center gap-2">
            <span className="text-2xs text-txt-faint">
              {new Date(n.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            {editingId !== n.id && (
              <span className="ml-auto inline-flex gap-1">
                <button
                  className="ui-icon-action"
                  aria-label="แก้ไขประเด็น"
                  title="แก้ไข"
                  onClick={() => {
                    setEditingId(n.id);
                    setEditBody(n.body);
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="ui-icon-action hover:text-danger"
                  aria-label="ลบประเด็น"
                  title="ลบ"
                  onClick={() => { if (window.confirm("ยืนยันลบประเด็นนี้?")) remove.mutate(n.id); }}
                  disabled={remove.isPending}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            )}
          </div>
          {editingId === n.id ? (
            <div className="mt-1 flex flex-col gap-2">
              <LazyRichTextEditor
                value={editBody}
                onChange={setEditBody}
                onSubmit={() => !isRichTextEmpty(editBody) && update.mutate({ id: n.id, body: editBody })}
              />
              <div className="flex items-center gap-2">
                <button
                  className="ui-btn-primary"
                  onClick={() => update.mutate({ id: n.id, body: editBody })}
                  disabled={isRichTextEmpty(editBody) || update.isPending}
                >
                  บันทึก
                </button>
                <button className="ui-icon-action" aria-label="ยกเลิก" title="ยกเลิก" onClick={() => setEditingId(null)}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-0.5">
              <RichText html={n.body} />
            </div>
          )}
        </div>
      ))}

      {/* Composer — เพิ่มประเด็นใหม่ของช่วงนี้ (ประวัติเก่ายังอยู่) */}
      <LazyRichTextEditor
        value={draft}
        onChange={setDraft}
        placeholder="ติดปัญหาอะไร ต้องการอะไรเพิ่ม ขั้นต่อไปทำอะไร…"
        onSubmit={() => !isRichTextEmpty(draft) && create.mutate()}
      />
      <div className="flex items-center justify-end">
        <button
          className="ui-btn-primary"
          onClick={() => create.mutate()}
          disabled={isRichTextEmpty(draft) || create.isPending}
          title="บันทึก (Ctrl/⌘ + Enter)"
        >
          <Save size={14} /> {create.isPending ? "กำลังบันทึก…" : "เพิ่มประเด็น"}
        </button>
      </div>
      <p className="text-2xs text-txt-faint">ประเด็นจะแสดงในหน้า "สรุปประชุม" ตามช่วงวันที่ที่เขียน — ของเก่าเก็บเป็นประวัติ</p>
    </aside>
  );
}
