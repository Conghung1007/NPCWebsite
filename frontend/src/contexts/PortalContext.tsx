import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  PORTAL_META,
  resolvePortalForPath,
  type PortalId,
} from "@/lib/portal";

type PortalContextValue = {
  portal: PortalId;
  meta: (typeof PORTAL_META)[PortalId];
  isGroup: boolean;
  isHuongnghiep: boolean;
  isDichvu: boolean;
  isLuyenthi: boolean;
};

const PortalContext = createContext<PortalContextValue | null>(null);

function currentPathname(location: string): string {
  return location.split("?")[0] || "/";
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [portal, setPortal] = useState<PortalId>(() =>
    resolvePortalForPath(
      typeof window !== "undefined" ? window.location.pathname : "/",
    ),
  );

  useEffect(() => {
    setPortal(resolvePortalForPath(currentPathname(location)));
  }, [location]);

  useEffect(() => {
    document.title = PORTAL_META[portal].documentTitle;
    document.documentElement.dataset.portal = portal;
  }, [portal]);

  const value = useMemo<PortalContextValue>(
    () => ({
      portal,
      meta: PORTAL_META[portal],
      isGroup: portal === "group",
      isHuongnghiep: portal === "huongnghiep",
      isDichvu: portal === "dichvu",
      isLuyenthi: portal === "luyenthi",
    }),
    [portal],
  );

  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal must be used within PortalProvider");
  }
  return ctx;
}
