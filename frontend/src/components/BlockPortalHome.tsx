import { PageSectionsRenderer } from "@/components/PageSectionsRenderer";
import { usePageLayout } from "@/hooks/usePageLayout";
import { Button } from "@/components/ui/button";

type BlockPortalHomeProps = {
  page: "group" | "huongnghiep" | "dichvu" | "luyenthi";
  label: string;
};

/** Shared shell for portal home pages driven by page_layouts blocks. */
export function BlockPortalHome({ page, label }: BlockPortalHomeProps) {
  const { data, isLoading, isError, refetch } = usePageLayout(page, page);

  if (isLoading) {
    return (
      <div
        className="page-loading-shell"
        role="status"
        aria-label="Đang tải"
      >
        <div className="page-loading-hero" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground space-y-3">
        <p>
          Không tải được khối nội dung {label}. Thử tải lại hoặc kiểm tra Cpanel
          → Nội dung trang.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tải lại
        </Button>
      </div>
    );
  }

  const sections = data.sections ?? [];
  const hasVisible = sections.some((s) => s.enabled !== false);

  if (!hasVisible) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <p>Trang {label} chưa có khối nội dung hiển thị.</p>
      </div>
    );
  }

  return <PageSectionsRenderer sections={sections} />;
}
