import { PageSectionsRenderer } from "@/components/PageSectionsRenderer";
import { usePageLayout } from "@/hooks/usePageLayout";
import { Button } from "@/components/ui/button";
import {
  DocumentHead,
  buildOrganizationJsonLd,
} from "@/components/DocumentHead";
import type { PortalId } from "@/lib/portal";
import { PORTAL_META, portalPath } from "@/lib/portal";
import { useMemo } from "react";

type BlockStaticPageProps = {
  /** page_layouts.page key (= registry layoutKey / id) */
  layoutKey: string;
  portal: PortalId;
  label: string;
  /** Optional SEO overrides; defaults from portal + label */
  seoTitle?: string;
  seoDescription?: string;
  /** Public path for canonical (defaults to portal home or inferred) */
  canonicalPath?: string;
};

/** Shared shell for marketing pages driven by page_layouts blocks. */
export function BlockStaticPage({
  layoutKey,
  portal,
  label,
  seoTitle,
  seoDescription,
  canonicalPath,
}: BlockStaticPageProps) {
  const { data, isLoading, isError, refetch } = usePageLayout(
    layoutKey,
    portal,
  );

  const isHome =
    layoutKey === "home" ||
    layoutKey === "gioi-thieu" ||
    label.toLowerCase().includes("giới thiệu");

  const title = seoTitle || (isHome ? PORTAL_META[portal].documentTitle : label);
  const description =
    seoDescription ||
    (isHome
      ? PORTAL_META[portal].description
      : `${label} — ${PORTAL_META[portal].brand}. ${PORTAL_META[portal].tagline}.`);
  const canonical =
    canonicalPath ||
    (typeof window !== "undefined" ? window.location.pathname : portalPath(portal, "/"));

  const jsonLd = useMemo(
    () => (isHome ? buildOrganizationJsonLd(canonical) : null),
    [isHome, canonical],
  );

  if (isLoading) {
    return (
      <>
        <DocumentHead
          title={title}
          description={description}
          canonicalPath={canonical}
          jsonLd={jsonLd}
        />
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
        <DocumentHead
          title={title}
          description={description}
          canonicalPath={canonical}
        />
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
        <DocumentHead
          title={title}
          description={description}
          canonicalPath={canonical}
        />
        <div className="max-w-xl mx-auto px-4 py-16 text-center text-muted-foreground">
          <p>Trang {label} chưa có khối nội dung hiển thị.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <DocumentHead
        title={title}
        description={description}
        canonicalPath={canonical}
        jsonLd={jsonLd}
      />
      <PageSectionsRenderer sections={sections} />
    </>
  );
}
