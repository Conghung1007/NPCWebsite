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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle, Eye, Edit } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

const createArticleSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  content: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
  category: z.string().min(1, "Vui lòng chọn danh mục"),
});

type CreateArticleForm = z.infer<typeof createArticleSchema>;

// Simple markdown to HTML converter
function convertMarkdownToHTML(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Bold and Italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />')
    // Lists
    .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^-\s+(.*$)/gm, '<li>$1</li>')
    // Wrap consecutive list items
    .replace(/(<li>.*<\/li>)/gs, (match) => {
      if (match.includes('1.')) {
        return '<ol class="list-decimal list-inside mb-4">' + match + '</ol>';
      }
      return '<ul class="list-disc list-inside mb-4">' + match + '</ul>';
    })
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-6]>.*<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p>(<ul.*<\/ul>)<\/p>/g, '$1')
    .replace(/<p>(<ol.*<\/ol>)<\/p>/g, '$1')
    .replace(/<p>(<img.*\/>)<\/p>/g, '$1');
}

export default function CreateArticle() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("edit");

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

                {/* Content with Preview */}
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nội dung bài viết *</FormLabel>
                      <FormControl>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="edit" className="flex items-center gap-2">
                              <Edit className="h-4 w-4" />
                              Chỉnh sửa
                            </TabsTrigger>
                            <TabsTrigger value="preview" className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              Xem trước
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="edit" className="mt-4">
                            <RichTextEditor
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Nhập nội dung bài viết... Sử dụng các nút định dạng để tạo văn bản đẹp và chèn hình ảnh ở bất kỳ vị trí nào."
                            />
                          </TabsContent>
                          
                          <TabsContent value="preview" className="mt-4">
                            <div className="border rounded-lg p-6 min-h-[400px] bg-white">
                              <div className="prose prose-lg max-w-none">
                                {field.value ? (
                                  <div 
                                    dangerouslySetInnerHTML={{ 
                                      __html: convertMarkdownToHTML(field.value) 
                                    }} 
                                  />
                                ) : (
                                  <p className="text-gray-500 italic">
                                    Chưa có nội dung để xem trước. Hãy nhập nội dung ở tab "Chỉnh sửa".
                                  </p>
                                )}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
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
      </div>
    </div>
  );
}