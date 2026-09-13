import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, PlusCircle } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  extractTempImageUrlsFromHtml,
  cleanupTempMediaUrls,
} from "@/lib/tempMediaCleanup";
import { apiFetch } from "@/lib/queryClient";
import { PORTAL_META, type PortalId } from "@/lib/portal";
import { articlePublicPath } from "@/lib/contentPaths";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import {
  ARTICLE_CATEGORIES,
  articleCategoryMeta,
  defaultCategoryForPortal,
  portalFromArticleCategory,
  type ArticleCategoryValue,
} from "@shared/articleCategories";

const categoryValues = ARTICLE_CATEGORIES.map((c) => c.value) as [
  ArticleCategoryValue,
  ...ArticleCategoryValue[],
];

const createArticleSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  content: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
  category: z.enum(categoryValues),
});

type CreateArticleForm = z.infer<typeof createArticleSchema>;

export default function CreateArticle() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { filter, defaultPortal } = useAdminPortal();

  const initialCategory = useMemo(() => {
    if (filter !== "all" && filter !== "group") {
      return defaultCategoryForPortal(filter);
    }
    if (defaultPortal && defaultPortal !== "group") {
      return defaultCategoryForPortal(defaultPortal);
    }
    return "study-abroad" as ArticleCategoryValue;
  }, [filter, defaultPortal]);

  const form = useForm<CreateArticleForm>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: initialCategory,
    },
  });

  const category = form.watch("category");
  const portal = useMemo(
    () => portalFromArticleCategory(category) as PortalId,
    [category],
  );
  const categoryMeta = articleCategoryMeta(category);

  const createArticleMutation = useMutation({
    mutationFn: async (data: CreateArticleForm) => {
      const response = await apiFetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let message = "Có lỗi xảy ra khi tạo bài viết";
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      const publicPath = data.article
        ? articlePublicPath(data.article)
        : null;
      toast({
        title: "Đã tạo bài viết",
        description: publicPath
          ? `Bài sẽ hiện ở khối Tin tức cùng danh mục trên cổng ${PORTAL_META[portal].brand}.`
          : "Bài viết đã được lưu.",
      });
      setLocation("/cpanel/articles");
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi tạo bài viết",
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
      // best-effort; may not complete on hard close
      void cleanupTempMediaUrls(urls, "article");
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [form]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={leaveForm}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại Cpanel
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Tạo bài viết mới</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Thông tin bài viết
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Bài viết gắn danh mục → cổng, rồi hiện trong khối «Tin bài» (Nội
              dung trang) nếu chuyên mục khối trùng danh mục này. Có thể chọn
              «Tất cả danh mục của cổng» trong khối để gom mọi bài của cổng.
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  createArticleMutation.mutate(data),
                )}
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
                      <FormDescription>
                        URL công khai lấy từ tiêu đề (slug) trong cổng tương ứng.
                      </FormDescription>
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
                        onValueChange={field.onChange}
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
                          ? ` — hiện ở ${categoryMeta.appearsOn}.`
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
                          placeholder="Nhập nội dung… Chèn ảnh vào bài — ảnh đầu tiên dùng làm ảnh bìa trên danh sách."
                        />
                      </FormControl>
                      <FormDescription>
                        Ảnh bìa = ảnh đầu tiên trong nội dung (không có trường
                        upload riêng). Nên chèn ít nhất một ảnh ở đầu bài.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-4 pt-6">
                  <Button
                    type="submit"
                    disabled={createArticleMutation.isPending}
                    className="flex-1 min-w-[10rem]"
                  >
                    {createArticleMutation.isPending
                      ? "Đang tạo..."
                      : "Tạo bài viết"}
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
