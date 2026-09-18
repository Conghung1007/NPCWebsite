import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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

/**
 * Wouter's location is the *internal* path (prefix stripped), so
 * `/luyen-thi/gioi-thieu` and `/huong-nghiep/gioi-thieu` both look like `/`.
 * Portal must follow the real browser pathname instead.
 */
const pathnameListeners = new Set<() => void>();
let historyPatched = false;

function notifyPathnameListeners() {
  pathnameListeners.forEach((listener) => listener());
}

function ensureHistoryPatch() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;

  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);

  history.pushState = ((...args: Parameters<History["pushState"]>) => {
    const ret = push(...args);
    notifyPathnameListeners();
    return ret;
  }) as History["pushState"];

  history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
    const ret = replace(...args);
    notifyPathnameListeners();
    return ret;
  }) as History["replaceState"];

  window.addEventListener("popstate", notifyPathnameListeners);
}

function subscribeBrowserPathname(onChange: () => void) {
  ensureHistoryPatch();
  pathnameListeners.add(onChange);
  return () => {
    pathnameListeners.delete(onChange);
  };
}

function getBrowserPathname(): string {
  return window.location.pathname || "/";
}

function getServerPathname(): string {
  return "/";
}

function portalFromPathname(pathname: string): PortalId {
  return (
    resolvePortalFromPath(pathname) ?? stripPortalPrefix(pathname).portal
  );
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const publicPath = useSyncExternalStore(
    subscribeBrowserPathname,
    getBrowserPathname,
    getServerPathname,
  );
  const portal = useMemo(
    () => portalFromPathname(publicPath),
    [publicPath],
  );

  useEffect(() => {
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
