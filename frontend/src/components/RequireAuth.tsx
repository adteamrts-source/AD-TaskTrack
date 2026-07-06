import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * Gate authenticated routes. While /api/me is loading, show a light splash;
 * if it errors (401/403 — not logged in / not allowlisted), bounce to /login.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isError, me } = useAuth();

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-txt-dim">กำลังโหลด…</div>;
  }
  if (isError || !me) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
