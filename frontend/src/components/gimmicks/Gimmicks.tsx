import { useEffect, useMemo, useState } from "react";
import "./gimmicks.css";

/* ---------- 1) Rocket celebration when daily hits 8h ---------- */
export function RocketCelebrate({ show }: { show: boolean }) {
  if (!show) return null;
  const sparks = Array.from({ length: 14 }, (_, i) => ({
    dx: `${Math.cos((i / 14) * Math.PI * 2) * (60 + Math.random() * 60)}px`,
    dy: `${Math.sin((i / 14) * Math.PI * 2) * (60 + Math.random() * 60)}px`,
  }));
  return (
    <div className="gmk-celebrate" aria-hidden="true">
      <div className="gmk-celebrate-inner">
        <span className="gmk-rocket">🚀</span>
        <span className="gmk-celebrate-text">วันนี้ครบแล้ว ลงจอดได้! ✨</span>
      </div>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="gmk-spark"
          style={{ left: "50%", top: "50%", "--dx": s.dx, "--dy": s.dy } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ---------- 2) Star burst at a point (verified!) — imperative ---------- */
export function burstAt(x: number, y: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const host = document.createElement("div");
  host.className = "gmk-burst";
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  for (let i = 0; i < 10; i++) {
    const star = document.createElement("i");
    star.textContent = "✦";
    const angle = (i / 10) * Math.PI * 2;
    const dist = 26 + Math.random() * 34;
    star.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    star.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    host.appendChild(star);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 1000);
}

/* ---------- 3) Time-based greeting ---------- */
const GREET: Record<string, string[]> = {
  morning: ["อรุณสวัสดิ์ ☀️ เริ่มวันให้สวยงาม", "กาแฟพร้อม งานพร้อม ☕", "เช้านี้ท้องฟ้า(จำลอง)แจ่มใส"],
  afternoon: ["บ่ายแล้ว อย่าลืมยืดเส้นยืดสาย 🧘", "พักสายตาจากจอบ้างนะ", "เติมน้ำสักแก้วไหม 💧"],
  evening: ["ใกล้หมดวันแล้ว เก็บงานเข้ายานได้ 🛸", "เย็นนี้อย่าลืมบันทึกงานนะ", "อีกนิดเดียวจบภารกิจวันนี้"],
  friday: ["ศุกร์เย็นแล้ว อีกนิดเดียวได้พัก 🎉", "ภารกิจสัปดาห์นี้ใกล้จบแล้ว 🚀", "ส่งท้ายสัปดาห์ให้สวย แล้วไปพักผ่อน!"],
};

export function Greeting() {
  const text = useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const key =
      now.getDay() === 5 && h >= 15 ? "friday" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    const list = GREET[key];
    return list[Math.floor(Math.random() * list.length)];
  }, []);
  return <span className="gmk-greeting">{text}</span>;
}

/* ---------- 4) Fun loading messages ---------- */
const LOADING = [
  "กำลังติดต่อดาวเทียม…",
  "กำลังนับดาว…",
  "กำลังเข็นจรวดออกจากโรงเก็บ…",
  "กำลังเช็คสัญญาณจากฐานทัพ…",
  "กำลังวอร์มเครื่องยนต์…",
];
export function pickLoadingMessage(): string {
  return LOADING[Math.floor(Math.random() * LOADING.length)];
}

/* ---------- 5) Rare flyby (UFO / comet) in the starfield ---------- */
const FLYBY_EMOJI = ["🛸", "☄️", "🛰️"];

export function Flyby() {
  const [fly, setFly] = useState<{ emoji: string; top: number; dur: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      // สุ่มทุก 4–9 นาที ค่อยโผล่สักครั้ง
      timer = setTimeout(() => {
        setFly({
          emoji: FLYBY_EMOJI[Math.floor(Math.random() * FLYBY_EMOJI.length)],
          top: 8 + Math.random() * 50,
          dur: 14 + Math.random() * 10,
        });
        schedule();
      }, (4 + Math.random() * 5) * 60_000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  if (!fly) return null;
  return (
    <span
      className="gmk-flyby"
      style={{ "--fly-top": `${fly.top}%`, "--fly-dur": `${fly.dur}s` } as React.CSSProperties}
      onAnimationEnd={() => setFly(null)}
    >
      {fly.emoji}
    </span>
  );
}

/* ---------- 6) Full-screen starburst (logo easter egg, 5 clicks) ---------- */
export function Starburst({ show }: { show: boolean }) {
  if (!show) return null;
  const stars = Array.from({ length: 26 }, () => ({
    left: `${Math.random() * 96}%`,
    top: `${Math.random() * 92}%`,
    size: 12 + Math.random() * 22,
    delay: Math.random() * 0.8,
  }));
  return (
    <div className="gmk-starburst" aria-hidden="true">
      {stars.map((s, i) => (
        <span key={i} style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: `${s.delay}s` }}>
          ✦
        </span>
      ))}
    </div>
  );
}

/* ---------- 7) Tiny astronaut mascot for empty states ---------- */
export function Astronaut({ pose = "float" }: { pose?: "float" | "search" | "shield" }) {
  return (
    <svg className="gmk-astro-img" width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
      {/* helmet + body, drawn with currentColor so both themes work */}
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="32" cy="22" r="11" />
        <path d="M25 22a7 7 0 0 1 14 0" opacity="0.5" />
        <path d="M24 33c-2 3-3 7-3 11 0 4 5 7 11 7s11-3 11-7c0-4-1-8-3-11" />
        {pose === "float" && <><path d="M21 38l-7 -4" /><path d="M43 38l7 -4" /><path d="M27 51l-3 7" /><path d="M37 51l3 7" /></>}
        {pose === "search" && <><path d="M21 38l-7 2" /><path d="M43 36l6-6" /><circle cx="52" cy="27" r="4" /><path d="M55 30l4 4" /></>}
        {pose === "shield" && <><path d="M21 38l-7 2" /><path d="M43 38l6 0" /><path d="M49 32l6 3-6 3z" fill="currentColor" stroke="none" /></>}
      </g>
    </svg>
  );
}
