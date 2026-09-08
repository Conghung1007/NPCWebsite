/**
 * Production origins / cookie domain for single-host path-based portals.
 */
import { isPortalId, type PortalId } from "./portal";

/** Safe env read (shared module is typechecked from frontend without @types/node). */
function env(name: string): string | undefined {
  try {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process;
    return typeof p?.env?.[name] === "string" ? p.env[name] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Public suffixes — browsers reject `Domain=.onrender.com` (and similar).
 * Host-only cookies must be used on Render until custom DNS is live.
 */
const PUBLIC_COOKIE_SUFFIXES = [
  "onrender.com",
  "render.com",
  "vercel.app",
  "netlify.app",
  "railway.app",
  "herokuapp.com",
  "github.io",
];

function isPublicCookieSuffix(host: string): boolean {
  const h = host.replace(/^\./, "").toLowerCase();
  return PUBLIC_COOKIE_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/**
 * Cookie Domain for the apex host (optional).
 * Path-based portals share one origin — host-only cookies are enough;
 * COOKIE_DOMAIN is only useful if you still need a parent domain.
 */
export function resolveCookieDomain(): string | undefined {
  const explicit = env("COOKIE_DOMAIN")?.trim();
  if (explicit) {
    const domain = explicit.startsWith(".") ? explicit : `.${explicit}`;
    if (isPublicCookieSuffix(domain)) return undefined;
    return domain.toLowerCase();
  }
  if (env("NODE_ENV") !== "production") return undefined;

  const publicUrl = env("PUBLIC_APP_URL")?.trim();
  if (!publicUrl) return undefined;
  try {
    const host = new URL(publicUrl).hostname.toLowerCase();
    if (isPublicCookieSuffix(host)) return undefined;
    // Single host — prefer host-only cookies; only set Domain for bare apex
    // when COOKIE_DOMAIN is explicit.
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Canonical public origin from PUBLIC_APP_URL (all portals share this). */
export function portalPublicOrigin(_portal?: PortalId): string | undefined {
  const publicUrl = env("PUBLIC_APP_URL")?.replace(/\/$/, "");
  if (publicUrl) return publicUrl;

  // Legacy per-portal envs (same value expected) — use group/first set
  const legacy =
    env("VITE_GROUP_ORIGIN") ||
    env("GROUP_ORIGIN") ||
    env("VITE_HUONGNGHIEP_ORIGIN") ||
    env("HUONGNGHIEP_ORIGIN");
  return legacy?.replace(/\/$/, "") || undefined;
}

/** Prefer request Host, then PUBLIC_APP_URL */
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
    (env("NODE_ENV") === "production" ? "https" : "http");

  if (host && !host.endsWith(".onrender.com")) {
    return `${proto}://${hostHeader?.split(",")[0]?.trim()}`;
  }

  if (isPortalId(input.portal)) {
    const origin = portalPublicOrigin(input.portal);
    if (origin) return origin;
  }

  const publicUrl = portalPublicOrigin();
  if (publicUrl) return publicUrl;

  if (host) return `${proto}://${host}`;
  return "http://localhost:5000";
}

/** Origins allowed for credentialed CORS (single app host + PUBLIC_APP_URL) */
export function allowedCorsOrigins(): string[] {
  const set = new Set<string>();
  const publicUrl = portalPublicOrigin();
  if (publicUrl) set.add(publicUrl);

  // www variants of PUBLIC_APP_URL
  if (publicUrl) {
    try {
      const u = new URL(publicUrl);
      if (u.hostname.startsWith("www.")) {
        set.add(`${u.protocol}//${u.hostname.slice(4)}`);
      } else {
        set.add(`${u.protocol}//www.${u.hostname}`);
      }
    } catch {
      /* ignore */
    }
  }

  set.add("https://tnjs.vn");
  set.add("https://www.tnjs.vn");

  const extra = env("ALLOWED_ORIGINS")?.split(",") || [];
  for (const o of extra) {
    const t = o.trim().replace(/\/$/, "");
    if (t) set.add(t);
  }

  return Array.from(set);
}
