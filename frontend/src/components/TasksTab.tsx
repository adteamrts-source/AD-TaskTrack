import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Kanban,
  List,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { burstAt } from "./gimmicks/Gimmicks";
import { useAuth } from "../lib/auth";
import {
  TASK_STATE_LABEL,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  type Paginated,
  type Task,
  type TaskStateKey,
  type TaskStatusKey,
  type TeamMember,
} from "../lib/types";

const STATUSES: TaskStatusKey[] = ["not_started", "working", "stuck", "done", "verified"];
const STATES: TaskStateKey[] = ["get_req", "design", "development", "test", "training", "go_live"];
const STATUS_PRIORITY: Record<TaskStatusKey, number> = {
  stuck: 0,
  working: 1,
  not_started: 2,
  done: 3,
  verified: 4,
};

type TaskForm = {
  title: string;
  detail: string;
  assigned_to: string;
  state: TaskStateKey;
  status: TaskStatusKey;
  estimated_manday: string;
  scheduled_date: string;
};

const EMPTY_TASK: TaskForm = {
  title: "",
  detail: "",
  assigned_to: "",
  state: "get_req",
  status: "not_started",
  estimated_manday: "",
  scheduled_date: "",
};

function errorText(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "detail" in data) return String((data as { detail: string }).detail);
    const first = data && typeof data === "object" ? Object.entries(data)[0] : null;
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : String(first[1])}`;
  }
  if (error instanceof Error) return error.message;
  return "ทำรายการไม่สำเร็จ";
}

function toTaskForm(task: Task): TaskForm {
  return {
    title: task.title,
    detail: task.detail,
    assigned_to: task.assigned_to == null ? "" : String(task.assigned_to),
    state: task.state,
    status: task.status,
    estimated_manday: task.estimated_manday || "",
    scheduled_date: task.scheduled_date || "",
  };
}

function toCreatePayload(form: TaskForm, projectId: string) {
  return {
    title: form.title.trim(),
    detail: form.detail,
    project: Number(projectId),
    assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
    state: form.state,
    estimated_manday: form.estimated_manday || null,
    scheduled_date: form.scheduled_date || null,
  };
}

function toUpdatePayload(form: TaskForm) {
  return {
    title: form.title.trim(),
    detail: form.detail,
    assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
    state: form.state,
    status: form.status,
    estimated_manday: form.estimated_manday || null,
    scheduled_date: form.scheduled_date || null,
  };
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Labeled({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1${full ? " sm:col-span-2 lg:col-span-4" : ""}`}>
      <span className="text-xs font-semibold text-txt-faint">{label}</span>
      {children}
    </label>
  );
}

function TaskFormFields({
  form,
  members,
  onChange,
  showStatus,
  allowUnassigned = true,
}: {
  form: TaskForm;
  members: TeamMember[];
  onChange: (form: TaskForm) => void;
  showStatus: boolean;
  allowUnassigned?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Labeled label="ชื่องาน *" full>
        <input className="ui-input" placeholder="เช่น ออกแบบหน้าจอ Dashboard" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
      </Labeled>
      <Labeled label="รายละเอียดงาน" full>
        <textarea
          className="min-h-[96px] rounded-btn border border-line bg-field px-3 py-2 text-sm text-txt outline-none transition focus:border-accent"
          placeholder="อธิบายขอบเขต เงื่อนไข หรือข้อมูลที่ต้องใช้"
          value={form.detail}
          onChange={(event) => onChange({ ...form, detail: event.target.value })}
        />
      </Labeled>
      <Labeled label="ผู้รับผิดชอบ">
        <select className="ui-input" value={form.assigned_to} onChange={(event) => onChange({ ...form, assigned_to: event.target.value })}>
          {allowUnassigned ? <option value="">ยังไม่มีผู้รับผิดชอบ (Backlog)</option> : null}
          {members.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
        </select>
      </Labeled>
      <Labeled label="Stage (SDLC)">
        <select className="ui-input" value={form.state} onChange={(event) => onChange({ ...form, state: event.target.value as TaskStateKey })}>
          {STATES.map((state) => <option key={state} value={state}>{TASK_STATE_LABEL[state]}</option>)}
        </select>
      </Labeled>
      {showStatus ? (
        <Labeled label="สถานะงาน">
          <select className="ui-input" value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as TaskStatusKey })}>
            {STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABEL[status]}</option>)}
          </select>
        </Labeled>
      ) : null}
      <Labeled label="Estimated MD">
        <input className="ui-input" inputMode="decimal" placeholder="เช่น 3" value={form.estimated_manday} onChange={(event) => onChange({ ...form, estimated_manday: event.target.value })} />
      </Labeled>
      <Labeled label="กำหนดส่ง">
        <input className="ui-input" type="date" value={form.scheduled_date} onChange={(event) => onChange({ ...form, scheduled_date: event.target.value })} />
      </Labeled>
    </div>
  );
}

function MobileLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-xs font-semibold text-txt-faint lg:hidden">{children}</div>;
}

function LoadingList() {
  return (
    <div className="flex flex-col gap-2" aria-label="กำลังโหลดรายการงาน">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-card bg-panel" />
      ))}
    </div>
  );
}

export default function TasksTab({ projectId }: { projectId: string }) {
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState<TaskForm>(EMPTY_TASK);
  const [view, setView] = useState<"list" | "board">("list");
  const isVerifier = !!me?.role && ["admin", "dm", "bsa"].includes(me.role);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["tasks", projectId, { search: deferredSearch, statusFilter, stateFilter, assigneeFilter, page, view }],
    queryFn: async () => {
      const params: Record<string, string> = { project: projectId, page: String(view === "board" ? 1 : page) };
      if (view === "board") params.page_size = "200"; // board shows everything at once
      if (deferredSearch) params.search = deferredSearch;
      if (statusFilter) params.status = statusFilter;
      if (stateFilter) params.state = stateFilter;
      if (assigneeFilter) params.assignee = assigneeFilter;
      return (await api.get<Paginated<Task>>("/tasks", { params })).data;
    },
    placeholderData: (previous) => previous,
  });

  const { data: members } = useQuery({
    queryKey: ["team-members", "task-select"],
    queryFn: async () => (await api.get<Paginated<TeamMember>>("/team-members")).data.results,
    enabled: can("Team Members", "view"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["plan-items", projectId] });
  };

  const create = useMutation({
    mutationFn: async () => api.post("/tasks", toCreatePayload(newTask, projectId)),
    onSuccess: () => {
      setNewTask(EMPTY_TASK);
      setAdding(false);
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/tasks/${id}`, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: async (id: number) => api.delete(`/tasks/${id}`), onSuccess: invalidate });
  const claim = useMutation({ mutationFn: async (id: number) => api.post(`/tasks/${id}/claim`), onSuccess: invalidate });

  const canCreate = can("Task", "create");
  const canFullEdit = can("Task", "edit") && isVerifier;
  const canDelete = can("Task", "delete");
  const hasFilters = !!(search || statusFilter || stateFilter || assigneeFilter);
  const anyError = update.error || remove.error || claim.error || create.error;
  const stageGroups = useMemo(
    () => STATES.map((state) => ({
      state,
      tasks: (data?.results ?? [])
        .filter((task) => task.state === state)
        .sort((left, right) => STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status]),
    })).filter((group) => group.tasks.length > 0),
    [data],
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setStateFilter("");
    setAssigneeFilter("");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_170px_180px_auto_auto]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <label className="sr-only" htmlFor="project-task-search">ค้นหางาน</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
          <input
            id="project-task-search"
            className="ui-input w-full pl-9 pr-9"
            type="search"
            placeholder="ค้นหาชื่องาน รายละเอียด หรือผู้รับผิดชอบ"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
          {search ? (
            <button className="absolute right-0 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-btn text-txt-faint hover:text-txt-strong" onClick={() => { setSearch(""); setPage(1); }} aria-label="ล้างคำค้น">
              <X size={14} />
            </button>
          ) : null}
        </div>

        <select className="ui-input w-full" aria-label="กรอง Stage" value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setPage(1); }}>
          <option value="">ทุก Stage</option>
          {STATES.map((state) => <option key={state} value={state}>{TASK_STATE_LABEL[state]}</option>)}
        </select>
        <select className="ui-input w-full" aria-label="กรองสถานะ" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABEL[status]}</option>)}
        </select>
        <select className="ui-input w-full" aria-label="กรองผู้รับผิดชอบ" value={assigneeFilter} onChange={(event) => { setAssigneeFilter(event.target.value); setPage(1); }}>
          <option value="">ทุกผู้รับผิดชอบ</option>
          <option value="me">งานของฉัน</option>
          <option value="backlog">ยังไม่มีผู้รับผิดชอบ (Backlog)</option>
          {(members ?? []).map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
        </select>
        <button className="ui-btn-ghost h-10 justify-center px-3 disabled:opacity-40" disabled={!hasFilters} onClick={clearFilters} title="ล้างตัวกรอง">
          <FilterX size={16} /> <span className="xl:hidden">ล้างตัวกรอง</span>
        </button>
        {canCreate ? (
          <button className="ui-btn-primary h-10 justify-center sm:col-span-2 xl:col-span-1" onClick={() => setAdding((value) => !value)}>
            <Plus size={16} /> {adding ? "ปิดฟอร์ม" : "เพิ่มงาน"}
          </button>
        ) : null}
      </div>

      {adding && canCreate ? (
        <section className="rounded-card border border-line bg-panel p-4" aria-label="เพิ่มงานใหม่">
          <TaskFormFields form={newTask} members={members ?? []} onChange={setNewTask} showStatus={false} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="ui-btn-ghost" onClick={() => { setAdding(false); setNewTask(EMPTY_TASK); }}>ยกเลิก</button>
            <button className="ui-btn-primary" disabled={!newTask.title.trim() || create.isPending} onClick={() => create.mutate()}>บันทึกงาน</button>
          </div>
        </section>
      ) : null}

      {anyError ? (
        <div className="rounded-btn border px-3 py-2 text-sm text-danger" style={{ background: "rgba(225,29,72,.08)", borderColor: "rgba(225,29,72,.2)" }}>{errorText(anyError)}</div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-xs text-txt-dim">
        <span>{data ? `พบ ${data.count.toLocaleString("th-TH")} งาน` : "รายการงาน"}</span>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading ? <span>กำลังอัปเดต…</span> : null}
          <div className="flex overflow-hidden rounded-btn border border-line">
            <button
              className={"grid h-9 w-9 place-items-center " + (view === "list" ? "bg-panel text-accent" : "text-txt-faint hover:text-txt-strong")}
              onClick={() => setView("list")}
              aria-label="มุมมองรายการ"
              title="มุมมองรายการ"
            >
              <List size={15} />
            </button>
            <button
              className={"grid h-9 w-9 place-items-center border-l border-line " + (view === "board" ? "bg-panel text-accent" : "text-txt-faint hover:text-txt-strong")}
              onClick={() => setView("board")}
              aria-label="มุมมองบอร์ด"
              title="มุมมองบอร์ด (ลากเปลี่ยนสถานะ)"
            >
              <Kanban size={15} />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? <LoadingList /> : null}
      {isError ? <div className="rounded-card border border-line px-4 py-6 text-center text-sm text-danger">โหลดรายการงานไม่สำเร็จ กรุณาลองใหม่</div> : null}

      {data && data.results.length > 0 && view === "board" ? (
        <TaskBoard
          tasks={data.results}
          isVerifier={isVerifier}
          currentUserId={me?.id ?? null}
          saving={update.isPending}
          onStatus={(id, status) => update.mutate({ id, body: { status } })}
        />
      ) : null}

      {data && data.results.length > 0 && view === "list" ? (
        <div className="flex flex-col gap-5">
          {stageGroups.map((group) => (
            <section key={group.state} aria-labelledby={`task-stage-${group.state}`}>
              <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
                <h3 id={`task-stage-${group.state}`} className="font-bold text-txt-strong">{TASK_STATE_LABEL[group.state]}</h3>
                <span className="text-xs text-txt-dim">{group.tasks.length.toLocaleString("th-TH")} งาน</span>
              </div>
              <div className="flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-card lg:border lg:border-line">
                <div className="hidden grid-cols-[minmax(260px,2fr)_minmax(150px,1fr)_180px_70px_150px] gap-3 border-b border-line bg-panel px-4 py-3 text-xs font-semibold text-txt-faint lg:grid">
                  <span>งาน</span><span>ผู้รับผิดชอบ</span><span>สถานะ</span><span>MD</span><span />
                </div>
                {group.tasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    members={members ?? []}
                    isVerifier={isVerifier}
                    currentUserId={me?.id ?? null}
                    canFullEdit={canFullEdit}
                    canDelete={canDelete}
                    saving={update.isPending}
                    actionBusy={claim.isPending}
                    deleting={remove.isPending}
                    onStatus={(status) => update.mutate({ id: task.id, body: { status } })}
                    onSave={(body) => update.mutate({ id: task.id, body })}
                    onDelete={() => remove.mutate(task.id)}
                    onClaim={() => claim.mutate(task.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {data && data.results.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-line px-4 py-8 text-center">
          <ListTodo size={24} className="mb-2 text-txt-faint" />
          <div className="font-semibold text-txt-strong">{hasFilters ? "ไม่พบงานที่ตรงกับตัวกรอง" : "โครงการนี้ยังไม่มีงาน"}</div>
          <div className="mt-1 text-sm text-txt-dim">{hasFilters ? "ลองเปลี่ยนคำค้นหรือเคลียร์ตัวกรอง" : "เพิ่มงานแรกเพื่อเริ่มติดตามการทำงาน"}</div>
          {hasFilters ? <button className="ui-btn-ghost mt-4" onClick={clearFilters}><FilterX size={15} /> ล้างตัวกรอง</button> : null}
        </div>
      ) : null}

      {view === "list" && data && (data.previous || data.next) ? (
        <div className="flex items-center justify-center gap-3">
          <button className="ui-btn-ghost h-9 w-9 justify-center px-0" disabled={!data.previous || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="หน้าก่อนหน้า" title="หน้าก่อนหน้า">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-txt-dim">หน้า {page.toLocaleString("th-TH")}</span>
          <button className="ui-btn-ghost h-9 w-9 justify-center px-0" disabled={!data.next || isFetching} onClick={() => setPage((value) => value + 1)} aria-label="หน้าถัดไป" title="หน้าถัดไป">
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Kanban: columns by status, drag a card to change status (same rules as the
    list — verifier moves anything, others only their own; verified is
    verifier-only). */
function TaskBoard({
  tasks, isVerifier, currentUserId, saving, onStatus,
}: {
  tasks: Task[];
  isVerifier: boolean;
  currentUserId: number | null;
  saving: boolean;
  onStatus: (id: number, status: TaskStatusKey) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<TaskStatusKey | null>(null);
  const dragTask = tasks.find((t) => t.id === dragId) ?? null;

  const canMove = (task: Task) => isVerifier || task.assigned_to === currentUserId;
  const canDropTo = (status: TaskStatusKey) => status !== "verified" || isVerifier;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {STATUSES.map((status) => {
        const colTasks = tasks.filter((t) => t.status === status);
        const droppable = dragTask != null && canDropTo(status) && dragTask.status !== status;
        return (
          <section
            key={status}
            aria-label={TASK_STATUS_LABEL[status]}
            className={
              "flex min-h-40 flex-col rounded-card border bg-panel/50 " +
              (overCol === status && droppable ? "border-accent" : "border-line")
            }
            onDragOver={(e) => {
              if (droppable) {
                e.preventDefault();
                setOverCol(status);
              }
            }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              if (dragTask && droppable && !saving) {
                if (status === "verified") burstAt(e.clientX, e.clientY);
                onStatus(dragTask.id, status);
              }
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-xs font-bold" style={{ color: TASK_STATUS_COLOR[status] }}>
                ● {TASK_STATUS_LABEL[status]}
              </span>
              <span className="text-2xs text-txt-faint">{colTasks.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {colTasks.map((task) => {
                const movable = canMove(task);
                const isOverdue = !!task.scheduled_date && task.scheduled_date < localToday() && !["done", "verified"].includes(task.status);
                return (
                  <article
                    key={task.id}
                    draggable={movable && !saving}
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className={
                      "rounded-btn border border-line bg-card p-2.5 text-sm shadow-sm " +
                      (movable ? "cursor-grab active:cursor-grabbing " : "opacity-80 ") +
                      (dragId === task.id ? "opacity-40" : "")
                    }
                    title={movable ? "ลากไปคอลัมน์อื่นเพื่อเปลี่ยนสถานะ" : "แก้สถานะได้เฉพาะงานของตัวเอง"}
                  >
                    <div className="break-words font-semibold text-txt-strong">{task.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-2xs text-txt-faint">
                      <span>{task.assigned_to_name || "Backlog"}</span>
                      {task.estimated_manday && <span>{task.estimated_manday} md</span>}
                      {task.scheduled_date && (
                        <span className={isOverdue ? "font-bold text-danger" : ""}>
                          {formatDate(task.scheduled_date)}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskListItem({
  task,
  members,
  isVerifier,
  currentUserId,
  canFullEdit,
  canDelete,
  saving,
  actionBusy,
  deleting,
  onStatus,
  onSave,
  onDelete,
  onClaim,
}: {
  task: Task;
  members: TeamMember[];
  isVerifier: boolean;
  currentUserId: number | null;
  canFullEdit: boolean;
  canDelete: boolean;
  saving: boolean;
  actionBusy: boolean;
  deleting: boolean;
  onStatus: (status: TaskStatusKey) => void;
  onSave: (body: Record<string, unknown>) => void;
  onDelete: () => void;
  onClaim: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TaskForm>(() => toTaskForm(task));
  const statusOptions = isVerifier ? STATUSES : STATUSES.filter((status) => status !== "verified");
  const canChangeStatus = isVerifier || task.assigned_to === currentUserId;
  const isOverdue = !!task.scheduled_date && task.scheduled_date < localToday() && !["done", "verified"].includes(task.status);

  useEffect(() => setDraft(toTaskForm(task)), [task]);

  return (
    <article className="overflow-hidden rounded-card border border-line bg-card lg:rounded-none lg:border-0 lg:border-b lg:last:border-b-0">
      {editing ? (
        <div className="p-4">
          <TaskFormFields form={draft} members={members} onChange={setDraft} showStatus allowUnassigned={task.assigned_to == null} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="ui-btn-ghost" onClick={() => { setDraft(toTaskForm(task)); setEditing(false); }}>ยกเลิก</button>
            <button className="ui-btn-primary" disabled={!draft.title.trim() || saving} onClick={() => { onSave(toUpdatePayload(draft)); setEditing(false); }}>บันทึก</button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 lg:grid-cols-[minmax(260px,2fr)_minmax(150px,1fr)_180px_70px_150px] lg:items-center lg:gap-3 lg:py-3">
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <button className="flex w-full items-start gap-1.5 text-left" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
                {expanded ? <ChevronDown size={15} className="mt-0.5 shrink-0 text-txt-faint" /> : <ChevronRight size={15} className="mt-0.5 shrink-0 text-txt-faint" />}
                <span className="min-w-0">
                  <span className="block break-words font-semibold text-txt-strong">{task.title}</span>
                  {task.scheduled_date ? (
                    <span className={`mt-1 inline-flex items-center gap-1 text-xs ${isOverdue ? "font-semibold text-danger" : "text-txt-faint"}`}>
                      <CalendarDays size={12} /> กำหนดส่ง {formatDate(task.scheduled_date)}{isOverdue ? " · เกินกำหนด" : ""}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
            <div className="min-w-0">
              <MobileLabel>ผู้รับผิดชอบ</MobileLabel>
              <span className={task.assigned_to_name ? "break-words text-sm text-txt-dim" : "text-sm text-txt-faint"}>{task.assigned_to_name || "ยังไม่มีผู้รับผิดชอบ (Backlog)"}</span>
            </div>
            <div className="col-span-2 row-start-3 lg:col-span-1 lg:row-auto">
              <MobileLabel>สถานะ</MobileLabel>
              {canChangeStatus ? (
                <select
              className="task-status-control min-h-10 w-full rounded-btn border border-line bg-field px-2 py-1.5 text-sm font-semibold outline-none focus:border-accent"
                  style={{ color: TASK_STATUS_COLOR[task.status] }}
                  value={task.status}
                  disabled={saving}
                  onChange={(event) => {
                    if (event.target.value === "verified") {
                      const r = event.target.getBoundingClientRect();
                      burstAt(r.left + r.width / 2, r.top);
                    }
                    onStatus(event.target.value as TaskStatusKey);
                  }}
                  aria-label={`สถานะของ ${task.title}`}
                >
                  {statusOptions.map((status) => <option key={status} value={status}>{TASK_STATUS_LABEL[status]}</option>)}
                </select>
              ) : (
                <span className="text-sm font-semibold" style={{ color: TASK_STATUS_COLOR[task.status] }}>● {TASK_STATUS_LABEL[task.status]}</span>
              )}
            </div>
            <div className="col-start-2 row-start-2 lg:col-auto lg:row-auto">
              <MobileLabel>Estimated MD</MobileLabel>
              <span className="text-sm text-txt-dim">{task.estimated_manday || "—"}</span>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1.5 lg:col-span-1">
              {task.assigned_to == null ? (
                <button className="inline-flex min-h-10 items-center gap-1 rounded-btn px-3 text-xs font-semibold text-accent hover:bg-field disabled:opacity-40" disabled={actionBusy} onClick={onClaim} title="รับเป็นงานของฉัน">
                  <UserPlus size={14} /> รับงานนี้
                </button>
              ) : null}
              {canFullEdit ? <button className="ui-icon-action" onClick={() => setEditing(true)} aria-label={`แก้ไข ${task.title}`} title="แก้ไข"><Pencil size={16} /></button> : null}
              {canDelete ? (
                <button
                  className="ui-icon-action hover:text-danger"
                  disabled={deleting}
                  onClick={() => { if (window.confirm(`ยืนยันลบงาน “${task.title}”?`)) onDelete(); }}
                  aria-label={`ลบ ${task.title}`}
                  title="ลบ"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          </div>

          {expanded ? (
            <div className="border-t border-line bg-panel px-4 py-3 text-sm text-txt-dim">
              <div className="whitespace-pre-wrap break-words">{task.detail || "ไม่มีรายละเอียดเพิ่มเติม"}</div>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
