import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, FolderKanban, ListTodo, Search, Server } from "lucide-react";
import { api } from "../lib/api";

interface SearchResult {
  type: "project" | "task" | "client" | "infra";
  title: string;
  subtitle: string;
  link: string;
}

const TYPE_ICON = { project: FolderKanban, task: ListTodo, client: Building2, infra: Server };
const TYPE_LABEL = { project: "โครงการ", task: "งาน", client: "ลูกค้า", infra: "ทรัพยากร" };

/** Topbar global search (โครงการ/งาน/ลูกค้า/ทรัพยากร) — Cmd/Ctrl+K to focus. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  const { data } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async () =>
      (await api.get<{ results: SearchResult[] }>("/search", { params: { q: debounced } })).data,
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const results = debounced.length >= 2 ? data?.results ?? [] : [];

  return (
    <div className="relative hidden min-w-0 sm:block" ref={wrapRef}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
      <input
        ref={inputRef}
        className="ui-input h-10 w-44 pl-8 text-sm transition-[width] focus:w-64 lg:w-56"
        placeholder="ค้นหา… (⌘K)"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="ค้นหารวม"
      />
      {open && debounced.length >= 2 && (
        <div className="notif-panel">
          {results.length === 0 && <p className="px-3 py-3 text-sm text-txt-faint">ไม่พบผลลัพธ์</p>}
          <div className="max-h-80 overflow-y-auto">
            {results.map((r, i) => {
              const Icon = TYPE_ICON[r.type];
              return (
                <button
                  key={i}
                  className="flex w-full items-center gap-2 border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-panel"
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    navigate(r.link);
                  }}
                >
                  <Icon size={14} className="shrink-0 text-txt-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-txt-strong">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-2xs text-txt-faint">{r.subtitle}</span>}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-txt-faint">{TYPE_LABEL[r.type]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
