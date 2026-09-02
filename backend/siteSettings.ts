import { eq } from "drizzle-orm";
import { db } from "./db";
import { siteSettings, type SiteSetting } from "@shared/schema";
import {
  mergeSiteSettings,
  siteSettingsInputSchema,
  type SiteSettingsInput,
} from "@shared/siteSettings";
import type { PortalId } from "@shared/portal";

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
  };
}

export async function getSiteSettings(
  portal: PortalId = "group",
): Promise<SiteSettingsInput & { portal: PortalId }> {
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
  const parsed = siteSettingsInputSchema.parse(input);
  const existing = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.portal, portal))
    .limit(1);

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
    logoUrl: parsed.logoUrl || "",
    logoFooterUrl: parsed.logoFooterUrl || "",
    faviconUrl: parsed.faviconUrl || "",
    privacyUrl: parsed.privacyUrl || "",
    termsUrl: parsed.termsUrl || "",
    popupEnabled: parsed.popupEnabled ?? false,
    popupTitle: parsed.popupTitle || "",
    popupBody: parsed.popupBody || "",
    popupImageUrl: parsed.popupImageUrl || "",
    popupLinkUrl: parsed.popupLinkUrl || "",
    popupDelayMs: parsed.popupDelayMs ?? 1500,
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

  return { ...parsed, portal };
}
