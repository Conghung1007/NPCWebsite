import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  Edit2, 
  Trash2,
  Plus
} from "lucide-react";
import type { Article } from "@shared/schema";

const categories = [
  { value: "visa-services", label: "Dịch vụ visa" },
  { value: "study-abroad", label: "Tư vấn du học" },
  { value: "japanese-training", label: "Đào tạo tiếng Nhật" },
  { value: "flight-tickets", label: "Vé máy bay" }
];

export function ArticleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch articles
  const { data: articles = [], isLoading, refetch } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  // Delete article mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/articles/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete article");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Bài viết đã được xóa thành công.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa bài viết. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  });

  const handleDelete = (article: Article) => {
    if (confirm(`Bạn có chắc chắn muốn xóa bài viết "${article.title}"?`)) {
      deleteMutation.mutate(article.id);
    }
  };

  const getCategoryLabel = (category: string) => {
    return categories.find(cat => cat.value === category)?.label || category;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quản lý bài viết
            </CardTitle>
            <Link href="/create-article">
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Tạo bài viết mới
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p>Đang tải danh sách bài viết...</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có bài viết nào</p>
              <p className="text-sm">Nhấn nút "Tạo bài viết mới" để bắt đầu</p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{article.title}</h3>
                      <Badge variant="secondary">
                        {getCategoryLabel(article.category)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p className="mb-1">
                        {article.content.substring(0, 100)}
                        {article.content.length > 100 && "..."}
                      </p>
                      {article.createdAt && (
                        <p className="text-xs">
                          Được tạo: {formatDate(article.createdAt)}
                        </p>
                      )}
                      {article.updatedAt && article.updatedAt !== article.createdAt && (
                        <p className="text-xs">
                          Cập nhật: {formatDate(article.updatedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/edit-article/${article.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(article)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}