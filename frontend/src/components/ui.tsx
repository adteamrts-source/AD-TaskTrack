import { useMemo, type ReactNode } from "react";
import { Astronaut, pickLoadingMessage } from "./gimmicks/Gimmicks";
import {
  HEALTH_LABEL,
  HEALTH_COLOR,
  PHASE_LABEL,
  type HealthStatus,
  type ProjectPhase,
} from "../lib/types";

/** Consistent page header (title + subtitle + optional action). */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-txt-strong">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-txt-dim">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ui-card min-w-0 p-5 ${className}`}>{children}</div>;
}

/** Generic colored pill badge (TailAdmin-style). */
export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  if (!color) return <span className="ui-pill border border-line bg-warn-bg text-accent">{children}</span>;
  return (
    <span className="ui-pill" style={{ color, background: "var(--card)", border: "1px solid var(--line)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return <Badge color={HEALTH_COLOR[status]}>{HEALTH_LABEL[status]}</Badge>;
}

export function PhaseTag({ phase }: { phase: ProjectPhase }) {
  return (
    <span className="ui-pill border border-line bg-warn-bg text-accent">{PHASE_LABEL[phase]}</span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  mascot = "float",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  mascot?: "float" | "search" | "shield" | null;
}) {
  return (
    <Card className="text-center">
      {mascot && <div className="flex justify-center"><Astronaut pose={mascot} /></div>}
      <p className="text-base font-bold text-txt-strong">{title}</p>
      {hint && <p className="mt-1 text-sm text-txt-dim">{hint}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-3">{action}</div>}
    </Card>
  );
}

/** TailAdmin-style data table — pass column headers + <Row>/<Cell> children. */
export function Table({ columns, children }: { columns: ReactNode[]; children: ReactNode }) {
  return (
    <div className="ui-card responsive-table-wrap">
      <table className="responsive-table w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-panel text-left text-2xs uppercase tracking-wide text-txt-faint">
            {columns.map((c, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-b border-line last:border-0 ${className}`}>{children}</tr>;
}

export function Cell({
  children,
  className = "",
  colSpan,
  label,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
  label?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      data-label={label}
      data-full={colSpan && colSpan > 1 ? "true" : undefined}
      className={`px-4 py-3 align-middle ${className}`}
    >
      {children}
    </td>
  );
}

/** Underline tabs (TailAdmin-style). */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-nowrap gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={
              "min-h-11 shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition " +
              (on ? "border-accent text-accent" : "border-transparent text-txt-dim hover:text-txt-strong")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Loading skeleton — replaces bare "กำลังโหลด…" text (feels faster). */
export function Skeleton({ rows = 3 }: { rows?: number; card?: boolean }) {
  const msg = useMemo(pickLoadingMessage, []);
  return (
    <div aria-label="กำลังโหลด" role="status">
      <div className="flex animate-pulse flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-16 rounded-card bg-panel" />
        ))}
      </div>
      <p className="mt-2 text-center text-2xs text-txt-faint">{msg}</p>
    </div>
  );
}

/** Small definition field for detail panels. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wide text-txt-faint">{label}</div>
      <div className="mt-0.5 font-semibold text-txt-strong">{value}</div>
    </div>
  );
}
