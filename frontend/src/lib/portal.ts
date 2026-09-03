import {
  PORTAL_HOSTS,
  PORTAL_IDS,
  TNJS_EXTERNAL_URL,
  tnjsTrainingHref,
  isPortalId,
  normalizeAllowedPortals,
  normalizePortalAlias,
  resolvePortalFromHost,
  type PortalId,
} from "@shared/portal";

export type { PortalId };
export {
  PORTAL_HOSTS,
  PORTAL_IDS,
  TNJS_EXTERNAL_URL,
  tnjsTrainingHref,
  isPortalId,
  normalizeAllowedPortals,
  normalizePortalAlias,
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

const STORAGE_KEY = "npc_portal";

/** Path prefixes allowed per portal (plus always-shared paths). */
export const PORTAL_PATHS: Record<PortalId, string[]> = {
  group: ["/", "/contact", "/japanese-training"],
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

/** Exclusive route owners — longer prefixes first (`/exam-result` before `/exam`). */
const PATH_OWNING_PORTAL: Array<{ prefix: string; portal: PortalId }> = [
  { prefix: "/online-exam", portal: "luyenthi" },
  { prefix: "/exam-result", portal: "luyenthi" },
  { prefix: "/exam-attempts", portal: "luyenthi" },
  { prefix: "/exam", portal: "luyenthi" },
  { prefix: "/certificate", portal: "luyenthi" },
  { prefix: "/classes", portal: "luyenthi" },
  { prefix: "/cart", portal: "luyenthi" },
  { prefix: "/checkout", portal: "luyenthi" },
  { prefix: "/du-hoc", portal: "huongnghiep" },
  { prefix: "/di-lam", portal: "huongnghiep" },
  { prefix: "/dao-tao-nghe", portal: "huongnghiep" },
  { prefix: "/visa-services", portal: "huongnghiep" },
  { prefix: "/study-abroad", portal: "huongnghiep" },
  { prefix: "/countries", portal: "huongnghiep" },
  { prefix: "/schools", portal: "huongnghiep" },
  { prefix: "/costs", portal: "huongnghiep" },
  { prefix: "/documents", portal: "huongnghiep" },
  { prefix: "/faq", portal: "huongnghiep" },
  { prefix: "/bien-phien-dich", portal: "dichvu" },
  { prefix: "/ky-nang-mem", portal: "dichvu" },
  { prefix: "/tu-van-doanh-nghiep", portal: "dichvu" },
  { prefix: "/courses", portal: "dichvu" },
  { prefix: "/schedule", portal: "dichvu" },
  { prefix: "/enterprise", portal: "dichvu" },
  { prefix: "/japanese-training", portal: "group" },
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`));
}

export function isPathAllowedForPortal(portal: PortalId, pathname: string): boolean {
  if (SHARED_PATH_PREFIXES.some((p) => pathMatchesPrefix(pathname, p))) {
    return true;
  }
  const allowed = PORTAL_PATHS[portal] || [];
  if (allowed.some((p) => pathMatchesPrefix(pathname, p))) {
    return true;
  }

  // Custom CMS pages (`/:slug`) — allow unless the path is owned by another portal.
  if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname)) {
    const inferred = inferPortalForPath(pathname);
    if (!inferred || inferred === portal) return true;
  }

  return false;
}

/** Infer portal from a deep link (e.g. /exam/:id → luyenthi) when soft-lock would 404. */
export function inferPortalForPath(pathname: string): PortalId | null {
  for (const { prefix, portal } of PATH_OWNING_PORTAL) {
    if (pathMatchesPrefix(pathname, prefix)) return portal;
  }
  return null;
}

function persistPortal(portal: PortalId) {
  try {
    localStorage.setItem(STORAGE_KEY, portal);
  } catch {
    /* ignore */
  }
}

function readQueryPortal(): PortalId | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("portal");
  return normalizePortalAlias(q);
}

function readStoredPortal(): PortalId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return normalizePortalAlias(v);
  } catch {
    return null;
  }
}

/** Resolve active portal: ?portal= > host > localStorage > env > group */
export function resolvePortal(): PortalId {
  const fromQuery = readQueryPortal();
  if (fromQuery) {
    persistPortal(fromQuery);
    return fromQuery;
  }

  if (typeof window !== "undefined") {
    const fromHost = resolvePortalFromHost(window.location.hostname);
    if (fromHost) return fromHost;
  }

  const stored = readStoredPortal();
  if (stored) return stored;

  const env = import.meta.env.VITE_PORTAL as string | undefined;
  const fromEnv = normalizePortalAlias(env);
  if (fromEnv) return fromEnv;

  return "group";
}

/**
 * Like resolvePortal, but if the current path belongs to another portal
 * (common after F5 / deploy on /exam/... without ?portal=), switch to it.
 */
export function resolvePortalForPath(pathname: string): PortalId {
  const base = resolvePortal();
  if (isPathAllowedForPortal(base, pathname)) return base;
  const inferred = inferPortalForPath(pathname);
  if (inferred) {
    persistPortal(inferred);
    return inferred;
  }
  return base;
}

const ORIGIN_ENV: Record<PortalId, string | undefined> = {
  group: import.meta.env.VITE_GROUP_ORIGIN as string | undefined,
  huongnghiep: import.meta.env.VITE_HUONGNGHIEP_ORIGIN as string | undefined,
  dichvu: import.meta.env.VITE_DICHVU_ORIGIN as string | undefined,
  luyenthi: import.meta.env.VITE_LUYENTHI_ORIGIN as string | undefined,
};

export function portalOrigin(portal: PortalId): string {
  const configured = ORIGIN_ENV[portal]?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window === "undefined") return "";

  const host = window.location.hostname.toLowerCase();
  if (
    host === "npgroup.com" ||
    host.endsWith(".npgroup.com") ||
    host === "npgroup.vn" ||
    host.endsWith(".npgroup.vn")
  ) {
    return `https://${PORTAL_HOSTS[portal]}`;
  }

  return window.location.origin;
}

/** Same-origin path that keeps ?portal= when origins aren't configured yet */
export function portalPath(portal: PortalId, path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const [pathname, hash = ""] = p.split("#");
  const hashPart = p.includes("#") ? `#${hash}` : "";
  const envKey = ORIGIN_ENV[portal];
  const sameOrigin =
    typeof window !== "undefined" &&
    portalOrigin(portal) === window.location.origin;
  if (sameOrigin && !envKey) {
    const url = new URL(pathname || "/", window.location.origin);
    url.searchParams.set("portal", portal);
    return url.pathname + url.search + hashPart;
  }
  return (pathname || "/") + hashPart;
}

export function portalHref(portal: PortalId, path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = portalOrigin(portal);
  const envKey = ORIGIN_ENV[portal];
  const sameOrigin =
    typeof window !== "undefined" && origin === window.location.origin;
  if (sameOrigin && !envKey) {
    return portalPath(portal, p);
  }
  const [pathname, hash = ""] = p.split("#");
  const hashPart = p.includes("#") ? `#${hash}` : "";
  return `${origin}${pathname || "/"}${hashPart}`;
}

/** Contact URL on a portal, optional service prefills */
export function portalContactHref(portal: PortalId, service?: string): string {
  const base = portalHref(portal, "/contact");
  if (!service) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}service=${encodeURIComponent(service)}`;
}

/** @deprecated use portalOrigin('group') */
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
      {
        name: "Liên hệ",
        href: portalPath("huongnghiep", "/contact"),
        shortName: "Liên hệ",
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
        href: portalContactHref("dichvu", "interpreting"),
        shortName: "Biên phiên dịch",
        external: true,
      },
      {
        name: "Kỹ năng mềm",
        href: portalContactHref("dichvu", "soft-skills"),
        shortName: "Kỹ năng mềm",
        external: true,
      },
      {
        name: "Tư vấn doanh nghiệp",
        href: portalContactHref("dichvu", "enterprise"),
        shortName: "Tư vấn DN",
        external: true,
      },
      {
        name: "Liên hệ",
        href: portalPath("dichvu", "/contact"),
        shortName: "Liên hệ",
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
      {
        name: "Liên hệ",
        href: portalPath("luyenthi", "/contact"),
        shortName: "Liên hệ",
      },
    ];
  }

  // NP Group hub
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
      external: true,
    },
    {
      name: "Dịch vụ",
      href: portalHref("dichvu", "/"),
      shortName: "Dịch vụ",
      external: true,
    },
    {
      name: "Luyện thi",
      href: portalHref("luyenthi", "/"),
      shortName: "Luyện thi",
      external: true,
    },
    {
      name: "Liên hệ",
      href: portalPath("group", "/contact"),
      shortName: "Liên hệ",
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
        external: true,
      },
    ];
  }
  if (portal === "dichvu") {
    return [
      {
        name: "Biên phiên dịch",
        href: portalContactHref("dichvu", "interpreting"),
        shortName: "Biên phiên dịch",
        external: true,
      },
      {
        name: "Kỹ năng mềm",
        href: portalContactHref("dichvu", "soft-skills"),
        shortName: "Kỹ năng mềm",
        external: true,
      },
      {
        name: "Tư vấn doanh nghiệp",
        href: portalContactHref("dichvu", "enterprise"),
        shortName: "Tư vấn DN",
        external: true,
      },
      {
        name: "Trí Nhân Academy",
        href: portalHref("group", "/"),
        shortName: "Group",
        external: true,
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
        external: true,
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
      external: true,
    },
    {
      name: "Dịch vụ",
      href: portalHref("dichvu", "/"),
      shortName: "Dịch vụ",
      external: true,
    },
    {
      name: "Luyện thi",
      href: portalHref("luyenthi", "/"),
      shortName: "Luyện thi",
      external: true,
    },
  ];
}
