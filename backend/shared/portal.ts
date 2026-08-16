/** Shared portal IDs — Phase 0 locked hostnames on npgroup.vn */

export const PORTAL_IDS = ["group", "tnjs", "duhoc", "daotao"] as const;
export type PortalId = (typeof PORTAL_IDS)[number];

export const PORTAL_HOSTS = {
  group: "npgroup.vn",
  tnjs: "tnjs.npgroup.vn",
  duhoc: "duhoc.npgroup.vn",
  daotao: "daotao.npgroup.vn",
} as const;

export function isPortalId(value: unknown): value is PortalId {
  return typeof value === "string" && (PORTAL_IDS as readonly string[]).includes(value);
}

/**
 * Normalize user.portals for ACL.
 * null / empty / missing → unrestricted (all portals).
 */
export function normalizeAllowedPortals(portals: unknown): PortalId[] | null {
  if (!Array.isArray(portals) || portals.length === 0) return null;
  const ids = [...new Set(portals.filter(isPortalId))];
  return ids.length ? ids : null;
}

export function canAccessPortal(
  allowed: PortalId[] | null,
  portal: string | null | undefined,
): boolean {
  if (!allowed) return true;
  return isPortalId(portal) && allowed.includes(portal);
}

/** Sanitize portals from admin form body (empty → null = all). */
export function sanitizePortalsInput(raw: unknown): PortalId[] | null {
  if (raw == null || raw === "") return null;
  if (!Array.isArray(raw)) return null;
  return normalizeAllowedPortals(raw);
}

/** Map legacy article category → portal */
export function portalFromArticleCategory(category: string): PortalId {
  switch (category) {
    case "japanese-training":
      return "tnjs";
    case "study-abroad":
    case "visa-services":
      return "duhoc";
    case "soft-skills":
      return "daotao";
    default:
      return "group";
  }
}

export function resolvePortalFromHost(hostname: string): PortalId | null {
  const host = hostname.toLowerCase().split(":")[0];
  if (host.startsWith("tnjs.") || host === "tnjs.localhost") return "tnjs";
  if (host.startsWith("duhoc.") || host === "duhoc.localhost") return "duhoc";
  if (host.startsWith("daotao.") || host === "daotao.localhost") return "daotao";
  if (
    host === "npgroup.vn" ||
    host === "www.npgroup.vn" ||
    host === "npgroup.localhost" ||
    host === "npgroup.com" ||
    host === "www.npgroup.com"
  ) {
    return "group";
  }
  if (host.includes("npcwebsite") && !host.startsWith("tnjs.")) return "group";
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
  if (isPortalId(input.queryPortal)) return input.queryPortal;
  if (isPortalId(input.headerPortal)) return input.headerPortal;
  if (input.hostname) {
    const fromHost = resolvePortalFromHost(input.hostname);
    if (fromHost) return fromHost;
  }
  if (isPortalId(input.envPortal)) return input.envPortal;
  return "group";
}
