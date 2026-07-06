import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Plus, Search, Pencil } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader, Table, Row, Cell } from "../components/ui";
import { type Client, type Paginated } from "../lib/types";

type ClientForm = { client_name: string; client_abbreviation: string; client_website: string; is_active: boolean };
const EMPTY_CLIENT: ClientForm = { client_name: "", client_abbreviation: "", client_website: "", is_active: true };

function errorText(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "detail" in data) return String((data as { detail: string }).detail);
    const first = data && typeof data === "object" ? Object.entries(data)[0] : null;
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : String(first[1])}`;
  }
  return "ทำรายการไม่สำเร็จ";
}

export default function Clients() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("true");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_CLIENT);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["clients-master", { search, active }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (active) params.active = active;
      return (await api.get<Paginated<Client>>("/clients", { params })).data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["clients-master"] });
  };

  const create = useMutation({
    mutationFn: async () =>
      api.post<Client>("/clients", {
        client_name: form.client_name.trim(),
        client_abbreviation: form.client_abbreviation.trim() || null,
        client_website: form.client_website.trim(),
        is_active: form.is_active,
      }),
    onSuccess: () => { setForm(EMPTY_CLIENT); setAdding(false); refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: ClientForm }) =>
      api.patch(`/clients/${id}`, {
        client_name: body.client_name.trim(),
        client_abbreviation: body.client_abbreviation.trim() || null,
        client_website: body.client_website.trim(),
        is_active: body.is_active,
      }),
    onSuccess: refresh,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (form.client_name.trim()) create.mutate();
  }

  const canCreate = can("Client Master", "create");
  const canEdit = can("Client Master", "edit");

  return (
    <div>
      <PageHeader
        title="Client Master"
        subtitle="จัดการรายชื่อลูกค้าที่ใช้ใน project และ daily work"
        action={canCreate && (
          <button className="ui-btn-primary" onClick={() => setAdding((v) => !v)}>
            <Plus size={16} /> {adding ? "ปิดฟอร์ม" : "เพิ่มลูกค้า"}
          </button>
        )}
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
          <input className="ui-input w-full pl-9" placeholder="ค้นหาชื่อ / ตัวย่อ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="ui-input w-full sm:w-auto" value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="">ทั้งหมด</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {adding && canCreate && (
        <form className="mb-4 grid gap-2 rounded-card border border-line bg-panel p-4 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_120px_minmax(180px,1fr)_auto_auto] lg:items-end" onSubmit={submit}>
          <ClientFields form={form} onChange={setForm} />
          <button className="ui-btn-primary w-full lg:w-auto" disabled={!form.client_name.trim() || create.isPending}>บันทึกลูกค้า</button>
          {create.isError && <div className="w-full text-sm text-danger">{errorText(create.error)}</div>}
        </form>
      )}
      {update.isError && <div className="mb-3 text-sm text-danger">{errorText(update.error)}</div>}
      {isLoading && <div className="ui-card p-5 text-sm text-txt-dim">กำลังโหลดลูกค้า…</div>}
      {isError && <div className="ui-card p-5 text-sm text-txt-dim">โหลดลูกค้าไม่สำเร็จ</div>}

      {data && (
        <Table columns={["ลูกค้า", "เว็บไซต์", "สถานะ", ""]}>
          {data.results.map((client) => (
            <ClientRow key={client.id} client={client} canEdit={canEdit} saving={update.isPending} onSave={(body) => update.mutate({ id: client.id, body })} />
          ))}
          {data.results.length === 0 && <Row><Cell colSpan={4} className="text-center text-txt-faint">ยังไม่มีลูกค้าตรงเงื่อนไข</Cell></Row>}
        </Table>
      )}
    </div>
  );
}

function ClientFields({ form, onChange }: { form: ClientForm; onChange: (form: ClientForm) => void }) {
  return (
    <>
      <input className="ui-input w-full" placeholder="ชื่อลูกค้า *" value={form.client_name} onChange={(e) => onChange({ ...form, client_name: e.target.value })} />
      <input className="ui-input w-full" placeholder="ตัวย่อ" value={form.client_abbreviation} onChange={(e) => onChange({ ...form, client_abbreviation: e.target.value })} />
      <input className="ui-input w-full" placeholder="เว็บไซต์" value={form.client_website} onChange={(e) => onChange({ ...form, client_website: e.target.value })} />
      <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-txt-dim">
        <input type="checkbox" checked={form.is_active} onChange={(e) => onChange({ ...form, is_active: e.target.checked })} /> Active
      </label>
    </>
  );
}

function ClientRow({ client, canEdit, saving, onSave }: { client: Client; canEdit: boolean; saving: boolean; onSave: (body: ClientForm) => void }) {
  const seed = (): ClientForm => ({
    client_name: client.client_name,
    client_abbreviation: client.client_abbreviation || "",
    client_website: client.client_website,
    is_active: client.is_active,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ClientForm>(seed);
  useEffect(() => setDraft(seed()), [client]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    return (
      <Row>
        <Cell colSpan={4}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_120px_minmax(180px,1fr)_auto_auto_auto] lg:items-center">
            <ClientFields form={draft} onChange={setDraft} />
            <button className="ui-btn-ghost w-full" onClick={() => setEditing(false)}>ยกเลิก</button>
            <button className="ui-btn-primary w-full" disabled={!draft.client_name.trim() || saving} onClick={() => { onSave(draft); setEditing(false); }}>บันทึก</button>
          </div>
        </Cell>
      </Row>
    );
  }

  return (
    <Row>
      <Cell label="ลูกค้า">
        <div className="font-bold text-txt-strong">{client.client_name}</div>
        <div className="text-2xs text-txt-faint">{client.client_abbreviation || "ไม่มีตัวย่อ"}</div>
      </Cell>
      <Cell label="เว็บไซต์" className="break-all text-txt-dim">{client.client_website || "—"}</Cell>
      <Cell label="สถานะ">
        <span className="ui-pill" style={{ color: client.is_active ? "var(--ok)" : "var(--txt-faint)", border: "1px solid var(--line)", background: "var(--card)" }}>
          {client.is_active ? "Active" : "Inactive"}
        </span>
      </Cell>
      <Cell label="จัดการ">
        {canEdit && (
          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
            <button className="ui-icon-action" onClick={() => setEditing(true)} aria-label="แก้ไข"><Pencil size={16} /></button>
            <button className="ui-btn-ghost h-10 px-3" disabled={saving} onClick={() => onSave({ ...seed(), is_active: !client.is_active })}>
              {client.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </div>
        )}
      </Cell>
    </Row>
  );
}
