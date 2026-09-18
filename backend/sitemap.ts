import type { Request, Response } from "express";
import { storage } from "./storage";
import { listCmsPages } from "./cmsPages";
import { listHiddenPublicPathEntries } from "./cmsHiddenPages";
import { PAGE_CONTENT_REGISTRY } from "@shared/pageContentRegistry";
import { cmsPageToContentEntry } from "@shared/cmsPages";
import {
  isPortalId,
  toPublicPortalPath,
  type PortalId,
} from "@shared/portal";
import { portalPublicOrigin } from "@shared/origins";

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

function sitemapBaseUrl(): string {
  const fromEnv = portalPublicOrigin()?.replace(/\/$/, "");
  if (fromEnv && !/\.railway\.app$/i.test(fromEnv) && !/\.up\.railway\.app$/i.test(fromEnv)) {
    return fromEnv;
  }
  return "https://trinhanacademy.com";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absoluteUrl(base: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function toLastmod(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function articlePublicPath(article: {
  slug?: string | null;
  id: string;
  portal?: string | null;
}): string {
  const portal = (isPortalId(article.portal) ? article.portal : "group") as PortalId;
  const key = (article.slug || article.id).trim();
  return toPublicPortalPath(portal, `/${key}`);
}

function examPublicPath(exam: { slug?: string | null; id: string }): string {
  const key = (exam.slug || exam.id).trim();
  return toPublicPortalPath("luyenthi", `/${key}`);
}

/** Extra static public pages not always in PAGE_CONTENT_REGISTRY contact slots. */
const EXTRA_STATIC_PATHS: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: toPublicPortalPath("group", "/contact"), priority: "0.7", changefreq: "monthly" },
  { path: toPublicPortalPath("huongnghiep", "/contact"), priority: "0.6", changefreq: "monthly" },
  { path: toPublicPortalPath("dichvu", "/contact"), priority: "0.6", changefreq: "monthly" },
  { path: toPublicPortalPath("luyenthi", "/contact"), priority: "0.6", changefreq: "monthly" },
  { path: toPublicPortalPath("luyenthi", "/online-exam"), priority: "0.7", changefreq: "weekly" },
];

export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const base = sitemapBaseUrl();
  const hidden = await listHiddenPublicPathEntries();
  const hiddenPaths = new Set(hidden.map((h) => h.path));

  const byLoc = new Map<string, SitemapEntry>();

  const add = (
    path: string,
    opts?: { lastmod?: string; changefreq?: string; priority?: string },
  ) => {
    if (!path || path.includes("#")) return;
    if (hiddenPaths.has(path)) return;
    const loc = absoluteUrl(base, path);
    if (byLoc.has(loc)) return;
    byLoc.set(loc, {
      loc,
      lastmod: opts?.lastmod,
      changefreq: opts?.changefreq || "weekly",
      priority: opts?.priority || "0.6",
    });
  };

  for (const entry of PAGE_CONTENT_REGISTRY) {
    const isHome =
      entry.publicPath === "/" ||
      entry.publicPath.endsWith("/gioi-thieu");
    add(entry.publicPath, {
      priority: isHome ? "1.0" : "0.8",
      changefreq: isHome ? "daily" : "weekly",
    });
  }

  for (const extra of EXTRA_STATIC_PATHS) {
    add(extra.path, {
      priority: extra.priority,
      changefreq: extra.changefreq,
    });
  }

  try {
    const cmsPages = await listCmsPages();
    for (const row of cmsPages) {
      const entry = cmsPageToContentEntry(row);
      add(entry.publicPath, {
        lastmod: toLastmod(row.updatedAt),
        priority: "0.7",
        changefreq: "weekly",
      });
    }
  } catch (err) {
    console.warn("sitemap: listCmsPages failed", err);
  }

  try {
    const articles = await storage.getAllArticles();
    for (const article of articles) {
      if (!article.slug && !article.id) continue;
      add(articlePublicPath(article), {
        lastmod: toLastmod(article.createdAt),
        priority: "0.6",
        changefreq: "weekly",
      });
    }
  } catch (err) {
    console.warn("sitemap: getAllArticles failed", err);
  }

  try {
    const exams = await storage.getActiveExams();
    for (const exam of exams) {
      add(examPublicPath(exam), {
        lastmod: toLastmod(exam.createdAt),
        priority: "0.7",
        changefreq: "weekly",
      });
    }
  } catch (err) {
    console.warn("sitemap: getActiveExams failed", err);
  }

  return Array.from(byLoc.values()).sort((a, b) =>
    a.loc.localeCompare(b.loc),
  );
}

function renderSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`);
      if (e.changefreq) {
        parts.push(`    <changefreq>${escapeXml(e.changefreq)}</changefreq>`);
      }
      if (e.priority) {
        parts.push(`    <priority>${escapeXml(e.priority)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function renderRobotsTxt(baseUrl: string): string {
  const sitemap = `${baseUrl.replace(/\/$/, "")}/sitemap.xml`;
  const prefixes = ["", "/huong-nghiep", "/dich-vu", "/luyen-thi"];
  const privatePaths = [
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
  ];

  const disallows = [
    ...privatePaths.flatMap((p) =>
      prefixes.map((pre) => `Disallow: ${pre}${p}`),
    ),
    "Disallow: /api/",
  ];

  return `User-agent: *
Allow: /

${disallows.join("\n")}

Sitemap: ${sitemap}
`;
}

export async function handleSitemap(_req: Request, res: Response): Promise<void> {
  try {
    const entries = await buildSitemapEntries();
    const xml = renderSitemapXml(entries);
    res
      .status(200)
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(xml);
  } catch (err) {
    console.error("sitemap.xml error:", err);
    res.status(500).type("text/plain").send("Failed to build sitemap");
  }
}

export function handleRobots(_req: Request, res: Response): void {
  const body = renderRobotsTxt(sitemapBaseUrl());
  res
    .status(200)
    .type("text/plain")
    .set("Cache-Control", "public, max-age=86400")
    .send(body);
}
