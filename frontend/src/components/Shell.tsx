import { useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket,
  ListTodo,
  NotebookPen,
  FolderKanban,
  Building2,
  PieChart,
  Server,
  Users,
  SlidersHorizontal,
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import Starfield from "./Starfield";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./GlobalSearch";
import { Starburst } from "./gimmicks/Gimmicks";
import "./shell.css";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", dm: "DM", bsa: "BSA", dev: "Dev" };
const COLLAPSE_KEY = "astro-sidebar-collapsed";

interface NavItem { to: string; label: string; icon: LucideIcon; module: string; action?: "view" | "create" | "edit" | "delete"; }

const NAV: NavItem[] = [
  { to: "/my-work", label: "งานของฉัน", icon: ListTodo, module: "My Work" },
  { to: "/my-summary", label: "สรุปงานของฉัน", icon: NotebookPen, module: "My Work" },
  { to: "/projects", label: "โครงการ", icon: FolderKanban, module: "Projects" },
  { to: "/meeting-summary", label: "สรุปประชุม", icon: PieChart, module: "Meeting Summary" },
  { to: "/infrastructure", label: "Infrastructure", icon: Server, module: "Budget" },
  { to: "/team", label: "ทีม", icon: Users, module: "Team Members" },
];
const ADMIN_NAV: NavItem[] = [
  // Client master is reference data — kept in the admin group; gated by edit
  // so Admin/DM/BSA see it (dev only holds view). Inline creation in the
  // project form is unaffected.
  { to: "/clients", label: "ลูกค้า", icon: Building2, module: "Client Master", action: "edit" },
  { to: "/settings", label: "ตั้งค่า", icon: SlidersHorizontal, module: "User Management" },
  { to: "/admin", label: "ระบบ", icon: ShieldCheck, module: "User Management" },
];

export default function Shell() {
  const { theme, toggle } = useTheme();
  const { me, can } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoLaunch, setLogoLaunch] = useState(false);
  const [starburst, setStarburst] = useState(false);
  const logoClicksRef = useRef<number[]>([]);

  // Easter egg: คลิกโลโก้ = จรวดบินขึ้นแล้วกลับ; 5 คลิกใน 3 วิ = ดาวเต็มจอ
  function handleLogoClick() {
    setLogoLaunch(true);
    setTimeout(() => setLogoLaunch(false), 1700);
    const now = Date.now();
    logoClicksRef.current = [...logoClicksRef.current.filter((t) => now - t < 3000), now];
    if (logoClicksRef.current.length >= 5) {
      logoClicksRef.current = [];
      setStarburst(true);
      setTimeout(() => setStarburst(false), 3200);
    }
  }

  const { data: reminder, isError: reminderError } = useQuery({
    queryKey: ["daily-reminder"],
    queryFn: async () =>
      (await api.get<{ needs_submission: boolean; work_date: string }>("/daily/reminder")).data,
    enabled: can("My Work", "view"),
    staleTime: 60_000,
  });

  const visibleNav = NAV.filter((item) => can(item.module, item.action ?? "view"));
  const visibleAdmin = ADMIN_NAV.filter((item) => can(item.module, item.action ?? "view"));
  const initials = (me?.full_name || me?.email || "U").trim().slice(0, 1).toUpperCase();

  function toggleCollapse() {
    setCollapsed((v) => {
      localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      return !v;
    });
  }
  async function handleLogout() {
    try { await api.post("/auth/logout"); } finally { window.location.href = "/login"; }
  }

  // Labels always remain visible in the drawer; collapse applies to wide desktop only.
  const labelCls = collapsed ? "xl:hidden" : "";

  function Row({ item }: { item: NavItem }) {
    const Icon = item.icon;
    return (
      <NavLink
        to={item.to}
        title={item.label}
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) =>
          "astro-nav-link " +
          (collapsed ? "xl:justify-center " : "") +
          (isActive ? "is-active" : "")
        }
      >
        <Icon size={18} strokeWidth={2} className="shrink-0" />
        <span className={labelCls}>{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="astro-shell relative flex min-h-screen text-txt">
      <Starfield />
      <Starburst show={starburst} />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="astro-mobile-backdrop fixed inset-0 z-30 xl:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={
          "astro-sidebar fixed inset-y-0 left-0 z-40 flex flex-col gap-4 overflow-y-auto p-3 transition-all duration-300 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full") +
          " xl:static xl:translate-x-0 " +
          (collapsed ? "w-64 xl:w-[76px]" : "w-64")
        }
      >
        <div className={"astro-brand flex items-center gap-3 px-2 " + (collapsed ? "xl:justify-center" : "")}>
          <button
            type="button"
            className={"astro-brand-mark grid h-10 w-10 shrink-0 cursor-pointer place-items-center border-0 " + (logoLaunch ? "gmk-logo-launch" : "")}
            onClick={handleLogoClick}
            aria-label="ASTRO"
            title="🚀"
          >
            <Rocket size={27} />
          </button>
          <span className={"astro-brand-name text-xl font-bold text-txt-strong " + labelCls}>ASTRO</span>
        </div>

        <nav className="astro-nav flex flex-1 flex-col gap-1">
          <p className={"astro-nav-label px-3 pb-1 text-2xs font-bold text-txt-faint " + labelCls}>เมนู</p>
          {visibleNav.map((item) => <Row key={item.to} item={item} />)}
          {visibleAdmin.length > 0 && (
            <>
              <p className={"astro-nav-label px-3 pb-1 pt-4 text-2xs font-bold text-txt-faint " + labelCls}>ผู้ดูแลระบบ</p>
              {visibleAdmin.map((item) => <Row key={item.to} item={item} />)}
            </>
          )}
        </nav>

        <div className="astro-user-panel border-t border-line pt-3">
          <div className={"flex items-center gap-3 " + (collapsed ? "xl:justify-center" : "")}>
            <span className="astro-avatar grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-accent">{initials}</span>
            <div className={"min-w-0 flex-1 " + labelCls}>
              <div className="truncate text-sm font-bold text-txt-strong">{me?.full_name || me?.email || "ผู้ใช้"}</div>
              <div className="text-2xs uppercase tracking-wide text-txt-faint">{me ? ROLE_LABEL[me.role] : "—"}</div>
            </div>
            <button
              onClick={handleLogout}
              className={"astro-icon-button grid h-11 w-11 shrink-0 place-items-center text-txt-dim transition hover:border-danger hover:text-danger " + labelCls}
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="astro-topbar sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
          {/* mobile hamburger */}
          <button className="astro-icon-button grid h-11 w-11 place-items-center text-txt-dim xl:hidden" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนู">
            <Menu size={18} />
          </button>
          {/* desktop collapse toggle */}
          <button className="astro-icon-button hidden h-10 w-10 place-items-center text-txt-dim transition hover:text-accent xl:grid" onClick={toggleCollapse} aria-label="ย่อ/ขยายเมนู">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          <div className="flex-1">
            {can("My Work", "view") && <ReminderPill reminder={reminder} error={reminderError} />}
          </div>
          <GlobalSearch />
          <NotificationBell />
          <button onClick={toggle} className="astro-icon-button grid h-11 w-11 place-items-center text-txt-dim transition hover:text-accent" aria-label="สลับธีม">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </header>
        <main className="astro-content flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ReminderPill({ reminder, error }: { reminder?: { needs_submission: boolean }; error: boolean }) {
  let cls = "ui-pill border border-line bg-card text-txt-dim";
  let icon = <BellRing size={14} />;
  let text = "กำลังตรวจ Daily";
  if (error) {
    cls = "ui-pill text-danger"; icon = <AlertCircle size={14} />; text = "ตรวจสถานะ Daily ไม่ได้";
  } else if (reminder?.needs_submission) {
    cls = "ui-pill bg-warn-bg text-warn"; icon = <BellRing size={14} />; text = "ยังไม่กรอกงานวันนี้";
  } else if (reminder) {
    cls = "ui-pill text-ok [background:rgba(5,150,105,.1)]"; icon = <CheckCircle2 size={14} />; text = "กรอกงานวันนี้แล้ว";
  }
  return <NavLink to="/my-work" className={cls} title="สถานะการกรอกงานวันนี้">{icon}<span className="hidden sm:inline">{text}</span></NavLink>;
}
