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
    if (!page || page === "share" || page === "profile.php" || page === "people") {
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
  rightCount: number;
};

export function resolveFloatLinks(
  settings: Partial<SiteSettingsInput> | null | undefined,
): FloatResolvedLinks {
  const s = settings || {};
  const messenger =
    s.floatMessengerEnabled !== false
      ? resolveMessengerUrl(s.floatMessengerUrl || "", s.facebookUrl || "")
      : null;
  const zalo =
    s.floatZaloEnabled !== false
      ? resolveZaloUrl(s.zaloUrl || "", s.hotline || "")
      : null;
  const call =
    s.floatCallEnabled !== false ? resolveTelHref(s.hotline || "") : null;
  return {
    messenger,
    zalo,
    call,
    rightCount: [messenger, zalo, call].filter(Boolean).length,
  };
}
