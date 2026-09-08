/**
 * Normalize Google Maps paste (iframe HTML, share link, address) into an embeddable URL.
 */

export function normalizeGoogleMapsEmbedUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  let url = raw.trim().replace(/&amp;/gi, "&");

  const iframeSrc = url.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeSrc?.[1]) {
    url = iframeSrc[1].trim().replace(/&amp;/gi, "&");
  } else {
    const srcOnly = url.match(/src=["']([^"']+)["']/i);
    if (srcOnly?.[1] && /maps/i.test(srcOnly[1])) {
      url = srcOnly[1].trim().replace(/&amp;/gi, "&");
    }
  }

  if (
    /google\.[^/]*\/maps\/embed/i.test(url) ||
    /maps\.google\.[^/]*\/.*embed/i.test(url)
  ) {
    return url;
  }

  if (/[?&]output=embed\b/i.test(url)) {
    return url;
  }

  // Short links cannot be expanded client-side
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) {
    return null;
  }

  const coords = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coords) {
    const [, lat, lng] = coords;
    return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }

  try {
    const parsed = new URL(url);
    const q =
      parsed.searchParams.get("q") ||
      parsed.searchParams.get("query") ||
      parsed.searchParams.get("destination");
    if (q) {
      return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }
    const pb = parsed.searchParams.get("pb");
    if (pb) {
      return `https://www.google.com/maps/embed?pb=${pb}`;
    }
  } catch {
    /* not an absolute URL */
  }

  const place = url.match(/\/maps\/place\/([^/@]+)/i);
  if (place?.[1]) {
    const name = decodeURIComponent(place[1].replace(/\+/g, " "));
    return `https://www.google.com/maps?q=${encodeURIComponent(name)}&output=embed`;
  }

  if (/google\.[^/]+\/maps/i.test(url)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  }

  // Plain address / place name
  if (!/^https?:\/\//i.test(url)) {
    return buildMapsEmbedFromAddress(url);
  }

  return null;
}

export function buildMapsEmbedFromAddress(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`;
}

/** Prefer mapUrl; fall back to first address line. */
export function resolveOfficeMapEmbed(opts: {
  mapUrl?: string | null;
  addressLines?: string[] | null;
}): { embedUrl: string | null; openUrl: string | null } {
  const fromMap = normalizeGoogleMapsEmbedUrl(opts.mapUrl);
  if (fromMap) {
    return {
      embedUrl: fromMap,
      openUrl: fromMap.replace(/[?&]output=embed\b/, "").replace(/\?$/, ""),
    };
  }

  const address = (opts.addressLines || []).map((s) => s.trim()).find(Boolean);
  if (address) {
    const embedUrl = buildMapsEmbedFromAddress(address);
    return {
      embedUrl,
      openUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    };
  }

  // Short link: still offer open-in-maps
  const raw = opts.mapUrl?.trim();
  if (raw && /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[^/]+\/maps/i.test(raw)) {
    return { embedUrl: null, openUrl: raw };
  }

  return { embedUrl: null, openUrl: null };
}

export function normalizeContactContent(content: unknown): string[] {
  if (Array.isArray(content)) {
    return content.map((c) => String(c ?? "").trim()).filter(Boolean);
  }
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c ?? "").trim()).filter(Boolean);
      }
    } catch {
      /* plain text */
    }
    return trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
