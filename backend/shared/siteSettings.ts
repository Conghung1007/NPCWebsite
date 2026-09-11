import { z } from "zod";
import type { PortalId } from "./portal";

export const siteSettingsInputSchema = z.object({
  siteName: z.string().max(200).optional().default(""),
  hotline: z.string().max(50).optional().default(""),
  email: z.string().max(120).optional().default(""),
  address: z.string().max(500).optional().default(""),
  facebookUrl: z.string().max(500).optional().default(""),
  youtubeUrl: z.string().max(500).optional().default(""),
  zaloUrl: z.string().max(500).optional().default(""),
  linkedinUrl: z.string().max(500).optional().default(""),
  tiktokUrl: z.string().max(500).optional().default(""),
  logoUrl: z.string().max(500).optional().default(""),
  logoFooterUrl: z.string().max(500).optional().default(""),
  faviconUrl: z.string().max(500).optional().default(""),
  privacyUrl: z.string().max(500).optional().default(""),
  termsUrl: z.string().max(500).optional().default(""),
  popupEnabled: z.boolean().optional().default(false),
  popupTitle: z.string().max(200).optional().default(""),
  popupBody: z.string().max(2000).optional().default(""),
  popupImageUrl: z.string().max(500).optional().default(""),
  popupLinkUrl: z.string().max(500).optional().default(""),
  popupDelayMs: z.number().int().min(0).max(60000).optional().default(1500),
  floatWidgetsEnabled: z.boolean().optional().default(true),
  floatCtaEnabled: z.boolean().optional().default(true),
  floatCtaLabel: z.string().max(80).optional().default("Tư vấn miễn phí"),
  floatCtaHref: z.string().max(500).optional().default("/#tu-van"),
  floatCtaImageUrl: z.string().max(500).optional().default(""),
  floatMessengerEnabled: z.boolean().optional().default(true),
  floatMessengerUrl: z.string().max(500).optional().default(""),
  floatZaloEnabled: z.boolean().optional().default(true),
  floatCallEnabled: z.boolean().optional().default(true),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsInputSchema>;

export type PublicSiteSettings = SiteSettingsInput & { portal: PortalId };

export const DEFAULT_SITE_SETTINGS: SiteSettingsInput = {
  siteName: "Trí Nhân Academy",
  hotline: "",
  email: "",
  address: "",
  facebookUrl: "",
  youtubeUrl: "",
  zaloUrl: "",
  linkedinUrl: "",
  tiktokUrl: "",
  logoUrl: "",
  logoFooterUrl: "",
  faviconUrl: "",
  privacyUrl: "",
  termsUrl: "",
  popupEnabled: false,
  popupTitle: "",
  popupBody: "",
  popupImageUrl: "",
  popupLinkUrl: "",
  popupDelayMs: 1500,
  floatWidgetsEnabled: true,
  floatCtaEnabled: true,
  floatCtaLabel: "Tư vấn miễn phí",
  floatCtaHref: "/#tu-van",
  floatCtaImageUrl: "",
  floatMessengerEnabled: true,
  floatMessengerUrl: "",
  floatZaloEnabled: true,
  floatCallEnabled: true,
};

export function mergeSiteSettings(
  row: Partial<SiteSettingsInput> | null | undefined,
): SiteSettingsInput {
  return { ...DEFAULT_SITE_SETTINGS, ...(row || {}) };
}
