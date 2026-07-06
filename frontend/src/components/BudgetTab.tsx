import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Table, Row, Cell } from "./ui";
import { AssetFormCard, type AssetForm } from "../pages/Infrastructure";
import {
  ASSET_TYPE_LABEL,
  BILLING_CYCLE_LABEL,
  type Budget,
  type CostLineItem,
  type InfraResponse,
} from "../lib/types";

const CATEGORIES = [
  { key: "manpower", label: "Manpower / LOE" },
  { key: "infra", label: "Server / Infrastructure" },
  { key: "subscription", label: "Subscription / Tools" },
  { key: "system", label: "System / Custom" },
];

type CostForm = {
  category: string;
  label: string;
  qty_or_units: string;
  months: string;
  rate: string;
  total_override: string;
  is_outsource: boolean;
  note: string;
};

const EMPTY_COST: CostForm = {
  category: "manpower", label: "", qty_or_units: "1", months: "1", rate: "0",
  total_override: "", is_outsource: false, note: "",
};

function baht(s: string) {
  return "฿" + Number(s).toLocaleString("th-TH");
}
function errorText(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "detail" in data) return String((data as { detail: string }).detail);
    const first = data && typeof data === "object" ? Object.entries(data)[0] : null;
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : String(first[1])}`;
  }
  return "ทำรายการไม่สำเร็จ";
}
function toPayload(form: CostForm) {
  return {
    category: form.category, label: form.label.trim(),
    qty_or_units: form.qty_or_units || "0", months: form.months || "0", rate: form.rate || "0",
    total_override: form.total_override.trim() || null, is_outsource: form.is_outsource, note: form.note,
  };
}
function fromItem(item: CostLineItem, category: string): CostForm {
  return {
    category: item.category || category, label: item.label, qty_or_units: item.qty_or_units,
    months: item.months, rate: item.rate, total_override: item.total_override || "",
    is_outsource: item.is_outsource, note: item.note,
  };
}

export default function BudgetTab({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<CostForm>(EMPTY_COST);

  const { data, isLoading } = useQuery({
    queryKey: ["budget", projectId],
    queryFn: async () => (await api.get<Budget>(`/projects/${projectId}/budget`)).data,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["budget", projectId] });

  const create = useMutation({
    mutationFn: async () => api.post(`/projects/${projectId}/cost-items`, toPayload(form)),
    onSuccess: () => { setForm(EMPTY_COST); setAdding(false); refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: CostForm }) => api.patch(`/cost-items/${id}`, toPayload(body)),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: async (id: number) => api.delete(`/cost-items/${id}`), onSuccess: refresh });

  if (isLoading) return <p className="text-sm text-txt-dim">กำลังโหลด…</p>;
  if (!data) return <p className="text-sm text-txt-dim">โหลดงบประมาณไม่สำเร็จ</p>;

  const canCreate = can("Budget", "create");
  const canEdit = can("Budget", "edit");
  const canDelete = can("Budget", "delete");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-txt-dim">
          Grand Total: <strong className="text-lg text-accent">{baht(data.grand_total)}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="ui-btn-ghost" onClick={() => window.open(`/api/projects/${projectId}/budget/export?format=xlsx`)}>
            <Download size={15} /> Export Excel
          </button>
          {canCreate && data.can_see_rate && (
            <button className="ui-btn-primary" onClick={() => setAdding((v) => !v)}>
              <Plus size={16} /> {adding ? "ปิดฟอร์ม" : "เพิ่มรายการ"}
            </button>
          )}
        </div>
      </div>

      {adding && canCreate && data.can_see_rate && (
        <div className="rounded-card border border-line bg-panel p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <CostFields form={form} onChange={setForm} />
            <button className="ui-btn-primary w-full sm:col-span-2 lg:col-span-1" disabled={!form.label.trim() || create.isPending} onClick={() => create.mutate()}>บันทึก</button>
          </div>
          {create.isError && <div className="mt-2 text-sm text-danger">{errorText(create.error)}</div>}
        </div>
      )}
      {(update.isError || remove.isError) && <div className="text-sm text-danger">{errorText(update.error || remove.error)}</div>}

      {!data.can_see_rate && (
        <p className="text-2xs text-txt-faint">* คุณเห็นเฉพาะยอดรวมต่อหมวด{data.show_headcount ? " + จำนวนคน" : ""} (เงินเดือน/rate เป็นความลับของ pre-sale)</p>
      )}

      {data.categories.map((cat) => (
        <div key={cat.category} className="ui-card overflow-hidden">
          <div className="flex items-baseline justify-between px-4 py-3">
            <h3 className="font-bold text-txt-strong">{cat.category_label}</h3>
            <div className="flex flex-wrap items-baseline justify-end gap-2">
              {cat.headcount != null && <span className="ui-pill border border-line bg-warn-bg text-txt-dim">{cat.headcount} คน</span>}
              <span className="font-bold text-accent">{baht(cat.total)}</span>
            </div>
          </div>
          {cat.items && cat.items.length > 0 && (
            <Table columns={canEdit || canDelete ? ["รายการ", "จำนวน", "เดือน", "Rate", "Override", "รวม", ""] : ["รายการ", "จำนวน", "เดือน", "Rate", "Override", "รวม"]}>
              {cat.items.map((item) => (
                <CostRow
                  key={item.id}
                  item={item}
                  category={cat.category}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  saving={update.isPending}
                  deleting={remove.isPending}
                  onSave={(body) => update.mutate({ id: item.id, body })}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))}
            </Table>
          )}
        </div>
      ))}

      <p className="text-2xs italic text-txt-faint">{data.vat_note}</p>

      {/* ใช้จริง — ทะเบียนทรัพยากร (actuals) เทียบกับประมาณการข้างบน */}
      <ActualsSection projectId={projectId} canSeeMoney={data.can_see_rate} />
    </div>
  );
}

function ActualsSection({ projectId, canSeeMoney }: { projectId: string; canSeeMoney: boolean }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data } = useQuery({
    queryKey: ["infra", { project: projectId }],
    queryFn: async () =>
      (await api.get<InfraResponse>("/infra", { params: { project: projectId } })).data,
  });

  const create = useMutation({
    mutationFn: async (form: AssetForm) => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(), asset_type: form.asset_type, provider: form.provider.trim(),
        location: form.location.trim(), environment: form.environment, project: Number(projectId),
        billing_cycle: form.billing_cycle, start_date: form.start_date || null,
        expires_at: form.expires_at || null, status: form.status, note: form.note.trim(),
      };
      if (canSeeMoney) payload.cost = form.cost || "0";
      return api.post("/infra", payload);
    },
    onSuccess: () => {
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["infra"] });
    },
  });

  const assets = data?.assets ?? [];
  const expiringSet = new Set(data?.summary.expiring_soon ?? []);
  const expiredSet = new Set(data?.summary.expired ?? []);

  return (
    <div className="ui-card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
        <h3 className="font-bold text-txt-strong">
          ใช้จริง — ทรัพยากร / ค่าบริการ
          <Link to="/infrastructure" className="ml-2 text-2xs font-semibold text-accent hover:underline">
            ดูรวมทุกโครงการ →
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {data?.summary.monthly_cost_total != null && (
            <span className="font-bold text-accent">{baht(data.summary.monthly_cost_total)}/เดือน</span>
          )}
          {can("Budget", "create") && (
            <button className="ui-btn-ghost" onClick={() => setAdding((v) => !v)}>
              <Plus size={14} /> เพิ่ม
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="border-t border-line p-3">
          <AssetFormCard
            initial={EMPTY_ASSET_FORM}
            projects={[]}
            canSeeMoney={canSeeMoney}
            pending={create.isPending}
            submitLabel="เพิ่มทรัพยากร"
            fixedProject={Number(projectId)}
            onCancel={() => setAdding(false)}
            onSubmit={(form) => create.mutate(form)}
          />
        </div>
      )}

      {assets.length === 0 && !adding && (
        <p className="border-t border-line px-4 py-3 text-sm text-txt-faint">
          ยังไม่มีรายการ — ซื้อ/เช่า server หรือ subscription มาแล้ว บันทึกไว้ที่นี่เพื่อเทียบกับประมาณการ
        </p>
      )}

      {assets.length > 0 && (
        <div className="responsive-table-wrap border-t border-line">
          <table className="responsive-table responsive-table--embedded w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-panel text-left text-2xs uppercase tracking-wide text-txt-faint">
                <th className="px-4 py-2 font-semibold">ชื่อ</th>
                <th className="px-4 py-2 font-semibold">ประเภท</th>
                <th className="px-4 py-2 font-semibold">อยู่ที่ไหน</th>
                {canSeeMoney && <th className="px-4 py-2 text-right font-semibold">ราคา</th>}
                <th className="px-4 py-2 font-semibold">หมดอายุ</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const warn = expiringSet.has(a.id) || expiredSet.has(a.id);
                return (
                  <tr key={a.id} className={"border-b border-line last:border-0 " + (a.status === "cancelled" ? "opacity-60" : "")}>
                    <td data-label="ชื่อ" className="px-4 py-2 font-semibold text-txt-strong">{a.name}</td>
                    <td data-label="ประเภท" className="px-4 py-2 text-txt-dim">{ASSET_TYPE_LABEL[a.asset_type]}</td>
                    <td data-label="อยู่ที่ไหน" className="px-4 py-2 text-txt-dim">
                      {a.provider || "—"}{a.environment ? ` · ${a.environment.toUpperCase()}` : ""}
                      {a.location && <div className="break-all text-2xs text-txt-faint">{a.location}</div>}
                    </td>
                    {canSeeMoney && (
                      <td data-label="ราคา" className="px-4 py-2 text-right text-txt-dim">
                        {a.cost != null ? baht(a.cost) : "—"}
                        <span className="text-2xs text-txt-faint"> /{BILLING_CYCLE_LABEL[a.billing_cycle]}</span>
                      </td>
                    )}
                    <td data-label="หมดอายุ" className={"px-4 py-2 " + (warn ? "font-bold text-warn" : "text-txt-dim")}>
                      {a.expires_at
                        ? new Date(`${a.expires_at}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const EMPTY_ASSET_FORM: AssetForm = {
  name: "", asset_type: "server", provider: "", location: "", environment: "",
  project: null, cost: "", billing_cycle: "monthly", start_date: "", expires_at: "",
  status: "active", note: "",
};

function CostFields({ form, onChange }: { form: CostForm; onChange: (form: CostForm) => void }) {
  return (
    <>
      <select className="ui-input w-full" value={form.category} onChange={(e) => onChange({ ...form, category: e.target.value })}>
        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <input className="ui-input w-full sm:col-span-2" placeholder="รายการ" value={form.label} onChange={(e) => onChange({ ...form, label: e.target.value })} />
      <input className="ui-input w-full" placeholder="จำนวน" value={form.qty_or_units} onChange={(e) => onChange({ ...form, qty_or_units: e.target.value })} />
      <input className="ui-input w-full" placeholder="เดือน" value={form.months} onChange={(e) => onChange({ ...form, months: e.target.value })} />
      <input className="ui-input w-full" placeholder="rate" value={form.rate} onChange={(e) => onChange({ ...form, rate: e.target.value })} />
      <input className="ui-input w-full" placeholder="override" value={form.total_override} onChange={(e) => onChange({ ...form, total_override: e.target.value })} />
      <label className="inline-flex items-center gap-1.5 text-2xs font-semibold text-txt-dim">
        <input type="checkbox" checked={form.is_outsource} onChange={(e) => onChange({ ...form, is_outsource: e.target.checked })} /> outsource
      </label>
      <input className="ui-input w-full sm:col-span-2" placeholder="หมายเหตุ" value={form.note} onChange={(e) => onChange({ ...form, note: e.target.value })} />
    </>
  );
}

function CostRow({
  item, category, canEdit, canDelete, saving, deleting, onSave, onDelete,
}: {
  item: CostLineItem;
  category: string;
  canEdit: boolean;
  canDelete: boolean;
  saving: boolean;
  deleting: boolean;
  onSave: (body: CostForm) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CostForm>(() => fromItem(item, category));
  useEffect(() => setDraft(fromItem(item, category)), [category, item]);

  const cols = canEdit || canDelete ? 7 : 6;

  if (editing) {
    return (
      <Row>
        <Cell colSpan={cols}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <CostFields form={draft} onChange={setDraft} />
            <button className="ui-btn-ghost w-full" onClick={() => setEditing(false)}>ยกเลิก</button>
            <button className="ui-btn-primary w-full" disabled={!draft.label.trim() || saving} onClick={() => { onSave(draft); setEditing(false); }}>บันทึก</button>
          </div>
        </Cell>
      </Row>
    );
  }

  return (
    <Row>
      <Cell label="รายการ">
        <span className="text-txt-strong">{item.label}</span>
        {item.is_outsource && <span className="ml-2 rounded-pill bg-warn-bg px-1.5 py-0.5 text-[10px] font-bold text-warn">outsource</span>}
        {item.note && <div className="text-2xs text-txt-faint">{item.note}</div>}
      </Cell>
      <Cell label="จำนวน" className="text-right text-txt-dim">{Number(item.qty_or_units)}</Cell>
      <Cell label="เดือน" className="text-right text-txt-dim">{Number(item.months)}</Cell>
      <Cell label="Rate" className="text-right text-txt-dim">{baht(item.rate)}</Cell>
      <Cell label="Override" className="text-right text-txt-dim">{item.total_override ? baht(item.total_override) : "—"}</Cell>
      <Cell label="รวม" className="text-right font-semibold text-txt-strong">{baht(item.total)}</Cell>
      {(canEdit || canDelete) && (
        <Cell label="จัดการ">
          <div className="flex items-center justify-end gap-3">
            {canEdit && <button className="ui-icon-action" onClick={() => setEditing(true)} aria-label="แก้ไข"><Pencil size={16} /></button>}
            {canDelete && (
              <button
                className="ui-icon-action hover:text-danger"
                disabled={deleting}
                onClick={() => { if (window.confirm(`ยืนยันลบรายการ “${item.label}”?`)) onDelete(); }}
                aria-label={`ลบ ${item.label}`}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </Cell>
      )}
    </Row>
  );
}
