import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ArrowLeft, Pencil, Trash2, Plus } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PlanTab from "../components/PlanTab";
import TasksTab from "../components/TasksTab";
import BudgetTab from "../components/BudgetTab";
import RiskTab from "../components/RiskTab";
import { Tabs, PhaseTag, HealthBadge, Table, Row, Cell } from "../components/ui";
import {
  PHASE_LABEL,
  type Client,
  type Paginated,
  type Project,
  type ProjectPhase,
  type ProjectTeamMember,
  type TeamMember,
} from "../lib/types";

const PHASES: ProjectPhase[] = ["pre_sale", "execution", "ma", "closed", "cancelled"];
const ROLE_LABEL: Record<string, string> = { admin: "Admin", dm: "DM", bsa: "BSA", dev: "Dev" };

const TABS = [
  { key: "tasks", label: "งาน" },
  { key: "plan", label: "แผนงาน" },
  { key: "risk", label: "ความเสี่ยง" },
  { key: "team", label: "ทีม" },
  { key: "budget", label: "งบประมาณ" },
];

function projectDate(value: string | null): string {
  if (!value) return "ยังไม่ระบุ";
  return new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SummaryField({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-xs font-semibold text-txt-faint">{label}</div>
      <div className="mt-1 text-sm font-semibold text-txt-strong">{value}</div>
    </div>
  );
}

function ProjectSummary({ project }: { project: Project }) {
  const period = `${projectDate(project.start_date)} – ${projectDate(project.end_date)}`;
  return (
    <section className="mb-5 border-y border-line bg-panel px-4 py-4" aria-label="ข้อมูลภาพรวมโครงการ">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryField label="ความคืบหน้า" value={project.progress == null ? "ยังไม่มีข้อมูลงาน" : `${Math.round(project.progress * 100)}%`} />
        <SummaryField label="ล่าช้า" value={project.delay_days > 0 ? `${project.delay_days} วัน` : "ไม่ล่าช้า"} />
        <SummaryField label="ระยะเวลาโครงการ" value={period} wide />
        <SummaryField label="ผู้รับผิดชอบโครงการ (PO)" value={project.po_name || "ยังไม่ระบุ"} wide={project.value_thb == null} />
        {project.value_thb != null && (
          <SummaryField label="มูลค่าโครงการ" value={`฿${Number(project.value_thb).toLocaleString("th-TH")}`} />
        )}
        {project.health_reason && <SummaryField label="เหตุผลสถานะ" value={project.health_reason} wide />}
      </div>
    </section>
  );
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

function FormError({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-btn border px-3 py-2 text-sm text-danger" style={{ background: "rgba(225,29,72,.08)", borderColor: "rgba(225,29,72,.2)" }}>
      {children}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, me } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const tab = TABS.some((item) => item.key === requestedTab) ? requestedTab! : "tasks";
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (requestedTab !== tab) {
      const next = new URLSearchParams(params);
      next.set("tab", tab);
      setParams(next, { replace: true });
    }
  }, [params, requestedTab, setParams, tab]);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
    enabled: !!id,
  });

  const deleteProject = useMutation({
    mutationFn: async () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
  });

  return (
    <div>
      <Link to="/projects" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-txt-dim hover:text-accent">
        <ArrowLeft size={15} /> โครงการ
      </Link>

      {isLoading && <div className="ui-card p-5 text-sm text-txt-dim">กำลังโหลด…</div>}

      {project && (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="break-words text-2xl font-bold text-txt-strong">{project.project_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-txt-dim">
                <span className="font-bold uppercase tracking-wide text-txt-faint">{project.project_code || "—"}</span>
                <span>·</span>
                <span>{project.client_name}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PhaseTag phase={project.project_phase} />
              <HealthBadge status={project.health_status} />
            </div>
          </div>

          {(can("Projects", "edit") || can("Projects", "delete")) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {can("Projects", "edit") && (
                <button className="ui-btn-ghost" onClick={() => setEditing((v) => !v)}>
                  <Pencil size={15} /> {editing ? "ปิดฟอร์มแก้ไข" : "แก้ไขข้อมูลโครงการ"}
                </button>
              )}
              {can("Projects", "delete") && (
                <button
                  className="ui-btn-danger"
                  disabled={deleteProject.isPending}
                  onClick={() => {
                    if (window.confirm("ยืนยันลบโครงการนี้? ระบบจะซ่อนโครงการแบบ soft delete")) deleteProject.mutate();
                  }}
                >
                  <Trash2 size={15} /> ลบโครงการ
                </button>
              )}
            </div>
          )}

          <ProjectSummary project={project} />

          {editing && (
            <ProjectEditForm
              project={project}
              canSeeMoney={me?.role === "admin" || me?.role === "dm"}
              onDone={() => setEditing(false)}
            />
          )}

          <Tabs tabs={TABS} active={tab} onChange={(k) => setParams({ tab: k })} />

          <div>
            {tab === "tasks" && <TasksTab projectId={id!} />}
            {tab === "plan" && <PlanTab projectId={id!} />}
            {tab === "risk" && <RiskTab projectId={id!} />}
            {tab === "team" && <ProjectTeamPanel projectId={id!} />}
            {tab === "budget" && <BudgetTab projectId={id!} />}
          </div>
        </>
      )}
    </div>
  );
}

function Labeled({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={"flex flex-col gap-1" + (full ? " sm:col-span-2" : "")}>
      <span className="text-2xs font-semibold uppercase tracking-wide text-txt-faint">{label}</span>
      {children}
    </label>
  );
}

function ProjectEditForm({ project, canSeeMoney, onDone }: { project: Project; canSeeMoney: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const blank = () => ({
    project_name: project.project_name,
    project_code: project.project_code || "",
    client: String(project.client),
    project_phase: project.project_phase,
    po_user: project.po_user ? String(project.po_user) : "",
    value_thb: project.value_thb || "",
    start_date: project.start_date || "",
    end_date: project.end_date || "",
  });
  const [form, setForm] = useState(blank);
  useEffect(() => setForm(blank()), [project]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: clients } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: async () => (await api.get<Paginated<Client>>("/clients")).data.results,
  });
  const { data: members } = useQuery({
    queryKey: ["team-members", "po-select"],
    queryFn: async () => (await api.get<Paginated<TeamMember>>("/team-members")).data.results,
  });

  const update = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        project_name: form.project_name.trim(),
        project_code: form.project_code.trim() || null,
        client: Number(form.client),
        project_phase: form.project_phase,
        po_user: form.po_user ? Number(form.po_user) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (canSeeMoney) payload.value_thb = form.value_thb.trim() || null;
      return api.patch(`/projects/${project.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", String(project.id)] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onDone();
    },
  });

  const dateError = !!(form.start_date && form.end_date && form.end_date < form.start_date);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (form.project_name.trim() && form.client && !dateError) update.mutate();
  }

  return (
    <form className="mb-6 grid gap-3 rounded-card border border-line bg-panel p-4 sm:grid-cols-2" onSubmit={submit}>
      <Labeled label="ชื่อโครงการ *" full>
        <input className="ui-input" value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
      </Labeled>
      <Labeled label="รหัสโครงการ">
        <input className="ui-input" value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })} />
      </Labeled>
      <Labeled label="เฟส">
        <select className="ui-input" value={form.project_phase} onChange={(e) => setForm({ ...form, project_phase: e.target.value as ProjectPhase })}>
          {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
        </select>
      </Labeled>
      <Labeled label="ลูกค้า" full>
        <select className="ui-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>{c.client_abbreviation ? `${c.client_abbreviation} · ` : ""}{c.client_name}</option>
          ))}
        </select>
      </Labeled>
      <Labeled label="PO">
        <select className="ui-input" value={form.po_user} onChange={(e) => setForm({ ...form, po_user: e.target.value })}>
          <option value="">ยังไม่ระบุ</option>
          {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
        </select>
      </Labeled>
      {canSeeMoney && (
        <Labeled label="มูลค่าโครงการ">
          <input className="ui-input" inputMode="decimal" value={form.value_thb} onChange={(e) => setForm({ ...form, value_thb: e.target.value })} />
        </Labeled>
      )}
      <Labeled label="วันเริ่ม">
        <input className="ui-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
      </Labeled>
      <Labeled label="วันสิ้นสุด">
        <input className="ui-input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
      </Labeled>
      {dateError && <div className="sm:col-span-2"><FormError>วันสิ้นสุดต้องไม่ก่อนวันเริ่ม</FormError></div>}
      {update.isError && <div className="sm:col-span-2"><FormError>{errorText(update.error)}</FormError></div>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="ui-btn-ghost" onClick={onDone}>ยกเลิก</button>
        <button className="ui-btn-primary" disabled={!form.project_name.trim() || !form.client || dateError || update.isPending}>
          บันทึกข้อมูลโครงการ
        </button>
      </div>
    </form>
  );
}

function ProjectTeamPanel({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ user: "", role_in_project: "", responsibilities: "", allocation_percentage: "" });
  const canEdit = can("Projects", "edit");

  const { data: team, isLoading, isError } = useQuery({
    queryKey: ["project-team", projectId],
    queryFn: async () => (await api.get<Paginated<ProjectTeamMember> | ProjectTeamMember[]>(`/projects/${projectId}/team`)).data,
  });
  const { data: members } = useQuery({
    queryKey: ["team-members", "project-team"],
    queryFn: async () => (await api.get<Paginated<TeamMember>>("/team-members")).data.results,
    enabled: canEdit,
  });
  const rows = Array.isArray(team) ? team : team?.results ?? [];

  const addMember = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${projectId}/team`, {
        user: Number(form.user),
        role_in_project: form.role_in_project,
        responsibilities: form.responsibilities,
        allocation_percentage: form.allocation_percentage ? Number(form.allocation_percentage) : null,
      }),
    onSuccess: () => {
      setForm({ user: "", role_in_project: "", responsibilities: "", allocation_percentage: "" });
      qc.invalidateQueries({ queryKey: ["project-team", projectId] });
    },
  });
  const patchMember = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<ProjectTeamMember> }) => api.patch(`/project-team/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-team", projectId] }),
  });
  const deleteMember = useMutation({
    mutationFn: async (id: number) => api.delete(`/project-team/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-team", projectId] }),
  });

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="grid gap-2 rounded-card border border-line bg-panel p-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(220px,1.4fr)_112px_auto]">
          <select className="ui-input w-full" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })}>
            <option value="">เลือกสมาชิก</option>
            {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </select>
          <input className="ui-input w-full" placeholder="บทบาทในโครงการ" value={form.role_in_project} onChange={(e) => setForm({ ...form, role_in_project: e.target.value })} />
          <input className="ui-input w-full" placeholder="หน้าที่รับผิดชอบ" value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} />
          <input className="ui-input w-full" placeholder="% allocation" inputMode="numeric" value={form.allocation_percentage} onChange={(e) => setForm({ ...form, allocation_percentage: e.target.value })} />
          <button className="ui-btn-primary w-full sm:col-span-2 xl:col-span-1" disabled={!form.user || addMember.isPending} onClick={() => addMember.mutate()}>
            <Plus size={15} /> เพิ่ม
          </button>
        </div>
      )}
      {isLoading && <p className="text-sm text-txt-dim">กำลังโหลดทีม…</p>}
      {isError && <p className="text-sm text-txt-dim">โหลดทีมไม่สำเร็จ</p>}
      {(patchMember.isError || deleteMember.isError) && <FormError>{errorText(patchMember.error || deleteMember.error)}</FormError>}
      {rows.length === 0 ? (
        <div className="rounded-btn border border-line bg-field px-3 py-2 text-sm text-txt-dim">ยังไม่มีสมาชิกในทีมโครงการ</div>
      ) : (
        <Table columns={["สมาชิก", "บทบาท", "หน้าที่", "%", ""]}>
          {rows.map((row) => (
            <ProjectTeamRow
              key={row.id}
              row={row}
              canEdit={canEdit}
              saving={patchMember.isPending}
              deleting={deleteMember.isPending}
              onSave={(body) => patchMember.mutate({ id: row.id, body })}
              onDelete={() => deleteMember.mutate(row.id)}
            />
          ))}
        </Table>
      )}
    </div>
  );
}

function ProjectTeamRow({
  row, canEdit, saving, deleting, onSave, onDelete,
}: {
  row: ProjectTeamMember;
  canEdit: boolean;
  saving: boolean;
  deleting: boolean;
  onSave: (body: Partial<ProjectTeamMember>) => void;
  onDelete: () => void;
}) {
  const seed = () => ({
    role_in_project: row.role_in_project,
    responsibilities: row.responsibilities,
    allocation_percentage: row.allocation_percentage == null ? "" : String(row.allocation_percentage),
  });
  const [draft, setDraft] = useState(seed);
  useEffect(() => setDraft(seed()), [row]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    draft.role_in_project !== row.role_in_project ||
    draft.responsibilities !== row.responsibilities ||
    draft.allocation_percentage !== (row.allocation_percentage == null ? "" : String(row.allocation_percentage));

  return (
    <Row>
      <Cell label="สมาชิก">
        <div className="font-bold text-txt-strong">{row.full_name || row.email}</div>
        <div className="text-2xs text-txt-faint">{ROLE_LABEL[row.user_role] || row.user_role}</div>
      </Cell>
      <Cell label="บทบาท"><input className="ui-input w-full" disabled={!canEdit} value={draft.role_in_project} onChange={(e) => setDraft({ ...draft, role_in_project: e.target.value })} /></Cell>
      <Cell label="หน้าที่"><input className="ui-input w-full" disabled={!canEdit} value={draft.responsibilities} onChange={(e) => setDraft({ ...draft, responsibilities: e.target.value })} /></Cell>
      <Cell label="Allocation"><input className="ui-input w-full sm:w-16" disabled={!canEdit} inputMode="numeric" value={draft.allocation_percentage} onChange={(e) => setDraft({ ...draft, allocation_percentage: e.target.value })} /></Cell>
      <Cell label="จัดการ">
        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            <button
              className="ui-btn-ghost h-10 px-3"
              disabled={!dirty || saving}
              onClick={() => onSave({
                role_in_project: draft.role_in_project,
                responsibilities: draft.responsibilities,
                allocation_percentage: draft.allocation_percentage ? Number(draft.allocation_percentage) : null,
              })}
            >
              บันทึก
            </button>
            <button className="ui-icon-action hover:text-danger" disabled={deleting} onClick={onDelete} aria-label="ลบ"><Trash2 size={16} /></button>
          </div>
        )}
      </Cell>
    </Row>
  );
}
