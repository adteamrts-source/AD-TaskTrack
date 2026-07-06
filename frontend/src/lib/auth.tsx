import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type Role = "admin" | "dm" | "bsa" | "dev";

export interface Permission {
  module: string;
  action: "view" | "create" | "edit" | "delete";
}

export interface Me {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  position: string;
  employment_type: "permanent" | "contractor";
  permissions: Permission[];
  calendar_connected: boolean;
}

interface AuthValue {
  me: Me | null;
  isLoading: boolean;
  isError: boolean;
  can: (module: string, action: Permission["action"]) => boolean;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/me");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
  });

  const me = data ?? null;
  const can: AuthValue["can"] = (module, action) =>
    !!me?.permissions.some((p) => p.module === module && p.action === action);

  return (
    <AuthContext.Provider value={{ me, isLoading, isError, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
