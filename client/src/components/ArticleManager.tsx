import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/ui/pagination";
import { 
  FileText, 
  Edit2, 
  Trash2,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import type { Article } from "@shared/schema";
import { useState } from "react";

const categories = [
  { value: "visa-services", label: "Dịch vụ visa" },
  { value: "study-abroad", label: "Tư vấn du học" },
  { value: "japanese-training", label: "Đào tạo tiếng Nhật" },
  { value: "flight-tickets", label: "Vé máy bay" }
];

export function ArticleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 6;
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'custom'>('custom');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; article: Article | null }>({
    isOpen: false,
    article: null
  });

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
      // Reset to first page if current page becomes empty after deletion
      const newTotal = sortedArticles.length - 1;
      const newTotalPages = Math.ceil(newTotal / articlesPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa bài viết. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  });

  // Move article order mutation
  const moveOrderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const response = await fetch(`/api/articles/${id}/move`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ direction }),
      });
      if (!response.ok) throw new Error("Failed to move article");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật thứ tự bài viết.",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể thay đổi thứ tự. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  });

  const handleDelete = (article: Article) => {
    setDeleteConfirm({ isOpen: true, article });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.article) return;
    deleteMutation.mutate(deleteConfirm.article.id);
    setDeleteConfirm({ isOpen: false, article: null });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, article: null });
  };

  const getCategoryLabel = (category: string) => {
    return categories.find(cat => cat.value === category)?.label || category;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // Sort articles by custom order (sortOrder field)
  const sortedArticles = [...articles].sort((a, b) => {
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
  const totalPages = Math.ceil(sortedArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const currentArticles = sortedArticles.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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
              {currentArticles.map((article) => (
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
                          Được tạo: {formatDate(article.createdAt.toString())}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveOrderMutation.mutate({ id: article.id, direction: 'up' })}
                      disabled={moveOrderMutation.isPending}
                      title="Di chuyển lên"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveOrderMutation.mutate({ id: article.id, direction: 'down' })}
                      disabled={moveOrderMutation.isPending}
                      title="Di chuyển xuống"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Link href={`/edit-article/${article.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(article)}
                      disabled={deleteMutation.isPending}
                      title="Xóa bài viết"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa bài viết</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa bài viết "{deleteConfirm.article?.title}"?
              <br />
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Hủy
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}