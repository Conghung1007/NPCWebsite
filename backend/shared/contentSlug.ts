import { normalizeCmsSlug } from "./cmsPages";

/** UUID v1–v5 shape (exams/articles primary keys). */
export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

/** Title → URL slug (same rules as CMS pages). */
export function slugifyTitle(title: string): string {
  const base = normalizeCmsSlug(title);
  return base || "noi-dung";
}

/**
 * Pick a unique slug from a title. `exists(slug)` should return true when taken
 * by another row (not the current entity).
 */
export async function allocateUniqueSlug(
  title: string,
  exists: (slug: string) => Promise<boolean>,
  preferred?: string,
): Promise<string> {
  const base = slugifyTitle(preferred?.trim() || title);
  if (!(await exists(base))) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
