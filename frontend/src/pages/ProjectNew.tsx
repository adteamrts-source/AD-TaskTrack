import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  PHASE_LABEL,
  type Client,
  type Paginated,
  type Project,
  type ProjectPhase,
  type TeamMember,
} from "../lib/types";

const PHASES: ProjectPhase[] = ["pre_sale", "execution", "ma", "closed", "cancelled"];
type FieldErrors = Record<string, string[] | string>;

function apiMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as FieldErrors | undefined;
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.join(", ");
    const nfe = data?.non_field_errors;
    if (Array.isArray(nfe)) return nfe.join(", ");
    if (data && typeof data === "object") {
      const first = Object.entries(data)[0];
      if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : String(first[1])}`;
    }
    if (error.response?.status === 403) return "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้";
  }
  return "ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

function Labeled({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={"flex flex-col gap-1" + (full ? " sm:col-span-2" : "")}>
      <span className="text-2xs font-semibold uppercase tracking-wide text-txt-faint">{label}</span>
      {children}
    </label>
  );
}

export default function ProjectNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me, can } = useAuth();
  const canCreateProject = can("Projects", "create");
  const canCreateClient = can("Client Master", "create");
  const canSeeMoney = me?.role === "admin" || me?.role === "dm";

  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectPhase, setProjectPhase] = useState<ProjectPhase>("pre_sale");
  const [poUser, setPoUser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [valueThb, setValueThb] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAbbr, setClientAbbr] = useState("");
  const [clientWebsite, setClientWebsite] = useState("");

  const { data: clients, isLoading: clientsLoading, isError: clientsError } = useQuery({
    queryKey: ["clients", "active"],
    queryFn: async () => (await api.get<Paginated<Client>>("/clients")).data.results,
  });
  const { data: members } = useQuery({
    queryKey: ["team-members", "po-select"],
    queryFn: async () => (await api.get<Paginated<TeamMember>>("/team-members")).data.results,
    enabled: can("Team Members", "view"),
  });

  const dateError = useMemo(() => (startDate && endDate && endDate < startDate ? "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" : ""), [endDate, startDate]);

  const createClient = useMutation({
    mutationFn: async () =>
      (await api.post<Client>("/clients", {
        client_name: clientName.trim(),
        client_abbreviation: clientAbbr.trim() || null,
        client_website: clientWebsite.trim(),
        is_active: true,
      })).data,
    onSuccess: (client) => {
      setClientId(String(client.id));
      setClientName(""); setClientAbbr(""); setClientWebsite("");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { project_name: projectName.trim(), client: Number(clientId), project_phase: projectPhase };
      if (projectCode.trim()) payload.project_code = projectCode.trim();
      if (poUser) payload.po_user = Number(poUser);
      if (startDate) payload.start_date = startDate;
      if (endDate) payload.end_date = endDate;
      if (canSeeMoney && valueThb.trim()) payload.value_thb = valueThb.trim();
      return (await api.post<Project>("/projects", payload)).data;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${project.id}`);
    },
  });

  const hasClients = (clients?.length ?? 0) > 0;
  const canSubmit = canCreateProject && !!projectName.trim() && !!clientId && !dateError && !createProject.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) createProject.mutate();
  }

  return (
    <div>
      <Link to="/projects" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-txt-dim hover:text-accent">
        <ArrowLeft size={15} /> โครงการ
      </Link>
      <h1 className="text-2xl font-bold text-txt-strong">สร้างโครงการ</h1>
      <p className="mb-5 text-sm text-txt-dim">เพิ่มข้อมูลหลักก่อน แล้วค่อยแตกแผนงานและ task ในหน้ารายละเอียด</p>

      {!canCreateProject && (
        <div className="ui-card p-5">
          <strong className="text-txt-strong">บัญชีนี้ยังไม่มีสิทธิ์สร้างโครงการ</strong>
          <p className="text-sm text-txt-dim">สิทธิ์สร้างโครงการเปิดให้ Admin หรือ DM ตาม permission matrix เท่านั้น</p>
          <Link className="text-sm font-semibold text-accent hover:underline" to="/projects">กลับไปหน้ารายการโครงการ</Link>
        </div>
      )}

      {canCreateProject && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <form className="ui-card grid gap-3 p-5 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="text-2xs font-bold uppercase tracking-wide text-txt-faint sm:col-span-2">ข้อมูลโครงการ</div>
            <Labeled label="ชื่อโครงการ *" full>
              <input className="ui-input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="เช่น ASTRO Implementation" autoFocus />
            </Labeled>
            <Labeled label="รหัสโครงการ">
              <input className="ui-input" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} placeholder="เว้นว่างได้" />
            </Labeled>
            <Labeled label="เฟส">
              <select className="ui-input" value={projectPhase} onChange={(e) => setProjectPhase(e.target.value as ProjectPhase)}>
                {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
              </select>
            </Labeled>
            <Labeled label="ลูกค้า *" full>
              <select className="ui-input" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={clientsLoading || clientsError || !hasClients}>
                <option value="">{clientsLoading ? "กำลังโหลดลูกค้า..." : hasClients ? "เลือกลูกค้า" : "ยังไม่มีลูกค้าที่ใช้งานอยู่"}</option>
                {clients?.map((c) => <option key={c.id} value={c.id}>{c.client_abbreviation ? `${c.client_abbreviation} · ` : ""}{c.client_name}</option>)}
              </select>
              {clientsError && <span className="text-2xs text-danger">โหลดรายชื่อลูกค้าไม่สำเร็จ</span>}
            </Labeled>
            <Labeled label="PO">
              <select className="ui-input" value={poUser} onChange={(e) => setPoUser(e.target.value)}>
                <option value="">ยังไม่ระบุ</option>
                {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
              </select>
            </Labeled>
            {canSeeMoney && (
              <Labeled label="มูลค่าโครงการ (บาท)">
                <input className="ui-input" inputMode="decimal" value={valueThb} onChange={(e) => setValueThb(e.target.value)} placeholder="เช่น 1200000" />
              </Labeled>
            )}
            <Labeled label="วันเริ่ม">
              <input className="ui-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Labeled>
            <Labeled label="วันสิ้นสุด">
              <input className="ui-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {dateError && <span className="text-2xs text-danger">{dateError}</span>}
            </Labeled>
            {createProject.isError && <div className="text-sm text-danger sm:col-span-2">{apiMessage(createProject.error)}</div>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Link className="ui-btn-ghost" to="/projects">ยกเลิก</Link>
              <button className="ui-btn-primary" disabled={!canSubmit}>{createProject.isPending ? "กำลังสร้าง..." : "สร้างโครงการ"}</button>
            </div>
          </form>

          <aside className="ui-card flex flex-col gap-3 p-5">
            <div className="text-2xs font-bold uppercase tracking-wide text-txt-faint">ลูกค้าใหม่</div>
            {canCreateClient ? (
              <>
                <Labeled label="ชื่อลูกค้า"><input className="ui-input" value={clientName} onChange={(e) => setClientName(e.target.value)} /></Labeled>
                <Labeled label="ตัวย่อ"><input className="ui-input" value={clientAbbr} onChange={(e) => setClientAbbr(e.target.value)} placeholder="ไม่บังคับ" /></Labeled>
                <Labeled label="เว็บไซต์"><input className="ui-input" value={clientWebsite} onChange={(e) => setClientWebsite(e.target.value)} placeholder="ไม่บังคับ" /></Labeled>
                {createClient.isError && <div className="text-sm text-danger">{apiMessage(createClient.error)}</div>}
                <button className="ui-btn-ghost" onClick={() => clientName.trim() && canCreateClient && createClient.mutate()} disabled={!clientName.trim() || createClient.isPending}>
                  {createClient.isPending ? "กำลังเพิ่ม..." : "เพิ่มลูกค้าและเลือกใช้"}
                </button>
              </>
            ) : (
              <p className="text-sm text-txt-dim">หากไม่พบลูกค้าที่ต้องการ ให้ผู้ดูแลเพิ่มใน Client Master ก่อนสร้างโครงการ</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
