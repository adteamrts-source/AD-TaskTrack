import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, History, Link2, X } from "lucide-react";
import type { Dependency, DependencyRelationType, PlanItem } from "../../lib/types";
import {
  EMPTY_FORM,
  RELATION_TYPES,
  buildPayload,
  relationShort,
  toForm,
  type PlanForm,
} from "./shared";
import DependencyEditor from "./DependencyEditor";
import RevisionList from "./RevisionList";

export type PendingDep = { pred: number; relation: DependencyRelationType; lag: number };

export type DrawerState =
  | { mode: "create"; phase?: string }
  | { mode: "edit"; item: PlanItem };

/**
 * The single editing surface for a plan item — full form, dependencies and
 * (edit mode) revision history in a right-side drawer. change_reason is
 * required exactly when a tracked field (phase/task/manday/dates) is dirty,
 * same rule the API enforces.
 */
export default function PlanItemDrawer({
  state,
  allItems,
  deps,
  saving,
  depBusy,
  errorMessage,
  onClose,
  onCreate,
  onSave,
  onAddDep,
  onUpdateDep,
  onRemoveDep,
}: {
  state: DrawerState;
  allItems: PlanItem[];
  deps: Dependency[];
  saving: boolean;
  depBusy: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>, pendingDeps: PendingDep[]) => void;
  onSave: (id: number, payload: Record<string, unknown>) => void;
  onAddDep: (predecessorId: number, relation: DependencyRelationType, lag: number) => void;
  onUpdateDep: (dependencyId: number, relation: DependencyRelationType, lag: number) => void;
  onRemoveDep: (depId: number) => void;
}) {
  const editItem = state.mode === "edit" ? state.item : null;
  const [form, setForm] = useState<PlanForm>(() =>
    editItem ? toForm(editItem) : { ...EMPTY_FORM, phase: state.mode === "create" ? state.phase ?? "" : "" },
  );
  const [pendingDeps, setPendingDeps] = useState<PendingDep[]>([]);
  const [newDepRelation, setNewDepRelation] = useState<DependencyRelationType>("finish_to_start");
  const [newDepLag, setNewDepLag] = useState("");
  const [showRevisions, setShowRevisions] = useState(false);

  // Re-seed only when the TARGET changes (another row / switch to create) —
  // not on every refetch, so in-progress typing survives dep mutations.
  const targetKey = editItem ? `edit:${editItem.id}` : `create:${state.mode === "create" ? state.phase ?? "" : ""}`;
  useEffect(() => {
    setForm(editItem ? toForm(editItem) : { ...EMPTY_FORM, phase: state.mode === "create" ? state.phase ?? "" : "" });
    setPendingDeps([]);
    setShowRevisions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // Keyboard access (PRODUCT.md): Esc closes, focus jumps into the drawer.
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  const nameById = useMemo(() => new Map(allItems.map((it) => [it.id, it.task])), [allItems]);

  // Ported unchanged: reason required when a tracked field differs.
  const reasonRequired = useMemo(() => {
    if (!editItem) return false;
    return (
      form.phase !== editItem.phase ||
      form.task !== editItem.task ||
      form.manday !== (editItem.manday || "") ||
      form.start_date !== (editItem.start_date || "") ||
      form.end_date !== (editItem.end_date || "")
    );
  }, [form, editItem]);

  const myPreds = editItem ? deps.filter((d) => d.successor === editItem.id) : [];
  const predIds = new Set(myPreds.map((d) => d.predecessor));
  const predOptions = allItems.filter(
    (it) => it.id !== editItem?.id && !predIds.has(it.id) && !pendingDeps.some((p) => p.pred === it.id),
  );

  const valid = form.phase.trim() && form.task.trim() && !(reasonRequired && !form.change_reason.trim());

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    if (editItem) onSave(editItem.id, buildPayload(form, true));
    else onCreate(buildPayload(form, false), pendingDeps);
  }

  const field = (label: string, node: React.ReactNode, full = false) => (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-2" : "")}>
      <span className="text-2xs font-semibold uppercase tracking-wide text-txt-faint">{label}</span>
      {node}
    </label>
  );

  return (
    <>
      <div className="plan-drawer-backdrop" onClick={onClose} />
      <aside ref={panelRef} className="plan-drawer" role="dialog" aria-modal="true" aria-label={editItem ? "แก้ไขรายการแผนงาน" : "เพิ่มรายการแผนงาน"}>
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h3 className="font-bold text-txt-strong">
            {editItem ? `แก้ไข: ${editItem.task}` : "เพิ่มรายการแผนงาน"}
          </h3>
          <button className="ui-icon-action" onClick={onClose} aria-label="ปิด"><X size={16} /></button>
        </header>

        <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            {field("เฟส *", <input className="ui-input" placeholder="เช่น 1. เตรียมการ+ออกแบบ" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} />, true)}
            {field("งาน *", <input className="ui-input" placeholder="ชื่องาน / task" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />, true)}
            {field("วันเริ่ม", <input className="ui-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />)}
            {field("วันสิ้นสุด", <input className="ui-input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />)}
            {field("Manday", <input className="ui-input" placeholder="auto จากวันที่" value={form.manday} disabled={!!(form.start_date && form.end_date)} onChange={(e) => setForm({ ...form, manday: e.target.value })} />)}
            {field("ลำดับ", <input className="ui-input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />)}
            <label className="col-span-2 inline-flex items-center gap-2 text-2xs font-semibold text-txt-dim">
              <input type="checkbox" checked={form.is_milestone} onChange={(e) => setForm({ ...form, is_milestone: e.target.checked })} />
              milestone (จุดวัดสถานะสุขภาพโครงการ)
            </label>
          </div>

          {/* เหตุผลการแก้ไข — บังคับเมื่อแตะ field สำคัญ */}
          {editItem && (
            <div className={"rounded-btn border p-3 " + (reasonRequired ? "border-warn bg-warn-bg" : "border-line bg-card")}>
              {field(
                reasonRequired ? "เหตุผลการแก้ไข * (แก้ scope / วันที่ / manday ต้องระบุ)" : "เหตุผลการแก้ไข",
                <input className="ui-input" placeholder="เช่น ลูกค้าขอเลื่อน UAT" value={form.change_reason} onChange={(e) => setForm({ ...form, change_reason: e.target.value })} />,
                true,
              )}
            </div>
          )}

          {/* Dependencies */}
          <div className="flex flex-col gap-2 rounded-btn border border-line bg-card p-3">
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-txt-faint">
              <Link2 size={13} /> ขึ้นกับงานก่อนหน้า
            </span>

            {editItem &&
              myPreds.map((d) => (
                <DependencyEditor
                  key={d.id}
                  dependency={d}
                  predecessorName={nameById.get(d.predecessor) || d.predecessor}
                  busy={depBusy}
                  onSave={(relation, lag) => onUpdateDep(d.id, relation, lag)}
                  onRemove={() => onRemoveDep(d.id)}
                />
              ))}

            {!editItem &&
              pendingDeps.map((d, i) => (
                <span key={i} className="inline-flex w-fit items-center gap-1 rounded-pill border border-line bg-warn-bg px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {relationShort(d.relation)} · {nameById.get(d.pred) || d.pred}{d.lag > 0 ? ` +${d.lag} วัน` : d.lag < 0 ? ` ${d.lag} วัน` : ""}
                  <button type="button" className="text-txt-faint hover:text-danger" onClick={() => setPendingDeps(pendingDeps.filter((_, j) => j !== i))} aria-label="ลบ dependency"><X size={11} /></button>
                </span>
              ))}

            <div className="flex flex-wrap items-center gap-2">
              <select className="ui-input" aria-label="ชนิด dependency" value={newDepRelation} onChange={(e) => setNewDepRelation(e.target.value as DependencyRelationType)} disabled={depBusy}>
                {RELATION_TYPES.map((relation) => (
                  <option key={relation.value} value={relation.value}>{relation.short} · {relation.label}</option>
                ))}
              </select>
              <select
                className="ui-input"
                value=""
                disabled={depBusy || predOptions.length === 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!v) return;
                  const lag = Number(newDepLag || 0);
                  if (editItem) onAddDep(v, newDepRelation, lag);
                  else setPendingDeps([...pendingDeps, { pred: v, relation: newDepRelation, lag }]);
                  setNewDepLag("");
                }}
              >
                <option value="">+ เพิ่มงานก่อนหน้า</option>
                {predOptions.map((it) => <option key={it.id} value={it.id}>{it.task}</option>)}
              </select>
              <input className="ui-input w-28" type="number" placeholder="lag / lead" value={newDepLag} onChange={(e) => setNewDepLag(e.target.value)} title="ค่าบวกคือวันหน่วง (lag) ค่าลบคือเริ่มก่อน (lead)" />
            </div>
          </div>

          {/* Revision history */}
          {editItem && (
            <div className="rounded-btn border border-line bg-card p-3">
              <button type="button" className="inline-flex items-center gap-1.5 text-2xs font-bold text-txt-dim hover:text-accent" onClick={() => setShowRevisions((v) => !v)}>
                {showRevisions ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <History size={13} /> ประวัติการแก้ไข
              </button>
              {showRevisions && <div className="mt-2"><RevisionList itemId={editItem.id} /></div>}
            </div>
          )}

          {errorMessage && <div className="text-sm text-danger">{errorMessage}</div>}

          <div className="mt-auto flex justify-end gap-2 border-t border-line pt-3">
            <button type="button" className="ui-btn-ghost" onClick={onClose}>ปิด</button>
            <button type="submit" className="ui-btn-primary" disabled={!valid || saving}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
