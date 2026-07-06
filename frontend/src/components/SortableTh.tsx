import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

/** Clickable table header for client-side sorting (shared by summary pages). */
export default function SortableTh<K extends string>({
  label, k, sortKey, sortDir, onSort, right = false,
}: {
  label: string;
  k: K;
  sortKey: K;
  sortDir: SortDir;
  onSort: (k: K) => void;
  right?: boolean;
}) {
  const active = k === sortKey;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={"px-4 py-2 font-semibold " + (right ? "text-right" : "")}>
      <button
        className={
          "inline-flex min-h-11 items-center gap-1 uppercase tracking-wide transition hover:text-accent " +
          (active ? "text-accent" : "")
        }
        onClick={() => onSort(k)}
        aria-label={`เรียงตาม${label}`}
      >
        {label} <Icon size={12} />
      </button>
    </th>
  );
}
