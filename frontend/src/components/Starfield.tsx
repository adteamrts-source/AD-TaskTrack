import { useEffect, useMemo, useState } from "react";
import { Flyby } from "./gimmicks/Gimmicks";
import "./starfield.css";

/**
 * Ambient Space backdrop (PRD §5.8 / UI-1..6):
 * - twinkling starfield + shooting stars that spawn at RANDOM positions,
 *   1-3 at a time with random timing, re-rolled every cycle
 * - decorative only: pointer-events none, sits behind UI
 * - prefers-reduced-motion stops all motion (handled in CSS)
 * - Light mode dims the ambient (CSS) for readability
 */

interface Shot {
  id: number;
  top: number; // %
  left: number; // %
  delay: number; // s
  duration: number; // s
  length: number; // px
}

const SHOT_CYCLE_MS = 8000;

function rollShots(): Shot[] {
  const count = 1 + Math.floor(Math.random() * 3); // 1-3 ดวง
  return Array.from({ length: count }, () => ({
    id: Math.random(),
    top: Math.random() * 45, // ครึ่งบนของจอ
    left: 25 + Math.random() * 70,
    delay: Math.random() * 4,
    duration: 1.8 + Math.random() * 1.6,
    length: 90 + Math.random() * 80,
  }));
}

export default function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        duration: 3,
      })),
    [],
  );

  const [shots, setShots] = useState<Shot[]>(rollShots);
  useEffect(() => {
    const timer = setInterval(() => setShots(rollShots()), SHOT_CYCLE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="starfield" aria-hidden="true">
      <Flyby />
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
      {shots.map((s) => (
        <span
          key={s.id}
          className="shooting-star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.length}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
