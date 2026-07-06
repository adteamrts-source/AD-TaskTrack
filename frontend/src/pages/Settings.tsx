import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Table, Row, Cell } from "../components/ui";
import { type Holiday, type Paginated, type SystemSetting } from "../lib/types";

const SETTING_LABEL: Record<SystemSetting["key"], string> = {
  HOURS_PER_WORKING_DAY: "ชั่วโมงต่อ 1 working day",
  health_threshold_at_risk: "At risk threshold",
  health_threshold_delay: "Delay threshold",
};

function errorText(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "detail" in data) return String((data as { detail: string }).detail);
    const first = data && typeof data === "object" ? Object.entries(data)[0] : null;
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : String(first[1])}`;
  }
  return "ทำรายการไม่สำเร็จ";
}

export default function Settings() {
  const qc = useQueryClient();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [holidayForm, setHolidayForm] = useState({ holiday_date: "", name: "", type: "public" as Holiday["type"] });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get<SystemSetting[]>("/system-settings")).data,
  });
  const { data: holidays, isLoading: holidaysLoading, isError: holidaysError } = useQuery({
    queryKey: ["holidays", year],
    queryFn: async () => {
      const data = (await api.get<Paginated<Holiday> | Holiday[]>("/holidays", { params: { year } })).data;
      return Array.isArray(data) ? data : data.results;
    },
  });

  const patchSetting = useMutation({
    mutationFn: async (body: Pick<SystemSetting, "key" | "value">) => api.patch<SystemSetting>("/system-settings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
  const invalidateHol = () => {
    qc.invalidateQueries({ queryKey: ["holidays"] });
    qc.invalidateQueries({ queryKey: ["working-days"] });
  };
  const createHoliday = useMutation({
    mutationFn: async () => api.post<Holiday>("/holidays", holidayForm),
    onSuccess: () => { setHolidayForm({ holiday_date: "", name: "", type: "public" }); invalidateHol(); },
  });
  const patchHoliday = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<Holiday> }) => api.patch(`/holidays/${id}`, body),
    onSuccess: invalidateHol,
  });
  const deleteHoliday = useMutation({ mutationFn: async (id: number) => api.delete(`/holidays/${id}`), onSuccess: invalidateHol });

  function submitHoliday(event: FormEvent) {
    event.preventDefault();
    if (holidayForm.holiday_date && holidayForm.name.trim()) createHoliday.mutate();
  }

  return (
    <div>
      <PageHeader title="ตั้งค่าระบบ" subtitle="จัดการ working day calendar และค่าที่ใช้คำนวณ manday / project health" />

      <section className="ui-card mb-5 p-5">
        <h2 className="text-lg font-bold text-txt-strong">System Settings</h2>
        <p className="mb-4 text-sm text-txt-dim">ค่ากลางที่มีผลกับ manday และ health calculation</p>
        {settingsLoading && <p className="text-sm text-txt-dim">กำลังโหลด settings…</p>}
        {patchSetting.isError && <div className="mb-2 text-sm text-danger">{errorText(patchSetting.error)}</div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {settings?.map((setting) => (
            <SettingRow key={setting.key} setting={setting} saving={patchSetting.isPending} onSave={(value) => patchSetting.mutate({ key: setting.key, value })} />
          ))}
        </div>
      </section>

      <section className="ui-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-txt-strong">วันหยุด / Working Days</h2>
            <p className="text-sm text-txt-dim">วันหยุดจะไม่ถูกนับเป็น working day และ daily task จะ default เป็น OT</p>
          </div>
          <input className="ui-input w-full sm:w-24" inputMode="numeric" aria-label="ปี" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>

        <form className="mb-4 flex flex-wrap items-center gap-2" onSubmit={submitHoliday}>
          <input className="ui-input w-full sm:w-auto" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })} />
          <input className="ui-input w-full flex-1" placeholder="ชื่อวันหยุด" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} />
          <select className="ui-input w-full sm:w-auto" value={holidayForm.type} onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as Holiday["type"] })}>
            <option value="public">วันหยุดราชการ</option>
            <option value="company">วันหยุดบริษัท</option>
          </select>
          <button className="ui-btn-primary w-full sm:w-auto" disabled={!holidayForm.holiday_date || !holidayForm.name.trim() || createHoliday.isPending}>
            <Plus size={15} /> เพิ่มวันหยุด
          </button>
        </form>
        {(createHoliday.isError || patchHoliday.isError || deleteHoliday.isError) && (
          <div className="mb-2 text-sm text-danger">{errorText(createHoliday.error || patchHoliday.error || deleteHoliday.error)}</div>
        )}
        {holidaysLoading && <p className="text-sm text-txt-dim">กำลังโหลดวันหยุด…</p>}
        {holidaysError && <p className="text-sm text-txt-dim">โหลดวันหยุดไม่สำเร็จ</p>}

        {holidays && (
          <Table columns={["วันที่", "ชื่อ", "ประเภท", ""]}>
            {holidays.map((holiday) => (
              <HolidayRow
                key={holiday.id}
                holiday={holiday}
                saving={patchHoliday.isPending}
                deleting={deleteHoliday.isPending}
                onSave={(body) => patchHoliday.mutate({ id: holiday.id, body })}
                onDelete={() => deleteHoliday.mutate(holiday.id)}
              />
            ))}
            {holidays.length === 0 && <Row><Cell colSpan={4} className="text-center text-txt-faint">ยังไม่มีวันหยุดในปีนี้</Cell></Row>}
          </Table>
        )}
      </section>
    </div>
  );
}

function SettingRow({ setting, saving, onSave }: { setting: SystemSetting; saving: boolean; onSave: (value: string) => void }) {
  const [value, setValue] = useState(setting.value);
  useEffect(() => setValue(setting.value), [setting.value]);
  const dirty = value !== setting.value;
  return (
    <div className="rounded-card border border-line bg-panel p-3">
      <div className="text-sm font-bold text-txt-strong">{SETTING_LABEL[setting.key]}</div>
      <div className="mb-2 text-2xs text-txt-faint">{setting.key}</div>
      <div className="flex gap-2">
        <input className="ui-input flex-1" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="ui-btn-ghost" disabled={!dirty || saving} onClick={() => onSave(value)}>บันทึก</button>
      </div>
    </div>
  );
}

function HolidayRow({
  holiday, saving, deleting, onSave, onDelete,
}: {
  holiday: Holiday;
  saving: boolean;
  deleting: boolean;
  onSave: (body: Partial<Holiday>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ holiday_date: holiday.holiday_date, name: holiday.name, type: holiday.type });
  useEffect(() => setDraft({ holiday_date: holiday.holiday_date, name: holiday.name, type: holiday.type }), [holiday]);

  if (editing) {
    return (
      <Row>
        <Cell colSpan={4}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[160px_minmax(180px,1fr)_160px_auto_auto] lg:items-center">
            <input className="ui-input w-full" type="date" value={draft.holiday_date} onChange={(e) => setDraft({ ...draft, holiday_date: e.target.value })} />
            <input className="ui-input w-full" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <select className="ui-input w-full" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Holiday["type"] })}>
              <option value="public">วันหยุดราชการ</option>
              <option value="company">วันหยุดบริษัท</option>
            </select>
            <button className="ui-btn-ghost w-full" onClick={() => setEditing(false)}>ยกเลิก</button>
            <button className="ui-btn-primary w-full" disabled={!draft.name.trim() || saving} onClick={() => { onSave(draft); setEditing(false); }}>บันทึก</button>
          </div>
        </Cell>
      </Row>
    );
  }
  return (
    <Row>
      <Cell label="วันที่" className="font-semibold text-txt-strong">{holiday.holiday_date}</Cell>
      <Cell label="ชื่อ" className="text-txt-dim">{holiday.name}</Cell>
      <Cell label="ประเภท"><span className="ui-pill border border-line bg-card text-txt-dim">{holiday.type === "public" ? "ราชการ" : "บริษัท"}</span></Cell>
      <Cell label="จัดการ">
        <div className="flex items-center justify-end gap-3">
          <button className="ui-icon-action" onClick={() => setEditing(true)} aria-label="แก้ไข"><Pencil size={16} /></button>
          <button className="ui-icon-action hover:text-danger" disabled={deleting} onClick={onDelete} aria-label="ลบ"><Trash2 size={16} /></button>
        </div>
      </Cell>
    </Row>
  );
}
