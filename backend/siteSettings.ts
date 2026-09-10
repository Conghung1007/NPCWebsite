import { eq } from "drizzle-orm";
import { db } from "./db";
import { siteSettings, type SiteSetting } from "@shared/schema";
import {
  mergeSiteSettings,
  siteSettingsInputSchema,
  type SiteSettingsInput,
} from "@shared/siteSettings";
import { PORTAL_IDS, type PortalId } from "@shared/portal";

/** Brand mark is site-wide — same lockup on hub + every product portal. */
const SHARED_BRAND_KEYS = ["logoUrl", "logoFooterUrl", "faviconUrl"] as const;

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

async function getGroupBrandFallback(): Promise<
  Pick<SiteSettingsInput, (typeof SHARED_BRAND_KEYS)[number]>
> {
  const [group] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.portal, "group"))
    .limit(1);
  if (!group) {
    return { logoUrl: "", logoFooterUrl: "", faviconUrl: "" };
  }
  return {
    logoUrl: group.logoUrl || "",
    logoFooterUrl: group.logoFooterUrl || "",
    faviconUrl: group.faviconUrl || "",
  };
}

/** Prefer hub brand marks so product portals never keep a stale per-portal logo. */
function withSharedBrand(
  input: SiteSettingsInput,
  hub: Pick<SiteSettingsInput, (typeof SHARED_BRAND_KEYS)[number]>,
): SiteSettingsInput {
  const next = { ...input };
  for (const key of SHARED_BRAND_KEYS) {
    if (hub[key]?.trim()) {
      next[key] = hub[key];
    }
  }
  return next;
}

type BrandPatch = {
  logoUrl: string;
  logoFooterUrl: string;
  faviconUrl?: string;
};

/**
 * Write brand onto every portal. Hub is updated first (source of truth for GET).
 * Empty favicon is omitted so Cpanel logo saves do not wipe a stored faviconUrl.
 */
async function syncBrandAcrossPortals(brand: BrandPatch): Promise<void> {
  const patch: {
    logoUrl: string;
    logoFooterUrl: string;
    faviconUrl?: string;
    updatedAt: Date;
  } = {
    logoUrl: brand.logoUrl || "",
    logoFooterUrl: brand.logoFooterUrl || "",
    updatedAt: new Date(),
  };
  if (brand.faviconUrl !== undefined) {
    patch.faviconUrl = brand.faviconUrl;
  }

  const existing = await db
    .select({ id: siteSettings.id, portal: siteSettings.portal })
    .from(siteSettings);
  const byPortal = new Map(existing.map((r) => [r.portal, r.id]));

  // Hub first so concurrent readers never see a split brand
  const groupId = byPortal.get("group");
  if (groupId) {
    await db.update(siteSettings).set(patch).where(eq(siteSettings.id, groupId));
  } else {
    await db.insert(siteSettings).values({
      portal: "group",
      ...mergeSiteSettings(null),
      ...patch,
    });
  }

  for (const id of PORTAL_IDS) {
    if (id === "group") continue;
    const rowId = byPortal.get(id);
    if (rowId) {
      await db.update(siteSettings).set(patch).where(eq(siteSettings.id, rowId));
    } else {
      await db.insert(siteSettings).values({
        portal: id,
        ...mergeSiteSettings(null),
        ...patch,
      });
    }
  }
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
    const base = mergeSiteSettings(null);
    if (portal === "group") return { ...base, portal };
    const hub = await getGroupBrandFallback();
    return { ...withSharedBrand(base, hub), portal };
  }

  const input = rowToInput(row);
  if (portal === "group") {
    return { ...input, portal: portal as PortalId };
  }
  const hub = await getGroupBrandFallback();
  return { ...withSharedBrand(input, hub), portal: portal as PortalId };
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

  const prev = existing[0] ? rowToInput(existing[0]) : null;

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
    // Cpanel has no favicon field — never blank an existing DB value on save
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

  // Brand lockup is always site-wide (hub + product portals)
  const brandPatch: BrandPatch = {
    logoUrl: values.logoUrl,
    logoFooterUrl: values.logoFooterUrl,
  };
  // Only propagate favicon when the client actually sent one (Cpanel has no favicon field yet)
  if (parsed.faviconUrl?.trim()) {
    brandPatch.faviconUrl = parsed.faviconUrl.trim();
  }
  await syncBrandAcrossPortals(brandPatch);

  return { ...parsed, portal };
}
