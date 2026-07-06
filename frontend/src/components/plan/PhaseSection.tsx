import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Dependency, PlanItem } from "../../lib/types";
import { dependencyText } from "./shared";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

/** Collapsible card for one phase: compact item rows + a quick-add row. */
export default function PhaseSection({
  phase,
  items,
  total,
  allItems,
  deps,
  canEdit,
  canDelete,
  canCreate,
  deleting,
  onEdit,
  onDelete,
  onQuickAdd,
  quickAddPending,
}: {
  phase: string;
  items: PlanItem[];
  total: number;
  allItems: PlanItem[];
  deps: Dependency[];
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  deleting: boolean;
  onEdit: (item: PlanItem) => void;
  onDelete: (id: number) => void;
  onQuickAdd: (payload: Record<string, unknown>) => void;
  quickAddPending: boolean;
}) {
  const [open, setOpen] = useState(true);
  const nameById = useMemo(() => new Map(allItems.map((it) => [it.id, it.task])), [allItems]);

  const starts = items.map((i) => i.start_date).filter(Boolean) as string[];
  const ends = items.map((i) => i.end_date).filter(Boolean) as string[];
  const sortedEnds = ends.slice().sort();
  const range = starts.length && ends.length
    ? `${shortDate(starts.slice().sort()[0])} – ${shortDate(sortedEnds[sortedEnds.length - 1])}`
    : "ยังไม่กำหนดวัน";

  return (
    <section className="ui-card overflow-hidden p-0">
      <button
        type="button"
        className="plan-phase-head flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={15} className="shrink-0 text-txt-faint" /> : <ChevronRight size={15} className="shrink-0 text-txt-faint" />}
        <span className="min-w-0 flex-1 truncate font-bold text-txt-strong">{phase}</span>
        <span className="text-2xs text-txt-faint">{items.length} งาน · {range}</span>
        <span className="text-sm font-bold text-accent">{total} manday</span>
      </button>

      {open && (
        <div className="border-t border-line">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              deps={deps}
              nameById={nameById}
              canEdit={canEdit}
              canDelete={canDelete}
              deleting={deleting}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
            />
          ))}
          {canCreate && <QuickAddRow phase={phase} pending={quickAddPending} onAdd={onQuickAdd} />}
        </div>
      )}
    </section>
  );
}

function ItemRow({
  item, deps, nameById, canEdit, canDelete, deleting, onEdit, onDelete,
}: {
  item: PlanItem;
  deps: Dependency[];
  nameById: Map<number, string>;
  canEdit: boolean;
  canDelete: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const myPreds = deps.filter((d) => d.successor === item.id);
  const pct = item.progress == null ? null : Math.round(item.progress * 100);
  return (
    <div className="plan-item-row">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-txt-strong">
          {item.is_milestone && <span className="mr-1 text-accent-2" title="milestone">◆</span>}
          {item.task}
        </div>
        {myPreds.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Link2 size={12} className="text-txt-faint" />
            {myPreds.map((dependency) => (
              <span key={dependency.id} className="inline-flex items-center rounded-pill border border-line bg-warn-bg px-2 py-0.5 text-[10px] font-semibold text-accent">
                {dependencyText(dependency, nameById.get(dependency.predecessor) || dependency.predecessor)}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className="plan-item-dates text-2xs text-txt-dim">
        {shortDate(item.start_date)} – {shortDate(item.end_date)}
      </span>
      <span className="w-16 text-right text-2xs text-txt-dim">{item.manday ?? "—"} md</span>

      <span className="plan-item-progress">
        <span className="plan-progress-mini"><span style={{ width: `${pct ?? 0}%` }} /></span>
        <span className="text-2xs text-txt-dim">{pct == null ? "N/A" : `${pct}%`}</span>
      </span>

      {(canEdit || canDelete) && (
        <span className="flex shrink-0 items-center gap-1">
          {canEdit && (
            <button className="ui-icon-action" onClick={onEdit} aria-label={`แก้ไข ${item.task}`} title="แก้ไข / dependency / ประวัติ">
              <Pencil size={15} />
            </button>
          )}
          {canDelete && (
            <button
              className="ui-icon-action hover:text-danger"
              disabled={deleting}
              onClick={() => { if (window.confirm(`ยืนยันลบแผนงาน “${item.task}”? ประวัติการแก้ไขจะถูกลบด้วย`)) onDelete(); }}
              aria-label={`ลบ ${item.task}`}
              title="ลบ"
            >
              <Trash2 size={15} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function QuickAddRow({
  phase, pending, onAdd,
}: {
  phase: string;
  pending: boolean;
  onAdd: (payload: Record<string, unknown>) => void;
}) {
  const [task, setTask] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [manday, setManday] = useState("");
  const [milestone, setMilestone] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!task.trim() || pending) return;
    onAdd({
      phase,
      task: task.trim(),
      start_date: start || null,
      end_date: end || null,
      manday: manday && !(start && end) ? manday : null,
      is_milestone: milestone,
      sort_order: 0,
    });
    setTask(""); setStart(""); setEnd(""); setManday(""); setMilestone(false);
  }

  return (
    <form className="plan-quick-add" onSubmit={submit}>
      <Plus size={14} className="shrink-0 text-txt-faint" />
      <input className="ui-input min-w-0 flex-1" placeholder={`เพิ่มงานในเฟส ${phase}`} value={task} onChange={(e) => setTask(e.target.value)} />
      <input className="ui-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="วันเริ่ม" />
      <input className="ui-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="วันสิ้นสุด" />
      <input className="ui-input w-24" placeholder="manday" value={manday} disabled={!!(start && end)} onChange={(e) => setManday(e.target.value)} aria-label="manday" />
      <label className="inline-flex items-center gap-1 text-2xs font-semibold text-txt-dim">
        <input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} /> MS
      </label>
      <button type="submit" className="ui-btn-ghost" disabled={!task.trim() || pending}>เพิ่ม</button>
    </form>
  );
}
