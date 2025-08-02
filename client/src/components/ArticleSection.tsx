import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import type { Article } from "@shared/schema";

interface ArticleSectionProps {
  category: string;
  title: string;
  description?: string;
}

export function ArticleSection({ category, title, description }: ArticleSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 9;

  const { data: allArticles, isLoading, error } = useQuery<Article[]>({
    queryKey: ['/api/articles', category],
    queryFn: async () => {
      const response = await fetch(`/api/articles?category=${category}`);
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      const data = await response.json();
      console.log('ArticleSection - Fetched articles:', { category, articles: data });
      return data;
    }
  });

  // Sort articles by newest first before pagination
  const sortedArticles = allArticles?.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ) || [];
  
  // Calculate pagination
  const totalArticles = sortedArticles.length;
  const totalPages = Math.ceil(totalArticles / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const articles = sortedArticles.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of articles section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Không thể tải bài viết. Vui lòng thử lại sau.</p>
      </div>
    );
  }

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
          {description && (
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">{description}</p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="space-y-4">
                <Skeleton className="aspect-video rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles?.map((article) => {
                console.log('ArticleSection - Rendering article:', article);
                return (
                  <div key={article.id} className="w-full h-full flex">
                    <ArticleCard
                      article={article}
                    />
                  </div>
                );
              })}
            </div>

            {/* Pagination - always show for service pages */}
            {totalArticles > 0 && (
              <div className="mt-12">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.max(1, totalPages)}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}

        {!isLoading && (!allArticles || allArticles.length === 0) && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Chưa có bài viết nào trong danh mục này.</p>
            <div className="text-xs text-gray-400 mt-2">
              Debug: Category: {category}, Articles: {JSON.stringify(allArticles)}
            </div>
          </div>
        )}

        {/* Articles summary */}
        {!isLoading && allArticles && allArticles.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-600">
            Hiển thị {startIndex + 1}-{Math.min(endIndex, totalArticles)} trong tổng số {totalArticles} bài viết
          </div>
        )}
      </div>
    </section>
  );
}