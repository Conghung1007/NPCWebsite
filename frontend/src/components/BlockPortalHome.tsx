import { useMemo } from "react";
import { PageSectionsRenderer } from "@/components/PageSectionsRenderer";
import { usePageLayout } from "@/hooks/usePageLayout";
import { Button } from "@/components/ui/button";
import {
  DocumentHead,
  buildOrganizationJsonLd,
} from "@/components/DocumentHead";
import { PORTAL_META, portalPath, type PortalId } from "@/lib/portal";

type BlockPortalHomeProps = {
  page: "group" | "huongnghiep" | "dichvu" | "luyenthi";
  label: string;
};

/** Shared shell for portal home pages driven by page_layouts blocks. */
export function BlockPortalHome({ page, label }: BlockPortalHomeProps) {
  const { data, isLoading, isError, refetch } = usePageLayout(page, page);
  const portal = page as PortalId;
  const meta = PORTAL_META[portal];
  const canonical = portalPath(portal, "/");
  const jsonLd = useMemo(
    () => buildOrganizationJsonLd(canonical),
    [canonical],
  );

  const head = (
    <DocumentHead
      title={meta.documentTitle}
      description={meta.description}
      canonicalPath={canonical}
      jsonLd={jsonLd}
    />
  );

  if (isLoading) {
    return (
      <>
        {head}
        <div
          className="page-loading-shell"
          role="status"
          aria-label="Đang tải"
        >
          <div className="page-loading-hero" />
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        {head}
        <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground space-y-3">
          <p>
            Không tải được khối nội dung {label}. Thử tải lại hoặc kiểm tra Cpanel
            → Nội dung trang.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tải lại
          </Button>
        </div>
      </>
    );
  }

  const sections = data.sections ?? [];
  const hasVisible = sections.some((s) => s.enabled !== false);

  if (!hasVisible) {
    return (
      <>
        {head}
        <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground">
          <p>Trang {label} chưa có khối nội dung hiển thị.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <PageSectionsRenderer sections={sections} />
    </>
  );
}
