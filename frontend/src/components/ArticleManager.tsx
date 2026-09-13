import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/ui/pagination";
import {
  FileText,
  Edit2,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import type { Article } from "@shared/schema";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/queryClient";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import { portalBadgeLabel } from "@/components/AdminPortalFilter";
import { articleCategoryLabel } from "@shared/articleCategories";
import { articlePublicPath } from "@/lib/contentPaths";

export function ArticleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { listQuery, filter } = useAdminPortal();
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 6;
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    article: Article | null;
  }>({
    isOpen: false,
    article: null,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["/api/articles", "admin", listQuery],
    queryFn: async () => {
      const res = await apiFetch(`/api/articles?${listQuery}`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/articles/${id}`, {
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
      const newTotal = sortedArticles.length - 1;
      const newTotalPages = Math.ceil(newTotal / articlesPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa bài viết. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const moveOrderMutation = useMutation({
    mutationFn: async ({
      id,
      direction,
    }: {
      id: string;
      direction: "up" | "down";
    }) => {
      const response = await apiFetch(`/api/articles/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể thay đổi thứ tự. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN");
  };

  const sortedArticles = [...articles].sort((a, b) => {
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
  const totalPages = Math.ceil(sortedArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const currentArticles = sortedArticles.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Quản lý bài viết
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Bài viết gắn theo danh mục → cổng (Hướng nghiệp / Dịch vụ / Luyện
                thi) và hiện ở khối Tin tức trong Bố cục trang. Dùng bộ lọc
                portal phía trên để thu hẹp danh sách.
              </p>
            </div>
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
              <p>
                {filter === "all"
                  ? "Chưa có bài viết nào"
                  : `Chưa có bài viết trong cổng «${portalBadgeLabel(filter)}»`}
              </p>
              <p className="text-sm mt-1">
                Tạo bài với danh mục thuộc cổng này, hoặc chọn bộ lọc «Tất cả».
                Khối Tin bài trên trang phải cùng danh mục (hoặc «Tất cả danh
                mục của cổng»).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentArticles.map((article) => {
                const publicPath = articlePublicPath(article);
                return (
                  <div
                    key={article.id}
                    className="flex items-center justify-between gap-3 p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-medium">{article.title}</h3>
                        <Badge variant="outline">
                          {portalBadgeLabel(article.portal)}
                        </Badge>
                        <Badge variant="secondary">
                          {articleCategoryLabel(article.category)}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p className="mb-1 line-clamp-2">
                          {article.content
                            .replace(/<[^>]+>/g, " ")
                            .substring(0, 120)}
                          {article.content.length > 120 ? "..." : ""}
                        </p>
                        {article.slug ? (
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {publicPath}
                          </p>
                        ) : null}
                        {article.createdAt ? (
                          <p className="text-xs mt-1">
                            Được tạo: {formatDate(article.createdAt.toString())}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          moveOrderMutation.mutate({
                            id: article.id,
                            direction: "up",
                          })
                        }
                        disabled={moveOrderMutation.isPending}
                        title="Di chuyển lên"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          moveOrderMutation.mutate({
                            id: article.id,
                            direction: "down",
                          })
                        }
                        disabled={moveOrderMutation.isPending}
                        title="Di chuyển xuống"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      {article.slug ? (
                        <Link href={publicPath}>
                          <Button size="sm" variant="outline" title="Xem công khai">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      ) : null}
                      <Link href={`/edit-article/${article.id}`}>
                        <Button size="sm" variant="outline" title="Chỉnh sửa">
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
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => !open && cancelDelete()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa bài viết</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa bài viết &quot;
              {deleteConfirm.article?.title}&quot;?
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
