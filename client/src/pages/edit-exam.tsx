import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Save, Plus, ArrowLeft, Search, Trash2, HelpCircle, Volume2, Eye, X } from "lucide-react";
import type { Exam, Question } from "@shared/schema";

const questionCategories = [
  { value: "từ vựng", label: "Từ vựng" },
  { value: "ngữ pháp", label: "Ngữ pháp" },
  { value: "đọc hiểu", label: "Đọc hiểu" },
  { value: "nghe hiểu", label: "Nghe hiểu" },
];

// Form validation schema - now only for exam metadata
const examFormSchema = z.object({
  title: z.string().min(1, "Tiêu đề là bắt buộc"),
  description: z.string().optional(),
  timeLimit: z.number().min(1, "Thời gian phải lớn hơn 0"),
  isDemo: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

type ExamFormData = z.infer<typeof examFormSchema>;

export default function EditExam() {
  const { examId } = useParams<{ examId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for managing selected questions  
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [isQuestionSelectOpen, setIsQuestionSelectOpen] = useState(false);
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Fetch exam data
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${examId}`],
    enabled: !!examId,
  });

  // Fetch current exam questions
  const { data: currentQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: [`/api/exams/${examId}/questions`],
    enabled: !!examId,
  });

  // Fetch all questions from question bank
  const { data: availableQuestions = [], isLoading: allQuestionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      timeLimit: 30,
      isDemo: false,
      isActive: true,
    },
  });

  // Populate form and selected questions when data is loaded
  useEffect(() => {
    if (exam && !questionsLoading) {
      console.log('Loading exam data:', { exam, currentQuestions, length: currentQuestions.length });
      
      // Set form values
      form.reset({
        title: exam.title,
        description: exam.description || "",
        timeLimit: exam.timeLimit,
        isDemo: exam.isDemo || false,
        isActive: exam.isActive !== false,
      });

      // Set selected questions
      setSelectedQuestions(currentQuestions);
    }
  }, [exam, currentQuestions, questionsLoading, form]);

  // Filter available questions for selection
  const filteredQuestions = availableQuestions.filter(question => {
    // Don't show questions already selected
    if (selectedQuestions.find(sq => sq.id === question.id)) return false;
    
    // Apply search filter
    if (questionSearchQuery && !question.questionText.toLowerCase().includes(questionSearchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply category filter
    if (selectedCategory && selectedCategory !== "all" && question.category !== selectedCategory) {
      return false;
    }
    
    return true;
  });

  const updateExamMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      if (selectedQuestions.length === 0) {
        throw new Error("Phải có ít nhất một câu hỏi cho bài thi");
      }

      // Step 1: Update exam metadata
      const examData = {
        ...data,
        questionCount: selectedQuestions.length,
      };
      
      await apiRequest("PUT", `/api/exams/${examId}`, examData);
      
      // Step 2: Get current question associations
      const currentQuestionIds = currentQuestions.map(q => q.id);
      const newQuestionIds = selectedQuestions.map(q => q.id);
      
      // Step 3: Remove questions that are no longer selected
      const questionsToRemove = currentQuestionIds.filter(id => !newQuestionIds.includes(id));
      for (const questionId of questionsToRemove) {
        await apiRequest("DELETE", `/api/exams/${examId}/questions/${questionId}`);
      }
      
      // Step 4: Add new questions that weren't previously selected
      const questionsToAdd = newQuestionIds.filter(id => !currentQuestionIds.includes(id));
      for (let i = 0; i < questionsToAdd.length; i++) {
        const questionId = questionsToAdd[i];
        const sortOrder = currentQuestionIds.length + i; // Add after existing questions
        await apiRequest("POST", `/api/exams/${examId}/questions/${questionId}`, {
          sortOrder
        });
      }
      
      return { examId, success: true };
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Cập nhật bài thi thành công",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      queryClient.invalidateQueries({ queryKey: [`/api/exams/${examId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/exams/${examId}/questions`] });
      setLocation("/cpanel?tab=exams");
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật bài thi",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ExamFormData) => {
    updateExamMutation.mutate(data);
  };

  const handleSelectQuestion = (question: Question) => {
    setSelectedQuestions(prev => [...prev, question]);
  };

  const handleRemoveQuestion = (questionId: string) => {
    setSelectedQuestions(prev => prev.filter(q => q.id !== questionId));
  };

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

  if (examLoading || questionsLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-8 text-red-600">
          <p className="text-lg font-medium">Không tìm thấy bài thi</p>
          <Button
            variant="outline"
            onClick={() => setLocation("/cpanel?tab=exams")}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation("/cpanel?tab=exams")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Chỉnh Sửa Bài Thi</h1>
        <p className="text-gray-600 mt-2">Cập nhật thông tin bài thi và quản lý câu hỏi</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Exam Information */}
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Bài Thi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiêu đề *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập tiêu đề bài thi" {...field} data-testid="input-exam-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Nhập mô tả bài thi (tùy chọn)"
                        rows={3}
                        {...field}
                        data-testid="textarea-exam-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timeLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian làm bài (phút) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="1"
                          placeholder="30"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-exam-timelimit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isDemo"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="isDemo"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-exam-demo"
                          />
                          <label htmlFor="isDemo" className="text-sm">
                            Bài thi demo (không cần đăng nhập)
                          </label>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="isActive"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-exam-active"
                          />
                          <label htmlFor="isActive" className="text-sm">
                            Bài thi đang hoạt động
                          </label>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Questions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Câu hỏi trong bài thi ({selectedQuestions.length})</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedQuestions.length === 0 
                      ? "Chưa có câu hỏi nào" 
                      : `${selectedQuestions.length} câu hỏi`}
                  </p>
                </div>
                <Button 
                  type="button"
                  onClick={() => setIsQuestionSelectOpen(true)}
                  className="flex items-center gap-2"
                  data-testid="button-select-questions"
                >
                  <Plus className="w-4 h-4" />
                  Thêm câu hỏi
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">Chưa có câu hỏi nào</p>
                  <p className="text-sm">Nhấn nút "Thêm câu hỏi" để chọn câu hỏi từ bộ câu hỏi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedQuestions.map((question, index) => (
                    <div key={question.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-2">
                          {question.audioUrl && <Volume2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />}
                          {question.imageUrl && <Eye className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />}
                          <p className="text-sm font-medium">{question.questionText}</p>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          {getCategoryBadge(question.category)}
                          <Badge variant="outline" className="text-xs">
                            {question.questionType === "multiple_choice" ? "Trắc nghiệm" : "Đúng/Sai"}
                          </Badge>
                        </div>
                        {question.description && (
                          <p className="text-xs text-gray-600">{question.description}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveQuestion(question.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-remove-question-${question.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setLocation("/cpanel?tab=exams")}
              disabled={updateExamMutation.isPending}
            >
              Hủy
            </Button>
            <Button 
              type="submit" 
              disabled={updateExamMutation.isPending || selectedQuestions.length === 0}
              data-testid="button-update-exam"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateExamMutation.isPending ? "Đang cập nhật..." : "Cập nhật bài thi"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Question Selection Dialog */}
      <Dialog open={isQuestionSelectOpen} onOpenChange={setIsQuestionSelectOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chọn câu hỏi từ bộ câu hỏi</DialogTitle>
            <DialogDescription>
              Chọn câu hỏi từ bộ câu hỏi có sẵn để thêm vào bài thi
            </DialogDescription>
          </DialogHeader>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm câu hỏi..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-available-questions"
                />
              </div>
            </div>
            <div className="min-w-[200px]">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-filter-category">
                  <SelectValue placeholder="Lọc theo danh mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  {questionCategories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Available Questions */}
          <div className="border rounded-lg">
            {allQuestionsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {questionSearchQuery || selectedCategory ? 
                  "Không tìm thấy câu hỏi nào phù hợp." :
                  "Đã chọn tất cả câu hỏi có sẵn hoặc bộ câu hỏi trống."
                }
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nội dung câu hỏi</TableHead>
                    <TableHead>Danh mục</TableHead>
                    <TableHead>Loại</TableHead>
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
                        {question.description && (
                          <div className="text-xs text-gray-600 mt-1 truncate">
                            {question.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(question.category)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {question.questionType === "multiple_choice" ? "Trắc nghiệm" : "Đúng/Sai"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSelectQuestion(question)}
                          data-testid={`button-add-question-${question.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Chọn
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsQuestionSelectOpen(false);
                setQuestionSearchQuery("");
                setSelectedCategory("");
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}