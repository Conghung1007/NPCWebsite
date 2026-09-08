import {
  portalPath,
  type PortalId,
} from "@/lib/portal";

type SlugEntity = {
  id: string;
  title?: string | null;
  slug?: string | null;
  portal?: string | null;
};

/** Public exam URL: /luyen-thi/de-thi-n5 (title slug). */
export function examPublicPath(exam: SlugEntity): string {
  const key = (exam.slug || exam.id).trim();
  return portalPath("luyenthi", `/${key}`);
}

/** Public article URL under its portal: /huong-nghiep/ten-bai-viet */
export function articlePublicPath(article: SlugEntity): string {
  const portal = (article.portal as PortalId) || "group";
  const key = (article.slug || article.id).trim();
  return portalPath(portal, `/${key}`);
}
