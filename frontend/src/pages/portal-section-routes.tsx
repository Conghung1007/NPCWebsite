import { usePortal } from "@/contexts/PortalContext";
import {
  DUHOC_SECTIONS,
  DAOTAO_SECTIONS,
  PortalSectionPage,
  PortalNewsPage,
  getSectionBySlug,
} from "@/pages/portal-sections";
import NotFound from "@/pages/not-found";
import { PORTAL_META } from "@/lib/portal";

/** Route wrapper: /countries | /schools | ... for duhoc / daotao */
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
  if (portal === "tnjs") {
    return (
      <PortalNewsPage
        category="japanese-training"
        title="Tin tức TNJS"
        description="Cập nhật khóa học, lịch thi và hoạt động đào tạo tiếng Nhật."
      />
    );
  }
  if (portal === "daotao") {
    return (
      <PortalNewsPage
        category="soft-skills"
        title="Tin tức đào tạo"
        description="Tin tức và thông báo từ cổng kỹ năng mềm N&P."
      />
    );
  }
  if (portal === "duhoc") {
    return (
      <PortalNewsPage
        category="study-abroad"
        title="Tin tức du học"
        description="Thông tin tuyển sinh, học bổng và cập nhật từ các thị trường du học."
      />
    );
  }
  return <NotFound />;
}

/** Optional index of all section cards — used by daotao home */
export { DUHOC_SECTIONS, DAOTAO_SECTIONS };
