import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Tag } from "lucide-react";
import { ArticleCard } from "@/components/ArticleCard";
import type { Article } from "@shared/schema";
import { useEffect, useMemo } from "react";
import {
  articleContentToHtml,
  getArticleCoverUrl,
  isHtmlContent,
} from "@/lib/articleContent";

export default function ArticleDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  // Scroll to top when component mounts or id changes
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [id]);

  // Fetch article detail
  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ["/api/articles", id],
    enabled: !!id,
  });

  // Fetch all articles for related articles section
  const { data: allArticles } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
    enabled: !!article,
  });

  const getServiceName = (category: string) => {
    const serviceNames: Record<string, string> = {
      'visa-services': 'Dịch vụ Visa',
      'study-abroad': 'Du học',
      'japanese-training': 'Đào tạo tiếng Nhật',

    };
    return serviceNames[category] || category;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get 3 random related articles (excluding current article)
  const getRelatedArticles = () => {
    if (!allArticles || !article) return [];
    
    const otherArticles = allArticles.filter(a => a.id !== article.id);
    const shuffled = [...otherArticles].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  const relatedArticles = getRelatedArticles();
  const coverUrl = useMemo(
    () => (article ? getArticleCoverUrl(article) : null),
    [article],
  );
  const htmlBody = useMemo(
    () => (article ? articleContentToHtml(article.content) : ""),
    [article],
  );
  const showHeaderImage =
    Boolean(coverUrl) &&
    article &&
    !article.content.includes(coverUrl!);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Không tìm thấy bài viết</h1>
          <p className="text-gray-600 mb-6">Bài viết bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay về trang chủ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>

        <article className="bg-white rounded-xl shadow-sm border border-border/70 overflow-hidden">
          {/* Cover only when thumbnail is not already embedded in TipTap body */}
          {showHeaderImage && coverUrl ? (
            <div className="w-full aspect-[21/9] max-h-80 overflow-hidden bg-muted">
              <img
                src={coverUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <Badge variant="outline" className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {getServiceName(article.category)}
              </Badge>
              <div className="flex items-center text-muted-foreground text-sm">
                <Calendar className="w-4 h-4 mr-1.5" />
                {formatDate(article.createdAt.toString())}
              </div>
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-8 leading-tight tracking-tight">
              {article.title}
            </h1>

            <div
              className="article-html-content"
              dangerouslySetInnerHTML={{ __html: htmlBody }}
              data-format={isHtmlContent(article.content) ? "html" : "markdown"}
            />

            {article.videoUrl && (
              <div className="mt-10">
                <h3 className="font-display text-xl font-semibold text-foreground mb-4">
                  Video liên quan
                </h3>
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <iframe
                    src={article.videoUrl}
                    className="w-full h-full"
                    allowFullScreen
                    title={`Video: ${article.title}`}
                  />
                </div>
              </div>
            )}

            <div className="mt-12 p-6 rounded-lg bg-primary/5 border border-primary/15">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Cần tư vấn thêm?
              </h3>
              <p className="text-muted-foreground mb-4">
                Đội ngũ chuyên gia của Trí Nhân Academy sẵn sàng hỗ trợ bạn với dịch vụ{" "}
                {getServiceName(article.category).toLowerCase()}.
              </p>
              <Button onClick={() => setLocation("/contact")}>
                Liên hệ ngay
              </Button>
            </div>
          </div>
        </article>
      </div>

      {relatedArticles.length > 0 && (
        <div className="max-w-5xl mx-auto mt-14">
          <h2 className="font-display text-2xl font-bold text-foreground mb-8 text-center">
            Bài viết liên quan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedArticles.map((relatedArticle) => (
              <div key={relatedArticle.id} className="w-full h-full flex">
                <ArticleCard article={relatedArticle} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}