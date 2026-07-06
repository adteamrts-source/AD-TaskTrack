import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileBadge, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { type DependencyRelationType, type PlanItem, type PlanResponse } from "../lib/types";
import GanttChart from "./GanttChart";
import { Skeleton } from "./ui";
import PhaseSection from "./plan/PhaseSection";
import PlanItemDrawer, { type DrawerState, type PendingDep } from "./plan/PlanItemDrawer";
import { downloadPlanCsv, errorText } from "./plan/shared";
import "./plantab.css";

export default function PlanTab({ projectId }: { projectId: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["plan-items", projectId],
    queryFn: async () => (await api.get<PlanResponse>(`/projects/${projectId}/plan-items`)).data,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["plan-items", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const postDep = (pred: number, succ: number, relation: DependencyRelationType, lag: number) =>
    api.post(`/projects/${projectId}/dependencies`, { predecessor: pred, successor: succ, relation_type: relation, lag_days: lag });

  // Drawer create: item first, then its pending dependencies (ported sequence).
  const createItem = useMutation({
    mutationFn: async ({ payload, pendingDeps }: { payload: Record<string, unknown>; pendingDeps: PendingDep[] }) => {
      const res = await api.post<{ id: number }>(`/projects/${projectId}/plan-items`, payload);
      const newId = res.data.id;
      for (const d of pendingDeps) await postDep(d.pred, newId, d.relation, d.lag);
      return res;
    },
    onSuccess: () => { refresh(); setDrawer(null); },
  });
  const quickAdd = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post(`/projects/${projectId}/plan-items`, payload),
    onSuccess: refresh,
  });
  const updateItem = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/plan-items/${id}`, body),
    onSuccess: () => { refresh(); setDrawer(null); },
  });
  const deleteItem = useMutation({ mutationFn: async (id: number) => api.delete(`/plan-items/${id}`), onSuccess: refresh });
  const addDep = useMutation({
    mutationFn: async ({ pred, succ, relation, lag = 0 }: { pred: number; succ: number; relation: DependencyRelationType; lag?: number }) =>
      postDep(pred, succ, relation, lag),
    onSuccess: refresh,
  });
  const updateDep = useMutation({
    mutationFn: async ({ id, relation_type, lag_days }: { id: number; relation_type: DependencyRelationType; lag_days: number }) =>
      api.patch(`/dependencies/${id}`, { relation_type, lag_days }),
    onSuccess: refresh,
  });
  const removeDep = useMutation({ mutationFn: async (id: number) => api.delete(`/dependencies/${id}`), onSuccess: refresh });
  const generate = useMutation({
    mutationFn: async () =>
      (await api.post<{ count: number; skipped: number }>(
        `/projects/${projectId}/tasks/generate`,
        { mode: "all", state: "development" },
      )).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks", projectId] }); refresh(); },
  });

  // Group items by phase (in order of appearance) for per-phase sections.
  const phaseGroups = useMemo(() => {
    const groups: { phase: string; items: PlanItem[]; total: number }[] = [];
    const idxByPhase = new Map<string, number>();
    for (const it of data?.items ?? []) {
      let i = idxByPhase.get(it.phase);
      if (i === undefined) { i = groups.length; idxByPhase.set(it.phase, i); groups.push({ phase: it.phase, items: [], total: 0 }); }
      groups[i].items.push(it);
      groups[i].total += Number(it.manday || 0);
    }
    return groups;
  }, [data]);

  if (isLoading) return <Skeleton rows={3} />;
  if (isError || !data) return <p className="text-sm text-txt-dim">โหลดแผนงานไม่สำเร็จ</p>;

  const canCreate = can("Plan/Timeline", "create");
  const canEdit = can("Plan/Timeline", "edit");
  const canDelete = can("Plan/Timeline", "delete");
  const canGenTasks = can("Task", "create");

  const listError =
    quickAdd.isError || deleteItem.isError || generate.isError
      ? errorText(quickAdd.error || deleteItem.error || generate.error)
      : null;
  const drawerError =
    createItem.isError || updateItem.isError || addDep.isError || updateDep.isError || removeDep.isError
      ? errorText(createItem.error || updateItem.error || addDep.error || updateDep.error || removeDep.error)
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-txt-dim">รวม manday ทั้งโครงการ: <strong className="text-accent">{data.total_manday}</strong></div>
        <div className="flex flex-wrap gap-2">
          <button className="ui-btn-ghost" onClick={() => window.open(`/api/projects/${projectId}/plan/export?format=xlsx`)}><FileSpreadsheet size={15} /> Excel</button>
          <button className="ui-btn-ghost" onClick={() => window.open(`/api/projects/${projectId}/plan/export?format=pdf`)}><FileText size={15} /> PDF</button>
          <button className="ui-btn-ghost" onClick={() => downloadPlanCsv(projectId, data)}><FileDown size={15} /> CSV</button>
          <button
            className="ui-btn-ghost"
            onClick={() => window.open(`/api/projects/${projectId}/progress-report`)}
            title="เอกสารอัปเดตความคืบหน้าสำหรับส่งลูกค้า (ไม่มีข้อมูลมูลค่าโครงการ)"
          >
            <FileBadge size={15} /> รายงานลูกค้า (PDF)
          </button>
          {canGenTasks && data.items.length > 0 && (
            <button
              className="ui-btn-ghost"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              title="สร้าง Task จากแผน — แผนที่มี Task อยู่แล้วจะถูกข้าม ไม่สร้างซ้ำ"
            >
              สร้าง Task จากแผน
            </button>
          )}
          {canCreate && (
            <button className="ui-btn-primary" onClick={() => setDrawer({ mode: "create" })}>
              <Plus size={16} /> เพิ่มรายการ / เฟสใหม่
            </button>
          )}
        </div>
      </div>

      {listError && <div className="text-sm text-danger">{listError}</div>}
      {generate.isSuccess && (
        <div className="text-sm text-txt-dim">
          สร้าง Task ใหม่ {generate.data.count} งาน
          {generate.data.skipped > 0 && ` · ข้าม ${generate.data.skipped} งานที่มี Task อยู่แล้ว (ไม่สร้างซ้ำ)`}
        </div>
      )}

      {phaseGroups.length === 0 && (
        <div className="ui-card p-6 text-center text-sm text-txt-faint">
          ยังไม่มีรายการแผนงาน{canCreate && " — กด \"เพิ่มรายการ / เฟสใหม่\" เพื่อเริ่มวางแผน"}
        </div>
      )}

      {phaseGroups.map((group) => (
        <PhaseSection
          key={group.phase}
          phase={group.phase}
          items={group.items}
          total={group.total}
          allItems={data.items}
          deps={data.dependencies}
          canEdit={canEdit}
          canDelete={canDelete}
          canCreate={canCreate}
          deleting={deleteItem.isPending}
          onEdit={(item) => setDrawer({ mode: "edit", item })}
          onDelete={(id) => deleteItem.mutate(id)}
          onQuickAdd={(payload) => quickAdd.mutate(payload)}
          quickAddPending={quickAdd.isPending}
        />
      ))}

      <div>
        <h3 className="mb-3 font-bold text-txt-strong">Gantt</h3>
        <GanttChart items={data.items} dependencies={data.dependencies} />
      </div>

      {drawer && (
        <PlanItemDrawer
          state={
            // Keep the drawer's edit target fresh after refetch (e.g. dep changes).
            drawer.mode === "edit"
              ? { mode: "edit", item: data.items.find((it) => it.id === drawer.item.id) ?? drawer.item }
              : drawer
          }
          allItems={data.items}
          deps={data.dependencies}
          saving={createItem.isPending || updateItem.isPending}
          depBusy={addDep.isPending || updateDep.isPending || removeDep.isPending}
          errorMessage={drawerError}
          onClose={() => setDrawer(null)}
          onCreate={(payload, pendingDeps) => createItem.mutate({ payload, pendingDeps })}
          onSave={(id, body) => updateItem.mutate({ id, body })}
          onAddDep={(pred, relation, lag) => {
            if (drawer.mode === "edit") addDep.mutate({ pred, succ: drawer.item.id, relation, lag });
          }}
          onUpdateDep={(depId, relation_type, lag_days) => updateDep.mutate({ id: depId, relation_type, lag_days })}
          onRemoveDep={(depId) => removeDep.mutate(depId)}
        />
      )}
    </div>
  );
}
