import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, User, Tag } from "lucide-react";
import { ArticleCard } from "@/components/ArticleCard";
import type { Article } from "@shared/schema";

export default function ArticleDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

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
      'flight-tickets': 'Vé máy bay',
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
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Button 
          variant="outline" 
          onClick={() => window.history.back()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>

        {/* Article content */}
        <article className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header image */}
          {article.imageUrl && (
            <div className="w-full h-64 md:h-80 lg:h-96 rounded-t-lg overflow-hidden">
              <img 
                src={article.imageUrl} 
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 md:p-8">
            {/* Article meta */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <Badge variant="outline" className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {getServiceName(article.category)}
              </Badge>
              
              <div className="flex items-center text-gray-500 text-sm">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(article.createdAt.toString())}
              </div>
            </div>

            {/* Article title */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">
              {article.title}
            </h1>

            {/* Article content */}
            <div className="prose prose-lg max-w-none">
              <div className="text-gray-700 leading-relaxed text-base md:text-lg">
                {(() => {
                  let firstImageSkipped = false;
                  return article.content.split('\n').map((line, index) => {
                    // Handle images
                    const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                    if (imageMatch) {
                      // Skip the first image if it matches the header image
                      if (!firstImageSkipped && article.imageUrl && imageMatch[2] === article.imageUrl) {
                        firstImageSkipped = true;
                        return null;
                      }
                      return (
                        <figure key={index} className="my-6 inline-block">
                          <img 
                            src={imageMatch[2]} 
                            alt={imageMatch[1]} 
                            className="max-w-full h-auto rounded-lg border shadow-sm block"
                          />
                          {imageMatch[1] && (
                            <figcaption className="text-sm text-gray-500 mt-2 italic text-center px-2">
                              {imageMatch[1]}
                            </figcaption>
                          )}
                        </figure>
                      );
                    }
                    
                    // Handle bold text
                    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    
                    // Handle italic text
                    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
                    
                    // Handle links
                    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">$1</a>');
                    
                    // Handle lists
                    if (line.startsWith('- ')) {
                      return (
                        <ul key={index} className="list-disc ml-6 mb-2">
                          <li dangerouslySetInnerHTML={{ __html: line.substring(2) }} />
                        </ul>
                      );
                    }
                    
                    if (/^\d+\.\s/.test(line)) {
                      return (
                        <ol key={index} className="list-decimal ml-6 mb-2">
                          <li dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '') }} />
                        </ol>
                      );
                    }
                    
                    return line.trim() ? (
                      <p key={index} dangerouslySetInnerHTML={{ __html: line }} />
                    ) : (
                      <br key={index} />
                    );
                  });
                })()}
                  
                  // Handle bold text
                  line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                  
                  // Handle italic text
                  line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
                  
                  // Handle links
                  line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">$1</a>');
                  
                  // Handle lists
                  if (line.startsWith('- ')) {
                    return (
                      <ul key={index} className="list-disc ml-6 mb-2">
                        <li dangerouslySetInnerHTML={{ __html: line.substring(2) }} />
                      </ul>
                    );
                  }
                  
                  if (/^\d+\.\s/.test(line)) {
                    return (
                      <ol key={index} className="list-decimal ml-6 mb-2">
                        <li dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '') }} />
                      </ol>
                    );
                  }
                  
                  return line.trim() ? (
                    <p key={index} className="mb-4" dangerouslySetInnerHTML={{ __html: line }} />
                  ) : (
                    <br key={index} />
                  );
                })}
              </div>
            </div>

            {/* Video embed if available */}
            {article.videoUrl && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Video liên quan</h3>
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe
                    src={article.videoUrl}
                    className="w-full h-full"
                    allowFullScreen
                    title={`Video: ${article.title}`}
                  />
                </div>
              </div>
            )}

            {/* Call to action */}
            <div className="mt-12 p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Cần tư vấn thêm?
              </h3>
              <p className="text-green-700 mb-4">
                Đội ngũ chuyên gia của N&P sẵn sàng hỗ trợ bạn với dịch vụ {getServiceName(article.category).toLowerCase()}.
              </p>
              <Button 
                onClick={() => setLocation("/contact")}
                className="bg-green-600 hover:bg-green-700"
              >
                Liên hệ ngay
              </Button>
            </div>
          </div>
        </article>

        {/* Related articles section */}
        {relatedArticles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
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
    </div>
  );
}