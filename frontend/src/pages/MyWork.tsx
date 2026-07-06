import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, ClipboardList, Clock3, Inbox, Plus, Save, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import {
  type CalendarEvent,
  type CalendarEventsResponse,
  type DailyEntry,
  type DailyListResponse,
  type Paginated,
  type Project,
  type Task,
} from "../lib/types";
import { addDays, isWeekend, thaiDow, toISO, workWeek, fromISO } from "../lib/dates";
import HoursStepper from "../components/HoursStepper";
import LazyMarkdownContent from "../components/LazyMarkdownContent";
import MarkdownEditor from "../components/MarkdownEditor";
import { Greeting, RocketCelebrate } from "../components/gimmicks/Gimmicks";
import "./mywork.css";

const LAST_PROJECT_KEY = "astro-last-project";
const CALENDAR_REAUTH_KEY = "astro-calendar-reauth-attempted";
const GENERAL = "general";

export default function MyWork() {
  const qc = useQueryClient();
  const today = toISO(new Date());
  const [date, setDate] = useState(today);

  const [content, setContent] = useState("");
  const [proj, setProj] = useState<string>(() => localStorage.getItem(LAST_PROJECT_KEY) || GENERAL);
  const [hours, setHours] = useState(1);
  const [isOt, setIsOt] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const prevHoursRef = useRef<number | null>(null);
  const week = useMemo(() => workWeek(fromISO(date)), [date]);
  const { data: workingDays } = useQuery({
    queryKey: ["working-days", week[0], week[4]],
    queryFn: async () =>
      (await api.get<{ date: string; is_working_day: boolean }[]>(
        `/calendar/working-days?from=${week[0]}&to=${week[4]}`,
      )).data,
  });
  const nonWorking = (iso: string) => {
    const found = workingDays?.find((d) => d.date === iso);
    if (found) return !found.is_working_day;
    return isWeekend(iso);
  };

  useEffect(() => {
    setIsOt(nonWorking(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, workingDays]);

  const { data: daily } = useQuery({
    queryKey: ["daily", date],
    queryFn: async () => (await api.get<DailyListResponse>(`/daily?work_date=${date}&user=me`)).data,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => (await api.get<Paginated<Project>>("/projects")).data.results,
  });
  const { data: assigned, isLoading: assignedLoading, isError: assignedError } = useQuery({
    queryKey: ["tasks-mine"],
    queryFn: async () => (await api.get<Paginated<Task>>("/tasks?assignee=me")).data.results,
  });
  const { data: backlog, isLoading: backlogLoading, isError: backlogError } = useQuery({
    queryKey: ["tasks-backlog"],
    queryFn: async () => (await api.get<Paginated<Task>>("/tasks?assignee=backlog")).data.results,
  });
  const { data: calendar, isLoading: calendarLoading, isError: calendarError } = useQuery({
    queryKey: ["calendar-events", date],
    queryFn: async () =>
      (await api.get<CalendarEventsResponse>("/calendar/events", { params: { date } })).data,
  });

  useEffect(() => {
    if (calendar?.connected) {
      sessionStorage.removeItem(CALENDAR_REAUTH_KEY);
      return;
    }
    if (calendar?.connected === false && !sessionStorage.getItem(CALENDAR_REAUTH_KEY)) {
      sessionStorage.setItem(CALENDAR_REAUTH_KEY, "1");
      window.location.assign("/accounts/google/login/");
    }
  }, [calendar?.connected]);

  const refreshDaily = () => {
    qc.invalidateQueries({ queryKey: ["daily", date] });
    qc.invalidateQueries({ queryKey: ["daily-reminder"] });
  };

  const addManual = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        work_date: date, source: "manual", detail: content.trim(), hours: hours.toFixed(1), is_ot: isOt,
      };
      if (proj !== GENERAL) payload.project_id = Number(proj);
      return api.post("/daily", payload);
    },
    onSuccess: () => {
      if (proj !== GENERAL) localStorage.setItem(LAST_PROJECT_KEY, proj);
      setContent("");
      refreshDaily();
    },
  });
  const logFromTask = useMutation({
    mutationFn: async (task: Task) =>
      api.post("/daily", { work_date: date, source: "manual", task_id: task.id, hours: "1.0", is_ot: isOt }),
    onSuccess: refreshDaily,
  });
  const logFromCalendar = useMutation({
    mutationFn: async (event: CalendarEvent) =>
      api.post("/daily", { work_date: date, source: "meeting", calendar_event_id: event.id, title: event.title, hours: event.hours, is_ot: isOt }),
    onSuccess: refreshDaily,
  });
  const claim = useMutation({
    mutationFn: async (id: number) => api.post(`/tasks/${id}/claim`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks-backlog"] });
      qc.invalidateQueries({ queryKey: ["tasks-mine"] });
    },
  });
  const patchEntry = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/daily/${id}`, body),
    onSuccess: refreshDaily,
  });
  const removeEntry = useMutation({
    mutationFn: async (id: number) => api.delete(`/daily/${id}`),
    onSuccess: refreshDaily,
  });

  const submit = () => { if (content.trim()) addManual.mutate(); };

  const entries = daily?.results ?? [];
  const totalHours = daily ? Number(daily.total_hours) : 0;

  // 🚀 ครบ 8 ชม. ของวันนี้ครั้งแรก -> จรวดทะยานฉลอง
  useEffect(() => {
    if (!daily || date !== today) { prevHoursRef.current = null; return; }
    const prev = prevHoursRef.current;
    prevHoursRef.current = totalHours;
    if (prev != null && prev < 8 && totalHours >= 8) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalHours, date, daily]);
  const calendarEvents = calendar?.events ?? [];
  const dayProgress = Math.min(100, Math.round((totalHours / 8) * 100));
  return (
    <div className="my-work-page">
      <RocketCelebrate show={celebrate} />
      <header className="work-page-header">
        <div>
          <h1>งานของฉัน</h1>
          <p>{date === today ? "บันทึกงานที่ทำวันนี้" : `บันทึกงานวันที่ ${date}`} · <Greeting /></p>
        </div>
        <div className="work-day-summary" aria-label={`${entries.length} รายการ รวม ${totalHours} ชั่วโมง`}>
          <Clock3 size={16} />
          <span>{entries.length} รายการ</span>
          <strong>{totalHours}/8 ชม.</strong>
        </div>
      </header>

      <div className="work-progress" aria-label={`บันทึกแล้ว ${dayProgress}%`}>
        <span style={{ width: `${dayProgress}%` }} />
      </div>

      <section className="work-date-toolbar" aria-label="เลือกวันที่บันทึกงาน">
        <button className="work-date-nav" onClick={() => setDate(addDays(week[0], -3))} aria-label="สัปดาห์ก่อน">
          <ChevronLeft size={18} />
        </button>
        <div className="work-week-days">
          {week.map((iso) => {
            const active = iso === date;
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                className={`work-week-day${active ? " is-active" : ""}${nonWorking(iso) ? " is-off" : ""}`}
              >
                <span>{thaiDow(iso)}</span>
                <strong>{fromISO(iso).getDate()}</strong>
              </button>
            );
          })}
        </div>
        <button className="work-date-nav" onClick={() => setDate(addDays(week[4], 3))} aria-label="สัปดาห์ถัดไป">
          <ChevronRight size={18} />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="ui-input work-date-picker"
          title="เลือกวันอื่น (รวมวันหยุด) สำหรับ OT"
        />
      </section>

      <div className="work-layout">
        <main className="work-primary">
          <section className="ui-card work-composer">
            <label htmlFor="daily-detail">งานที่ทำวันนี้</label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              onSubmit={submit}
              placeholder="พิมพ์งานที่ทำวันนี้…"
            />
            <div className="work-composer-actions">
              <select className="ui-input work-project-select" value={proj} onChange={(e) => setProj(e.target.value)}>
                <option value={GENERAL}>ทั่วไป (ไม่ผูกโครงการ)</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>{p.client_abbreviation || p.client_name} · {p.project_name}</option>
                ))}
              </select>
              <HoursStepper value={hours} onChange={setHours} />
              <label className="work-ot-check">
                <input type="checkbox" checked={isOt} onChange={(e) => setIsOt(e.target.checked)} /> OT
              </label>
              <button className="ui-btn-primary work-save" onClick={submit} disabled={!content.trim() || addManual.isPending} title="บันทึก (Ctrl/⌘ + Enter)">
                <Save size={16} /> {addManual.isPending ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </section>

          <section className="work-entries-section">
            <div className="work-entries-head">
              <h2>บันทึกของวันที่เลือก</h2>
              <span>รวม {totalHours} ชม.</span>
            </div>
            <div className="work-entries">
              {entries.length === 0 && (
                <div className="work-empty">
                  <span><Inbox size={24} /></span>
                  <strong>ยังไม่มีบันทึก</strong>
                  <p>พิมพ์งานด้านบน หรือแตะเพิ่มจากรายการด้านข้าง</p>
                </div>
              )}
              {entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  projects={projects ?? []}
                  onProject={(pid) => patchEntry.mutate({ id: entry.id, body: { project_id: pid } })}
                  onHours={(value) => patchEntry.mutate({ id: entry.id, body: { hours: value.toFixed(1) } })}
                  onOt={(value) => patchEntry.mutate({ id: entry.id, body: { is_ot: value } })}
                  onDelete={() => removeEntry.mutate(entry.id)}
                />
              ))}
            </div>
          </section>
        </main>

        <aside className="work-source-rail" aria-label="เพิ่มบันทึกจากข้อมูลที่มี">
          <section className="work-source-section">
            <SourceHeading icon={<Calendar size={16} />} title="ประชุมวันที่เลือก" count={calendarEvents.length} />
            <div className="work-source-list">
              {calendarLoading && <SourceEmpty>กำลังโหลดปฏิทิน…</SourceEmpty>}
              {calendarError && <SourceEmpty danger>ดึงปฏิทินไม่สำเร็จ กรุณารีเฟรชหรือเข้าสู่ระบบด้วย Google ใหม่</SourceEmpty>}
              {calendar && !calendar.connected && <SourceEmpty>กำลังต่ออายุสิทธิ์ Google Calendar…</SourceEmpty>}
              {calendar?.connected && calendarEvents.length === 0 && <SourceEmpty>ไม่มีประชุมในวันที่เลือก</SourceEmpty>}
              {calendarEvents.map((event) => (
                <SourceRow
                  key={event.id}
                  title={event.title}
                  detail={`${event.all_day ? "ทั้งวัน" : formatEventTime(event)} · ${Number(event.hours)} ชม.`}
                  action="เพิ่ม"
                  onAction={() => logFromCalendar.mutate(event)}
                  disabled={logFromCalendar.isPending}
                />
              ))}
            </div>
          </section>

          <section className="work-source-section">
            <SourceHeading icon={<ClipboardList size={16} />} title="งานที่มอบหมายให้ฉัน" count={assigned?.length ?? 0} />
            <div className="work-source-list">
              {assignedLoading && <SourceEmpty>กำลังโหลดงาน…</SourceEmpty>}
              {assignedError && <SourceEmpty danger>โหลดงานที่มอบหมายไม่สำเร็จ</SourceEmpty>}
              {!assignedLoading && !assignedError && assigned?.length === 0 && <SourceEmpty>ไม่มีงานที่มอบหมายในตอนนี้</SourceEmpty>}
              {assigned?.map((task) => (
                <SourceRow
                  key={task.id}
                  title={task.title}
                  detail={task.project_name}
                  action="เพิ่ม 1 ชม."
                  onAction={() => logFromTask.mutate(task)}
                  disabled={logFromTask.isPending}
                />
              ))}
            </div>
          </section>

          <section className="work-source-section is-backlog">
            <SourceHeading icon={<Inbox size={16} />} title="Backlog · งานที่ยังไม่มีผู้รับ" count={backlog?.length ?? 0} />
            <div className="work-source-list">
              {backlogLoading && <SourceEmpty>กำลังโหลด Backlog…</SourceEmpty>}
              {backlogError && <SourceEmpty danger>โหลด Backlog ไม่สำเร็จ</SourceEmpty>}
              {!backlogLoading && !backlogError && backlog?.length === 0 && <SourceEmpty>ไม่มีงานค้างให้รับ</SourceEmpty>}
              {backlog?.map((task) => (
                <SourceRow
                  key={task.id}
                  title={task.title}
                  detail={task.project_name}
                  action="รับงาน"
                  onAction={() => claim.mutate(task.id)}
                  disabled={claim.isPending}
                />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SourceHeading({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="work-source-heading">
      <h2>{icon}{title}</h2>
      <span>{count}</span>
    </div>
  );
}

function SourceRow({ title, detail, action, onAction, disabled }: {
  title: string;
  detail?: string;
  action: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="work-source-row">
      <div><strong>{title}</strong>{detail && <span>{detail}</span>}</div>
      <button type="button" onClick={onAction} disabled={disabled}><Plus size={15} /> {action}</button>
    </div>
  );
}

function SourceEmpty({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return <p className={`work-source-empty${danger ? " is-danger" : ""}`}>{children}</p>;
}

function formatEventTime(event: CalendarEvent): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const start = new Intl.DateTimeFormat("th-TH", opts).format(new Date(event.start));
  const end = new Intl.DateTimeFormat("th-TH", opts).format(new Date(event.end));
  return `${start}–${end}`;
}

function EntryRow({
  entry, projects, onProject, onHours, onOt, onDelete,
}: {
  entry: DailyEntry;
  projects: Project[];
  onProject: (pid: number | null) => void;
  onHours: (h: number) => void;
  onOt: (v: boolean) => void;
  onDelete: () => void;
}) {
  const isTask = entry.task != null;
  return (
    <div className="work-entry-row">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {entry.detail ? (
            <LazyMarkdownContent value={entry.detail} />
          ) : (
            <div className="font-semibold text-txt-strong">{entry.title}</div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isTask ? (
              <span className="text-2xs text-txt-dim">{entry.project_name}</span>
            ) : (
              <select
                className="rounded-btn border border-line bg-field px-2 py-0.5 text-2xs text-txt-dim"
                value={entry.project ?? GENERAL}
                onChange={(e) => onProject(e.target.value === GENERAL ? null : Number(e.target.value))}
              >
                <option value={GENERAL}>ทั่วไป</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.client_abbreviation || p.client_name}</option>
                ))}
              </select>
            )}
            {entry.is_ot && <span className="ui-pill bg-warn-bg text-warn">OT</span>}
            {entry.status_snapshot && (
              <span className="ui-pill border border-line bg-card text-txt-dim">{entry.status_snapshot}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <HoursStepper small value={Number(entry.hours)} onChange={onHours} />
          <label className="inline-flex items-center gap-1 text-[10px] font-bold text-warn">
            <input type="checkbox" checked={entry.is_ot} onChange={(e) => onOt(e.target.checked)} /> OT
          </label>
          <button
            className="ui-icon-action hover:text-danger"
            onClick={() => { if (window.confirm("ยืนยันลบบันทึกงานนี้?")) onDelete(); }}
            aria-label="ลบ"
            title="ลบบันทึก"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
