import type { PortalSectionDef } from "@/pages/portal-sections";

const JSON_KEYS = ["cards", "rows", "steps", "bullets", "faq"] as const;
const TEXT_KEYS = ["title", "description", "lead", "note", "ctaLabel"] as const;

export function portalSectionPageId(slug: string): string {
  return `section-${slug}`;
}

/** Serialize editable section fields to site_contents key/value map */
export function sectionDefToSiteContent(
  def: PortalSectionDef,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TEXT_KEYS) {
    const val = def[key];
    if (val != null && val !== "") out[key] = val;
  }
  if (def.cards?.length) out.cards = JSON.stringify(def.cards);
  if (def.rows?.length) out.rows = JSON.stringify(def.rows);
  if (def.steps?.length) out.steps = JSON.stringify(def.steps);
  if (def.bullets?.length) out.bullets = JSON.stringify(def.bullets);
  if (def.faq?.length) out.faq = JSON.stringify(def.faq);
  return out;
}

function parseJsonArray<T>(raw: string | undefined, fallback: T[] | undefined): T[] | undefined {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Merge DB site_contents over hardcoded section defaults */
export function mergePortalSectionContent(
  fallback: PortalSectionDef,
  remote: Record<string, string>,
): PortalSectionDef {
  return {
    ...fallback,
    title: remote.title ?? fallback.title,
    description: remote.description ?? fallback.description,
    lead: remote.lead ?? fallback.lead,
    note: remote.note ?? fallback.note,
    ctaLabel: remote.ctaLabel ?? fallback.ctaLabel,
    cards: parseJsonArray(remote.cards, fallback.cards),
    rows: parseJsonArray(remote.rows, fallback.rows),
    steps: parseJsonArray(remote.steps, fallback.steps),
    bullets: parseJsonArray(remote.bullets, fallback.bullets),
    faq: parseJsonArray(remote.faq, fallback.faq),
  };
}

export function getPortalSectionDefaults(
  fallback: PortalSectionDef,
): Record<string, string> {
  return sectionDefToSiteContent(fallback);
}

export const PORTAL_SECTION_JSON_FIELDS = JSON_KEYS;
export const PORTAL_SECTION_TEXT_FIELDS = TEXT_KEYS;
