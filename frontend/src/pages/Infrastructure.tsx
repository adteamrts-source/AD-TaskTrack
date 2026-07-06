import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus, Search, Server, Trash2, Wallet, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Card, EmptyState, Skeleton } from "../components/ui";
import {
  ASSET_ENV_LABEL,
  ASSET_STATUS_LABEL,
  ASSET_TYPE_LABEL,
  BILLING_CYCLE_LABEL,
  type AssetEnvironment,
  type AssetStatus,
  type AssetType,
  type BillingCycle,
  type InfraAsset,
  type InfraResponse,
  type Paginated,
  type Project,
} from "../lib/types";
import "./infrastructure.css";

const TYPES: AssetType[] = ["server", "subscription", "domain", "license", "other"];
const ENVS: Exclude<AssetEnvironment, "">[] = ["dev", "uat", "prod"];
const CYCLES: BillingCycle[] = ["monthly", "yearly", "one_time"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export interface AssetForm {
  name: string;
  asset_type: AssetType;
  provider: string;
  location: string;
  environment: AssetEnvironment;
  project: number | null;
  cost: string;
  billing_cycle: BillingCycle;
  start_date: string;
  expires_at: string;
  status: AssetStatus;
  note: string;
}

const EMPTY_FORM: AssetForm = {
  name: "", asset_type: "server", provider: "", location: "", environment: "",
  project: null, cost: "", billing_cycle: "monthly", start_date: "", expires_at: "",
  status: "active", note: "",
};

function toPayload(form: AssetForm, canSeeMoney: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    asset_type: form.asset_type,
    provider: form.provider.trim(),
    location: form.location.trim(),
    environment: form.environment,
    project: form.project,
    billing_cycle: form.billing_cycle,
    start_date: form.start_date || null,
    expires_at: form.expires_at || null,
    status: form.status,
    note: form.note.trim(),
  };
  if (canSeeMoney) payload.cost = form.cost || "0";
  return payload;
}

export default function Infrastructure() {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [env, setEnv] = useState("");
  const [projectF, setProjectF] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InfraAsset | null>(null);

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (type) params.type = type;
  if (env) params.environment = env;
  if (projectF) params.project = projectF;
  if (status) params.status = status;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["infra", params],
    queryFn: async () => (await api.get<InfraResponse>("/infra", { params })).data,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => (await api.get<Paginated<Project>>("/projects")).data.results,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["infra"] });
  const create = useMutation({
    mutationFn: async (form: AssetForm) => api.post("/infra", toPayload(form, canSeeMoney)),
    onSuccess: () => { setAdding(false); refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, form }: { id: number; form: AssetForm }) =>
      api.patch(`/infra/${id}`, toPayload(form, canSeeMoney)),
    onSuccess: () => { setEditing(null); refresh(); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/infra/${id}`),
    onSuccess: refresh,
  });

  const canSeeMoney = me?.role === "admin" || me?.role === "dm";
  const canCreate = can("Budget", "create");
  const canEdit = can("Budget", "edit");
  const canDelete = can("Budget", "delete");

  const expiringSet = new Set(data?.summary.expiring_soon ?? []);
  const expiredSet = new Set(data?.summary.expired ?? []);

  return (
    <div>
      <PageHeader
        title="Infrastructure"
        subtitle="ทะเบียน server / subscription ที่ใช้จริง — งานอะไรอยู่ที่ไหน หมดอายุเมื่อไหร่"
        action={
          canCreate && (
            <button className="ui-btn-primary" onClick={() => { setAdding((v) => !v); setEditing(null); }}>
              <Plus size={16} /> เพิ่มทรัพยากร
            </button>
          )
        }
      />

      {/* Summary cards */}
      {data && (
        <div className="dash-stats mb-5">
          <div className="ui-card dash-stat">
            <span className="dash-stat-num text-txt-strong">{data.summary.active}</span>
            <span className="dash-stat-label">ใช้งานอยู่ (ทั้งหมด {data.summary.total})</span>
          </div>
          <div className="ui-card dash-stat">
            <span className="dash-stat-num" style={{ color: data.summary.expiring_soon.length > 0 ? "var(--warn)" : "var(--ok)" }}>
              {data.summary.expiring_soon.length}
            </span>
            <span className="dash-stat-label">ใกล้หมดอายุใน {data.summary.window_days} วัน</span>
          </div>
          {data.summary.expired.length > 0 && (
            <div className="ui-card dash-stat">
              <span className="dash-stat-num" style={{ color: "var(--danger)" }}>{data.summary.expired.length}</span>
              <span className="dash-stat-label">เลยวันหมดอายุแล้ว</span>
            </div>
          )}
          {data.summary.monthly_cost_total != null && (
            <div className="ui-card dash-stat">
              <span className="dash-stat-num text-accent">
                ฿{Number(data.summary.monthly_cost_total).toLocaleString("th-TH")}
              </span>
              <span className="dash-stat-label"><Wallet size={11} className="mr-1 inline" />ค่าใช้จ่ายต่อเดือน (รายเดือน+รายปีเฉลี่ย)</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-full sm:min-w-[220px] sm:basis-auto">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
          <input className="ui-input w-full pl-9" placeholder="ค้นหา ชื่อ / provider / ที่อยู่ / โครงการ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="ui-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">ทุกประเภท</option>
          {TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABEL[t]}</option>)}
        </select>
        <select className="ui-input" value={env} onChange={(e) => setEnv(e.target.value)}>
          <option value="">ทุก environment</option>
          {ENVS.map((v) => <option key={v} value={v}>{ASSET_ENV_LABEL[v]}</option>)}
        </select>
        <select className="ui-input" value={projectF} onChange={(e) => setProjectF(e.target.value)}>
          <option value="">ทุกโครงการ</option>
          {projects?.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="active">ใช้งานอยู่</option>
          <option value="cancelled">ยกเลิกแล้ว</option>
        </select>
      </div>

      {(adding || editing) && (
        <AssetFormCard
          key={editing?.id ?? "new"}
          initial={editing ? {
            name: editing.name, asset_type: editing.asset_type, provider: editing.provider,
            location: editing.location, environment: editing.environment, project: editing.project,
            cost: editing.cost ?? "", billing_cycle: editing.billing_cycle,
            start_date: editing.start_date ?? "", expires_at: editing.expires_at ?? "",
            status: editing.status, note: editing.note,
          } : EMPTY_FORM}
          projects={projects ?? []}
          canSeeMoney={canSeeMoney}
          pending={create.isPending || update.isPending}
          submitLabel={editing ? "บันทึกการแก้ไข" : "เพิ่มทรัพยากร"}
          onCancel={() => { setAdding(false); setEditing(null); }}
          onSubmit={(form) => (editing ? update.mutate({ id: editing.id, form }) : create.mutate(form))}
        />
      )}

      {isLoading && <Skeleton rows={3} />}
      {isError && <Card>โหลดข้อมูลไม่สำเร็จ</Card>}
      {data && data.assets.length === 0 && !adding && (
        <EmptyState
          title="ยังไม่มีทรัพยากรในทะเบียน"
          hint="บันทึก server / subscription ที่ซื้อหรือเช่ามาจริง เพื่อให้ทีมรู้ว่างานอะไรอยู่ที่ไหน และไม่ลืมต่ออายุ"
          action={canCreate && (
            <button className="ui-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> เพิ่มรายการแรก</button>
          )}
        />
      )}

      {data && data.assets.length > 0 && (
        <div className="ui-card responsive-table-wrap p-0">
          <table className="responsive-table w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-panel text-left text-2xs uppercase tracking-wide text-txt-faint">
                <th className="px-4 py-3 font-semibold">ชื่อ</th>
                <th className="px-4 py-3 font-semibold">ประเภท</th>
                <th className="px-4 py-3 font-semibold">โครงการ</th>
                <th className="px-4 py-3 font-semibold">อยู่ที่ไหน</th>
                <th className="px-4 py-3 font-semibold">Env</th>
                {canSeeMoney && <th className="px-4 py-3 text-right font-semibold">ราคา</th>}
                <th className="px-4 py-3 font-semibold">หมดอายุ</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                {(canEdit || canDelete) && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {data.assets.map((a) => {
                const expWarn = expiringSet.has(a.id);
                const expOver = expiredSet.has(a.id);
                return (
                  <tr key={a.id} className={"border-b border-line last:border-0 " + (a.status === "cancelled" ? "opacity-60" : "")}>
                    <td data-label="ชื่อ" className="px-4 py-3 font-semibold text-txt-strong">
                      <span className="inline-flex items-center gap-1.5"><Server size={13} className="shrink-0 text-txt-faint" />{a.name}</span>
                      {a.note && <div className="mt-0.5 text-2xs font-normal text-txt-faint">{a.note}</div>}
                    </td>
                    <td data-label="ประเภท" className="px-4 py-3 text-txt-dim">{ASSET_TYPE_LABEL[a.asset_type]}</td>
                    <td data-label="โครงการ" className="px-4 py-3 text-txt-dim">{a.project_name || <span className="text-txt-faint">ของกลาง</span>}</td>
                    <td data-label="อยู่ที่ไหน" className="px-4 py-3 text-txt-dim">
                      {a.provider || "—"}
                      {a.location && <div className="break-all text-2xs text-txt-faint">{a.location}</div>}
                    </td>
                    <td data-label="Env" className="px-4 py-3 text-txt-dim">{a.environment ? ASSET_ENV_LABEL[a.environment as Exclude<AssetEnvironment, "">] : "—"}</td>
                    {canSeeMoney && (
                      <td data-label="ราคา" className="px-4 py-3 text-right text-txt-dim">
                        {a.cost != null ? `฿${Number(a.cost).toLocaleString("th-TH")}` : "—"}
                        <div className="text-2xs text-txt-faint">{BILLING_CYCLE_LABEL[a.billing_cycle]}</div>
                      </td>
                    )}
                    <td data-label="หมดอายุ" className="px-4 py-3">
                      <span className={expOver ? "font-bold text-danger" : expWarn ? "font-bold text-warn" : "text-txt-dim"}>
                        {(expOver || expWarn) && <AlertTriangle size={12} className="mr-1 inline" />}
                        {fmtDate(a.expires_at)}
                      </span>
                    </td>
                    <td data-label="สถานะ" className="px-4 py-3">
                      <span className={"ui-pill border border-line bg-card " + (a.status === "active" ? "text-ok" : "text-txt-faint")}>
                        {ASSET_STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button className="ui-icon-action" onClick={() => { setEditing(a); setAdding(false); }} aria-label={`แก้ไข ${a.name}`}>
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="ui-icon-action hover:text-danger"
                              disabled={remove.isPending}
                              onClick={() => { if (window.confirm(`ยืนยันลบ “${a.name}” ออกจากทะเบียน?`)) remove.mutate(a.id); }}
                              aria-label={`ลบ ${a.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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

export function AssetFormCard({
  initial, projects, canSeeMoney, pending, submitLabel, onSubmit, onCancel, fixedProject,
}: {
  initial: AssetForm;
  projects: Project[];
  canSeeMoney: boolean;
  pending: boolean;
  submitLabel: string;
  onSubmit: (form: AssetForm) => void;
  onCancel: () => void;
  fixedProject?: number; // budget tab: lock to the current project
}) {
  const [form, setForm] = useState<AssetForm>(
    fixedProject != null ? { ...initial, project: fixedProject } : initial,
  );
  const set = <K extends keyof AssetForm>(key: K, value: AssetForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim()) onSubmit(form);
  };

  const field = (label: string, node: React.ReactNode) => (
    <label className="flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wide text-txt-faint">{label}</span>
      {node}
    </label>
  );

  return (
    <form className="ui-card mb-4 p-4" onSubmit={submit}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-txt-strong">{submitLabel}</span>
        <button type="button" className="ui-icon-action" onClick={onCancel} aria-label="ปิดฟอร์ม"><X size={14} /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {field("ชื่อ *", <input className="ui-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น DO Droplet — OSHA Prod" required />)}
        {field("ประเภท", (
          <select className="ui-input" value={form.asset_type} onChange={(e) => set("asset_type", e.target.value as AssetType)}>
            {TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABEL[t]}</option>)}
          </select>
        ))}
        {field("Provider", <input className="ui-input" value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="AWS / DigitalOcean / เครื่องลูกค้า" />)}
        {field("ที่อยู่ (URL / IP)", <input className="ui-input" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="เช่น 128.199.x.x หรือ https://…" />)}
        {field("Environment", (
          <select className="ui-input" value={form.environment} onChange={(e) => set("environment", e.target.value as AssetEnvironment)}>
            <option value="">— ไม่ระบุ —</option>
            {ENVS.map((v) => <option key={v} value={v}>{ASSET_ENV_LABEL[v]}</option>)}
          </select>
        ))}
        {fixedProject == null &&
          field("โครงการ", (
            <select className="ui-input" value={form.project ?? ""} onChange={(e) => set("project", e.target.value ? Number(e.target.value) : null)}>
              <option value="">ของกลาง (ไม่ผูกโครงการ)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          ))}
        {canSeeMoney && field("ราคา (฿)", <input className="ui-input" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set("cost", e.target.value)} />)}
        {field("รอบจ่าย", (
          <select className="ui-input" value={form.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value as BillingCycle)}>
            {CYCLES.map((c) => <option key={c} value={c}>{BILLING_CYCLE_LABEL[c]}</option>)}
          </select>
        ))}
        {field("วันเริ่มใช้", <input className="ui-input" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />)}
        {field("วันหมดอายุ / ต่ออายุ", <input className="ui-input" type="date" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} />)}
        {field("สถานะ", (
          <select className="ui-input" value={form.status} onChange={(e) => set("status", e.target.value as AssetStatus)}>
            <option value="active">ใช้งานอยู่</option>
            <option value="cancelled">ยกเลิกแล้ว</option>
          </select>
        ))}
        {field("หมายเหตุ", <input className="ui-input" value={form.note} onChange={(e) => set("note", e.target.value)} />)}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" className="ui-btn-primary" disabled={!form.name.trim() || pending}>
          {pending ? "กำลังบันทึก…" : submitLabel}
        </button>
        <button type="button" className="ui-btn-ghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    </form>
  );
}
