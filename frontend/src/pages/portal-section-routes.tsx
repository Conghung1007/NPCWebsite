import { usePortal } from "@/contexts/PortalContext";
import {
  DUHOC_SECTIONS,
  DAOTAO_SECTIONS,
  HUONGNGHIEP_TRACKS,
  DICHVU_SECTIONS,
  PortalSectionPage,
  PortalNewsPage,
  getSectionBySlug,
} from "@/pages/portal-sections";
import NotFound from "@/pages/not-found";
import { PORTAL_META } from "@/lib/portal";

/** Route wrapper: section pages for huongnghiep / dichvu */
export function PortalSectionRoute({ slug }: { slug: string }) {
  const { portal } = usePortal();
  const section = getSectionBySlug(portal, slug);
  if (!section) return <NotFound />;
  return (
    <PortalSectionPage
      section={section}
      portalLabel={PORTAL_META[portal].brand}
    />
  );
}

export function PortalNewsRoute() {
  const { portal } = usePortal();
  if (portal === "luyenthi") {
    return (
      <PortalNewsPage
        category="japanese-training"
        title="Tin tức luyện thi"
        description="Cập nhật đề thi, lịch thi và hoạt động luyện thi."
      />
    );
  }
  if (portal === "dichvu") {
    return (
      <PortalNewsPage
        category="soft-skills"
        title="Tin tức dịch vụ"
        description="Tin tức kỹ năng mềm và dịch vụ doanh nghiệp N&P."
      />
    );
  }
  if (portal === "huongnghiep") {
    return (
      <PortalNewsPage
        category="study-abroad"
        title="Tin tức hướng nghiệp"
        description="Thông tin du học, nghề nghiệp và cập nhật từ thị trường."
      />
    );
  }
  return <NotFound />;
}

export { DUHOC_SECTIONS, DAOTAO_SECTIONS, HUONGNGHIEP_TRACKS, DICHVU_SECTIONS };
