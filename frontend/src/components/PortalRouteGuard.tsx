import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { usePortal } from "@/contexts/PortalContext";
import type { PortalId } from "@/lib/portal";
import NotFound from "@/pages/not-found";

/** Path prefixes allowed per portal (plus always-shared paths). */
const PORTAL_PATHS: Record<PortalId, string[]> = {
  group: ["/", "/company", "/contact", "/visa-services", "/study-abroad"],
  tnjs: [
    "/",
    "/classes",
    "/cart",
    "/checkout",
    "/online-exam",
    "/exam",
    "/exam-attempts",
    "/certificate",
    "/news",
    "/contact",
    "/japanese-training",
  ],
  duhoc: [
    "/",
    "/countries",
    "/schools",
    "/costs",
    "/documents",
    "/faq",
    "/visa-services",
    "/study-abroad",
    "/news",
    "/contact",
  ],
  daotao: [
    "/",
    "/courses",
    "/schedule",
    "/enterprise",
    "/news",
    "/contact",
  ],
};

const SHARED_PREFIXES = [
  "/login",
  "/register",
  "/cpanel",
  "/article",
  "/create-article",
  "/edit-article",
  "/create-exam",
  "/edit-exam",
  "/manage",
];

function pathAllowed(portal: PortalId, pathname: string): boolean {
  if (SHARED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  const allowed = PORTAL_PATHS[portal] || [];
  return allowed.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}

/** Soft lock: wrong-portal marketing paths → NotFound (shared/auth/cpanel always OK). */
export function PortalRouteGuard({ children }: { children: ReactNode }) {
  const { portal } = usePortal();
  const [location] = useLocation();
  const pathname = location.split("?")[0] || "/";

  if (!pathAllowed(portal, pathname)) {
    return <NotFound />;
  }

  return <>{children}</>;
}
