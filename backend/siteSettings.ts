import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { siteSettings, type SiteSetting } from "@shared/schema";
import {
  mergeSiteSettings,
  siteSettingsInputSchema,
  type SiteSettingsInput,
} from "@shared/siteSettings";
import type { PortalId } from "@shared/portal";

let floatColumnsReady: Promise<void> | null = null;

/** Idempotent ALTER for floating-widget columns (production may lag drizzle push). */
export function ensureFloatWidgetColumns(): Promise<void> {
  if (!floatColumnsReady) {
    floatColumnsReady = (async () => {
      const alters = [
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_widgets_enabled boolean NOT NULL DEFAULT true`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_cta_enabled boolean NOT NULL DEFAULT true`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_cta_label text NOT NULL DEFAULT 'Tư vấn miễn phí'`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_cta_href text NOT NULL DEFAULT '/#tu-van'`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_cta_image_url text NOT NULL DEFAULT ''`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_messenger_enabled boolean NOT NULL DEFAULT true`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_messenger_url text NOT NULL DEFAULT ''`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_zalo_enabled boolean NOT NULL DEFAULT true`,
        `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS float_call_enabled boolean NOT NULL DEFAULT true`,
      ];
      for (const sql of alters) {
        await pool.query(sql);
      }
    })().catch((err) => {
      console.error("ensureFloatWidgetColumns failed:", err);
      floatColumnsReady = null;
      // Don't block reads forever if ALTER fails (e.g. permission) — retry next call
      throw err;
    });
  }
  return floatColumnsReady;
}

function rowToInput(row: SiteSetting): SiteSettingsInput {
  return {
    siteName: row.siteName || "",
    hotline: row.hotline || "",
    email: row.email || "",
    address: row.address || "",
    facebookUrl: row.facebookUrl || "",
    youtubeUrl: row.youtubeUrl || "",
    zaloUrl: row.zaloUrl || "",
    linkedinUrl: row.linkedinUrl || "",
    tiktokUrl: row.tiktokUrl || "",
    logoUrl: row.logoUrl || "",
    logoFooterUrl: row.logoFooterUrl || "",
    faviconUrl: row.faviconUrl || "",
    privacyUrl: row.privacyUrl || "",
    termsUrl: row.termsUrl || "",
    popupEnabled: row.popupEnabled ?? false,
    popupTitle: row.popupTitle || "",
    popupBody: row.popupBody || "",
    popupImageUrl: row.popupImageUrl || "",
    popupLinkUrl: row.popupLinkUrl || "",
    popupDelayMs: row.popupDelayMs ?? 1500,
    floatWidgetsEnabled: row.floatWidgetsEnabled ?? true,
    floatCtaEnabled: row.floatCtaEnabled ?? true,
    floatCtaLabel: row.floatCtaLabel || "Tư vấn miễn phí",
    floatCtaHref: row.floatCtaHref || "/#tu-van",
    floatCtaImageUrl: row.floatCtaImageUrl || "",
    floatMessengerEnabled: row.floatMessengerEnabled ?? true,
    floatMessengerUrl: row.floatMessengerUrl || "",
    floatZaloEnabled: row.floatZaloEnabled ?? true,
    floatCallEnabled: row.floatCallEnabled ?? true,
  };
}

export async function getSiteSettings(
  portal: PortalId = "group",
): Promise<SiteSettingsInput & { portal: PortalId }> {
  try {
    await ensureFloatWidgetColumns();
  } catch {
    /* columns may already exist / retry later */
  }
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.portal, portal))
    .limit(1);

  if (!row) {
    return { ...mergeSiteSettings(null), portal };
  }
  return { ...rowToInput(row), portal: portal as PortalId };
}

export async function upsertSiteSettings(
  portal: PortalId,
  input: SiteSettingsInput,
): Promise<SiteSettingsInput & { portal: PortalId }> {
  try {
    await ensureFloatWidgetColumns();
  } catch {
    /* retry next time */
  }
  const parsed = siteSettingsInputSchema.parse(input);
  const existing = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.portal, portal))
    .limit(1);

  const prev = existing[0] ? rowToInput(existing[0]) : null;

  const floatValues = {
    floatWidgetsEnabled: parsed.floatWidgetsEnabled ?? true,
    floatCtaEnabled: parsed.floatCtaEnabled ?? true,
    floatCtaLabel: parsed.floatCtaLabel?.trim() || "Tư vấn miễn phí",
    floatCtaHref: parsed.floatCtaHref?.trim() || "/#tu-van",
    floatCtaImageUrl: parsed.floatCtaImageUrl || "",
    floatMessengerEnabled: parsed.floatMessengerEnabled ?? true,
    floatMessengerUrl: parsed.floatMessengerUrl || "",
    floatZaloEnabled: parsed.floatZaloEnabled ?? true,
    floatCallEnabled: parsed.floatCallEnabled ?? true,
  };

  // Float widgets are site-wide and only authoritative on hub (group)
  const applyFloat = portal === "group";

  const values = {
    siteName: parsed.siteName || "",
    hotline: parsed.hotline || "",
    email: parsed.email || "",
    address: parsed.address || "",
    facebookUrl: parsed.facebookUrl || "",
    youtubeUrl: parsed.youtubeUrl || "",
    zaloUrl: parsed.zaloUrl || "",
    linkedinUrl: parsed.linkedinUrl || "",
    tiktokUrl: parsed.tiktokUrl || "",
    logoUrl: prev?.logoUrl || parsed.logoUrl || "",
    logoFooterUrl: prev?.logoFooterUrl || parsed.logoFooterUrl || "",
    faviconUrl: parsed.faviconUrl?.trim()
      ? parsed.faviconUrl.trim()
      : prev?.faviconUrl || "",
    privacyUrl: parsed.privacyUrl || "",
    termsUrl: parsed.termsUrl || "",
    popupEnabled: parsed.popupEnabled ?? false,
    popupTitle: parsed.popupTitle || "",
    popupBody: parsed.popupBody || "",
    popupImageUrl: parsed.popupImageUrl || "",
    popupLinkUrl: parsed.popupLinkUrl || "",
    popupDelayMs: parsed.popupDelayMs ?? 1500,
    ...(applyFloat
      ? floatValues
      : prev
        ? {
            floatWidgetsEnabled: prev.floatWidgetsEnabled,
            floatCtaEnabled: prev.floatCtaEnabled,
            floatCtaLabel: prev.floatCtaLabel,
            floatCtaHref: prev.floatCtaHref,
            floatCtaImageUrl: prev.floatCtaImageUrl,
            floatMessengerEnabled: prev.floatMessengerEnabled,
            floatMessengerUrl: prev.floatMessengerUrl,
            floatZaloEnabled: prev.floatZaloEnabled,
            floatCallEnabled: prev.floatCallEnabled,
          }
        : floatValues),
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db
      .update(siteSettings)
      .set(values)
      .where(eq(siteSettings.id, existing[0].id));
  } else {
    await db.insert(siteSettings).values({ portal, ...values });
  }

  return { ...parsed, ...values, portal };
}
