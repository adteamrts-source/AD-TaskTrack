import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { PlanRevision } from "../../lib/types";

export default function RevisionList({ itemId }: { itemId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["plan-revisions", itemId],
    queryFn: async () => (await api.get<PlanRevision[]>(`/plan-items/${itemId}/revisions`)).data,
  });
  if (isLoading) return <div className="text-2xs text-txt-faint">กำลังโหลด revision…</div>;
  if (isError) return <div className="text-2xs text-txt-faint">โหลด revision ไม่สำเร็จ</div>;
  if (!data?.length) return <div className="text-2xs text-txt-faint">ยังไม่มี revision</div>;
  return (
    <div className="flex flex-col gap-1 text-2xs text-txt-dim">
      {data.map((rev) => (
        <div key={rev.id} className="flex flex-wrap gap-x-3">
          <strong className="text-txt-strong">{rev.field_name}</strong>
          <span>{rev.old_value || "—"} → {rev.new_value || "—"}</span>
          <span>{rev.change_reason || "ไม่ระบุเหตุผล"}</span>
          <span className="text-txt-faint">{rev.changed_by_name || "system"}</span>
        </div>
      ))}
    </div>
  );
}
