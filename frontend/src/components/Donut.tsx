export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Minimal SVG donut for hours-by-project (Meeting Summary §6.10). */
export default function Donut({ slices, size = 160 }: { slices: DonutSlice[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  if (total <= 0) {
    return <p className="text-2xs text-txt-faint">ไม่มีข้อมูลชั่วโมงในช่วงนี้</p>;
  }

  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {slices.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * circ;
            const seg = (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={20}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--txt-strong)">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="var(--txt-faint)">
          ชม.
        </text>
      </svg>
      <ul className="w-full text-2xs">
        {slices.map((s, i) => (
          <li key={i} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 py-1 text-txt-dim">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 break-words">{s.label}</span>
            <span className="whitespace-nowrap text-txt-faint">
              {s.value} ชม. ({Math.round((s.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
