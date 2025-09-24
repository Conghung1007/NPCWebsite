import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, ArrowLeft, Search, Trash2, HelpCircle, Volume2, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Question } from "@shared/schema";

const questionCategories = [
  { value: "từ vựng", label: "Từ vựng" },
  { value: "ngữ pháp", label: "Ngữ pháp" },
  { value: "đọc hiểu", label: "Đọc hiểu" },
  { value: "nghe hiểu", label: "Nghe hiểu" },
];

// Form validation schema for 4-section exam structure
const examSchema = z.object({
  title: z.string().min(1, "Tiêu đề bài thi là bắt buộc"),
  description: z.string().optional(),
  isDemo: z.boolean().default(false),
  
  // Vocabulary section
  vocabularyTimeLimit: z.number().min(1, "Thời gian phần từ vựng phải lớn hơn 0"),
  
  // Grammar section  
  grammarTimeLimit: z.number().min(1, "Thời gian phần ngữ pháp phải lớn hơn 0"),
  
  // Listening section
  listeningTimeLimit: z.number().min(1, "Thời gian phần nghe hiểu phải lớn hơn 0"),
  
  // Reading section
  readingTimeLimit: z.number().min(1, "Thời gian phần đọc hiểu phải lớn hơn 0"),
});

type ExamFormData = z.infer<typeof examSchema>;

export default function CreateExam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for managing selected questions by section
  const [selectedVocabularyQuestions, setSelectedVocabularyQuestions] = useState<Question[]>([]);
  const [selectedGrammarQuestions, setSelectedGrammarQuestions] = useState<Question[]>([]);
  const [selectedListeningQuestions, setSelectedListeningQuestions] = useState<Question[]>([]);
  const [selectedReadingQuestions, setSelectedReadingQuestions] = useState<Question[]>([]);
  
  const [isQuestionSelectOpen, setIsQuestionSelectOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<"vocabulary" | "grammar" | "listening" | "reading">("vocabulary");
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      description: "",
      isDemo: false,
      vocabularyTimeLimit: 10,
      grammarTimeLimit: 10,
      listeningTimeLimit: 5,
      readingTimeLimit: 5,
    },
  });

  // Fetch questions from question bank
  const { data: availableQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  // Get currently selected questions for current section
  const getCurrentSectionQuestions = () => {
    switch (currentSection) {
      case "vocabulary": return selectedVocabularyQuestions;
      case "grammar": return selectedGrammarQuestions;
      case "listening": return selectedListeningQuestions;
      case "reading": return selectedReadingQuestions;
      default: return [];
    }
  };

  // Filter available questions for current section
  const filteredQuestions = availableQuestions.filter(question => {
    // Don't show questions already selected in current section
    if (getCurrentSectionQuestions().find(sq => sq.id === question.id)) return false;
    
    // Apply search filter
    if (questionSearchQuery && !question.questionText.toLowerCase().includes(questionSearchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply category filter - only show questions matching the current section
    const sectionCategoryMap = {
      vocabulary: "từ vựng",
      grammar: "ngữ pháp", 
      listening: "nghe hiểu",
      reading: "đọc hiểu"
    };
    
    if (question.category !== sectionCategoryMap[currentSection]) {
      return false;
    }
    
    return true;
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      // Validate that each section has at least one question
      if (selectedVocabularyQuestions.length === 0) {
        throw new Error("Phải chọn ít nhất một câu hỏi cho phần từ vựng");
      }
      if (selectedGrammarQuestions.length === 0) {
        throw new Error("Phải chọn ít nhất một câu hỏi cho phần ngữ pháp");
      }
      if (selectedListeningQuestions.length === 0) {
        throw new Error("Phải chọn ít nhất một câu hỏi cho phần nghe hiểu");
      }
      if (selectedReadingQuestions.length === 0) {
        throw new Error("Phải chọn ít nhất một câu hỏi cho phần đọc hiểu");
      }

      // Create the exam with section-specific question arrays
      const examData = {
        ...data,
        vocabularyQuestions: selectedVocabularyQuestions.map(q => q.id),
        grammarQuestions: selectedGrammarQuestions.map(q => q.id),
        listeningQuestions: selectedListeningQuestions.map(q => q.id),
        readingQuestions: selectedReadingQuestions.map(q => q.id),
      };
      
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(examData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create exam");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Tạo bài thi thành công",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      setLocation("/cpanel?tab=exams");
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo bài thi",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ExamFormData) => {
    createExamMutation.mutate(data);
  };

  // Helper functions to add/remove questions for each section
  const addQuestionToSection = (question: Question) => {
    switch (currentSection) {
      case "vocabulary":
        setSelectedVocabularyQuestions(prev => [...prev, question]);
        break;
      case "grammar":
        setSelectedGrammarQuestions(prev => [...prev, question]);
        break;
      case "listening":
        setSelectedListeningQuestions(prev => [...prev, question]);
        break;
      case "reading":
        setSelectedReadingQuestions(prev => [...prev, question]);
        break;
    }
  };

  const removeQuestionFromSection = (questionId: string, section: "vocabulary" | "grammar" | "listening" | "reading") => {
    switch (section) {
      case "vocabulary":
        setSelectedVocabularyQuestions(prev => prev.filter(q => q.id !== questionId));
        break;
      case "grammar":
        setSelectedGrammarQuestions(prev => prev.filter(q => q.id !== questionId));
        break;
      case "listening":
        setSelectedListeningQuestions(prev => prev.filter(q => q.id !== questionId));
        break;
      case "reading":
        setSelectedReadingQuestions(prev => prev.filter(q => q.id !== questionId));
        break;
    }
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation("/cpanel?tab=exams")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Tạo Bài Thi Mới</h1>
        <p className="text-gray-600 mt-2">Tạo bài thi bằng cách chọn câu hỏi từ bộ câu hỏi có sẵn</p>
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

              {/* 4-Section Time Limits */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <FormField
                  control={form.control}
                  name="vocabularyTimeLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian từ vựng (phút) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="10" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-vocabulary-time-limit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="grammarTimeLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian ngữ pháp (phút) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="10" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-grammar-time-limit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="listeningTimeLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian nghe hiểu (phút) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="5" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-listening-time-limit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="readingTimeLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian đọc hiểu (phút) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="5" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-reading-time-limit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Demo Checkbox */}
              <FormField
                control={form.control}
                name="isDemo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại bài thi</FormLabel>
                    <div className="flex items-center space-x-2 mt-2">
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
            </CardContent>
          </Card>

          {/* Selected Questions by Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Câu hỏi theo từng phần</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Tổng: {selectedVocabularyQuestions.length + selectedGrammarQuestions.length + selectedListeningQuestions.length + selectedReadingQuestions.length} câu hỏi
                  </p>
                </div>
                <Button 
                  type="button"
                  onClick={() => {
                    setCurrentSection("vocabulary");
                    setIsQuestionSelectOpen(true);
                  }}
                  className="flex items-center gap-2"
                  data-testid="button-select-questions"
                >
                  <Plus className="w-4 h-4" />
                  Chọn câu hỏi
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Vocabulary Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    Từ vựng ({selectedVocabularyQuestions.length} câu)
                  </h3>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setCurrentSection("vocabulary");
                      setIsQuestionSelectOpen(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Thêm
                  </Button>
                </div>
                {selectedVocabularyQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">Chưa có câu hỏi từ vựng</p>
                ) : (
                  <div className="space-y-2">
                    {selectedVocabularyQuestions.map((question, index) => (
                      <div key={question.id} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">{index + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm">{question.questionText}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeQuestionFromSection(question.id, "vocabulary")}
                          className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grammar Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    Ngữ pháp ({selectedGrammarQuestions.length} câu)
                  </h3>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setCurrentSection("grammar");
                      setIsQuestionSelectOpen(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Thêm
                  </Button>
                </div>
                {selectedGrammarQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">Chưa có câu hỏi ngữ pháp</p>
                ) : (
                  <div className="space-y-2">
                    {selectedGrammarQuestions.map((question, index) => (
                      <div key={question.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">{index + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm">{question.questionText}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeQuestionFromSection(question.id, "grammar")}
                          className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Listening Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    Nghe hiểu ({selectedListeningQuestions.length} câu)
                  </h3>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setCurrentSection("listening");
                      setIsQuestionSelectOpen(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Thêm
                  </Button>
                </div>
                {selectedListeningQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">Chưa có câu hỏi nghe hiểu</p>
                ) : (
                  <div className="space-y-2">
                    {selectedListeningQuestions.map((question, index) => (
                      <div key={question.id} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">{index + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm">{question.questionText}</p>
                          {question.audioUrl && <Volume2 className="w-4 h-4 text-yellow-600 mt-1" />}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeQuestionFromSection(question.id, "listening")}
                          className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reading Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    Đọc hiểu ({selectedReadingQuestions.length} câu)
                  </h3>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setCurrentSection("reading");
                      setIsQuestionSelectOpen(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Thêm
                  </Button>
                </div>
                {selectedReadingQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">Chưa có câu hỏi đọc hiểu</p>
                ) : (
                  <div className="space-y-2">
                    {selectedReadingQuestions.map((question, index) => (
                      <div key={question.id} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">{index + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm">{question.questionText}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeQuestionFromSection(question.id, "reading")}
                          className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setLocation("/cpanel?tab=exams")}
              disabled={createExamMutation.isPending}
            >
              Hủy
            </Button>
            <Button 
              type="submit" 
              disabled={createExamMutation.isPending || 
                       selectedVocabularyQuestions.length === 0 ||
                       selectedGrammarQuestions.length === 0 ||
                       selectedListeningQuestions.length === 0 ||
                       selectedReadingQuestions.length === 0}
              data-testid="button-create-exam"
            >
              <Save className="w-4 h-4 mr-2" />
              {createExamMutation.isPending ? "Đang tạo..." : "Tạo bài thi"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Question Selection Dialog */}
      <Dialog open={isQuestionSelectOpen} onOpenChange={setIsQuestionSelectOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chọn câu hỏi - Phần {
              currentSection === "vocabulary" ? "Từ vựng" :
              currentSection === "grammar" ? "Ngữ pháp" :
              currentSection === "listening" ? "Nghe hiểu" : "Đọc hiểu"
            }</DialogTitle>
            <DialogDescription>
              Chọn câu hỏi cho phần {
                currentSection === "vocabulary" ? "từ vựng" :
                currentSection === "grammar" ? "ngữ pháp" :
                currentSection === "listening" ? "nghe hiểu" : "đọc hiểu"
              } từ bộ câu hỏi có sẵn
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
            {questionsLoading ? (
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
                          onClick={() => addQuestionToSection(question)}
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
                setSelectedCategory("all");
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