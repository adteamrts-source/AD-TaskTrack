import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card, EmptyState, Skeleton } from "./ui";
import {
  RISK_LOG_ACTION_LABEL,
  RISK_SEVERITY_COLOR,
  RISK_SEVERITY_LABEL,
  RISK_STATUS_LABEL,
  type Risk,
  type RiskLog,
  type RiskSeverity,
  type RiskStatus,
} from "../lib/types";
import "./risktab.css";

const SEVERITIES: RiskSeverity[] = ["high", "medium", "low"];
const STATUSES: RiskStatus[] = ["open", "monitoring", "closed"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RiskForm {
  title: string;
  detail: string;
  severity: RiskSeverity;
  status: RiskStatus;
  mitigation: string;
}

const EMPTY_FORM: RiskForm = { title: "", detail: "", severity: "medium", status: "open", mitigation: "" };

export default function RiskTab({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: risks, isLoading, isError } = useQuery({
    queryKey: ["risks", projectId],
    queryFn: async () => (await api.get<Risk[]>(`/projects/${projectId}/risks`)).data,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["risks", projectId] });

  const create = useMutation({
    mutationFn: async (form: RiskForm) => api.post(`/projects/${projectId}/risks`, form),
    onSuccess: () => {
      setAdding(false);
      refresh();
    },
  });

  const canEdit = can("Projects", "edit");
  const openBySeverity = (sev: RiskSeverity) =>
    (risks ?? []).filter((r) => r.severity === sev && r.status !== "closed").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary chips + add button */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-txt-strong">
          <ShieldAlert size={16} className="text-txt-faint" /> ความเสี่ยงที่ยังไม่ปิด
        </span>
        {SEVERITIES.map((sev) => (
          <span key={sev} className="ui-pill border border-line bg-card" style={{ color: RISK_SEVERITY_COLOR[sev] }}>
            {RISK_SEVERITY_LABEL[sev]} {openBySeverity(sev)}
          </span>
        ))}
        {canEdit && (
          <button className="ui-btn-primary ml-auto" onClick={() => setAdding((v) => !v)}>
            <Plus size={15} /> บันทึกความเสี่ยง
          </button>
        )}
      </div>

      {adding && (
        <RiskFormCard
          initial={EMPTY_FORM}
          submitLabel="บันทึกความเสี่ยง"
          pending={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(form) => create.mutate(form)}
        />
      )}

      {isLoading && <Skeleton rows={2} />}
      {isError && <Card>โหลดข้อมูลไม่สำเร็จ</Card>}
      {risks && risks.length === 0 && !adding && (
        <EmptyState
          mascot="shield"
          title="ยังไม่มีความเสี่ยงที่บันทึกไว้"
          hint="บันทึกความเสี่ยงที่เห็นตอนนี้ พร้อมวิธีจัดการและระดับความรุนแรง เพื่อให้ทีมตามดูได้"
          action={canEdit && (
            <button className="ui-btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> บันทึกความเสี่ยงแรก
            </button>
          )}
        />
      )}

      {risks?.map((risk) => (
        <RiskCard key={risk.id} risk={risk} canEdit={canEdit} canDelete={can("Projects", "delete")} onChanged={refresh} />
      ))}
    </div>
  );
}

function RiskFormCard({
  initial, submitLabel, pending, onSubmit, onCancel,
}: {
  initial: RiskForm;
  submitLabel: string;
  pending: boolean;
  onSubmit: (form: RiskForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<RiskForm>(initial);
  const set = <K extends keyof RiskForm>(key: K, value: RiskForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.title.trim()) onSubmit({ ...form, title: form.title.trim() });
  };

  return (
    <form className="ui-card risk-form p-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="risk-field sm:col-span-2">
          <span>ความเสี่ยง *</span>
          <input className="ui-input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="เช่น ลูกค้าเลื่อน UAT ไม่มีกำหนด" required />
        </label>
        <label className="risk-field">
          <span>ความรุนแรง</span>
          <select className="ui-input" value={form.severity} onChange={(e) => set("severity", e.target.value as RiskSeverity)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{RISK_SEVERITY_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="risk-field">
          <span>สถานะ</span>
          <select className="ui-input" value={form.status} onChange={(e) => set("status", e.target.value as RiskStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{RISK_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="risk-field sm:col-span-2">
          <span>รายละเอียด</span>
          <textarea className="ui-input" rows={2} value={form.detail} onChange={(e) => set("detail", e.target.value)} />
        </label>
        <label className="risk-field sm:col-span-2">
          <span>จัดการยังไง</span>
          <textarea className="ui-input" rows={2} value={form.mitigation} onChange={(e) => set("mitigation", e.target.value)} placeholder="แนวทางรับมือ / ใครติดตาม" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" className="ui-btn-primary" disabled={!form.title.trim() || pending}>
          {pending ? "กำลังบันทึก…" : submitLabel}
        </button>
        <button type="button" className="ui-btn-ghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    </form>
  );
}

function RiskCard({
  risk, canEdit, canDelete, onChanged,
}: {
  risk: Risk;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showFullLog, setShowFullLog] = useState(false);

  const update = useMutation({
    mutationFn: async (form: RiskForm) => api.patch(`/risks/${risk.id}`, form),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: async () => api.delete(`/risks/${risk.id}`),
    onSuccess: onChanged,
  });
  const { data: fullLogs } = useQuery({
    queryKey: ["risk-logs", risk.id],
    queryFn: async () => (await api.get<RiskLog[]>(`/risks/${risk.id}/logs`)).data,
    enabled: showFullLog,
  });

  const closed = risk.status === "closed";
  const logs = showFullLog && fullLogs ? fullLogs : risk.logs;

  return (
    <div className={"ui-card p-0 " + (closed ? "opacity-70" : "")}>
      <button
        type="button"
        className="risk-head flex w-full items-center gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={15} className="shrink-0 text-txt-faint" /> : <ChevronRight size={15} className="shrink-0 text-txt-faint" />}
        <span className="min-w-0 flex-1 truncate font-bold text-txt-strong">{risk.title}</span>
        <span className="ui-pill shrink-0 border border-line bg-card" style={{ color: RISK_SEVERITY_COLOR[risk.severity] }}>
          {RISK_SEVERITY_LABEL[risk.severity]}
        </span>
        <span className="ui-pill shrink-0 border border-line bg-card text-txt-dim">{RISK_STATUS_LABEL[risk.status]}</span>
      </button>

      {open && !editing && (
        <div className="border-t border-line px-4 py-3">
          {risk.detail && <p className="mb-2 whitespace-pre-wrap text-sm text-txt">{risk.detail}</p>}
          <div className="mb-2 text-sm">
            <span className="text-2xs font-bold uppercase tracking-wide text-txt-faint">จัดการยังไง</span>
            <p className="mt-0.5 whitespace-pre-wrap text-txt">{risk.mitigation || "ยังไม่ระบุ"}</p>
          </div>
          <div className="mb-3 text-2xs text-txt-faint">
            บันทึกโดย {risk.created_by_name || "—"} · {formatDateTime(risk.created_at)}
          </div>

          {(canEdit || canDelete) && (
            <div className="mb-3 flex gap-2">
              {canEdit && (
                <button className="ui-btn-ghost" onClick={() => setEditing(true)}>
                  <Pencil size={13} /> แก้ไข
                </button>
              )}
              {canDelete && (
                <button
                  className="ui-btn-ghost hover:border-danger hover:text-danger"
                  onClick={() => { if (window.confirm(`ยืนยันลบความเสี่ยง “${risk.title}”? ประวัติจะถูกลบด้วย`)) remove.mutate(); }}
                  disabled={remove.isPending}
                >
                  <Trash2 size={13} /> ลบ
                </button>
              )}
            </div>
          )}

          {/* Log timeline */}
          <div className="risk-log">
            <span className="text-2xs font-bold uppercase tracking-wide text-txt-faint">ประวัติ</span>
            <ul className="mt-1 flex flex-col gap-1">
              {logs.map((log) => (
                <li key={log.id} className="text-2xs text-txt-dim">
                  <span className="text-txt-faint">{formatDateTime(log.at)}</span>{" "}
                  <strong className="font-semibold text-txt">{RISK_LOG_ACTION_LABEL[log.action] ?? log.action}</strong>
                  {log.detail && <span> — {log.detail}</span>}
                  {log.by_name && <span className="text-txt-faint"> · {log.by_name}</span>}
                </li>
              ))}
            </ul>
            {!showFullLog && risk.logs.length >= 5 && (
              <button className="mt-1 text-2xs font-bold text-accent" onClick={() => setShowFullLog(true)}>
                ดูประวัติทั้งหมด
              </button>
            )}
          </div>
        </div>
      )}

      {open && editing && (
        <div className="border-t border-line p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-txt-strong">แก้ไขความเสี่ยง</span>
            <button className="ui-icon-action" aria-label="ยกเลิก" onClick={() => setEditing(false)}><X size={14} /></button>
          </div>
          <RiskFormCard
            initial={{ title: risk.title, detail: risk.detail, severity: risk.severity, status: risk.status, mitigation: risk.mitigation }}
            submitLabel="บันทึกการแก้ไข"
            pending={update.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(form) => update.mutate(form)}
          />
        </div>
      )}
    </div>
  );
}
