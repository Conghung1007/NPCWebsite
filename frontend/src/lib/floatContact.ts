import type { SiteSettingsInput } from "@shared/siteSettings";

/** Keys owned by Cpanel → Thông tin liên hệ → Nút nổi (group hub only). */
export const FLOAT_WIDGET_KEYS = [
  "floatWidgetsEnabled",
  "floatCtaEnabled",
  "floatCtaLabel",
  "floatCtaHref",
  "floatCtaImageUrl",
  "floatMessengerEnabled",
  "floatMessengerUrl",
  "floatZaloEnabled",
  "floatCallEnabled",
] as const satisfies ReadonlyArray<keyof SiteSettingsInput>;

export type FloatWidgetKey = (typeof FLOAT_WIDGET_KEYS)[number];

/** Brand defaults (same contacts as tnjs.vn) when Cpanel fields are still empty. */
export const DEFAULT_FLOAT_HOTLINE = "0964 885 053";
export const DEFAULT_FLOAT_CALL = "028 6274 9261";
export const DEFAULT_FLOAT_ZALO = "https://zalo.me/0964885053";
export const DEFAULT_FLOAT_MESSENGER = "https://m.me/NgoaiNguTriNhan";
export const DEFAULT_FLOAT_FACEBOOK = "https://www.facebook.com/NgoaiNguTriNhan/";

export function pickFloatWidgetFields(
  source: Partial<SiteSettingsInput> | null | undefined,
): Pick<SiteSettingsInput, FloatWidgetKey> {
  const s = source || {};
  return {
    floatWidgetsEnabled: s.floatWidgetsEnabled ?? true,
    floatCtaEnabled: s.floatCtaEnabled ?? true,
    floatCtaLabel: s.floatCtaLabel || "Tư vấn miễn phí",
    floatCtaHref: s.floatCtaHref || "/#tu-van",
    floatCtaImageUrl: s.floatCtaImageUrl || "",
    floatMessengerEnabled: s.floatMessengerEnabled ?? true,
    floatMessengerUrl: s.floatMessengerUrl || "",
    floatZaloEnabled: s.floatZaloEnabled ?? true,
    floatCallEnabled: s.floatCallEnabled ?? true,
  };
}

export function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Prefer explicit m.me URL; else derive from facebook.com/PageName. */
export function resolveMessengerUrl(
  messengerUrl: string,
  facebookUrl: string,
): string | null {
  const direct = (messengerUrl || "").trim();
  if (direct) {
    if (/^https?:\/\//i.test(direct)) return direct;
    if (direct.startsWith("m.me/")) return `https://${direct}`;
    return `https://m.me/${direct.replace(/^\/+/, "")}`;
  }
  const fb = (facebookUrl || "").trim();
  if (!fb) return null;
  try {
    const u = new URL(fb.startsWith("http") ? fb : `https://${fb}`);
    if (
      !/facebook\.com$/i.test(u.hostname) &&
      !/\.facebook\.com$/i.test(u.hostname)
    ) {
      return null;
    }
    const page = u.pathname.split("/").filter(Boolean)[0];
    if (
      !page ||
      page === "share" ||
      page === "profile.php" ||
      page === "people"
    ) {
      return null;
    }
    return `https://m.me/${decodeURIComponent(page)}`;
  } catch {
    return null;
  }
}

export function resolveZaloUrl(zaloUrl: string, hotline: string): string | null {
  const raw = (zaloUrl || "").trim();
  if (raw) {
    if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
      return raw.startsWith("//") ? `https:${raw}` : raw;
    }
    if (raw.startsWith("zalo.me/")) return `https://${raw}`;
    const digits = digitsOnly(raw);
    if (digits) return `https://zalo.me/${digits}`;
    return null;
  }
  const phone = digitsOnly(hotline);
  return phone ? `https://zalo.me/${phone}` : null;
}

export function resolveTelHref(hotline: string): string | null {
  const phone = digitsOnly(hotline);
  return phone ? `tel:${phone}` : null;
}

export type FloatResolvedLinks = {
  messenger: string | null;
  zalo: string | null;
  call: string | null;
  callLabel: string;
  rightCount: number;
};

export type FloatResolveOptions = {
  /** First hotline line from contact_info when site_settings.hotline empty */
  contactHotline?: string | null;
};

/**
 * Resolve FAB hrefs. Empty Cpanel fields fall back to contact_info then brand defaults
 * so the right stack always shows like tnjs.vn out of the box.
 */
export function resolveFloatLinks(
  settings: Partial<SiteSettingsInput> | null | undefined,
  opts?: FloatResolveOptions,
): FloatResolvedLinks {
  const s = settings || {};
  const hotline =
    (s.hotline || "").trim() ||
    (opts?.contactHotline || "").trim() ||
    DEFAULT_FLOAT_CALL;
  const zalo =
    s.floatZaloEnabled !== false
      ? resolveZaloUrl(
          s.zaloUrl || "",
          (s.hotline || "").trim() || DEFAULT_FLOAT_HOTLINE,
        ) || DEFAULT_FLOAT_ZALO
      : null;
  const facebook = (s.facebookUrl || "").trim() || DEFAULT_FLOAT_FACEBOOK;
  const messengerDirect =
    (s.floatMessengerUrl || "").trim() || DEFAULT_FLOAT_MESSENGER;

  const messenger =
    s.floatMessengerEnabled !== false
      ? resolveMessengerUrl(messengerDirect, facebook) ||
        DEFAULT_FLOAT_MESSENGER
      : null;
  const call =
    s.floatCallEnabled !== false ? resolveTelHref(hotline) : null;

  return {
    messenger,
    zalo,
    call,
    callLabel: hotline,
    rightCount: [messenger, zalo, call].filter(Boolean).length,
  };
}
