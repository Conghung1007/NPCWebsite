import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, Edit, Trash2, HelpCircle, BookOpen, Volume2, Eye, Filter, Save, X, Minus } from "lucide-react";
import type { Question } from "@shared/schema";

const questionCategories = [
  { value: "từ vựng", label: "Từ vựng" },
  { value: "ngữ pháp", label: "Ngữ pháp" },
  { value: "đọc hiểu", label: "Đọc hiểu" },
  { value: "nghe hiểu", label: "Nghe hiểu" },
];

// Form validation schema
const questionSchema = z.object({
  category: z.string().min(1, "Danh mục là bắt buộc"),
  description: z.string().optional(),
  questionText: z.string().min(1, "Nội dung câu hỏi là bắt buộc"),
  questionType: z.enum(["multiple_choice", "true_false"]).default("multiple_choice"),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  options: z.array(z.string()).min(2, "Phải có ít nhất 2 lựa chọn"),
  correctAnswer: z.string().min(1, "Phải chọn đáp án đúng"),
  explanation: z.string().optional(),
}).refine(
  (data) => {
    // Validate that correctAnswer is one of the provided options
    const nonEmptyOptions = data.options.filter(option => option.trim() !== "");
    return nonEmptyOptions.includes(data.correctAnswer);
  },
  {
    message: "Đáp án đúng phải là một trong các lựa chọn đã nhập",
    path: ["correctAnswer"],
  }
).refine(
  (data) => {
    // For true/false questions, enforce exactly 2 options
    if (data.questionType === "true_false") {
      const nonEmptyOptions = data.options.filter(option => option.trim() !== "");
      return nonEmptyOptions.length === 2;
    }
    return true;
  },
  {
    message: "Câu hỏi Đúng/Sai phải có chính xác 2 lựa chọn",
    path: ["options"],
  }
);

type QuestionFormData = z.infer<typeof questionSchema>;

export function QuestionBankManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; question: Question | null }>({
    isOpen: false,
    question: null
  });

  // Form for creating/editing questions
  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      category: "ngữ pháp",
      description: "",
      questionText: "",
      questionType: "multiple_choice",
      imageUrl: "",
      audioUrl: "",
      options: ["", ""],
      correctAnswer: "",
      explanation: "",
    },
  });

  // Fetch all questions from question bank
  const { data: questions = [], isLoading, refetch } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  // Filter questions based on search and category
  const filteredQuestions = questions.filter(question => {
    const matchesSearch = searchQuery === "" || 
      question.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (question.description && question.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "" || question.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadge = (category: string) => {
    const categoryConfig = questionCategories.find(cat => cat.value === category);
    const variants: any = {
      "từ vựng": "default",
      "ngữ pháp": "secondary",
      "đọc hiểu": "outline",
      "nghe hiểu": "destructive"
    };
    return (
      <Badge variant={variants[category] || "outline"}>
        {categoryConfig?.label || category}
      </Badge>
    );
  };

  const handleDeleteQuestion = (question: Question) => {
    setDeleteConfirm({ isOpen: true, question });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.question) return;

    try {
      await apiRequest("DELETE", `/api/questions/${deleteConfirm.question.id}`);
      toast({
        title: "Thành công",
        description: "Câu hỏi đã được xóa thành công.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      setDeleteConfirm({ isOpen: false, question: null });
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa câu hỏi.",
        variant: "destructive",
      });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, question: null });
  };

  // Create/Update question mutations
  const createQuestionMutation = useMutation({
    mutationFn: async (data: QuestionFormData) => {
      return await apiRequest("POST", "/api/questions", data);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Câu hỏi đã được tạo thành công.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      setIsAddingQuestion(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo câu hỏi.",
        variant: "destructive",
      });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: QuestionFormData & { id: string }) => {
      const { id, ...updateData } = data;
      return await apiRequest("PUT", `/api/questions/${id}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Câu hỏi đã được cập nhật thành công.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      setEditingQuestion(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật câu hỏi.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: QuestionFormData) => {
    if (editingQuestion) {
      updateQuestionMutation.mutate({ ...data, id: editingQuestion.id });
    } else {
      createQuestionMutation.mutate(data);
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    form.reset({
      category: question.category,
      description: question.description || "",
      questionText: question.questionText,
      questionType: question.questionType as "multiple_choice" | "true_false",
      imageUrl: question.imageUrl || "",
      audioUrl: question.audioUrl || "",
      options: typeof question.options === 'string' 
        ? JSON.parse(question.options) 
        : Array.isArray(question.options) 
          ? question.options 
          : [],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || "",
    });
  };

  const handleAddOption = () => {
    const currentOptions = form.getValues("options");
    form.setValue("options", [...currentOptions, ""]);
  };

  const handleRemoveOption = (index: number) => {
    const currentOptions = form.getValues("options");
    if (currentOptions.length > 2) {
      form.setValue("options", currentOptions.filter((_, i) => i !== index));
    }
  };

  const cancelForm = () => {
    setIsAddingQuestion(false);
    setEditingQuestion(null);
    form.reset();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Bộ câu hỏi
          </CardTitle>
          <CardDescription>
            Quản lý và tạo câu hỏi độc lập để sử dụng trong các đề thi
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm câu hỏi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-questions"
                />
              </div>
            </div>
            
            {/* Category Filter */}
            <div className="min-w-[180px]">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="Lọc theo danh mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả danh mục</SelectItem>
                  {questionCategories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Question Button */}
            <Button 
              onClick={() => setIsAddingQuestion(true)} 
              className="flex items-center gap-2"
              data-testid="button-add-question"
            >
              <Plus className="w-4 h-4" />
              Thêm câu hỏi
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions Table */}
      <Card>
        <CardContent className="p-0">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || selectedCategory ? 
                "Không tìm thấy câu hỏi nào phù hợp." :
                "Chưa có câu hỏi nào trong bộ câu hỏi."
              }
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nội dung câu hỏi</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="max-w-md">
                      <div className="flex items-start gap-2">
                        {question.audioUrl && <Volume2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />}
                        {question.imageUrl && <Eye className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />}
                        <div className="truncate" title={question.questionText}>
                          {question.questionText}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getCategoryBadge(question.category)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {question.questionType === "multiple_choice" ? "Trắc nghiệm" : "Đúng/Sai"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm text-muted-foreground">
                        {question.description || "Không có"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditQuestion(question)}
                          data-testid={`button-edit-${question.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteQuestion(question)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-${question.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Question Dialog */}
      <Dialog open={isAddingQuestion || !!editingQuestion} onOpenChange={(open) => !open && cancelForm()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion ? "Cập nhật thông tin câu hỏi" : "Tạo một câu hỏi mới trong bộ câu hỏi"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Danh mục *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-question-category">
                            <SelectValue placeholder="Chọn danh mục" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {questionCategories.map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Question Type */}
                <FormField
                  control={form.control}
                  name="questionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loại câu hỏi</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-question-type">
                            <SelectValue placeholder="Chọn loại câu hỏi" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="multiple_choice">Trắc nghiệm</SelectItem>
                          <SelectItem value="true_false">Đúng/Sai</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả (tùy chọn)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Mô tả hoặc ghi chú cho câu hỏi..."
                        className="min-h-[60px]"
                        data-testid="textarea-question-description"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Question Text */}
              <FormField
                control={form.control}
                name="questionText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nội dung câu hỏi *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Nhập nội dung câu hỏi..."
                        className="min-h-[100px]"
                        data-testid="textarea-question-text"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Lựa chọn *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    className="flex items-center gap-1"
                    data-testid="button-add-option"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm lựa chọn
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {form.watch("options").map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder={`Lựa chọn ${index + 1}`}
                          value={option}
                          onChange={(e) => {
                            const currentOptions = form.getValues("options");
                            currentOptions[index] = e.target.value;
                            form.setValue("options", currentOptions);
                          }}
                          data-testid={`input-option-${index}`}
                        />
                      </div>
                      {form.watch("options").length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveOption(index)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-remove-option-${index}`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Correct Answer */}
              <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đáp án đúng *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-correct-answer">
                          <SelectValue placeholder="Chọn đáp án đúng" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {form.watch("options").map((option, index) => (
                          option.trim() && (
                            <SelectItem key={index} value={option}>
                              {option}
                            </SelectItem>
                          )
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Explanation */}
              <FormField
                control={form.control}
                name="explanation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giải thích (tùy chọn)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Giải thích tại sao đáp án này là đúng..."
                        className="min-h-[80px]"
                        data-testid="textarea-explanation"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex gap-2">
                <Button type="button" variant="outline" onClick={cancelForm}>
                  <X className="w-4 h-4 mr-1" />
                  Hủy
                </Button>
                <Button 
                  type="submit" 
                  disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                  data-testid="button-save-question"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {createQuestionMutation.isPending || updateQuestionMutation.isPending 
                    ? "Đang lưu..." 
                    : (editingQuestion ? "Cập nhật" : "Tạo câu hỏi")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa câu hỏi</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa câu hỏi này không?
              <br />
              <span className="text-red-600 font-medium">Hành động này không thể hoàn tác.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={confirmDelete} data-testid="button-confirm-delete">
              Xóa câu hỏi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}