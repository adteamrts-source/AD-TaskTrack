// Shared plan-tab helpers — ported unchanged from the old PlanTab so payload
// shapes and error surfacing stay identical (API contracts are frozen).
import { AxiosError } from "axios";
import type { Dependency, DependencyRelationType, PlanItem, PlanResponse } from "../../lib/types";

export type PlanForm = {
  phase: string; task: string; manday: string; start_date: string; end_date: string;
  is_milestone: boolean; sort_order: string; change_reason: string;
};

export const EMPTY_FORM: PlanForm = {
  phase: "", task: "", manday: "", start_date: "", end_date: "", is_milestone: false, sort_order: "0", change_reason: "",
};

export const RELATION_TYPES: { value: DependencyRelationType; short: string; label: string }[] = [
  { value: "finish_to_start", short: "FS", label: "งานก่อนหน้าจบ → งานนี้เริ่ม" },
  { value: "start_to_start", short: "SS", label: "งานก่อนหน้าเริ่ม → งานนี้เริ่ม" },
  { value: "finish_to_finish", short: "FF", label: "งานก่อนหน้าจบ → งานนี้จบ" },
  { value: "start_to_finish", short: "SF", label: "งานก่อนหน้าเริ่ม → งานนี้จบ" },
];

export const relationShort = (value: DependencyRelationType) =>
  RELATION_TYPES.find((relation) => relation.value === value)?.short ?? value;

export function dependencyText(dependency: Dependency, predecessorName: string | number): string {
  const lag = dependency.lag_days > 0
    ? ` +${dependency.lag_days} วัน`
    : dependency.lag_days < 0
      ? ` ${dependency.lag_days} วัน`
      : "";
  return `${relationShort(dependency.relation_type)} · ${predecessorName}${lag}`;
}

export function errorText(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "detail" in data) return String((data as { detail: string }).detail);
    const first = data && typeof data === "object" ? Object.entries(data)[0] : null;
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : String(first[1])}`;
  }
  return "ทำรายการไม่สำเร็จ";
}

export function toForm(item: PlanItem): PlanForm {
  return {
    phase: item.phase, task: item.task, manday: item.manday || "",
    start_date: item.start_date || "", end_date: item.end_date || "",
    is_milestone: item.is_milestone, sort_order: String(item.sort_order), change_reason: "",
  };
}

export function buildPayload(form: PlanForm, includeReason: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    phase: form.phase.trim(), task: form.task.trim(), is_milestone: form.is_milestone, sort_order: Number(form.sort_order || 0),
  };
  payload.start_date = form.start_date || null;
  payload.end_date = form.end_date || null;
  payload.manday = form.manday && !(form.start_date && form.end_date) ? form.manday : null;
  if (includeReason) payload.change_reason = form.change_reason.trim();
  return payload;
}

export function downloadPlanCsv(projectId: string, data: PlanResponse) {
  const rows = [
    ["phase", "task", "start_date", "end_date", "manday", "progress", "milestone", "sort_order"],
    ...data.items.map((item) => [
      item.phase, item.task, item.start_date || "", item.end_date || "", item.manday || "",
      item.progress == null ? "" : String(Math.round(item.progress * 100)), item.is_milestone ? "yes" : "", String(item.sort_order),
    ]),
    [],
    ["dependency_predecessor", "dependency_successor", "relation_type", "lag_days"],
    ...data.dependencies.map((dep) => [String(dep.predecessor), String(dep.successor), dep.relation_type, String(dep.lag_days)]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).split('"').join('""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `project_${projectId}_plan.csv`; a.click();
  URL.revokeObjectURL(url);
}
