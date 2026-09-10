import {
  PORTAL_HOSTS,
  PORTAL_IDS,
  PORTAL_BASE_PATH,
  PORTAL_HOME_SEGMENT,
  GROUP_CONTACT_PATH,
  TNJS_EXTERNAL_URL,
  tnjsTrainingHref,
  isPortalId,
  normalizeAllowedPortals,
  normalizePortalAlias,
  resolvePortalFromHost,
  resolvePortalFromPath,
  stripPortalPrefix,
  toPublicPortalPath,
  legacyPublicRedirect,
  inferPortalForFlatPath,
  FLAT_PATH_OWNING_PORTAL,
  type PortalId,
} from "@shared/portal";

export type { PortalId };
export {
  PORTAL_HOSTS,
  PORTAL_IDS,
  PORTAL_BASE_PATH,
  PORTAL_HOME_SEGMENT,
  GROUP_CONTACT_PATH,
  TNJS_EXTERNAL_URL,
  tnjsTrainingHref,
  isPortalId,
  normalizeAllowedPortals,
  normalizePortalAlias,
  resolvePortalFromHost,
  resolvePortalFromPath,
  stripPortalPrefix,
  toPublicPortalPath,
  legacyPublicRedirect,
  inferPortalForFlatPath,
  FLAT_PATH_OWNING_PORTAL,
};

export type NavItem = {
  name: string;
  href: string;
  shortName: string;
  external?: boolean;
  /** Hide in desktop nav below xl (still shown in mobile sheet) */
  hideBelowXl?: boolean;
  children?: NavItem[];
};

/** Pathname only (strip origin / query / hash) for comparing with hidden CMS paths. */
export function navItemPathname(href: string): string {
  try {
    if (/^https?:\/\//i.test(href)) {
      return new URL(href).pathname || "/";
    }
  } catch {
    /* ignore */
  }
  const path = href.split("?")[0]?.split("#")[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Drop nav links whose path matches a child page removed in Cpanel for this portal.
 * Portal homes are never hidden.
 */
export function filterNavByHiddenPaths(
  items: NavItem[],
  hiddenPaths: readonly string[] | null | undefined,
): NavItem[] {
  if (!hiddenPaths?.length) return items;
  const hidden = new Set(
    hiddenPaths
      .filter((p) => p && p !== "/")
      .map((p) => (p.startsWith("/") ? p : `/${p}`)),
  );
  if (hidden.size === 0) return items;

  const isHiddenPath = (pathname: string) => {
    if (pathname === "/" || pathname.endsWith(`/${PORTAL_HOME_SEGMENT}`)) {
      return false;
    }
    if (hidden.has(pathname)) return true;
    for (const h of Array.from(hidden)) {
      if (pathname === h || pathname.startsWith(`${h}/`)) return true;
    }
    return false;
  };

  return items
    .filter((item) => !isHiddenPath(navItemPathname(item.href)))
    .map((item) =>
      item.children?.length
        ? {
            ...item,
            children: filterNavByHiddenPaths(item.children, hiddenPaths),
          }
        : item,
    );
}

/** Paths hidden for a specific portal (from /api/cms-pages/hidden entries). */
export function hiddenPathsForPortal(
  entries: readonly { portal: string; path: string }[] | null | undefined,
  portal: string,
): string[] {
  if (!entries?.length) return [];
  return entries
    .filter((e) => e.portal === portal && e.path && e.path !== "/")
    .map((e) => {
      const p = e.path.startsWith("/") ? e.path : `/${e.path}`;
      // Entries may already be public paths or internal — normalize to public
      if (resolvePortalFromPath(p)) return p;
      return toPublicPortalPath(portal as PortalId, p);
    });
}

/** Apply Cpanel display-name overrides onto header/footer nav items.
 * Match by public path; never apply to external URLs; hash links only match path+hash.
 */
export function applyNavLabelOverrides(
  items: NavItem[],
  entries:
    | readonly { portal: string; path: string; label: string }[]
    | null
    | undefined,
  portal: PortalId,
): NavItem[] {
  if (!entries?.length) return items;
  const byPath = new Map<string, string>();
  for (const e of entries) {
    if (e.portal !== portal || !e.label?.trim()) continue;
    const key = normalizeNavMatchPath(e.path);
    if (!key) continue;
    byPath.set(key, e.label.trim());
  }
  if (byPath.size === 0) return items;

  return items.map((item) => {
    if (item.external || /^https?:\/\//i.test(item.href)) {
      return item.children?.length
        ? {
            ...item,
            children: applyNavLabelOverrides(item.children, entries, portal),
          }
        : item;
    }

    const matchKey = navItemMatchKey(item.href);
    // Bare "/" overrides must not paint hash CTAs (e.g. /#tu-van) or other roots.
    const label =
      matchKey && byPath.has(matchKey) ? byPath.get(matchKey) : undefined;

    const next: NavItem = label
      ? { ...item, name: label, shortName: label }
      : { ...item };
    if (item.children?.length) {
      next.children = applyNavLabelOverrides(item.children, entries, portal);
    }
    return next;
  });
}

/** Normalize stored override paths for matching (keeps #hash when present). */
export function normalizeNavMatchPath(path: string): string | null {
  const raw = (path || "").trim();
  if (!raw || /^https?:\/\//i.test(raw)) return null;
  const hashIdx = raw.indexOf("#");
  const pathPart = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const hashPart = hashIdx >= 0 ? raw.slice(hashIdx) : "";
  let p = pathPart.split("?")[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1) || "/";
  if (hashPart && hashPart !== "#") return `${p === "" ? "/" : p}${hashPart}`;
  return p || "/";
}

/** Match key for a nav href (pathname, or pathname+#hash). External → null. */
export function navItemMatchKey(href: string): string | null {
  if (!href || /^https?:\/\//i.test(href)) return null;
  return normalizeNavMatchPath(href);
}

/** Internal path prefixes allowed per portal (after strip). */
export const PORTAL_PATHS: Record<PortalId, string[]> = {
  group: ["/", "/contact", "/japanese-training", "/lien-he"],
  huongnghiep: [
    "/",
    "/du-hoc",
    "/di-lam",
    "/dao-tao-nghe",
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
  dichvu: [
    "/",
    "/bien-phien-dich",
    "/ky-nang-mem",
    "/tu-van-doanh-nghiep",
    "/courses",
    "/schedule",
    "/enterprise",
    "/news",
    "/contact",
  ],
  luyenthi: [
    "/",
    "/classes",
    "/cart",
    "/checkout",
    "/online-exam",
    "/exam",
    "/exam-result",
    "/exam-attempts",
    "/certificate",
    "/news",
    "/contact",
  ],
};

export const SHARED_PATH_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/profile",
  "/company",
  "/cpanel",
  "/article",
  "/create-article",
  "/edit-article",
  "/create-exam",
  "/edit-exam",
  "/manage",
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return (
    pathname === prefix ||
    (prefix !== "/" && pathname.startsWith(`${prefix}/`))
  );
}

export function isPathAllowedForPortal(
  portal: PortalId,
  pathname: string,
): boolean {
  const { internalPath } = stripPortalPrefix(pathname);
  const path = internalPath;

  if (SHARED_PATH_PREFIXES.some((p) => pathMatchesPrefix(path, p))) {
    return true;
  }
  const allowed = PORTAL_PATHS[portal] || [];
  if (allowed.some((p) => pathMatchesPrefix(path, p))) {
    return true;
  }

  // Custom CMS pages (`/:slug`) — allow unless owned by another portal.
  if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) {
    const inferred = inferPortalForPath(path);
    if (!inferred || inferred === portal) return true;
  }

  return false;
}

/** Infer portal from an internal flat path (e.g. /exam/:id → luyenthi). */
export function inferPortalForPath(pathname: string): PortalId | null {
  return inferPortalForFlatPath(pathname);
}

/**
 * Resolve active portal from the public browser pathname.
 * Priority: path prefix > ?portal= (one-shot) > env > group
 */
export function resolvePortal(): PortalId {
  if (typeof window !== "undefined") {
    const fromPath = resolvePortalFromPath(window.location.pathname);
    if (fromPath) return fromPath;

    const { portal } = stripPortalPrefix(window.location.pathname);
    if (portal) return portal;

    const q = new URLSearchParams(window.location.search).get("portal");
    const fromQuery = normalizePortalAlias(q);
    if (fromQuery) return fromQuery;
  }

  const env = import.meta.env.VITE_PORTAL as string | undefined;
  const fromEnv = normalizePortalAlias(env);
  if (fromEnv) return fromEnv;

  return "group";
}

/** Resolve portal for a given public or internal pathname. */
export function resolvePortalForPath(pathname: string): PortalId {
  const fromPrefix = resolvePortalFromPath(pathname);
  if (fromPrefix) return fromPrefix;

  const { portal, internalPath } = stripPortalPrefix(pathname);
  if (resolvePortalFromPath(pathname) || pathname.startsWith("/huong-nghiep") || pathname.startsWith("/dich-vu") || pathname.startsWith("/luyen-thi") || pathname === GROUP_CONTACT_PATH) {
    return portal;
  }

  if (SHARED_PATH_PREFIXES.some((p) => pathMatchesPrefix(internalPath, p))) {
    return resolvePortal();
  }

  const inferred = inferPortalForFlatPath(internalPath);
  if (inferred) return inferred;

  return portal;
}

/** Same-origin public path for a portal page (path-based, no ?portal=). */
export function portalPath(portal: PortalId, path = "/"): string {
  return toPublicPortalPath(portal, path);
}

/** Href for a portal page — always same-origin path now. */
export function portalHref(portal: PortalId, path = "/"): string {
  return toPublicPortalPath(portal, path);
}

/** @deprecated single-origin site */
export function portalOrigin(_portal?: PortalId): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Contact URL on a portal, optional service prefills */
export function portalContactHref(portal: PortalId, service?: string): string {
  const base = portalHref(portal, "/contact");
  if (!service) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}service=${encodeURIComponent(service)}`;
}

/** @deprecated use portalOrigin() */
export function groupOrigin(): string {
  return portalOrigin("group");
}

export const PORTAL_META: Record<
  PortalId,
  { brand: string; label: string; tagline: string; documentTitle: string }
> = {
  group: {
    brand: "Trí Nhân Academy",
    label: "Trí Nhân Academy",
    tagline: "Hệ sinh thái giáo dục & quốc tế",
    documentTitle: "Trí Nhân Academy",
  },
  huongnghiep: {
    brand: "Hướng nghiệp Trí Nhân",
    label: "Hướng nghiệp",
    tagline: "Du học · Đi làm · Đào tạo nghề",
    documentTitle: "Hướng nghiệp — Trí Nhân Academy",
  },
  dichvu: {
    brand: "Dịch vụ Trí Nhân",
    label: "Dịch vụ",
    tagline: "Biên phiên dịch · Kỹ năng mềm · Tư vấn DN",
    documentTitle: "Dịch vụ — Trí Nhân Academy",
  },
  luyenthi: {
    brand: "Luyện thi Trí Nhân",
    label: "Luyện thi",
    tagline: "Thi thử & luyện đề",
    documentTitle: "Luyện thi — Trí Nhân Academy",
  },
};

export function getNavigation(portal: PortalId): NavItem[] {
  if (portal === "huongnghiep") {
    return [
      {
        name: "Giới thiệu",
        href: portalPath("huongnghiep", "/"),
        shortName: "Giới thiệu",
      },
      {
        name: "Du học",
        href: portalPath("huongnghiep", "/du-hoc"),
        shortName: "Du học",
      },
      {
        name: "Đi làm",
        href: portalPath("huongnghiep", "/di-lam"),
        shortName: "Đi làm",
      },
      {
        name: "Đào tạo nghề",
        href: portalPath("huongnghiep", "/dao-tao-nghe"),
        shortName: "Đào tạo nghề",
      },
      {
        name: "Visa",
        href: portalPath("huongnghiep", "/visa-services"),
        shortName: "Visa",
        hideBelowXl: true,
      },
      {
        name: "Tin tức",
        href: portalPath("huongnghiep", "/news"),
        shortName: "Tin tức",
      },
    ];
  }

  if (portal === "dichvu") {
    return [
      {
        name: "Giới thiệu",
        href: portalPath("dichvu", "/"),
        shortName: "Giới thiệu",
      },
      {
        name: "Biên phiên dịch",
        href: portalPath("dichvu", "/bien-phien-dich"),
        shortName: "Biên phiên dịch",
      },
      {
        name: "Kỹ năng mềm",
        href: portalPath("dichvu", "/ky-nang-mem"),
        shortName: "Kỹ năng mềm",
      },
      {
        name: "Tư vấn doanh nghiệp",
        href: portalPath("dichvu", "/tu-van-doanh-nghiep"),
        shortName: "Tư vấn DN",
        hideBelowXl: true,
      },
    ];
  }

  if (portal === "luyenthi") {
    return [
      {
        name: "Luyện thi",
        href: portalPath("luyenthi", "/"),
        shortName: "Luyện thi",
      },
      {
        name: "Khóa học",
        href: portalPath("luyenthi", "/classes"),
        shortName: "Khóa học",
        hideBelowXl: true,
      },
      {
        name: "Tin tức",
        href: portalPath("luyenthi", "/news"),
        shortName: "Tin tức",
      },
    ];
  }

  // Hub — same-origin path links (not external subdomains)
  return [
    {
      name: "Đào tạo",
      href: tnjsTrainingHref(),
      shortName: "Đào tạo",
      external: true,
    },
    {
      name: "Hướng nghiệp",
      href: portalHref("huongnghiep", "/"),
      shortName: "Hướng nghiệp",
    },
    {
      name: "Dịch vụ",
      href: portalHref("dichvu", "/"),
      shortName: "Dịch vụ",
    },
    {
      name: "Luyện thi",
      href: portalHref("luyenthi", "/"),
      shortName: "Luyện thi",
    },
    {
      name: "Tư vấn miễn phí",
      href: portalPath("group", "/#tu-van"),
      shortName: "Tư vấn",
    },
  ];
}

export function getFooterServices(portal: PortalId): NavItem[] {
  if (portal === "huongnghiep") {
    return [
      {
        name: "Du học",
        href: portalPath("huongnghiep", "/du-hoc"),
        shortName: "Du học",
      },
      {
        name: "Đi làm",
        href: portalPath("huongnghiep", "/di-lam"),
        shortName: "Đi làm",
      },
      {
        name: "Đào tạo nghề",
        href: portalPath("huongnghiep", "/dao-tao-nghe"),
        shortName: "Đào tạo nghề",
      },
      {
        name: "Visa",
        href: portalPath("huongnghiep", "/visa-services"),
        shortName: "Visa",
      },
      {
        name: "Trí Nhân Academy",
        href: portalHref("group", "/"),
        shortName: "Group",
      },
    ];
  }
  if (portal === "dichvu") {
    return [
      {
        name: "Biên phiên dịch",
        href: portalPath("dichvu", "/bien-phien-dich"),
        shortName: "Biên phiên dịch",
      },
      {
        name: "Kỹ năng mềm",
        href: portalPath("dichvu", "/ky-nang-mem"),
        shortName: "Kỹ năng mềm",
      },
      {
        name: "Tư vấn doanh nghiệp",
        href: portalPath("dichvu", "/tu-van-doanh-nghiep"),
        shortName: "Tư vấn DN",
      },
      {
        name: "Trí Nhân Academy",
        href: portalHref("group", "/"),
        shortName: "Group",
      },
    ];
  }
  if (portal === "luyenthi") {
    return [
      {
        name: "Luyện thi",
        href: portalPath("luyenthi", "/"),
        shortName: "Luyện thi",
      },
      {
        name: "Khóa học",
        href: portalPath("luyenthi", "/classes"),
        shortName: "Khóa học",
      },
      {
        name: "Đào tạo tiếng Nhật",
        href: tnjsTrainingHref(),
        shortName: "TNJS",
        external: true,
      },
      {
        name: "Trí Nhân Academy",
        href: portalHref("group", "/"),
        shortName: "Group",
      },
    ];
  }
  return [
    {
      name: "Đào tạo tiếng Nhật (TNJS)",
      href: tnjsTrainingHref(),
      shortName: "Đào tạo",
      external: true,
    },
    {
      name: "Hướng nghiệp",
      href: portalHref("huongnghiep", "/"),
      shortName: "Hướng nghiệp",
    },
    {
      name: "Dịch vụ",
      href: portalHref("dichvu", "/"),
      shortName: "Dịch vụ",
    },
    {
      name: "Luyện thi",
      href: portalHref("luyenthi", "/"),
      shortName: "Luyện thi",
    },
  ];
}
