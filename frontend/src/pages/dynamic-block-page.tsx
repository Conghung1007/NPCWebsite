import { useRoute } from "wouter";
import { usePortal } from "@/contexts/PortalContext";
import { useCmsPageBySlug } from "@/hooks/useCmsPages";
import { PageSectionsRenderer } from "@/components/PageSectionsRenderer";
import { usePageLayout } from "@/hooks/usePageLayout";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";

/** Public route for admin-created block pages at `/:slug`. */
export default function DynamicBlockPage() {
  const [, params] = useRoute("/:slug");
  const slug = params?.slug ?? "";
  const { portal } = usePortal();
  const { data: pageMeta, isLoading: metaLoading } = useCmsPageBySlug(slug, portal);

  const layoutKey = pageMeta?.layoutKey ?? "";
  const { data, isLoading, isError, refetch } = usePageLayout(
    layoutKey,
    pageMeta?.portal,
    !!pageMeta?.layoutKey,
  );

  if (metaLoading || (pageMeta && isLoading)) {
    return (
      <div className="page-loading-shell" role="status" aria-label="Đang tải">
        <div className="page-loading-hero" />
      </div>
    );
  }

  if (!pageMeta) return <NotFound />;

  if (isError || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground space-y-3">
        <p>Không tải được nội dung trang {pageMeta.label}.</p>
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
        <p>Trang {pageMeta.label} chưa có khối nội dung hiển thị.</p>
      </div>
    );
  }

  return <PageSectionsRenderer sections={sections} />;
}
