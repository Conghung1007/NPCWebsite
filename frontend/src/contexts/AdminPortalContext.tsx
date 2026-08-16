import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  isPortalId,
  normalizeAllowedPortals,
  type PortalId,
} from "@/lib/portal";

export type AdminPortalFilter = "all" | PortalId;

const STORAGE_KEY = "npc_admin_portal_filter";

function readStored(): AdminPortalFilter {
  if (typeof window === "undefined") return "all";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "all" || isPortalId(v)) return v;
  } catch {
    /* ignore */
  }
  return "all";
}

type AdminPortalContextValue = {
  filter: AdminPortalFilter;
  setFilter: (next: AdminPortalFilter) => void;
  /** Query for list endpoints: `all=1` or `portal=…` */
  listQuery: string;
  /** Portal to prefill on create forms when filter is a single portal */
  defaultPortal: PortalId;
  /** null = unrestricted; otherwise only these portals */
  allowedPortals: PortalId[] | null;
};

const AdminPortalContext = createContext<AdminPortalContextValue | null>(null);

function clampFilter(
  next: AdminPortalFilter,
  allowed: PortalId[] | null,
): AdminPortalFilter {
  if (!allowed) return next;
  if (next === "all") return allowed[0];
  if (!allowed.includes(next)) return allowed[0];
  return next;
}

export function AdminPortalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const allowedPortals = useMemo(
    () => normalizeAllowedPortals(user?.portals),
    [user?.portals],
  );

  const [filter, setFilterState] = useState<AdminPortalFilter>(() =>
    clampFilter(readStored(), null),
  );

  useEffect(() => {
    setFilterState((prev) => clampFilter(prev, allowedPortals));
  }, [allowedPortals]);

  const setFilter = useCallback(
    (next: AdminPortalFilter) => {
      const clamped = clampFilter(next, allowedPortals);
      setFilterState(clamped);
      try {
        localStorage.setItem(STORAGE_KEY, clamped);
      } catch {
        /* ignore */
      }
    },
    [allowedPortals],
  );

  const value = useMemo<AdminPortalContextValue>(() => {
    const effective = clampFilter(filter, allowedPortals);
    const listQuery =
      effective === "all"
        ? "all=1"
        : `portal=${encodeURIComponent(effective)}`;
    const defaultPortal: PortalId =
      effective === "all"
        ? allowedPortals?.[0] || "group"
        : effective;
    return {
      filter: effective,
      setFilter,
      listQuery,
      defaultPortal,
      allowedPortals,
    };
  }, [filter, setFilter, allowedPortals]);

  return (
    <AdminPortalContext.Provider value={value}>
      {children}
    </AdminPortalContext.Provider>
  );
}

export function useAdminPortal(): AdminPortalContextValue {
  const ctx = useContext(AdminPortalContext);
  if (!ctx) {
    return {
      filter: "all",
      setFilter: () => {},
      listQuery: "all=1",
      defaultPortal: "group",
      allowedPortals: null,
    };
  }
  return ctx;
}
