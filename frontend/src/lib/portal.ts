import {
  PORTAL_HOSTS,
  PORTAL_IDS,
  isPortalId,
  normalizeAllowedPortals,
  resolvePortalFromHost,
  type PortalId,
} from "@shared/portal";

export type { PortalId };
export { PORTAL_HOSTS, PORTAL_IDS, isPortalId, normalizeAllowedPortals };

export type NavItem = {
  name: string;
  href: string;
  shortName: string;
  external?: boolean;
  /** Hide in desktop nav below xl (still shown in mobile sheet) */
  hideBelowXl?: boolean;
};

const STORAGE_KEY = "npc_portal";

function readQueryPortal(): PortalId | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("portal");
  return isPortalId(q) ? q : null;
}

function readStoredPortal(): PortalId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isPortalId(v) ? v : null;
  } catch {
    return null;
  }
}

/** Resolve active portal: ?portal= > host > localStorage > env > group */
export function resolvePortal(): PortalId {
  const fromQuery = readQueryPortal();
  if (fromQuery) {
    try {
      localStorage.setItem(STORAGE_KEY, fromQuery);
    } catch {
      /* ignore */
    }
    return fromQuery;
  }

  if (typeof window !== "undefined") {
    const fromHost = resolvePortalFromHost(window.location.hostname);
    if (fromHost) return fromHost;
  }

  const stored = readStoredPortal();
  if (stored) return stored;

  const env = import.meta.env.VITE_PORTAL as string | undefined;
  if (isPortalId(env)) return env;

  return "group";
}

const ORIGIN_ENV: Record<PortalId, string | undefined> = {
  group: import.meta.env.VITE_GROUP_ORIGIN as string | undefined,
  tnjs: import.meta.env.VITE_TNJS_ORIGIN as string | undefined,
  duhoc: import.meta.env.VITE_DUHOC_ORIGIN as string | undefined,
  daotao: import.meta.env.VITE_DAOTAO_ORIGIN as string | undefined,
};

export function portalOrigin(portal: PortalId): string {
  const configured = ORIGIN_ENV[portal]?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window === "undefined") return "";

  const host = window.location.hostname.toLowerCase();
  // On live npgroup hosts: cross-link to sibling subdomains (even without VITE_* at build)
  if (host === "npgroup.vn" || host.endsWith(".npgroup.vn")) {
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

/** @deprecated use portalOrigin('group') */
export function groupOrigin(): string {
  return portalOrigin("group");
}

/** @deprecated use portalOrigin('tnjs') */
export function tnjsOrigin(): string {
  return portalOrigin("tnjs");
}

export const PORTAL_META: Record<
  PortalId,
  { brand: string; tagline: string; documentTitle: string }
> = {
  group: {
    brand: "N&P Group",
    tagline: "Hệ sinh thái giáo dục & quốc tế",
    documentTitle: "N&P Group",
  },
  tnjs: {
    brand: "TNJS",
    tagline: "Đào tạo tiếng Nhật",
    documentTitle: "TNJS | Đào tạo tiếng Nhật — N&P Group",
  },
  duhoc: {
    brand: "Du học N&P",
    tagline: "Tư vấn du học & visa",
    documentTitle: "Du học & Visa — N&P Group",
  },
  daotao: {
    brand: "Đào tạo N&P",
    tagline: "Kỹ năng mềm",
    documentTitle: "Đào tạo kỹ năng mềm — N&P Group",
  },
};

export function getNavigation(portal: PortalId): NavItem[] {
  if (portal === "tnjs") {
    return [
      { name: "Giới thiệu", href: portalPath("tnjs", "/"), shortName: "Giới thiệu" },
      { name: "Khóa học", href: portalPath("tnjs", "/classes"), shortName: "Khóa học" },
      {
        name: "Lịch khai giảng",
        href: portalPath("tnjs", "/#jp-schedule"),
        shortName: "Lịch KG",
        hideBelowXl: true,
      },
      {
        name: "Giáo viên",
        href: portalPath("tnjs", "/#jp-instructors"),
        shortName: "Giáo viên",
        hideBelowXl: true,
      },
      { name: "Tin tức", href: portalPath("tnjs", "/news"), shortName: "Tin tức" },
      {
        name: "Thi trực tuyến",
        href: portalPath("tnjs", "/online-exam"),
        shortName: "Thi",
      },
      { name: "Liên hệ", href: portalPath("tnjs", "/contact"), shortName: "Liên hệ" },
    ];
  }
  if (portal === "duhoc") {
    return [
      { name: "Giới thiệu", href: portalPath("duhoc", "/"), shortName: "Giới thiệu" },
      {
        name: "Quốc gia",
        href: portalPath("duhoc", "/countries"),
        shortName: "Quốc gia",
      },
      {
        name: "Trường học",
        href: portalPath("duhoc", "/schools"),
        shortName: "Trường",
      },
      { name: "Chi phí", href: portalPath("duhoc", "/costs"), shortName: "Chi phí" },
      {
        name: "Hồ sơ",
        href: portalPath("duhoc", "/documents"),
        shortName: "Hồ sơ",
      },
      {
        name: "Visa",
        href: portalPath("duhoc", "/visa-services"),
        shortName: "Visa",
      },
      { name: "FAQ", href: portalPath("duhoc", "/faq"), shortName: "FAQ" },
      { name: "Liên hệ", href: portalPath("duhoc", "/contact"), shortName: "Liên hệ" },
    ];
  }
  if (portal === "daotao") {
    return [
      {
        name: "Giới thiệu",
        href: portalPath("daotao", "/"),
        shortName: "Giới thiệu",
      },
      {
        name: "Khóa học",
        href: portalPath("daotao", "/courses"),
        shortName: "Khóa học",
      },
      {
        name: "Lịch học",
        href: portalPath("daotao", "/schedule"),
        shortName: "Lịch học",
      },
      {
        name: "Doanh nghiệp",
        href: portalPath("daotao", "/enterprise"),
        shortName: "DN",
      },
      { name: "Tin tức", href: portalPath("daotao", "/news"), shortName: "Tin tức" },
      {
        name: "Liên hệ",
        href: portalPath("daotao", "/contact"),
        shortName: "Liên hệ",
      },
    ];
  }
  return [
    { name: "Trang chủ", href: portalPath("group", "/"), shortName: "Trang chủ" },
    {
      name: "TNJS — Tiếng Nhật",
      href: portalHref("tnjs", "/"),
      shortName: "TNJS",
      external: true,
    },
    {
      name: "Du học",
      href: portalHref("duhoc", "/"),
      shortName: "Du học",
      external: true,
    },
    {
      name: "Đào tạo",
      href: portalHref("daotao", "/"),
      shortName: "Đào tạo",
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
  if (portal === "tnjs") {
    return [
      { name: "Giới thiệu", href: portalPath("tnjs", "/"), shortName: "Giới thiệu" },
      { name: "Lớp học", href: portalPath("tnjs", "/classes"), shortName: "Lớp học" },
      {
        name: "Lịch khai giảng",
        href: portalPath("tnjs", "/#jp-schedule"),
        shortName: "Lịch",
      },
      { name: "Tin tức", href: portalPath("tnjs", "/news"), shortName: "Tin" },
      {
        name: "Thi trực tuyến",
        href: portalPath("tnjs", "/online-exam"),
        shortName: "Thi",
      },
      {
        name: "N&P Group",
        href: portalHref("group", "/"),
        shortName: "Group",
        external: true,
      },
    ];
  }
  if (portal === "duhoc") {
    return [
      ...getDuhocFooter(),
      {
        name: "N&P Group",
        href: portalHref("group", "/"),
        shortName: "Group",
        external: true,
      },
    ];
  }
  if (portal === "daotao") {
    return [
      ...getDaotaoFooter(),
      {
        name: "N&P Group",
        href: portalHref("group", "/"),
        shortName: "Group",
        external: true,
      },
    ];
  }
  return [
    {
      name: "TNJS — Đào tạo tiếng Nhật",
      href: portalHref("tnjs", "/"),
      shortName: "TNJS",
      external: true,
    },
    {
      name: "Tư vấn du học & visa",
      href: portalHref("duhoc", "/"),
      shortName: "Du học",
      external: true,
    },
    {
      name: "Đào tạo kỹ năng mềm",
      href: portalHref("daotao", "/"),
      shortName: "Đào tạo",
      external: true,
    },
  ];
}

function getDuhocFooter(): NavItem[] {
  return [
    { name: "Giới thiệu", href: portalPath("duhoc", "/"), shortName: "Giới thiệu" },
    {
      name: "Quốc gia",
      href: portalPath("duhoc", "/countries"),
      shortName: "Quốc gia",
    },
    {
      name: "Trường học",
      href: portalPath("duhoc", "/schools"),
      shortName: "Trường",
    },
    { name: "Chi phí", href: portalPath("duhoc", "/costs"), shortName: "Chi phí" },
    {
      name: "Hồ sơ",
      href: portalPath("duhoc", "/documents"),
      shortName: "Hồ sơ",
    },
    {
      name: "Visa",
      href: portalPath("duhoc", "/visa-services"),
      shortName: "Visa",
    },
    { name: "FAQ", href: portalPath("duhoc", "/faq"), shortName: "FAQ" },
    { name: "Liên hệ", href: portalPath("duhoc", "/contact"), shortName: "Liên hệ" },
  ];
}

function getDaotaoFooter(): NavItem[] {
  return [
    {
      name: "Giới thiệu",
      href: portalPath("daotao", "/"),
      shortName: "Giới thiệu",
    },
    {
      name: "Khóa học",
      href: portalPath("daotao", "/courses"),
      shortName: "Khóa học",
    },
    {
      name: "Lịch học",
      href: portalPath("daotao", "/schedule"),
      shortName: "Lịch",
    },
    {
      name: "Doanh nghiệp",
      href: portalPath("daotao", "/enterprise"),
      shortName: "DN",
    },
    { name: "Tin tức", href: portalPath("daotao", "/news"), shortName: "Tin" },
    {
      name: "Liên hệ",
      href: portalPath("daotao", "/contact"),
      shortName: "Liên hệ",
    },
  ];
}
