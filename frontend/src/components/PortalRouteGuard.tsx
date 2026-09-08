import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { usePortal } from "@/contexts/PortalContext";
import {
  isPathAllowedForPortal,
  hiddenPathsForPortal,
  PORTAL_HOME_SEGMENT,
  SHARED_PATH_PREFIXES,
} from "@/lib/portal";
import { useHiddenCmsPages } from "@/hooks/useCmsPages";
import NotFound from "@/pages/not-found";

function pathMatchesHidden(pathname: string, hiddenPath: string): boolean {
  return (
    pathname === hiddenPath ||
    (hiddenPath !== "/" && pathname.startsWith(`${hiddenPath}/`))
  );
}

function isShared(pathname: string): boolean {
  return SHARED_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Path prefixes define the portal. Shared roots (/login, /cpanel, …) always allowed.
 * Otherwise require an allowed internal path for the current portal.
 * Hidden CMS public paths 404 for this portal.
 */
export function PortalRouteGuard({ children }: { children: ReactNode }) {
  const { portal } = usePortal();
  const [location] = useLocation();
  const { data: hidden } = useHiddenCmsPages();
  const internalPath = location.split("?")[0] || "/";

  if (!isShared(internalPath) && !isPathAllowedForPortal(portal, internalPath)) {
    return <NotFound />;
  }

  const publicPath =
    typeof window !== "undefined" ? window.location.pathname : internalPath;

  const hiddenPaths = hiddenPathsForPortal(hidden?.entries, portal);
  const isHome =
    publicPath === "/" || publicPath.endsWith(`/${PORTAL_HOME_SEGMENT}`);

  if (
    !isHome &&
    publicPath !== "/" &&
    hiddenPaths.some((p) => pathMatchesHidden(publicPath, p))
  ) {
    return <NotFound />;
  }

  return <>{children}</>;
}
