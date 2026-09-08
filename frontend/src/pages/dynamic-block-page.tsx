import { lazy, Suspense, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePortal } from "@/contexts/PortalContext";
import { useCmsPageBySlug } from "@/hooks/useCmsPages";
import { PageSectionsRenderer } from "@/components/PageSectionsRenderer";
import { usePageLayout } from "@/hooks/usePageLayout";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import { apiFetch } from "@/lib/queryClient";
import type { Article, Exam } from "@shared/schema";
import { articlePublicPath, examPublicPath } from "@/lib/contentPaths";
import { looksLikeUuid } from "@shared/contentSlug";

const ExamTaking = lazy(() => import("@/pages/exam-taking"));
const ArticleDetail = lazy(() => import("@/pages/article-detail"));

type ContentHit =
  | { type: "exam"; exam: Exam }
  | { type: "article"; article: Article };

function LoadingShell() {
  return (
    <div className="page-loading-shell" role="status" aria-label="Đang tải">
      <div className="page-loading-hero" />
    </div>
  );
}

/**
 * Public catch-all under a portal prefix after strip:
 * resolve exam (luyenthi) → article → CMS block page.
 */
export default function DynamicBlockPage() {
  const [, params] = useRoute("/:slug");
  const slug = params?.slug ?? "";
  const { portal } = usePortal();
  const [, setLocation] = useLocation();

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["/api/content-by-slug", slug, portal],
    queryFn: async (): Promise<ContentHit | null> => {
      const res = await apiFetch(
        `/api/content-by-slug/${encodeURIComponent(slug)}?portal=${encodeURIComponent(portal)}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Không tra cứu được nội dung");
      return res.json();
    },
    enabled: !!slug,
    retry: false,
    staleTime: 30_000,
  });

  const skipCms = contentLoading || !!content;
  const { data: pageMeta, isLoading: metaLoading } = useCmsPageBySlug(
    slug,
    portal,
  );

  const layoutKey = pageMeta?.layoutKey ?? "";
  const { data, isLoading, isError, refetch } = usePageLayout(
    layoutKey,
    pageMeta?.portal,
    !!pageMeta?.layoutKey && !skipCms,
  );

  useEffect(() => {
    if (!content) return;
    if (content.type === "exam" && content.exam.slug && looksLikeUuid(slug)) {
      setLocation(examPublicPath(content.exam), { replace: true });
    }
    if (
      content.type === "article" &&
      content.article.slug &&
      looksLikeUuid(slug)
    ) {
      setLocation(articlePublicPath(content.article), { replace: true });
    }
  }, [content, slug, setLocation]);

  if (contentLoading) return <LoadingShell />;

  if (content?.type === "exam") {
    return (
      <Suspense fallback={<LoadingShell />}>
        <ExamTaking examId={content.exam.id} />
      </Suspense>
    );
  }

  if (content?.type === "article") {
    return (
      <Suspense fallback={<LoadingShell />}>
        <ArticleDetail id={content.article.id} />
      </Suspense>
    );
  }

  if (metaLoading || (pageMeta && isLoading)) {
    return <LoadingShell />;
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
