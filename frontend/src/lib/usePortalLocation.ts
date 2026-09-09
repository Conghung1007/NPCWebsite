import { useCallback, useLayoutEffect } from "react";
import {
  useBrowserLocation,
  navigate as browserNavigate,
} from "wouter/use-browser-location";
import {
  GROUP_CONTACT_PATH,
  SHARED_PATH_PREFIXES,
  legacyPublicRedirect,
  normalizePortalAlias,
  resolvePortalFromPath,
  stripPortalPrefix,
  toPublicPortalPath,
  type PortalId,
} from "@/lib/portal";

function pathOnly(to: string): string {
  return (to.split("?")[0] || "/").split("#")[0] || "/";
}

function splitTo(to: string): { path: string; search: string; hash: string } {
  const hashIdx = to.indexOf("#");
  const hash = hashIdx >= 0 ? to.slice(hashIdx) : "";
  const withoutHash = hashIdx >= 0 ? to.slice(0, hashIdx) : to;
  const qIdx = withoutHash.indexOf("?");
  const search = qIdx >= 0 ? withoutHash.slice(qIdx) : "";
  const path = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  return { path: path || "/", search, hash };
}

function isPublicPortalPath(path: string): boolean {
  return (
    path === GROUP_CONTACT_PATH ||
    path.startsWith("/huong-nghiep") ||
    path.startsWith("/dich-vu") ||
    path.startsWith("/luyen-thi")
  );
}

function isSharedAppPath(path: string): boolean {
  return SHARED_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

function currentPortalFromBrowserPath(pathname: string): PortalId {
  return (
    resolvePortalFromPath(pathname) ?? stripPortalPrefix(pathname).portal
  );
}

/**
 * Wouter location hook: browser shows `/huong-nghiep/du-hoc`,
 * routes see internal `/du-hoc`. Navigations to flat paths are re-prefixed.
 */
export function usePortalLocation(opts?: {
  ssrPath?: string;
}): [string, typeof browserNavigate] {
  const [pathname, navigate] = useBrowserLocation(opts);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    const hash = window.location.hash;
    const params = new URLSearchParams(search);
    const portalQ = params.get("portal");

    if (portalQ) {
      const portal = normalizePortalAlias(portalQ);
      if (portal) {
        params.delete("portal");
        const qs = params.toString();
        let dest: string;
        if (isPublicPortalPath(pathname)) {
          dest = pathname;
        } else if (pathname === "/" || pathname === "") {
          dest = toPublicPortalPath(portal, "/");
        } else if (isSharedAppPath(pathname)) {
          dest = pathname;
        } else {
          dest = toPublicPortalPath(portal, pathname);
        }
        navigate(`${dest}${qs ? `?${qs}` : ""}${hash}`, { replace: true });
        return;
      }
    }

    const redirect = legacyPublicRedirect(pathname);
    if (redirect && redirect !== pathname) {
      navigate(`${redirect}${search}${hash}`, { replace: true });
    }
  }, [pathname, navigate]);

  const { internalPath } = stripPortalPrefix(pathname);

  const navigatePublic = useCallback(
    (to: string | URL, navOpts?: Parameters<typeof browserNavigate>[1]) => {
      const raw = typeof to === "string" ? to : to.pathname + to.search + to.hash;
      if (/^https?:\/\//i.test(raw)) {
        window.location.assign(raw);
        return;
      }

      const { path, search, hash } = splitTo(raw);
      const portal = currentPortalFromBrowserPath(pathname);

      let publicPath: string;
      // Bare `/` is always the group hub home (logo, logout) — never re-prefix
      // into the active product portal.
      if (path === "/" || path === "") {
        publicPath = "/";
      } else if (
        isPublicPortalPath(path) ||
        isSharedAppPath(path) ||
        path === "/japanese-training"
      ) {
        publicPath = path;
      } else {
        publicPath = toPublicPortalPath(portal, path);
      }

      const redirected = legacyPublicRedirect(publicPath);
      navigate(`${redirected || publicPath}${search}${hash}`, navOpts);
    },
    [pathname, navigate],
  );

  return [internalPath, navigatePublic];
}

export { pathOnly };
