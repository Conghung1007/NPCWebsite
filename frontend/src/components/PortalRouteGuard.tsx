import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { usePortal } from "@/contexts/PortalContext";
import { isPathAllowedForPortal } from "@/lib/portal";
import NotFound from "@/pages/not-found";

/** Soft lock: wrong-portal marketing paths → NotFound (shared/auth/cpanel always OK).
 *  Deep links owned by another portal are auto-switched in PortalProvider first. */
export function PortalRouteGuard({ children }: { children: ReactNode }) {
  const { portal } = usePortal();
  const [location] = useLocation();
  const pathname = location.split("?")[0] || "/";

  if (!isPathAllowedForPortal(portal, pathname)) {
    return <NotFound />;
  }

  return <>{children}</>;
}
