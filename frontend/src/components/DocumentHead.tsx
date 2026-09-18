import { useEffect } from "react";
import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_OG_IMAGE,
  SEO_LOCALE,
  SEO_SITE_NAME,
  absoluteSeoUrl,
  buildPageTitle,
  truncateMetaDescription,
} from "@/lib/seo";

export type DocumentHeadProps = {
  title: string;
  description?: string | null;
  /** Path or absolute URL for canonical */
  canonicalPath?: string | null;
  image?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null;
};

function upsertMeta(
  attr: "name" | "property",
  key: string,
  content: string,
) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(
    `link[rel="${rel}"]`,
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  const id = "seo-json-ld";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * Client-side document head for public pages (title, description, OG, canonical, JSON-LD).
 */
export function DocumentHead({
  title,
  description,
  canonicalPath,
  image,
  type = "website",
  noindex = false,
  jsonLd,
}: DocumentHeadProps) {
  const jsonLdSerialized = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const fullTitle = buildPageTitle(title);
    const desc = truncateMetaDescription(
      description?.trim() || SEO_DEFAULT_DESCRIPTION,
    );
    const canonical = absoluteSeoUrl(
      canonicalPath ||
        (typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/"),
    );
    const ogImage = absoluteSeoUrl(image || SEO_DEFAULT_OG_IMAGE);

    document.title = fullTitle;
    upsertMeta("name", "description", desc);
    upsertMeta("name", "robots", noindex ? "noindex,nofollow" : "index,follow");

    upsertLink("canonical", canonical);

    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:site_name", SEO_SITE_NAME);
    upsertMeta("property", "og:locale", SEO_LOCALE);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", ogImage);

    if (jsonLdSerialized) {
      try {
        upsertJsonLd(JSON.parse(jsonLdSerialized));
      } catch {
        /* ignore */
      }
    }
  }, [
    title,
    description,
    canonicalPath,
    image,
    type,
    noindex,
    jsonLdSerialized,
  ]);

  return null;
}

/** Organization + WebSite JSON-LD for portal homes. */
export function buildOrganizationJsonLd(homePath = "/"): Record<string, unknown>[] {
  const origin = absoluteSeoUrl("/");
  const home = absoluteSeoUrl(homePath);
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SEO_SITE_NAME,
      url: origin,
      logo: absoluteSeoUrl(SEO_DEFAULT_OG_IMAGE),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SEO_SITE_NAME,
      url: home,
      inLanguage: "vi-VN",
      publisher: { "@type": "Organization", name: SEO_SITE_NAME },
    },
  ];
}

export function buildArticleJsonLd(input: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  datePublished?: string | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: absoluteSeoUrl(input.url),
    image: input.image ? absoluteSeoUrl(input.image) : absoluteSeoUrl(SEO_DEFAULT_OG_IMAGE),
    datePublished: input.datePublished || undefined,
    author: { "@type": "Organization", name: SEO_SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SEO_SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteSeoUrl(SEO_DEFAULT_OG_IMAGE),
      },
    },
    inLanguage: "vi-VN",
  };
}
