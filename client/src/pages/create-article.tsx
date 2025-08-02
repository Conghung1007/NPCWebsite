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
import { ArrowLeft, PlusCircle, Eye } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

const createArticleSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  content: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
  category: z.string().min(1, "Vui lòng chọn danh mục"),
});

type CreateArticleForm = z.infer<typeof createArticleSchema>;

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
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: async (data: CreateArticleForm) => {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Có lỗi xảy ra khi tạo bài viết");
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

  const onSubmit = (data: CreateArticleForm) => {
    createArticleMutation.mutate(data);
  };

  const categoryOptions = [
    { value: "visa-services", label: "Dịch vụ Visa" },
    { value: "study-abroad", label: "Du học" },
    { value: "japanese-training", label: "Đào tạo tiếng Nhật" },
    { value: "flight-tickets", label: "Vé máy bay" },
  ];

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
                    onClick={() => window.history.back()}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Preview Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Xem trước bài viết
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Title Preview */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {form.watch("title") || "Tiêu đề bài viết sẽ hiển thị ở đây"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Danh mục: {form.watch("category") ? categoryOptions.find(cat => cat.value === form.watch("category"))?.label : "Chưa chọn danh mục"}
                </p>
              </div>
              
              {/* Content Preview */}
              <div className="border-t pt-4">
                <div className="prose prose-sm max-w-none">
                  {form.watch("content") ? (
                    <div dangerouslySetInnerHTML={{
                      __html: form.watch("content")
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-2" />')
                        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
                        .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                        .replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>')
                        .replace(/\n/g, '<br/>')
                    }} />
                  ) : (
                    <p className="text-gray-500 italic">Nội dung bài viết sẽ hiển thị ở đây khi bạn nhập...</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}