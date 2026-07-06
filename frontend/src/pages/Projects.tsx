import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, Search, Users } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, HealthBadge, PhaseTag, EmptyState, Card, Skeleton } from "../components/ui";
import {
  HEALTH_COLOR,
  HEALTH_LABEL,
  PHASE_LABEL,
  type DashboardProject,
  type DashboardResponse,
  type ProjectPhase,
  type HealthStatus,
} from "../lib/types";
import "./dashboard.css";

const PHASES: ProjectPhase[] = ["pre_sale", "execution", "ma", "closed", "cancelled"];
const HEALTHS: HealthStatus[] = ["not_started", "on_plan", "at_risk", "delay", "completed"];
const STAT_HEALTHS: HealthStatus[] = ["on_plan", "at_risk", "delay", "completed"];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}

export default function Projects() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState("");
  const [health, setHealth] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["projects-dashboard", { search, phase, health }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (phase) params.phase = phase;
      if (health) params.health = health;
      const { data } = await api.get<DashboardResponse>("/dashboard", { params });
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="โครงการ"
        subtitle="ภาพรวมทุกโครงการ สถานะ ทีม และความเคลื่อนไหวล่าสุด"
        action={
          can("Projects", "create") && (
            <Link className="ui-btn-primary" to="/projects/new">
              <Plus size={16} /> สร้างโครงการ
            </Link>
          )
        }
      />

      {/* Rollup stat cards */}
      {data && (
        <div className="dash-stats mb-5">
          <div className="ui-card dash-stat">
            <span className="dash-stat-num text-txt-strong">{data.rollups.total}</span>
            <span className="dash-stat-label">โครงการทั้งหมด</span>
          </div>
          {STAT_HEALTHS.map((h) => (
            <div key={h} className="ui-card dash-stat">
              <span className="dash-stat-num" style={{ color: HEALTH_COLOR[h] }}>
                {data.rollups.by_health[h]}
              </span>
              <span className="dash-stat-label">{HEALTH_LABEL[h]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-full sm:min-w-[240px] sm:basis-auto">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
          <input
            className="ui-input w-full pl-9"
            placeholder="ค้นหา ชื่อ / รหัส / ลูกค้า"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="ui-input w-full sm:w-auto" value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value="">ทุกเฟส</option>
          {PHASES.map((p) => (
            <option key={p} value={p}>{PHASE_LABEL[p]}{data ? ` (${data.rollups.by_phase[p]})` : ""}</option>
          ))}
        </select>
        <select className="ui-input w-full sm:w-auto" value={health} onChange={(e) => setHealth(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          {HEALTHS.map((h) => (
            <option key={h} value={h}>{HEALTH_LABEL[h]}</option>
          ))}
        </select>
      </div>

      {isLoading && <Skeleton rows={4} />}
      {isError && <Card>โหลดข้อมูลไม่สำเร็จ</Card>}
      {data && data.projects.length === 0 && (
        <EmptyState
          mascot="search"
          title="ยังไม่มีโครงการที่ตรงเงื่อนไข"
          hint="ลองล้างตัวกรอง หรือสร้างโครงการใหม่หากเป็นงานที่เพิ่งเริ่ม"
          action={
            <>
              <button className="ui-btn-ghost" onClick={() => { setSearch(""); setPhase(""); setHealth(""); }}>
                ล้างตัวกรอง
              </button>
              {can("Projects", "create") && (
                <Link className="ui-btn-primary" to="/projects/new">สร้างโครงการ</Link>
              )}
            </>
          }
        />
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {data?.projects.map((p) => (
          <ProjectCard key={p.id} project={p} windowDays={data.activity_window_days} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project: p, windowDays }: { project: DashboardProject; windowDays: number }) {
  const pct = p.progress == null ? null : Math.round(p.progress * 100);
  return (
    <Link to={`/projects/${p.id}`} className="ui-card group block p-4 transition hover:-translate-y-0.5 hover:border-accent">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-wide text-txt-faint">
          {p.project_code || "—"}
        </span>
        <HealthBadge status={p.health_status} />
      </div>
      <div className="mt-1.5 text-base font-bold text-txt-strong group-hover:text-accent">
        {p.project_name}
      </div>
      <div className="mt-0.5 text-sm text-txt-dim">{p.client_abbreviation || p.client_name}</div>

      {/* Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-2xs text-txt-faint">
          <span>ความคืบหน้า (verified)</span>
          <span className="font-bold text-txt-dim">{pct == null ? "ยังไม่มีข้อมูล" : `${pct}%`}</span>
        </div>
        <div className="dash-progress mt-1">
          <div className="dash-progress-fill" style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PhaseTag phase={p.project_phase} />
        {p.delay_days > 0 && (
          <span className="ui-pill bg-warn-bg text-danger">ล่าช้า {p.delay_days} วัน</span>
        )}
        <span className="text-2xs text-txt-faint">
          งาน {p.task_counts.total} · ตรวจแล้ว {p.task_counts.verified}
        </span>
        {p.value_thb != null && (
          <span className="ml-auto text-xs font-bold text-accent">
            ฿{Number(p.value_thb).toLocaleString("th-TH")}
          </span>
        )}
      </div>

      {/* Team */}
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <Users size={14} className="shrink-0 text-txt-faint" />
        {p.team.length === 0 ? (
          <span className="text-xs text-txt-faint">ยังไม่กำหนดทีม</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {p.team.map((m) => (
              <span
                key={m.user}
                className="dash-member"
                title={`${m.full_name}${m.role_in_project ? ` · ${m.role_in_project}` : ""}`}
              >
                {m.full_name}
                {m.role_in_project && <em>{m.role_in_project}</em>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {p.recent_activity.length > 0 && (
        <div className="mt-2 flex items-start gap-2 text-2xs text-txt-faint">
          <CalendarClock size={14} className="mt-px shrink-0" />
          <span>
            {windowDays} วันล่าสุด:{" "}
            {p.recent_activity
              .map((a) => `${a.full_name} (${formatDate(a.last_date)} · ${a.hours} ชม.)`)
              .join(", ")}
          </span>
        </div>
      )}
    </Link>
  );
}
