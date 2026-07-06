import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CircleAlert } from "lucide-react";
import { api } from "../lib/api";

interface NotifItem {
  type: string;
  severity: "warn" | "danger";
  title: string;
  detail: string;
  link: string;
}

/** Topbar bell — "สิ่งที่ต้องสนใจตอนนี้" aggregated across the system. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ count: number; items: NotifItem[] }>("/notifications")).data,
    staleTime: 60_000,
    refetchInterval: 180_000,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = data?.count ?? 0;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        className="astro-icon-button relative grid h-11 w-11 place-items-center text-txt-dim transition hover:text-accent"
        onClick={() => setOpen((v) => !v)}
        aria-label={`การแจ้งเตือน (${count})`}
        aria-expanded={open}
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="border-b border-line px-3 py-2 text-2xs font-bold uppercase tracking-wide text-txt-faint">
            สิ่งที่ต้องสนใจตอนนี้
          </div>
          {(!data || data.items.length === 0) && (
            <p className="px-3 py-4 text-sm text-txt-faint">ไม่มีอะไรค้าง เยี่ยมมาก 🎉</p>
          )}
          <div className="max-h-80 overflow-y-auto">
            {data?.items.map((n, i) => (
              <Link
                key={i}
                to={n.link}
                onClick={() => setOpen(false)}
                className="flex items-start gap-2 border-b border-line px-3 py-2.5 last:border-0 hover:bg-panel"
              >
                {n.severity === "danger" ? (
                  <CircleAlert size={15} className="mt-0.5 shrink-0 text-danger" />
                ) : (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-txt-strong">{n.title}</span>
                  {n.detail && <span className="block truncate text-2xs text-txt-faint">{n.detail}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
