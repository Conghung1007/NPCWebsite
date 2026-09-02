/**
 * Production origins / cookie domain for multi-portal hosts on npgroup.com
 */
import { PORTAL_HOSTS, PORTAL_IDS, isPortalId, type PortalId } from "./portal";

/** Cookie Domain shared across apex + subdomains (e.g. `.npgroup.com`) */
export function resolveCookieDomain(): string | undefined {
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) {
    return explicit.startsWith(".") ? explicit : `.${explicit}`;
  }
  if (process.env.NODE_ENV !== "production") return undefined;

  const publicUrl = process.env.PUBLIC_APP_URL?.trim();
  if (!publicUrl) return undefined;
  try {
    const host = new URL(publicUrl).hostname.toLowerCase();
    if (host === "npgroup.com" || host.endsWith(".npgroup.com")) {
      return ".npgroup.com";
    }
    if (host === "npgroup.vn" || host.endsWith(".npgroup.vn")) {
      return ".npgroup.vn";
    }
    const parts = host.split(".");
    if (parts.length >= 2) {
      return `.${parts.slice(-2).join(".")}`;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

const PORTAL_ORIGIN_ENV: Record<PortalId, string | undefined> = {
  group: process.env.VITE_GROUP_ORIGIN || process.env.GROUP_ORIGIN,
  huongnghiep:
    process.env.VITE_HUONGNGHIEP_ORIGIN || process.env.HUONGNGHIEP_ORIGIN,
  dichvu: process.env.VITE_DICHVU_ORIGIN || process.env.DICHVU_ORIGIN,
  luyenthi: process.env.VITE_LUYENTHI_ORIGIN || process.env.LUYENTHI_ORIGIN,
};

export function portalPublicOrigin(portal: PortalId): string | undefined {
  const fromEnv = PORTAL_ORIGIN_ENV[portal]?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = PORTAL_HOSTS[portal];
  if (process.env.NODE_ENV === "production" && host) {
    return `https://${host}`;
  }
  return undefined;
}

/** Prefer request Host (user's current portal), then portal env, then PUBLIC_APP_URL */
export function resolvePublicBaseUrl(input: {
  host?: string | string[] | undefined;
  forwardedProto?: string | string[] | undefined;
  protocol?: string;
  portal?: PortalId | string | null;
}): string {
  const hostHeader = Array.isArray(input.host) ? input.host[0] : input.host;
  const host = hostHeader?.split(",")[0]?.trim().split(":")[0];
  const protoHeader = Array.isArray(input.forwardedProto)
    ? input.forwardedProto[0]
    : input.forwardedProto;
  const proto =
    protoHeader?.split(",")[0]?.trim() ||
    input.protocol ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host && !host.endsWith(".onrender.com")) {
    return `${proto}://${hostHeader?.split(",")[0]?.trim()}`;
  }

  if (isPortalId(input.portal)) {
    const origin = portalPublicOrigin(input.portal);
    if (origin) return origin;
  }

  const publicUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (publicUrl) return publicUrl;

  if (host) return `${proto}://${host}`;
  return "http://localhost:5000";
}

/** Origins allowed for credentialed CORS (subdomain portals + PUBLIC_APP_URL) */
export function allowedCorsOrigins(): string[] {
  const set = new Set<string>();
  const publicUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (publicUrl) set.add(publicUrl);

  for (const id of PORTAL_IDS) {
    const o = portalPublicOrigin(id);
    if (o) set.add(o);
  }

  for (const host of Object.values(PORTAL_HOSTS)) {
    set.add(`https://${host}`);
  }
  set.add("https://www.npgroup.com");
  set.add("https://www.npgroup.vn");
  set.add("https://tnjs.vn");
  set.add("https://www.tnjs.vn");

  const extra = process.env.ALLOWED_ORIGINS?.split(",") || [];
  for (const o of extra) {
    const t = o.trim().replace(/\/$/, "");
    if (t) set.add(t);
  }

  return [...set];
}
