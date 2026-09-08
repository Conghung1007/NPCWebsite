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
  resolvePortalFromPath,
  stripPortalPrefix,
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

function portalFromBrowser(): PortalId {
  if (typeof window === "undefined") return "group";
  return (
    resolvePortalFromPath(window.location.pathname) ??
    stripPortalPrefix(window.location.pathname).portal
  );
}

export function PortalProvider({ children }: { children: ReactNode }) {
  // useLocation triggers re-render on nav; portal always from public URL
  const [location] = useLocation();
  const [portal, setPortal] = useState<PortalId>(() => portalFromBrowser());

  useEffect(() => {
    setPortal(portalFromBrowser());
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
