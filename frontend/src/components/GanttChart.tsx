import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Dependency, type PlanItem } from "../lib/types";
import "./gantt.css";

const DAY = 86400000;
const ROW_H = 48;
const PHASE_ROW_H = 34;
const HEAD_H = 60; // year row + month row
const BAR_H = 22;
const LABEL_W = "clamp(150px, 36vw, 230px)";

const ord = (iso: string) => Math.floor(Date.parse(iso + "T00:00:00Z") / DAY);
const fromOrd = (o: number) => new Date(o * DAY);
const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const REL_SHORT: Record<Dependency["relation_type"], string> = {
  finish_to_start: "FS",
  start_to_start: "SS",
  finish_to_finish: "FF",
  start_to_finish: "SF",
};

type PhaseRow = {
  type: "phase";
  phase: string;
  minOrd: number | null;
  maxOrd: number | null;
  manday: number;
  progress: number | null;
};
type ItemRow = { type: "item"; item: PlanItem };
type GanttRow = PhaseRow | ItemRow;

/**
 * Gantt built from the actual plan detail (PL-4/PL-9): phase summary rows over
 * item bars, month+year axis, today line, weekend shading, progress fill,
 * milestone diamonds, dependency arrows (FS/SS/FF/SF) with lag labels, and a
 * hover tooltip with the full item detail. Colors from design tokens only.
 */
export default function GanttChart({
  items,
  dependencies,
}: {
  items: PlanItem[];
  dependencies: Dependency[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(900);
  const [hover, setHover] = useState<{ item: PlanItem; left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setViewW(Math.max(320, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const model = useMemo(() => {
    const dated = items.filter((i) => i.start_date && i.end_date);
    if (dated.length === 0) return null;

    // --- rows: phase summary row, then that phase's items (model order) ---
    const rows: GanttRow[] = [];
    const groups: { phase: string; items: PlanItem[] }[] = [];
    const idxByPhase = new Map<string, number>();
    for (const it of items) {
      let gi = idxByPhase.get(it.phase);
      if (gi === undefined) {
        gi = groups.length;
        idxByPhase.set(it.phase, gi);
        groups.push({ phase: it.phase, items: [] });
      }
      groups[gi].items.push(it);
    }
    for (const g of groups) {
      const datedInPhase = g.items.filter((i) => i.start_date && i.end_date);
      let num = 0;
      let den = 0;
      for (const i of g.items) {
        if (i.progress == null || i.manday == null) continue;
        num += i.progress * Number(i.manday);
        den += Number(i.manday);
      }
      rows.push({
        type: "phase",
        phase: g.phase,
        minOrd: datedInPhase.length ? Math.min(...datedInPhase.map((i) => ord(i.start_date!))) : null,
        maxOrd: datedInPhase.length ? Math.max(...datedInPhase.map((i) => ord(i.end_date!))) : null,
        manday: g.items.reduce((sum, i) => sum + Number(i.manday || 0), 0),
        progress: den > 0 ? num / den : null,
      });
      rows.push(...g.items.map((item): ItemRow => ({ type: "item", item })));
    }

    // y offset of each row (phase rows are slimmer than item rows).
    const rowTops: number[] = [];
    let cursor = HEAD_H;
    for (const row of rows) {
      rowTops.push(cursor);
      cursor += row.type === "phase" ? PHASE_ROW_H : ROW_H;
    }
    const bodyH = cursor - HEAD_H;

    // Item id -> row index (dependency arrows MUST use this, not item order).
    const rowOf = new Map<number, number>();
    rows.forEach((row, idx) => {
      if (row.type === "item") rowOf.set(row.item.id, idx);
    });

    const starts = dated.map((i) => ord(i.start_date!));
    const ends = dated.map((i) => ord(i.end_date!));
    const minOrd = Math.min(...starts) - 2;
    const maxOrd = Math.max(...ends) + 2;
    const totalDays = maxOrd - minOrd + 1;
    // Fit the whole timeline in the visible width whenever readable (>=3px/day)
    // so the chart shows "ครบในจอเดียว"; only very long projects scroll.
    const dayW = Math.max(3, Math.min(18, Math.floor(viewW / totalDays)));
    const chartW = totalDays * dayW;
    const x = (o: number) => (o - minOrd) * dayW;

    // Month + year axis.
    const months: { x: number; label: string }[] = [];
    const years: { x: number; label: string }[] = [];
    const first = fromOrd(minOrd);
    let y = first.getUTCFullYear();
    let m = first.getUTCMonth();
    for (;;) {
      const monthOrd = Math.floor(Date.UTC(y, m, 1) / DAY);
      if (monthOrd > maxOrd) break;
      months.push({
        x: x(Math.max(monthOrd, minOrd)),
        label: new Date(Date.UTC(y, m, 1)).toLocaleDateString("th-TH", { month: "short", timeZone: "UTC" }),
      });
      if (m === 0 || months.length === 1) {
        years.push({ x: x(Math.max(monthOrd, minOrd)), label: String(y + 543) });
      }
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }

    const weekends: number[] = [];
    for (let o = minOrd; o <= maxOrd; o++) {
      const dow = fromOrd(o).getUTCDay();
      if (dow === 0 || dow === 6) weekends.push(o);
    }

    const todayOrd = ord(new Date().toISOString().slice(0, 10));
    const nameById = new Map(items.map((it) => [it.id, it.task]));

    return { rows, rowTops, bodyH, minOrd, maxOrd, dayW, chartW, x, months, years, weekends, todayOrd, rowOf, nameById };
  }, [items, viewW]);

  if (!model) {
    return <p className="muted">ยังไม่มีรายการที่มีวันเริ่ม/สิ้นสุดสำหรับวาด Gantt</p>;
  }

  const { rows, rowTops, bodyH, dayW, chartW, x, months, years, weekends, todayOrd, rowOf, nameById } = model;
  const svgH = HEAD_H + bodyH;
  const showToday = todayOrd >= model.minOrd && todayOrd <= model.maxOrd;

  const predsOf = (itemId: number) =>
    dependencies
      .filter((d) => d.successor === itemId)
      .map((d) => {
        const lag = d.lag_days > 0 ? ` +${d.lag_days} วัน` : d.lag_days < 0 ? ` ${d.lag_days} วัน` : "";
        return `${REL_SHORT[d.relation_type]} · ${nameById.get(d.predecessor) ?? d.predecessor}${lag}`;
      });

  return (
    <div className="gc">
      {/* Frozen label column */}
      <div className="gc-labels" style={{ width: LABEL_W }}>
        <div className="gc-labels-head" style={{ height: HEAD_H }}>งาน</div>
        {rows.map((row, idx) =>
          row.type === "phase" ? (
            <div className="gc-row-label gc-row-label--phase" style={{ height: PHASE_ROW_H }} key={`p${idx}`} title={row.phase}>
              <span className="gc-rl-phase-name">{row.phase}</span>
              <span className="gc-rl-phase-meta">
                {row.manday ? `${row.manday} md` : ""}
                {row.progress != null ? ` · ${Math.round(row.progress * 100)}%` : ""}
              </span>
            </div>
          ) : (
            <div className="gc-row-label" style={{ height: ROW_H }} key={row.item.id} title={row.item.task}>
              <div className="gc-rl-task">
                {row.item.is_milestone && <span className="gc-rl-ms">◆</span>}
                {row.item.task}
              </div>
              <div className="gc-rl-meta">
                {row.item.start_date && row.item.end_date
                  ? `${fmtDate(row.item.start_date)} – ${fmtDate(row.item.end_date)}`
                  : "ไม่ระบุวันที่"}
                {row.item.manday ? ` · ${row.item.manday} md` : ""}
                {row.item.progress != null ? ` · ${Math.round(row.item.progress * 100)}%` : ""}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Scrollable timeline */}
      <div className="gc-scroll" ref={wrapRef} onMouseLeave={() => setHover(null)}>
        <svg width={chartW} height={svgH} className="gc-svg" role="img">
          <defs>
            <marker id="gc-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="gc-arrow" />
            </marker>
          </defs>

          {weekends.map((o) => (
            <rect key={`w${o}`} x={x(o)} y={HEAD_H} width={dayW} height={bodyH} className="gc-weekend" />
          ))}

          {/* year + month axis */}
          {years.map((yr, i) => (
            <text key={`y${i}`} x={yr.x + 6} y={16} className="gc-year-label">{yr.label}</text>
          ))}
          {months.map((mo, i) => (
            <g key={`m${i}`}>
              <line x1={mo.x} y1={20} x2={mo.x} y2={svgH} className="gc-grid-line" />
              <text x={mo.x + 6} y={42} className="gc-month-label">{mo.label}</text>
            </g>
          ))}
          <line x1={0} y1={HEAD_H} x2={chartW} y2={HEAD_H} className="gc-grid-strong" />

          {/* row separators */}
          {rows.map((row, idx) => (
            <line
              key={`s${idx}`}
              x1={0}
              y1={rowTops[idx] + (row.type === "phase" ? PHASE_ROW_H : ROW_H)}
              x2={chartW}
              y2={rowTops[idx] + (row.type === "phase" ? PHASE_ROW_H : ROW_H)}
              className="gc-row-sep"
            />
          ))}

          {showToday && (
            <g>
              <line x1={x(todayOrd)} y1={HEAD_H - 14} x2={x(todayOrd)} y2={svgH} className="gc-today" />
              <text x={x(todayOrd) + 4} y={HEAD_H - 4} className="gc-today-label">วันนี้</text>
            </g>
          )}

          {/* dependency arrows — Y comes from rowOf on the NEW row model */}
          {dependencies.map((dep) => {
            const p = items.find((i) => i.id === dep.predecessor);
            const s = items.find((i) => i.id === dep.successor);
            const predecessorUsesStart = dep.relation_type === "start_to_start" || dep.relation_type === "start_to_finish";
            const successorUsesFinish = dep.relation_type === "finish_to_finish" || dep.relation_type === "start_to_finish";
            const predecessorDate = predecessorUsesStart ? p?.start_date : p?.end_date;
            const successorDate = successorUsesFinish ? s?.end_date : s?.start_date;
            if (!p || !s || !predecessorDate || !successorDate) return null;
            const pRow = rowOf.get(p.id);
            const sRow = rowOf.get(s.id);
            if (pRow === undefined || sRow === undefined) return null;
            const x1 = x(ord(predecessorDate) + (predecessorUsesStart ? 0 : 1));
            const y1 = rowTops[pRow] + ROW_H / 2;
            const x2 = x(ord(successorDate) + (successorUsesFinish ? 1 : 0));
            const y2 = rowTops[sRow] + ROW_H / 2;
            const direction = x2 >= x1 ? 1 : -1;
            const midX = x1 + direction * Math.max(8, Math.abs(x2 - x1) / 2);
            return (
              <g key={dep.id}>
                <path d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} className="gc-dep" markerEnd="url(#gc-arrow)" />
                {dep.lag_days !== 0 && (
                  <text x={midX + 3} y={(y1 + y2) / 2} className="gc-dep-lag">
                    {dep.lag_days > 0 ? `+${dep.lag_days}` : dep.lag_days}
                  </text>
                )}
              </g>
            );
          })}

          {/* phase summary bars + item bars */}
          {rows.map((row, idx) => {
            const rowY = rowTops[idx];
            if (row.type === "phase") {
              if (row.minOrd == null || row.maxOrd == null) return null;
              const bx = x(row.minOrd);
              const bw = Math.max(x(row.maxOrd + 1) - bx, 3);
              const by = rowY + PHASE_ROW_H / 2 - 3;
              return (
                <g key={`pb${idx}`}>
                  <rect x={bx} y={by} width={bw} height={6} rx={3} className="gc-phase-bar" />
                  {row.progress != null && row.progress > 0 && (
                    <rect x={bx} y={by} width={Math.max(bw * row.progress, 2)} height={6} rx={3} className="gc-phase-progress" />
                  )}
                </g>
              );
            }
            const it = row.item;
            if (!it.start_date || !it.end_date) {
              return (
                <text key={it.id} x={6} y={rowY + ROW_H / 2 + 4} className="gc-undated">
                  ไม่ระบุวันที่
                </text>
              );
            }
            const bx = x(ord(it.start_date));
            const bw = Math.max(x(ord(it.end_date) + 1) - bx, 3);
            const by = rowY + (ROW_H - BAR_H) / 2;
            const prog = it.progress;
            return (
              <g
                key={it.id}
                onMouseEnter={() => setHover({ item: it, left: bx, top: rowY + ROW_H })}
                onMouseLeave={() => setHover(null)}
                // touch devices: tap toggles the tooltip
                onClick={() => setHover((h) => (h?.item.id === it.id ? null : { item: it, left: bx, top: rowY + ROW_H }))}
              >
                <rect x={bx} y={by} width={bw} height={BAR_H} rx={6} className={"gc-bar" + (it.is_milestone ? " mile" : "")} />
                {prog != null && prog > 0 && (
                  <rect x={bx} y={by} width={Math.max(bw * prog, 2)} height={BAR_H} rx={6} className="gc-progress" />
                )}
                {it.is_milestone && (
                  <path d={`M ${bx + bw} ${rowY + ROW_H / 2} l 7 -7 l 7 7 l -7 7 z`} className="gc-diamond" />
                )}
                <text x={bx + bw + (it.is_milestone ? 18 : 6)} y={rowY + ROW_H / 2 + 4} className="gc-bar-text">
                  {it.manday ? `${it.manday} md` : ""}
                  {prog != null ? `  ${Math.round(prog * 100)}%` : ""}
                </text>
              </g>
            );
          })}
        </svg>

        {/* hover tooltip — full detail incl. predecessors */}
        {hover && (
          <div className="gc-tooltip" style={{ left: hover.left, top: hover.top }}>
            <div className="gc-tt-title">
              {hover.item.is_milestone && <span className="gc-rl-ms">◆ </span>}
              {hover.item.task}
            </div>
            <div className="gc-tt-line">เฟส: {hover.item.phase}</div>
            <div className="gc-tt-line">
              {fmtDate(hover.item.start_date!)} – {fmtDate(hover.item.end_date!)}
              {hover.item.manday ? ` · ${hover.item.manday} md` : ""}
            </div>
            <div className="gc-tt-line">
              ความคืบหน้า: {hover.item.progress == null ? "ยังไม่มีงานย่อย" : `${Math.round(hover.item.progress * 100)}%`}
            </div>
            {predsOf(hover.item.id).length > 0 && (
              <div className="gc-tt-line">
                ขึ้นกับ: {predsOf(hover.item.id).join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* legend */}
      <div className="gc-legend">
        <span><i className="gc-lg gc-lg-phase" /> เฟส</span>
        <span><i className="gc-lg gc-lg-bar" /> งาน</span>
        <span><i className="gc-lg gc-lg-prog" /> ความคืบหน้า</span>
        <span><i className="gc-lg gc-lg-mile" /> milestone</span>
        <span><i className="gc-lg gc-lg-today" /> วันนี้</span>
        <span><i className="gc-lg gc-lg-dep" /> dependency (FS / SS / FF / SF)</span>
      </div>
    </div>
  );
}
