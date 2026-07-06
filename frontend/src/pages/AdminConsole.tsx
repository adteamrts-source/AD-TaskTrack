import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Plus, ExternalLink, FileCode2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Tabs, Table, Row, Cell } from "../components/ui";
import {
  type EmploymentType,
  type Paginated,
  type PermissionAction,
  type Role,
  type RolePermission,
  type UserAccount,
} from "../lib/types";

const ROLES: Role[] = ["admin", "dm", "bsa", "dev"];
const ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete"];
const MODULES = ["Projects", "Task", "Plan/Timeline", "Budget", "My Work", "Meeting Summary", "Client Master", "User Management", "Team Members"];
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", dm: "DM", bsa: "BSA", dev: "Dev" };
const ACTION_LABEL: Record<PermissionAction, string> = { view: "ดู", create: "สร้าง", edit: "แก้", delete: "ลบ" };

function djangoAdminUrl(): string {
  if (!import.meta.env.DEV) return "/admin/";
  const url = new URL(window.location.href);
  url.port = "8000";
  url.pathname = "/admin/";
  url.search = "";
  url.hash = "";
  return url.toString();
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

export default function AdminConsole() {
  const { can } = useAuth();
  const [tab, setTab] = useState("users");

  if (!can("User Management", "view")) {
    return (
      <div className="ui-card p-5">
        <strong className="text-txt-strong">บัญชีนี้ไม่มีสิทธิ์เข้า Admin Console</strong>
        <p className="text-sm text-txt-dim">ต้องมีสิทธิ์ User Management:view ตาม permission matrix</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin Console"
        subtitle="จัดการ allowlist ผู้ใช้และ permission matrix ของ ASTRO"
        action={
          <div className="flex flex-wrap gap-2">
            <a
              className="ui-btn-ghost"
              href="/api/external/v1/spec"
              title="เอกสาร spec สำหรับระบบภายนอกที่ส่ง project/task เข้า ASTRO"
            >
              <FileCode2 size={15} /> API Spec (ระบบภายนอก)
            </a>
            <a className="ui-btn-ghost" href={djangoAdminUrl()}><ExternalLink size={15} /> Django Admin</a>
          </div>
        }
      />
      <Tabs
        tabs={[{ key: "users", label: "ผู้ใช้ / Allowlist" }, { key: "permissions", label: "Permission Matrix" }]}
        active={tab}
        onChange={setTab}
      />
      {tab === "users" ? <UsersPanel /> : <PermissionsPanel canEdit={can("User Management", "edit")} />}
    </div>
  );
}

function UsersPanel() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const blank = { email: "", full_name: "", role: "dev" as Role, position: "", employment_type: "permanent" as EmploymentType, is_allowed: true };
  const [createForm, setCreateForm] = useState(blank);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-users", { search, role }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (role) params.role = role;
      return (await api.get<Paginated<UserAccount>>("/users", { params })).data;
    },
  });

  const createUser = useMutation({
    mutationFn: async () => api.post<UserAccount>("/users", createForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setCreateForm(blank);
      setShowCreate(false);
    },
  });
  const updateUser = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<UserAccount> }) => api.patch(`/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (createForm.email.trim()) createUser.mutate();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="ui-input min-w-[200px] flex-1" placeholder="ค้นหาชื่อหรืออีเมล" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="ui-input w-full sm:w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">ทุก role</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        {can("User Management", "create") && (
          <button className="ui-btn-primary" onClick={() => setShowCreate((v) => !v)}>
            <Plus size={16} /> {showCreate ? "ปิดฟอร์ม" : "เพิ่มผู้ใช้"}
          </button>
        )}
      </div>

      {showCreate && can("User Management", "create") && (
        <form className="grid gap-2 rounded-card border border-line bg-panel p-4 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_minmax(180px,1fr)_150px_150px_auto_auto] xl:items-end" onSubmit={submitCreate}>
          <input className="ui-input w-full" placeholder="อีเมล *" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          <input className="ui-input w-full" placeholder="ชื่อ" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} />
          <select className="ui-input w-full" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <select className="ui-input w-full" value={createForm.employment_type} onChange={(e) => setCreateForm({ ...createForm, employment_type: e.target.value as EmploymentType })}>
            <option value="permanent">Permanent</option>
            <option value="contractor">Contractor</option>
          </select>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-txt-dim">
            <input type="checkbox" checked={createForm.is_allowed} onChange={(e) => setCreateForm({ ...createForm, is_allowed: e.target.checked })} /> Login
          </label>
          <button className="ui-btn-primary w-full xl:w-auto" disabled={!createForm.email.trim() || createUser.isPending}>บันทึก</button>
          {createUser.isError && <div className="w-full text-sm text-danger">{errorText(createUser.error)}</div>}
        </form>
      )}

      {isLoading && <div className="ui-card p-5 text-sm text-txt-dim">กำลังโหลดผู้ใช้…</div>}
      {isError && <div className="ui-card p-5 text-sm text-txt-dim">โหลดผู้ใช้ไม่สำเร็จ</div>}
      {updateUser.isError && <div className="text-sm text-danger">{errorText(updateUser.error)}</div>}

      {data && (
        <Table columns={["ผู้ใช้", "ชื่อ", "Role", "ประเภท", "Login", ""]}>
          {data.results.map((user) => (
            <UserRow key={user.id} user={user} canEdit={can("User Management", "edit")} saving={updateUser.isPending} onSave={(body) => updateUser.mutate({ id: user.id, body })} />
          ))}
        </Table>
      )}
    </section>
  );
}

function UserRow({ user, canEdit, saving, onSave }: { user: UserAccount; canEdit: boolean; saving: boolean; onSave: (body: Partial<UserAccount>) => void }) {
  const seed = () => ({ full_name: user.full_name, role: user.role, position: user.position, employment_type: user.employment_type, is_allowed: user.is_allowed });
  const [draft, setDraft] = useState(seed);
  useEffect(() => setDraft(seed()), [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = useMemo(
    () => draft.full_name !== user.full_name || draft.role !== user.role || draft.position !== user.position || draft.employment_type !== user.employment_type || draft.is_allowed !== user.is_allowed,
    [draft, user],
  );

  return (
    <Row>
      <Cell label="ผู้ใช้">
        <div className="break-all font-bold text-txt-strong">{user.email}</div>
        <div className="text-2xs" style={{ color: user.is_allowed ? "var(--ok)" : "var(--danger)" }}>{user.is_allowed ? "Allowlisted" : "Blocked"}</div>
      </Cell>
      <Cell label="ชื่อ"><input className="ui-input w-full" value={draft.full_name} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Cell>
      <Cell label="Role">
        <select className="ui-input" value={draft.role} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </Cell>
      <Cell label="ประเภท">
        <select className="ui-input" value={draft.employment_type} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, employment_type: e.target.value as EmploymentType })}>
          <option value="permanent">Permanent</option>
          <option value="contractor">Contractor</option>
        </select>
      </Cell>
      <Cell label="Login"><input type="checkbox" checked={draft.is_allowed} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, is_allowed: e.target.checked })} /></Cell>
      <Cell label="จัดการ">
        {canEdit && (
          <button className="ui-btn-ghost h-10 px-3" disabled={!dirty || saving} onClick={() => onSave(draft)}>บันทึก</button>
        )}
      </Cell>
    </Row>
  );
}

function PermissionsPanel({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role>("admin");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => (await api.get<RolePermission[]>("/role-permissions")).data,
  });
  const toggle = useMutation({
    mutationFn: async (body: { role: Role; module: string; action: PermissionAction; allowed: boolean }) =>
      api.patch<RolePermission>("/role-permissions", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const lookup = useMemo(() => {
    const map = new Map<string, RolePermission>();
    data?.forEach((row) => map.set(`${row.role}:${row.module}:${row.action}`, row));
    return map;
  }, [data]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-txt-strong">Permission Matrix</h2>
          <p className="text-sm text-txt-dim">ทุกเมนูและ API ใช้ matrix นี้เป็น source of truth</p>
        </div>
        <select className="ui-input" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      {!canEdit && <p className="rounded-btn border border-line bg-field px-3 py-2 text-sm text-txt-dim">คุณดู matrix ได้ แต่ยังไม่มีสิทธิ์แก้ไข</p>}
      {toggle.isError && <div className="text-sm text-danger">{errorText(toggle.error)}</div>}
      {isLoading && <div className="ui-card p-5 text-sm text-txt-dim">กำลังโหลด matrix…</div>}
      {isError && <div className="ui-card p-5 text-sm text-txt-dim">โหลด matrix ไม่สำเร็จ</div>}
      {data && (
        <Table columns={["Module", ...ACTIONS.map((a) => ACTION_LABEL[a])]}>
          {MODULES.map((module) => (
            <Row key={module}>
              <Cell label="Module" className="font-semibold text-txt-strong">{module}</Cell>
              {ACTIONS.map((action) => {
                const allowed = !!lookup.get(`${selectedRole}:${module}:${action}`)?.allowed;
                return (
                  <Cell key={action} label={ACTION_LABEL[action]}>
                    <input
                      type="checkbox"
                      checked={allowed}
                      disabled={!canEdit || toggle.isPending}
                      onChange={(e) => toggle.mutate({ role: selectedRole, module, action, allowed: e.target.checked })}
                      aria-label={`${selectedRole} ${module} ${action}`}
                    />
                  </Cell>
                );
              })}
            </Row>
          ))}
        </Table>
      )}
    </section>
  );
}
