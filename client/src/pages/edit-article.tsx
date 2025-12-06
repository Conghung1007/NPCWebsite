import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit3 } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { Article } from "@shared/schema";

const editArticleSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  content: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
  category: z.string().min(1, "Vui lòng chọn danh mục"),
});

type EditArticleForm = z.infer<typeof editArticleSchema>;

export default function EditArticle() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Extract article ID from URL path
  const currentPath = window.location.pathname;
  const articleId = currentPath.split('/edit-article/')[1];

  const form = useForm<EditArticleForm>({
    resolver: zodResolver(editArticleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  });

  // Fetch article data
  const { data: article, isLoading: articleLoading } = useQuery<Article>({
    queryKey: ["/api/articles", articleId],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${articleId}`);
      if (!response.ok) {
        throw new Error("Không thể tải bài viết");
      }
      return response.json();
    },
    enabled: !!articleId,
  });

  // Update form when article data is loaded
  useEffect(() => {
    if (article) {
      form.reset({
        title: article.title,
        content: article.content,
        category: article.category,
      });
    }
  }, [article, form]);

  const updateArticleMutation = useMutation({
    mutationFn: async (data: EditArticleForm) => {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Có lỗi xảy ra khi cập nhật bài viết");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles", articleId] });
      toast({
        title: "Thành công",
        description: "Bài viết đã được cập nhật thành công!",
      });
      window.history.back();
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi cập nhật bài viết",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditArticleForm) => {
    updateArticleMutation.mutate(data);
  };

  const categoryOptions = [
    { value: "visa-services", label: "Dịch vụ Visa" },
    { value: "study-abroad", label: "Du học" },
    { value: "japanese-training", label: "Đào tạo tiếng Nhật" },

  ];

  if (!articleId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-500">Không tìm thấy ID bài viết</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Quay lại quản lý bài viết
          </Button>
        </div>
      </div>
    );
  }

  if (articleLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>Đang tải bài viết...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-500">Không tìm thấy bài viết</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Quay lại quản lý bài viết
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Chỉnh sửa bài viết
          </h1>
        </div>

        {/* Edit Article Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Cập nhật thông tin bài viết
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
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

                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Danh mục *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn danh mục bài viết" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Content */}
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
                          placeholder="Nhập nội dung bài viết... Sử dụng các nút định dạng để tạo văn bản đẹp và chèn hình ảnh ở bất kỳ vị trí nào."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button 
                    type="submit" 
                    disabled={updateArticleMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    {updateArticleMutation.isPending ? "Đang cập nhật..." : "Cập nhật bài viết"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => window.history.back()}
                  >
                    Hủy
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