import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { extractTempImageUrlsFromHtml, cleanupTempMediaUrls } from "@/lib/tempMediaCleanup";
import { apiFetch } from "@/lib/queryClient";
import { PORTAL_IDS, PORTAL_META, type PortalId } from "@/lib/portal";

const createArticleSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  content: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
  category: z.string().min(1, "Vui lòng chọn danh mục"),
  portal: z.enum(["group", "huongnghiep", "dichvu", "luyenthi"]),
});

type CreateArticleForm = z.infer<typeof createArticleSchema>;

function defaultPortalFromStorage(): PortalId {
  try {
    const v = localStorage.getItem("npc_admin_portal_filter");
    if (v && (PORTAL_IDS as readonly string[]).includes(v)) return v as PortalId;
  } catch {
    /* ignore */
  }
  return "group";
}

export default function CreateArticle() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateArticleForm>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      portal: defaultPortalFromStorage(),
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: async (data: CreateArticleForm) => {
      const response = await apiFetch("/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      toast({
        title: "Thành công",
        description: "Bài viết đã được tạo thành công!",
      });
      // Navigate to the created article
      if (data.article && data.article.id) {
        setLocation(`/article/${data.article.id}`);
      } else {
        setLocation("/");
      }
    },
    onError: (error: any) => {
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
      "qbank",
    );
    window.history.back();
  };

  const onSubmit = (data: CreateArticleForm) => {
    createArticleMutation.mutate(data);
  };

  const categoryOptions = [
    { value: "visa-services", label: "Dịch vụ Visa" },
    { value: "study-abroad", label: "Du học" },
    { value: "japanese-training", label: "Đào tạo tiếng Nhật" },
    { value: "soft-skills", label: "Kỹ năng mềm" },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            onClick={leaveForm}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Tạo bài viết mới
          </h1>
        </div>

        {/* Create Article Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Thông tin bài viết
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                <FormField
                  control={form.control}
                  name="portal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Portal *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn portal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PORTAL_IDS.map((id) => (
                            <SelectItem key={id} value={id}>
                              {PORTAL_META[id].brand}
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
                <div className="flex gap-4 pt-6">
                  <Button 
                    type="submit" 
                    disabled={createArticleMutation.isPending}
                    className="flex-1"
                  >
                    {createArticleMutation.isPending ? "Đang tạo..." : "Tạo bài viết"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={leaveForm}
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