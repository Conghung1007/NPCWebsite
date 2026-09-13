import { useEffect } from "react";
import { useLocation } from "wouter";
import { usePortal } from "@/contexts/PortalContext";
import { BlockStaticPage } from "@/components/BlockStaticPage";
import { portalPath, type PortalId } from "@/lib/portal";

const SECTION_META: Record<
  string,
  { layoutKey: string; portal: PortalId; label: string }
> = {
  "du-hoc": {
    layoutKey: "section-du-hoc",
    portal: "huongnghiep",
    label: "Du học",
  },
  "di-lam": {
    layoutKey: "section-di-lam",
    portal: "huongnghiep",
    label: "Đi làm",
  },
  "dao-tao-nghe": {
    layoutKey: "section-dao-tao-nghe",
    portal: "huongnghiep",
    label: "Đào tạo nghề",
  },
  "bien-phien-dich": {
    layoutKey: "section-bien-phien-dich",
    portal: "dichvu",
    label: "Biên phiên dịch",
  },
  "ky-nang-mem": {
    layoutKey: "section-ky-nang-mem",
    portal: "dichvu",
    label: "Kỹ năng mềm",
  },
  "tu-van-doanh-nghiep": {
    layoutKey: "section-tu-van-doanh-nghiep",
    portal: "dichvu",
    label: "Tư vấn doanh nghiệp",
  },
};

/** Old helper URLs → header parent page */
const LEGACY_REDIRECTS: Record<string, string> = {
  "/study-abroad": portalPath("huongnghiep", "/du-hoc"),
  "/countries": portalPath("huongnghiep", "/du-hoc"),
  "/schools": portalPath("huongnghiep", "/du-hoc"),
  "/costs": portalPath("huongnghiep", "/du-hoc"),
  "/documents": portalPath("huongnghiep", "/du-hoc"),
  "/faq": portalPath("huongnghiep", "/du-hoc"),
  "/courses": portalPath("dichvu", "/"),
  "/schedule": portalPath("dichvu", "/"),
  "/enterprise": portalPath("dichvu", "/"),
};

export function LegacyMarketingRedirect({ fromPath }: { fromPath: string }) {
  const [, setLocation] = useLocation();
  const target = LEGACY_REDIRECTS[fromPath] || "/";
  useEffect(() => {
    setLocation(target, { replace: true });
  }, [setLocation, target]);
  return (
    <div className="page-loading-shell" role="status" aria-label="Đang chuyển trang">
      <div className="page-loading-hero" />
    </div>
  );
}

export function BlockSectionPage({ slug }: { slug: string }) {
  const meta = SECTION_META[slug];
  if (!meta) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground">
        Không tìm thấy trang.
      </div>
    );
  }
  return (
    <BlockStaticPage
      layoutKey={meta.layoutKey}
      portal={meta.portal}
      label={meta.label}
    />
  );
}

export function BlockContactPage() {
  const { portal } = usePortal();
  const layoutKey =
    portal === "group" ? "group-contact" : `${portal}-contact`;
  return (
    <BlockStaticPage
      layoutKey={layoutKey}
      portal={portal}
      label="Liên hệ"
    />
  );
}

export function BlockNewsPage() {
  const { portal } = usePortal();
  if (portal === "group") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground">
        Chọn Hướng nghiệp, Dịch vụ hoặc Luyện thi để xem tin tức.
      </div>
    );
  }
  return (
    <BlockStaticPage
      layoutKey={`${portal}-news`}
      portal={portal}
      label="Tin tức"
    />
  );
}
