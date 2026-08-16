import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import type { Article } from "@shared/schema";
import { apiFetch } from "@/lib/queryClient";
import { resolvePortal } from "@/lib/portal";

interface ArticleSectionProps {
  category: string;
  title: string;
  description?: string;
}

export function ArticleSection({ category, title, description }: ArticleSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 9;
  const sectionRef = useRef<HTMLElement>(null);
  const reactId = useId();
  const sectionDomId = `articles-${category}`.replace(/[^a-z0-9-]/gi, "-");
  const portal = resolvePortal();

  const { data: allArticles, isLoading, error } = useQuery<Article[]>({
    queryKey: ["/api/articles", category, portal],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/articles?category=${encodeURIComponent(category)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch articles");
      }
      return response.json();
    },
  });

  // Reset page when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [category]);

  const sortedArticles = allArticles
    ? [...allArticles].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    : [];

  const totalArticles = sortedArticles.length;
  const totalPages = Math.ceil(totalArticles / articlesPerPage) || 1;
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const articles = sortedArticles.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) {
    return (
      <section className="py-16 sm:py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Không thể tải bài viết. Vui lòng thử lại sau.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id={sectionDomId}
      className="py-16 sm:py-20 bg-neutral"
      aria-labelledby={`${reactId}-heading`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <h2
            id={`${reactId}-heading`}
            className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2"
          >
            {title}
          </h2>
          {description ? (
            <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="aspect-video rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && totalArticles === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Chưa có bài viết nào trong danh mục này.
            </p>
          </div>
        ) : null}

        {!isLoading && totalArticles > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-10">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            ) : null}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Hiển thị {startIndex + 1}–{Math.min(endIndex, totalArticles)} / {totalArticles} bài
              viết
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
