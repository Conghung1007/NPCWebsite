import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit3 } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  extractTempImageUrlsFromHtml,
  cleanupTempMediaUrls,
} from "@/lib/tempMediaCleanup";
import type { Article } from "@shared/schema";
import { apiFetch } from "@/lib/queryClient";
import { PORTAL_META, type PortalId } from "@/lib/portal";
import {
  ARTICLE_CATEGORIES,
  articleCategoryMeta,
  isArticleCategory,
  portalFromArticleCategory,
  type ArticleCategoryValue,
} from "@shared/articleCategories";

const categoryValues = ARTICLE_CATEGORIES.map((c) => c.value) as [
  ArticleCategoryValue,
  ...ArticleCategoryValue[],
];

const editArticleSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  content: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
  category: z.enum(categoryValues),
});

type EditArticleForm = z.infer<typeof editArticleSchema>;

export default function EditArticle() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/edit-article/:id");
  const articleId = params?.id;
  const [legacyCategory, setLegacyCategory] = useState<string | null>(null);

  const form = useForm<EditArticleForm>({
    resolver: zodResolver(editArticleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "study-abroad",
    },
  });

  const category = form.watch("category");
  const portal = useMemo(
    () => portalFromArticleCategory(category) as PortalId,
    [category],
  );
  const categoryMeta = articleCategoryMeta(category);

  const { data: article, isLoading: articleLoading } = useQuery<Article>({
    queryKey: ["/api/articles", articleId],
    queryFn: async () => {
      const response = await apiFetch(`/api/articles/${articleId}`);
      if (!response.ok) throw new Error("Không thể tải bài viết");
      return response.json();
    },
    enabled: !!articleId,
  });

  useEffect(() => {
    if (!article) return;
    if (!isArticleCategory(article.category)) {
      setLegacyCategory(article.category);
      form.reset({
        title: article.title,
        content: article.content,
        category: "study-abroad",
      });
      return;
    }
    setLegacyCategory(null);
    form.reset({
      title: article.title,
      content: article.content,
      category: article.category,
    });
  }, [article, form]);

  const updateArticleMutation = useMutation({
    mutationFn: async (data: EditArticleForm) => {
      const response = await apiFetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let message = "Có lỗi xảy ra khi cập nhật bài viết";
        try {
          const err = await response.json();
          if (err?.message) message = err.message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      setLegacyCategory(null);
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles", articleId] });
      toast({
        title: "Thành công",
        description: "Bài viết đã được cập nhật thành công!",
      });
      setLocation("/cpanel/articles");
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi cập nhật bài viết",
        variant: "destructive",
      });
    },
  });

  const leaveForm = () => {
    void cleanupTempMediaUrls(
      extractTempImageUrlsFromHtml(form.getValues("content") || ""),
      "article",
    );
    setLocation("/cpanel/articles");
  };

  useEffect(() => {
    const onLeave = () => {
      const urls = extractTempImageUrlsFromHtml(form.getValues("content") || "");
      if (urls.length === 0) return;
      void cleanupTempMediaUrls(urls, "article");
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [form]);

  if (!articleId) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-500">Không tìm thấy ID bài viết</p>
        <Button onClick={leaveForm} className="mt-4">
          Quay lại quản lý bài viết
        </Button>
      </div>
    );
  }

  if (articleLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>Đang tải bài viết...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-500">Không tìm thấy bài viết</p>
        <Button onClick={leaveForm} className="mt-4">
          Quay lại quản lý bài viết
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={leaveForm}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại Cpanel
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Chỉnh sửa bài viết
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Cập nhật thông tin bài viết
            </CardTitle>
          </CardHeader>
          <CardContent>
            {legacyCategory ? (
              <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Danh mục cũ «{legacyCategory}» không còn hợp lệ. Hãy chọn danh
                mục mới bên dưới rồi lưu.
              </p>
            ) : null}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => {
                  if (legacyCategory) {
                    setLegacyCategory(null);
                  }
                  updateArticleMutation.mutate(data);
                })}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiêu đề bài viết *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nhập tiêu đề bài viết..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Danh mục (cổng hiển thị) *</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          setLegacyCategory(null);
                          field.onChange(v);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn danh mục" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ARTICLE_CATEGORIES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label} · {PORTAL_META[option.portal].brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Cổng: <strong>{PORTAL_META[portal].brand}</strong>
                        {categoryMeta?.appearsOn
                          ? ` — ${categoryMeta.appearsOn}.`
                          : "."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nội dung bài viết *</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Nhập nội dung… Ảnh đầu tiên = ảnh bìa danh sách."
                        />
                      </FormControl>
                      <FormDescription>
                        Ảnh bìa = ảnh đầu tiên trong nội dung.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-4">
                  <Button
                    type="submit"
                    disabled={updateArticleMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    {updateArticleMutation.isPending
                      ? "Đang cập nhật..."
                      : "Cập nhật bài viết"}
                  </Button>
                  <Button type="button" variant="outline" onClick={leaveForm}>
                    Hủy
                  </Button>
                  <Button type="button" variant="ghost" asChild>
                    <Link href="/cpanel/page-content">Mở Nội dung trang</Link>
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
