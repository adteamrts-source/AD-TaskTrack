import "./hoursstepper.css";

/** ± 0.5 stepper, min 0.5, no upper cap (PRD MW-11 / OT). */
export default function HoursStepper({
  value,
  onChange,
  small,
}: {
  value: number;
  onChange: (v: number) => void;
  small?: boolean;
}) {
  const dec = () => onChange(Math.max(0.5, Math.round((value - 0.5) * 2) / 2));
  const inc = () => onChange(Math.round((value + 0.5) * 2) / 2);
  return (
    <div className={"hours-stepper" + (small ? " sm" : "")}>
      <button type="button" onClick={dec} disabled={value <= 0.5} aria-label="ลดชั่วโมง">
        −
      </button>
      <span className="hours-val">{value} ชม.</span>
      <button type="button" onClick={inc} aria-label="เพิ่มชั่วโมง">
        +
      </button>
    </div>
  );
}
