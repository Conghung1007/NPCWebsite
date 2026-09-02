/** Shared portal IDs — N&P Group hub + 3 product portals (+ external TNJS) */

export const PORTAL_IDS = [
  "group",
  "huongnghiep",
  "dichvu",
  "luyenthi",
] as const;
export type PortalId = (typeof PORTAL_IDS)[number];

/** Production hostnames (npgroup.com + subdomains). TNJS is external tnjs.vn */
export const PORTAL_HOSTS = {
  group: "npgroup.com",
  huongnghiep: "huongnghiep.npgroup.com",
  dichvu: "dichvu.npgroup.com",
  luyenthi: "luyenthi.npgroup.com",
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

export function resolvePortalFromHost(hostname: string): PortalId | null {
  const host = hostname.toLowerCase().split(":")[0];

  if (
    host.startsWith("huongnghiep.") ||
    host === "huongnghiep.localhost" ||
    host.startsWith("duhoc.")
  ) {
    return "huongnghiep";
  }
  if (
    host.startsWith("dichvu.") ||
    host === "dichvu.localhost" ||
    host.startsWith("daotao.")
  ) {
    return "dichvu";
  }
  if (
    host.startsWith("luyenthi.") ||
    host === "luyenthi.localhost" ||
    host.startsWith("tnjs.")
  ) {
    return "luyenthi";
  }
  if (
    host === "npgroup.com" ||
    host === "www.npgroup.com" ||
    host === "npgroup.vn" ||
    host === "www.npgroup.vn" ||
    host === "npgroup.localhost"
  ) {
    return "group";
  }
  if (host.includes("npcwebsite")) return "group";
  return null;
}

/**
 * Resolve portal from Express-like request bits.
 * Priority: ?portal= > X-Portal header > Host > PORTAL env > group
 */
export function resolvePortalFromRequest(input: {
  queryPortal?: unknown;
  headerPortal?: unknown;
  hostname?: string;
  envPortal?: string | undefined;
}): PortalId {
  const fromQuery = normalizePortalAlias(input.queryPortal);
  if (fromQuery) return fromQuery;
  const fromHeader = normalizePortalAlias(input.headerPortal);
  if (fromHeader) return fromHeader;
  if (input.hostname) {
    const fromHost = resolvePortalFromHost(input.hostname);
    if (fromHost) return fromHost;
  }
  const fromEnv = normalizePortalAlias(input.envPortal);
  if (fromEnv) return fromEnv;
  return "group";
}
