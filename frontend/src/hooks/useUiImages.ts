import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

interface UiImage {
  id: string;
  imageType: string;
  imageUrl: string;
  altText?: string;
  description?: string;
}

/** Alternate DB imageType keys that map to the same slot on the UI */
const TYPE_ALIASES: Record<string, string[]> = {
  "online-exam": ["online-exam", "exam"],
  "why-choose-us": ["why-choose-us", "why-choose-image", "about-company"],
  "hero-banner": ["hero-banner", "hero"],
  "visa-service": ["visa-service", "visa-services"],
  "visa-hero": ["visa-hero", "visa-service", "visa-services"],
  "visa-consultation": ["visa-consultation"],
  "study-abroad-hero": ["study-abroad-hero", "study-abroad"],
  "study-abroad-students": ["study-abroad-students", "study-abroad"],
  "japanese-hero": ["japanese-hero", "japanese-training-hero", "japanese-training"],
  "japanese-training-hero": [
    "japanese-training-hero",
    "japanese-hero",
    "japanese-training",
  ],
  "japanese-classroom": [
    "japanese-classroom",
    "japanese-training-classroom",
    "japanese-training",
  ],
  "japanese-training-classroom": [
    "japanese-training-classroom",
    "japanese-classroom",
    "japanese-training",
  ],
  "instructor-1": ["instructor-1", "japanese-instructor-1"],
  "instructor-2": ["instructor-2", "japanese-instructor-2"],
  "instructor-3": ["instructor-3", "japanese-instructor-3"],
};

/** Public fallbacks when CMS has no usable URL (API down / private R2 only) */
export const UI_IMAGE_FALLBACKS: Record<string, string> = {
  "hero-banner":
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80",
  "why-choose-us":
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2084&q=80",
  "visa-hero":
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
  "visa-service":
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
  "study-abroad-hero":
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
  "study-abroad-students":
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
  "japanese-hero":
    "https://images.unsplash.com/photo-1528164344705-47542687000d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2092&q=80",
  "japanese-classroom":
    "https://images.unsplash.com/photo-1528164344705-47542687000d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2092&q=80",
  "online-exam":
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
  "contact-hero":
    "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
};

/**
 * Prefer URLs that work without R2 credentials.
 * Unsigned R2 host URLs and proxy paths often 404 when R2 env is missing.
 */
function rewritePrivateR2ToProxy(url: string): string | null {
  if (!url.includes(".r2.cloudflarestorage.com")) return null;
  if (/[?&]X-Amz-/i.test(url)) return null;
  try {
    const { pathname } = new URL(url);
    const path = pathname.replace(/^\//, "");
    const uiIdx = path.indexOf("ui-images/");
    if (uiIdx >= 0) {
      return `/api/proxy-image/primary/${path.slice(uiIdx)}`;
    }
    // Drop leading bucket segment if present: bucket/key...
    const parts = path.split("/");
    if (parts.length >= 2) {
      return `/api/proxy-image/primary/${parts.slice(1).join("/")}`;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeImageUrl(url: string): string {
  return rewritePrivateR2ToProxy(url) || url;
}

function urlReliability(url: string): number {
  if (!url) return -1;
  if (url.includes(".r2.cloudflarestorage.com") && !/[?&]X-Amz-/i.test(url)) {
    return 0; // private bucket URL without signature
  }
  if (url.startsWith("/api/proxy-image/") || url.startsWith("/ui-images/")) {
    return 1; // needs working R2 + proxy
  }
  if (/^https?:\/\//i.test(url)) {
    return 3; // public CDN / Unsplash / etc.
  }
  return 2;
}

function pickBestUrl(candidates: UiImage[]): string {
  if (!candidates.length) return "";
  const normalized = candidates.map((img) => ({
    ...img,
    imageUrl: normalizeImageUrl(img.imageUrl),
  }));
  const sorted = [...normalized].sort(
    (a, b) => urlReliability(b.imageUrl) - urlReliability(a.imageUrl),
  );
  for (const img of sorted) {
    if (urlReliability(img.imageUrl) > 0) return img.imageUrl;
  }
  return "";
}

export function useUiImages() {
  const queryClient = useQueryClient();

  const { data: uiImages, isLoading } = useQuery<UiImage[]>({
    queryKey: ["/api/ui-images"],
    retry: false,
  });

  const getImageByType = useCallback(
    (imageType: string, fallbackUrl?: string): string => {
      const fallback = fallbackUrl || UI_IMAGE_FALLBACKS[imageType] || "";

      if (!uiImages?.length) return fallback;

      // Prefer exact type first (so R2/proxy assets win over alias fallbacks)
      const exact = uiImages.filter((img) => img.imageType === imageType);
      const exactUrl = pickBestUrl(exact);
      if (exactUrl) return exactUrl;

      const aliases = (TYPE_ALIASES[imageType] || []).filter((t) => t !== imageType);
      if (aliases.length) {
        const matches = uiImages.filter((img) => aliases.includes(img.imageType));
        const aliasUrl = pickBestUrl(matches);
        if (aliasUrl) return aliasUrl;
      }

      return fallback;
    },
    [uiImages],
  );

  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/ui-images"] });
  }, [queryClient]);

  return {
    uiImages,
    isLoading,
    getImageByType,
    invalidateCache,
  };
}
