import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui";
import RangePicker, { rangeParams, type RangeValue } from "../components/RangePicker";
import { type Paginated, type TeamMember } from "../lib/types";
import "./team.css";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", dm: "DM", bsa: "BSA", dev: "Dev" };
const EMP_LABEL: Record<string, string> = { permanent: "Permanent", contractor: "Contractor" };

const UTIL_PRESETS = [
  { key: "1w", label: "1 สัปดาห์" },
  { key: "2w", label: "2 สัปดาห์" },
  { key: "1m", label: "1 เดือน" },
];

interface UtilizationUser {
  id: number;
  full_name: string;
  role: string;
  hours_by_day: Record<string, string>;
  total_hours: string;
  ot_hours: string;
  utilization: number | null;
}

interface UtilizationResponse {
  range: { from: string; to: string };
  days: { date: string; working: boolean }[];
  capacity_hours: number;
  hours_per_day: number;
  users: UtilizationUser[];
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "narrow" });
}

/** cell tone by hours vs a normal day */
function cellClass(hours: number, perDay: number): string {
  if (hours === 0) return "";
  if (hours > perDay) return "util-cell-over";
  if (hours >= perDay * 0.75) return "util-cell-full";
  return "util-cell-some";
}

function UtilizationSection() {
  const [range, setRange] = useState<RangeValue>({ preset: "1w", from: "", to: "" });
  const params = rangeParams(range);
  const { data, isLoading } = useQuery({
    queryKey: ["team-utilization", params],
    queryFn: async () => (await api.get<UtilizationResponse>("/team/utilization", { params })).data,
  });

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-txt-strong">ภาระงานทีม</h2>
          <p className="text-2xs text-txt-faint">
            ชั่วโมงที่บันทึกต่อวัน เทียบ capacity {data ? `${data.capacity_hours} ชม.` : ""} (วันทำงาน × {data?.hours_per_day ?? 8} ชม.)
          </p>
        </div>
        <RangePicker presets={UTIL_PRESETS} value={range} onChange={setRange} />
      </div>

      {isLoading && <div className="ui-card h-32 animate-pulse bg-panel" />}

      {data && (
        <div className="ui-card responsive-table-wrap p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-panel text-left text-2xs uppercase tracking-wide text-txt-faint">
                <th className="px-4 py-2 font-semibold">คน</th>
                {data.days.map((d) => (
                  <th key={d.date} className={"px-1 py-2 text-center font-semibold " + (!d.working ? "opacity-40" : "")}>
                    {dayLabel(d.date)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">รวม</th>
                <th className="px-3 py-2 text-right font-semibold">OT</th>
                <th className="px-3 py-2 text-right font-semibold">ใช้ไป</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-txt-strong">
                    {u.full_name}
                    <span className="ml-1.5 text-2xs font-normal uppercase text-txt-faint">{u.role}</span>
                  </td>
                  {data.days.map((d) => {
                    const h = Number(u.hours_by_day[d.date] ?? 0);
                    return (
                      <td key={d.date} className={"util-cell " + (!d.working ? "util-cell-off " : "") + cellClass(h, data.hours_per_day)}>
                        {h > 0 ? h : ""}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-bold text-txt-strong">{Number(u.total_hours)}</td>
                  <td className={"px-3 py-2 text-right " + (Number(u.ot_hours) > 0 ? "font-bold text-warn" : "text-txt-faint")}>
                    {Number(u.ot_hours) > 0 ? Number(u.ot_hours) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-txt-dim">
                    {u.utilization == null ? "—" : `${u.utilization}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Team() {
  const [role, setRole] = useState("");
  const [emp, setEmp] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["team-members", { role, emp }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (role) params.role = role;
      if (emp) params.employment_type = emp;
      const { data } = await api.get<Paginated<TeamMember>>("/team-members", { params });
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="ทีม" subtitle="ทะเบียนสมาชิกทีม + ภาระงาน" />

      <UtilizationSection />

      <div className="mb-5 flex flex-wrap gap-3">
        <select className="ui-input w-full sm:w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">ทุก role</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="ui-input w-full sm:w-auto" value={emp} onChange={(e) => setEmp(e.target.value)}>
          <option value="">ทุกประเภท</option>
          {Object.entries(EMP_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="ui-card p-5 text-sm text-txt-dim">กำลังโหลด…</div>}
      {isError && <div className="ui-card p-5 text-sm text-txt-dim">โหลดข้อมูลไม่สำเร็จ</div>}

      {data && (
        <div className="ui-card responsive-table-wrap">
          <table className="responsive-table w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-panel text-left text-2xs uppercase tracking-wide text-txt-faint">
                <th className="px-4 py-3 font-semibold">ชื่อ</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">ตำแหน่ง</th>
                <th className="px-4 py-3 font-semibold">ประเภท</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td data-label="ชื่อ" className="px-4 py-3">
                    <div className="font-bold text-txt-strong">{m.full_name || m.email}</div>
                    <div className="text-2xs text-txt-faint">{m.email}</div>
                  </td>
                  <td data-label="Role" className="px-4 py-3">
                    <span className="ui-pill border border-line bg-warn-bg text-accent">
                      {ROLE_LABEL[m.role] || m.role}
                    </span>
                  </td>
                  <td data-label="ตำแหน่ง" className="px-4 py-3 text-txt-dim">{m.position || "—"}</td>
                  <td data-label="ประเภท" className="px-4 py-3 text-txt-dim">{EMP_LABEL[m.employment_type] || m.employment_type}</td>
                </tr>
              ))}
              {data.results.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-txt-faint">
                    ไม่พบสมาชิก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
