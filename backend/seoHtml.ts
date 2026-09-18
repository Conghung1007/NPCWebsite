import fs from "fs";
import type { Request, Response } from "express";
import { storage } from "./storage";
import { getCmsPageBySlug } from "./cmsPages";
import { PAGE_CONTENT_REGISTRY } from "@shared/pageContentRegistry";
import {
  stripPortalPrefix,
  toPublicPortalPath,
  type PortalId,
} from "@shared/portal";
import { portalPublicOrigin } from "@shared/origins";

const BOT_UA =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|facebot|twitterbot|linkedinbot|discordbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot/i;

const PRIVATE_PREFIXES = [
  "/cpanel",
  "/login",
  "/register",
  "/forgot-password",
  "/profile",
  "/cart",
  "/checkout",
  "/create-article",
  "/edit-article",
  "/create-exam",
  "/edit-exam",
  "/manage",
  "/exam-attempts",
  "/exam-result",
  "/certificate",
  "/api/",
];

const DEFAULT_DESCRIPTION =
  "Trí Nhân Academy — hướng nghiệp, du học, dịch vụ biên phiên dịch & kỹ năng mềm, luyện thi tiếng Nhật.";
const DEFAULT_OG_IMAGE = "/brand/trinhan-academy-logo.png";
const SITE_NAME = "Trí Nhân Academy";

const PORTAL_SEO: Record<
  PortalId,
  { title: string; description: string }
> = {
  group: {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
  huongnghiep: {
    title: "Hướng nghiệp — Trí Nhân Academy",
    description:
      "Tư vấn hướng nghiệp, du học Nhật Bản, đi làm và đào tạo nghề tại Trí Nhân Academy.",
  },
  dichvu: {
    title: "Dịch vụ — Trí Nhân Academy",
    description:
      "Dịch vụ biên phiên dịch, đào tạo kỹ năng mềm và tư vấn doanh nghiệp tại Trí Nhân Academy.",
  },
  luyenthi: {
    title: "Luyện thi — Trí Nhân Academy",
    description:
      "Luyện thi tiếng Nhật online: thi thử, luyện đề JLPT và theo dõi kết quả tại Trí Nhân Academy.",
  },
};

export function isSeoBot(userAgent: string | undefined): boolean {
  return !!userAgent && BOT_UA.test(userAgent);
}

function seoBaseUrl(): string {
  const fromEnv = portalPublicOrigin()?.replace(/\/$/, "");
  if (fromEnv && !/\.railway\.app$/i.test(fromEnv)) return fromEnv;
  return "https://trinhanacademy.com";
}

function absoluteUrl(pathOrUrl: string): string {
  const raw = (pathOrUrl || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${seoBaseUrl()}${path}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainPreview(content: string, max = 160): string {
  const text = content
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`>\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function firstImageUrl(article: {
  imageUrl?: string | null;
  content: string;
}): string | null {
  if (article.imageUrl?.trim()) return article.imageUrl.trim();
  const htmlImg = article.content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlImg?.[1]) return htmlImg[1];
  const mdImg = article.content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return mdImg?.[1] || null;
}

type SeoPayload = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
};

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p),
  );
}

export async function resolveSeoForPath(pathname: string): Promise<SeoPayload> {
  const path = (pathname.split("?")[0] || "/").split("#")[0] || "/";
  const { portal, internalPath } = stripPortalPrefix(path);
  const publicCanonical = path.startsWith("/") ? path : `/${path}`;

  if (isPrivatePath(internalPath) || isPrivatePath(path)) {
    return {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      canonical: absoluteUrl(publicCanonical),
      noindex: true,
    };
  }

  if (internalPath === "/" || internalPath === "") {
    const p = PORTAL_SEO[portal];
    return {
      title: p.title,
      description: p.description,
      canonical: absoluteUrl(toPublicPortalPath(portal, "/")),
      image: DEFAULT_OG_IMAGE,
    };
  }

  const slug = internalPath.replace(/^\//, "").toLowerCase();

  // Registry static pages
  const registryHit = PAGE_CONTENT_REGISTRY.find(
    (e) => e.portal === portal && (e.publicPath === path || e.slug === slug),
  );
  if (registryHit) {
    return {
      title: `${registryHit.label} | ${SITE_NAME}`,
      description: registryHit.description || PORTAL_SEO[portal].description,
      canonical: absoluteUrl(registryHit.publicPath),
      image: DEFAULT_OG_IMAGE,
    };
  }

  try {
    if (portal === "luyenthi") {
      const exam = await storage.getExamBySlug(slug);
      if (exam && exam.isActive !== false) {
        return {
          title: `${exam.title} | ${SITE_NAME}`,
          description: plainPreview(
            typeof exam.description === "string"
              ? exam.description
              : `Đề thi ${exam.title} tại Trí Nhân Academy.`,
          ),
          canonical: absoluteUrl(toPublicPortalPath("luyenthi", `/${exam.slug || exam.id}`)),
          image: DEFAULT_OG_IMAGE,
        };
      }
    }

    const article = await storage.getArticleBySlug(portal, slug);
    if (article) {
      const img = firstImageUrl(article);
      return {
        title: `${article.title} | ${SITE_NAME}`,
        description: plainPreview(article.content),
        canonical: absoluteUrl(
          toPublicPortalPath(
            (article.portal as PortalId) || portal,
            `/${article.slug || article.id}`,
          ),
        ),
        image: img || DEFAULT_OG_IMAGE,
        type: "article",
      };
    }

    const cms = await getCmsPageBySlug(portal, slug);
    if (cms) {
      return {
        title: `${cms.label} | ${SITE_NAME}`,
        description: cms.description || PORTAL_SEO[portal].description,
        canonical: absoluteUrl(
          toPublicPortalPath(portal, `/${cms.slug || slug}`),
        ),
        image: DEFAULT_OG_IMAGE,
      };
    }
  } catch (err) {
    console.warn("seo resolve failed:", err);
  }

  return {
    title: PORTAL_SEO[portal].title,
    description: PORTAL_SEO[portal].description,
    canonical: absoluteUrl(publicCanonical),
    image: DEFAULT_OG_IMAGE,
  };
}

function injectMeta(html: string, seo: SeoPayload): string {
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const canonical = escapeHtml(seo.canonical);
  const image = escapeHtml(absoluteUrl(seo.image || DEFAULT_OG_IMAGE));
  const type = seo.type || "website";
  const robots = seo.noindex ? "noindex,nofollow" : "index,follow";

  const block = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
  `;

  let out = html.replace(/<title>[^<]*<\/title>/i, "");
  out = out.replace(
    /<meta\s+name=["']description["'][^>]*>/gi,
    "",
  );
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  out = out.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "");
  out = out.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "");
  out = out.replace(/<meta\s+name=["']robots["'][^>]*>/gi, "");

  if (out.includes("</head>")) {
    return out.replace("</head>", `${block}</head>`);
  }
  return `${block}${out}`;
}

/** Serve index.html with path-specific meta for known crawlers. */
export async function sendSeoAwareIndex(
  req: Request,
  res: Response,
  indexHtmlPath: string,
): Promise<void> {
  const html = await fs.promises.readFile(indexHtmlPath, "utf8");
  const ua = req.get("user-agent") || undefined;
  if (!isSeoBot(ua)) {
    res.send(html);
    return;
  }
  const pathname = (req.originalUrl || req.url || "/").split("?")[0] || "/";
  try {
    const seo = await resolveSeoForPath(pathname);
    res.type("html").send(injectMeta(html, seo));
  } catch (err) {
    console.warn("seo inject failed, serving plain index:", err);
    res.send(html);
  }
}
