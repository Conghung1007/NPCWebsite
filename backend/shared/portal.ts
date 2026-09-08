/** Shared portal IDs — hub + 3 product portals (+ external TNJS) */

export const PORTAL_IDS = [
  "group",
  "huongnghiep",
  "dichvu",
  "luyenthi",
] as const;
export type PortalId = (typeof PORTAL_IDS)[number];

/** Path prefix for each product portal (group uses apex `/`). */
export const PORTAL_BASE_PATH: Record<Exclude<PortalId, "group">, string> = {
  huongnghiep: "/huong-nghiep",
  dichvu: "/dich-vu",
  luyenthi: "/luyen-thi",
};

/** Home segment under a portal prefix (maps to internal `/`). */
export const PORTAL_HOME_SEGMENT = "gioi-thieu";

/** Group hub contact path (internal `/contact`). */
export const GROUP_CONTACT_PATH = "/lien-he";

/** Single apex host (path-based portals; no subdomains). */
export const PORTAL_HOSTS = {
  group: "trinhanacademy.com",
  huongnghiep: "trinhanacademy.com",
  dichvu: "trinhanacademy.com",
  luyenthi: "trinhanacademy.com",
} as const;

/** External Japanese training product site */
export const TNJS_EXTERNAL_URL = "https://tnjs.vn/";

/** User-facing link for Đào tạo / TNJS (always external tnjs.vn) */
export function tnjsTrainingHref(): string {
  return TNJS_EXTERNAL_URL;
}

export function isPortalId(value: unknown): value is PortalId {
  return (
    typeof value === "string" &&
    (PORTAL_IDS as readonly string[]).includes(value)
  );
}

/** Map legacy portal query/host values → current PortalId */
export function normalizePortalAlias(value: unknown): PortalId | null {
  if (isPortalId(value)) return value;
  if (typeof value !== "string") return null;
  switch (value.toLowerCase()) {
    case "duhoc":
      return "huongnghiep";
    case "daotao":
      return "dichvu";
    case "tnjs":
      return "luyenthi";
    case "npgroup":
    case "npc":
      return "group";
    default:
      return null;
  }
}

/**
 * Normalize user.portals for ACL.
 * null / empty / missing → unrestricted (all portals).
 */
export function normalizeAllowedPortals(portals: unknown): PortalId[] | null {
  if (!Array.isArray(portals) || portals.length === 0) return null;
  const ids = Array.from(
    new Set(
      portals
        .map((p) => normalizePortalAlias(p) ?? (isPortalId(p) ? p : null))
        .filter((p): p is PortalId => !!p),
    ),
  );
  return ids.length ? ids : null;
}

export function canAccessPortal(
  allowed: PortalId[] | null,
  portal: string | null | undefined,
): boolean {
  if (!allowed) return true;
  const id = normalizePortalAlias(portal) ?? (isPortalId(portal) ? portal : null);
  return !!id && allowed.includes(id);
}

/** Sanitize portals from admin form body (empty → null = all). */
export function sanitizePortalsInput(raw: unknown): PortalId[] | null {
  if (raw == null || raw === "") return null;
  if (!Array.isArray(raw)) return null;
  return normalizeAllowedPortals(raw);
}

/** Map article category → portal */
export function portalFromArticleCategory(category: string): PortalId {
  switch (category) {
    case "japanese-training":
      return "luyenthi";
    case "study-abroad":
    case "visa-services":
      return "huongnghiep";
    case "soft-skills":
      return "dichvu";
    default:
      return "group";
  }
}

function normalizePathname(pathname: string): string {
  const raw = (pathname.split("?")[0] || "/").split("#")[0] || "/";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1) || "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Portal implied by public URL prefix (`/huong-nghiep/...`). */
export function resolvePortalFromPath(pathname: string): PortalId | null {
  const path = normalizePathname(pathname);
  for (const id of ["huongnghiep", "dichvu", "luyenthi"] as const) {
    const base = PORTAL_BASE_PATH[id];
    if (path === base || path.startsWith(`${base}/`)) return id;
  }
  return null;
}

/**
 * Strip portal prefix for internal routing.
 * `/huong-nghiep/gioi-thieu` → `{ portal: huongnghiep, internalPath: "/" }`
 * `/huong-nghiep/du-hoc` → `{ portal: huongnghiep, internalPath: "/du-hoc" }`
 * `/lien-he` → `{ portal: group, internalPath: "/contact" }`
 */
export function stripPortalPrefix(pathname: string): {
  portal: PortalId;
  internalPath: string;
} {
  const path = normalizePathname(pathname);

  for (const id of ["huongnghiep", "dichvu", "luyenthi"] as const) {
    const base = PORTAL_BASE_PATH[id];
    if (path === base) {
      return { portal: id, internalPath: "/" };
    }
    if (path.startsWith(`${base}/`)) {
      const rest = path.slice(base.length) || "/";
      if (rest === `/${PORTAL_HOME_SEGMENT}`) {
        return { portal: id, internalPath: "/" };
      }
      return { portal: id, internalPath: rest };
    }
  }

  if (path === GROUP_CONTACT_PATH) {
    return { portal: "group", internalPath: "/contact" };
  }

  return { portal: "group", internalPath: path || "/" };
}

/**
 * Build public URL from portal + internal path.
 * `huongnghiep` + `/` → `/huong-nghiep/gioi-thieu`
 * `group` + `/contact` → `/lien-he`
 */
export function toPublicPortalPath(portal: PortalId, internalPath = "/"): string {
  const raw = internalPath.startsWith("/") ? internalPath : `/${internalPath}`;
  const [pathname, hash = ""] = raw.split("#");
  const hashPart = raw.includes("#") ? `#${hash}` : "";
  let p = normalizePathname(pathname || "/");

  if (portal === "group") {
    if (p === "/contact") return `${GROUP_CONTACT_PATH}${hashPart}`;
    return `${p}${hashPart}`;
  }

  const base = PORTAL_BASE_PATH[portal];
  if (p === "/") {
    return `${base}/${PORTAL_HOME_SEGMENT}${hashPart}`;
  }
  return `${base}${p}${hashPart}`;
}

/** Exclusive flat-route owners (for legacy redirects). Longer prefixes first. */
export const FLAT_PATH_OWNING_PORTAL: Array<{ prefix: string; portal: PortalId }> =
  [
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
  ];

export function inferPortalForFlatPath(pathname: string): PortalId | null {
  const path = normalizePathname(pathname);
  if (resolvePortalFromPath(path)) return null;
  for (const { prefix, portal } of FLAT_PATH_OWNING_PORTAL) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return portal;
  }
  return null;
}

/**
 * If the public URL should redirect (bare prefix, or legacy flat path), return target.
 */
export function legacyPublicRedirect(pathname: string): string | null {
  const path = normalizePathname(pathname);

  for (const id of ["huongnghiep", "dichvu", "luyenthi"] as const) {
    const base = PORTAL_BASE_PATH[id];
    if (path === base) {
      return `${base}/${PORTAL_HOME_SEGMENT}`;
    }
  }

  if (path === "/contact") {
    return GROUP_CONTACT_PATH;
  }

  const owner = inferPortalForFlatPath(path);
  if (owner && owner !== "group") {
    return toPublicPortalPath(owner, path);
  }

  return null;
}

/**
 * Host no longer selects portal (path-based). Kept for API compat → always null.
 */
export function resolvePortalFromHost(_hostname: string): PortalId | null {
  return null;
}

/**
 * Resolve portal from Express-like request bits.
 * Priority: X-Portal > ?portal= > path (if provided) > PORTAL env > group
 */
export function resolvePortalFromRequest(input: {
  queryPortal?: unknown;
  headerPortal?: unknown;
  pathname?: string;
  hostname?: string;
  envPortal?: string | undefined;
}): PortalId {
  const fromHeader = normalizePortalAlias(input.headerPortal);
  if (fromHeader) return fromHeader;
  const fromQuery = normalizePortalAlias(input.queryPortal);
  if (fromQuery) return fromQuery;
  if (input.pathname) {
    const fromPath = resolvePortalFromPath(input.pathname);
    if (fromPath) return fromPath;
  }
  const fromEnv = normalizePortalAlias(input.envPortal);
  if (fromEnv) return fromEnv;
  return "group";
}
