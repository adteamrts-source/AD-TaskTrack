import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { Dependency, DependencyRelationType } from "../../lib/types";
import { RELATION_TYPES } from "./shared";

export default function DependencyEditor({
  dependency,
  predecessorName,
  busy,
  onSave,
  onRemove,
}: {
  dependency: Dependency;
  predecessorName: string | number;
  busy: boolean;
  onSave: (relation: DependencyRelationType, lag: number) => void;
  onRemove: () => void;
}) {
  const [relation, setRelation] = useState<DependencyRelationType>(dependency.relation_type);
  const [lag, setLag] = useState(String(dependency.lag_days));
  useEffect(() => {
    setRelation(dependency.relation_type);
    setLag(String(dependency.lag_days));
  }, [dependency.lag_days, dependency.relation_type]);

  const parsedLag = Number(lag || 0);
  const dirty = relation !== dependency.relation_type || parsedLag !== dependency.lag_days;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-btn border border-line bg-warn-bg p-1.5">
      <span className="px-1 text-xs font-semibold text-txt-strong">{predecessorName}</span>
      <select className="ui-input" value={relation} onChange={(e) => setRelation(e.target.value as DependencyRelationType)} disabled={busy} aria-label={`ชนิด dependency ของ ${predecessorName}`}>
        {RELATION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.short}</option>)}
      </select>
      <input className="ui-input w-20" type="number" value={lag} onChange={(e) => setLag(e.target.value)} disabled={busy} aria-label={`lag หรือ lead ของ ${predecessorName}`} />
      <button type="button" className="ui-icon-action text-accent" disabled={!dirty || busy} onClick={() => onSave(relation, parsedLag)} aria-label="บันทึก dependency" title="บันทึก dependency">
        <Check size={14} />
      </button>
      <button type="button" className="ui-icon-action hover:text-danger" disabled={busy} onClick={onRemove} aria-label="ลบ dependency" title="ลบ dependency">
        <X size={14} />
      </button>
    </div>
  );
}
