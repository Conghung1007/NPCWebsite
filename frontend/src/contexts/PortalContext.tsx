import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PORTAL_META,
  resolvePortal,
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

export function PortalProvider({ children }: { children: ReactNode }) {
  const [portal, setPortal] = useState<PortalId>(() => resolvePortal());

  useEffect(() => {
    const sync = () => setPortal(resolvePortal());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

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
