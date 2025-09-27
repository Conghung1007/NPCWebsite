import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
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
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Question, Exam } from "@shared/schema";

const questionCategories = [
  { value: "từ vựng", label: "Từ vựng" },
  { value: "ngữ pháp", label: "Ngữ pháp" },
  { value: "đọc hiểu", label: "Đọc hiểu" },
  { value: "nghe hiểu", label: "Nghe hiểu" },
];

// Dynamic section structure
interface ExamSection {
  id: string;
  type: "từ vựng" | "ngữ pháp" | "đọc hiểu" | "nghe hiểu";
  timeLimit: number;
  questions: Question[];
}

// Form validation schema for exam information
const examSchema = z.object({
  title: z.string().min(1, "Tiêu đề bài thi là bắt buộc"),
  description: z.string().optional(),
  isDemo: z.boolean().default(false),
});

type ExamFormData = z.infer<typeof examSchema>;

export default function EditExam() {
  const { examId } = useParams<{ examId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, hasImageEditPermission } = useAuth();

  // State for dynamic exam sections
  const [examSections, setExamSections] = useState<ExamSection[]>([]);
  const [isQuestionSelectOpen, setIsQuestionSelectOpen] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string>("");
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      description: "",
      isDemo: false,
    },
  });

  // Fetch existing exam data
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${examId}`],
    enabled: !!examId,
  });

  // Authentication check
  useEffect(() => {
    if (!authLoading && (!user || !hasImageEditPermission)) {
      setLocation("/cpanel?tab=login");
    }
  }, [authLoading, user, hasImageEditPermission, setLocation]);

  // Fetch questions from question bank - only when authenticated
  const { data: availableQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    enabled: !!user && hasImageEditPermission,
  });

  // Load existing exam data into sections
  useEffect(() => {
    if (exam && availableQuestions.length > 0) {
      console.log('Loading exam data into sections:', exam);
      
      // Set form values
      form.reset({
        title: exam.title,
        description: exam.description || "",
        isDemo: exam.isDemo || false,
      });

      // Convert existing exam structure to dynamic sections
      const sections: ExamSection[] = [];
      
      // Add sections based on existing question arrays
      if (exam.vocabularyQuestions && Array.isArray(exam.vocabularyQuestions) && exam.vocabularyQuestions.length > 0) {
        const vocabularyQs = exam.vocabularyQuestions
          .map(id => availableQuestions.find(q => q.id === id))
          .filter(Boolean) as Question[];
        
        sections.push({
          id: "vocab-section",
          type: "từ vựng",
          timeLimit: exam.vocabularyTimeLimit || 10,
          questions: vocabularyQs
        });
      }

      if (exam.grammarQuestions && Array.isArray(exam.grammarQuestions) && exam.grammarQuestions.length > 0) {
        const grammarQs = exam.grammarQuestions
          .map(id => availableQuestions.find(q => q.id === id))
          .filter(Boolean) as Question[];
        
        sections.push({
          id: "grammar-section",
          type: "ngữ pháp",
          timeLimit: exam.grammarTimeLimit || 10,
          questions: grammarQs
        });
      }

      if (exam.listeningQuestions && Array.isArray(exam.listeningQuestions) && exam.listeningQuestions.length > 0) {
        const listeningQs = exam.listeningQuestions
          .map(id => availableQuestions.find(q => q.id === id))
          .filter(Boolean) as Question[];
        
        sections.push({
          id: "listening-section",
          type: "nghe hiểu",
          timeLimit: exam.listeningTimeLimit || 10,
          questions: listeningQs
        });
      }

      if (exam.readingQuestions && Array.isArray(exam.readingQuestions) && exam.readingQuestions.length > 0) {
        const readingQs = exam.readingQuestions
          .map(id => availableQuestions.find(q => q.id === id))
          .filter(Boolean) as Question[];
        
        sections.push({
          id: "reading-section",
          type: "đọc hiểu",
          timeLimit: exam.readingTimeLimit || 10,
          questions: readingQs
        });
      }

      // If no sections found, create a default section
      if (sections.length === 0) {
        sections.push({
          id: "section-1",
          type: "từ vựng",
          timeLimit: 10,
          questions: []
        });
      }

      setExamSections(sections);
    }
  }, [exam, availableQuestions, form]);

  // Helper functions for managing dynamic sections
  const addExamSection = () => {
    // Find available section types (not already used)
    const usedTypes = examSections.map(s => s.type);
    const availableTypes = questionCategories.filter(c => !usedTypes.includes(c.value as ExamSection['type']));
    
    if (availableTypes.length === 0) {
      toast({
        title: "Thông báo",
        description: "Bạn đã thêm đủ tất cả các loại phần thi. Mỗi loại chỉ được thêm 1 lần.",
        variant: "destructive",
      });
      return;
    }

    const newSection: ExamSection = {
      id: `section-${Date.now()}`,
      type: availableTypes[0].value as ExamSection['type'],
      timeLimit: 10,
      questions: []
    };
    setExamSections(prev => [...prev, newSection]);
  };

  const removeExamSection = (sectionId: string) => {
    if (examSections.length <= 1) {
      toast({
        title: "Lỗi",
        description: "Bài thi phải có ít nhất 1 phần thi",
        variant: "destructive",
      });
      return;
    }
    setExamSections(prev => prev.filter(section => section.id !== sectionId));
  };

  const updateSectionType = (sectionId: string, type: ExamSection['type']) => {
    // Check if this type is already used in another section
    const existingSection = examSections.find(s => s.type === type && s.id !== sectionId);
    if (existingSection) {
      toast({
        title: "Lỗi",
        description: `Loại phần thi "${questionCategories.find(c => c.value === type)?.label}" đã được sử dụng. Mỗi loại chỉ được sử dụng 1 lần.`,
        variant: "destructive",
      });
      return;
    }

    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, type, questions: [] } // Clear questions when type changes
        : section
    ));
  };

  const updateSectionTimeLimit = (sectionId: string, timeLimit: number) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, timeLimit }
        : section
    ));
  };

  const addQuestionToSection = (sectionId: string, question: Question) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, questions: [...section.questions, question] }
        : section
    ));
  };

  const removeQuestionFromSection = (sectionId: string, questionId: string) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, questions: section.questions.filter(q => q.id !== questionId) }
        : section
    ));
  };

  const openQuestionSelector = (sectionId: string) => {
    setCurrentSectionId(sectionId);
    setIsQuestionSelectOpen(true);
    setQuestionSearchQuery("");
    setSelectedLanguageFilter("all");
    setSelectedCategoryFilter("all");
  };

  // Category mapping between English and Vietnamese
  const categoryMapping: Record<string, string> = {
    "vocabulary": "từ vựng",
    "grammar": "ngữ pháp", 
    "reading": "đọc hiểu",
    "listening": "nghe hiểu",
    "từ vựng": "từ vựng",
    "ngữ pháp": "ngữ pháp",
    "đọc hiểu": "đọc hiểu", 
    "nghe hiểu": "nghe hiểu"
  };

  // Filter questions for selection based on current section type
  const getFilteredQuestionsForSection = () => {
    if (!currentSectionId) return [];
    
    const currentSection = examSections.find(s => s.id === currentSectionId);
    if (!currentSection) return [];

    // Get all questions already used in ANY section
    const usedQuestionIds = examSections.flatMap(section => section.questions.map(q => q.id));
    
    console.log('Debug filter:', {
      currentSectionType: currentSection.type,
      availableQuestionsCount: availableQuestions.length,
      sampleQuestionCategory: availableQuestions[0]?.category,
      usedQuestionIds: usedQuestionIds.length
    });
    
    return availableQuestions.filter(question => {
      // Don't show questions already used
      if (usedQuestionIds.includes(question.id)) return false;
      
      // Only show questions of the current section type (with mapping)
      const questionCategoryVietnamese = categoryMapping[question.category] || question.category;
      if (questionCategoryVietnamese !== currentSection.type) return false;
      
      // Apply search filter
      if (questionSearchQuery && !question.questionText.toLowerCase().includes(questionSearchQuery.toLowerCase())) {
        return false;
      }
      
      // Apply category filter
      if (selectedCategoryFilter && selectedCategoryFilter !== "all" && question.category !== selectedCategoryFilter) {
        return false;
      }
      
      // Apply language filter  
      if (selectedLanguageFilter && selectedLanguageFilter !== "all" && question.language !== selectedLanguageFilter) {
        return false;
      }
      
      return true;
    });
  };

  // Calculate total questions and time
  const totalQuestions = examSections.reduce((sum, section) => sum + section.questions.length, 0);
  const totalTimeLimit = examSections.reduce((sum, section) => sum + section.timeLimit, 0);

  // Update exam mutation with new section structure
  const updateExamMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      // Validate sections
      if (examSections.length === 0) {
        throw new Error("Bài thi phải có ít nhất 1 phần thi");
      }

      if (totalQuestions === 0) {
        throw new Error("Bài thi phải có ít nhất 1 câu hỏi");
      }

      // Prepare exam data with section structure
      const examData = {
        ...data,
        timeLimit: totalTimeLimit,
        questionCount: totalQuestions,
        // Section question arrays
        vocabularyQuestions: examSections.find(s => s.type === "từ vựng")?.questions.map(q => q.id) || [],
        grammarQuestions: examSections.find(s => s.type === "ngữ pháp")?.questions.map(q => q.id) || [],
        listeningQuestions: examSections.find(s => s.type === "nghe hiểu")?.questions.map(q => q.id) || [],
        readingQuestions: examSections.find(s => s.type === "đọc hiểu")?.questions.map(q => q.id) || [],
        // Section time limits
        vocabularyTimeLimit: examSections.find(s => s.type === "từ vựng")?.timeLimit || 0,
        grammarTimeLimit: examSections.find(s => s.type === "ngữ pháp")?.timeLimit || 0,
        listeningTimeLimit: examSections.find(s => s.type === "nghe hiểu")?.timeLimit || 0,
        readingTimeLimit: examSections.find(s => s.type === "đọc hiểu")?.timeLimit || 0,
      };

      return await apiRequest("PUT", `/api/exams/${examId}`, examData);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Cập nhật bài thi thành công",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      queryClient.invalidateQueries({ queryKey: [`/api/exams/${examId}`] });
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

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated or unauthorized
  if (!user || !hasImageEditPermission) {
    return null; // Will redirect via useEffect
  }

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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation("/cpanel?tab=exams")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Chỉnh sửa bài thi</h1>
        <p className="text-gray-600 mt-2">Cập nhật thông tin bài thi và quản lý các phần thi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Exam Information */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thông tin bài thi</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tiêu đề bài thi</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Nhập tiêu đề bài thi" 
                            {...field} 
                            data-testid="input-title"
                          />
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
                        <FormLabel>Mô tả (tùy chọn)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Nhập mô tả bài thi" 
                            rows={3}
                            {...field} 
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDemo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-demo"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Bài thi miễn phí</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Cho phép người dùng thi thử miễn phí
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Exam Summary */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-2">Tổng quan</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Số phần thi:</span>
                        <span className="font-medium">{examSections.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tổng câu hỏi:</span>
                        <span className="font-medium">{totalQuestions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tổng thời gian:</span>
                        <span className="font-medium">{totalTimeLimit} phút</span>
                      </div>
                    </div>
                  </div>

                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Dynamic Exam Sections */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Các phần thi</CardTitle>
                <Button 
                  onClick={addExamSection}
                  variant="outline" 
                  size="sm"
                  data-testid="button-add-section"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm phần thi
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {examSections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Chưa có phần thi nào. Nhấn "Thêm phần thi" để bắt đầu.</p>
                </div>
              ) : (
                examSections.map((section, index) => (
                  <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900">Phần {index + 1}</h4>
                      <Button
                        onClick={() => removeExamSection(section.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-remove-section-${section.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Loại phần thi
                        </label>
                        <Select 
                          value={section.type} 
                          onValueChange={(value) => updateSectionType(section.id, value as ExamSection['type'])}
                        >
                          <SelectTrigger data-testid={`select-section-type-${section.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {questionCategories.map(category => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Thời gian (phút)
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="120"
                          value={section.timeLimit}
                          onChange={(e) => updateSectionTimeLimit(section.id, parseInt(e.target.value) || 1)}
                          data-testid={`input-time-limit-${section.id}`}
                        />
                      </div>
                    </div>

                    {/* Section Questions */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Câu hỏi ({section.questions.length})
                        </span>
                        <Button
                          onClick={() => openQuestionSelector(section.id)}
                          variant="outline"
                          size="sm"
                          data-testid={`button-add-questions-${section.id}`}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Thêm câu hỏi
                        </Button>
                      </div>

                      {section.questions.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                          <p className="text-sm">Chưa có câu hỏi nào</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {section.questions.map((question, qIndex) => (
                            <div key={question.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    #{qIndex + 1}
                                  </span>
                                  {getCategoryBadge(question.category)}
                                  {question.audioUrl && <Volume2 className="w-4 h-4 text-blue-600" />}
                                </div>
                                <p className="text-sm text-gray-700 line-clamp-2">
                                  {question.questionText}
                                </p>
                              </div>
                              <Button
                                onClick={() => removeQuestionFromSection(section.id, question.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 ml-2"
                                data-testid={`button-remove-question-${question.id}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Button - Fixed at Bottom */}
      <div className="mt-8 flex justify-end">
        <Button 
          onClick={() => form.handleSubmit(onSubmit)()}
          size="lg"
          className="px-8 py-3 text-lg"
          disabled={updateExamMutation.isPending}
          data-testid="button-save-bottom"
        >
          <Save className="w-5 h-5 mr-3" />
          {updateExamMutation.isPending ? "Đang lưu..." : "Lưu bài thi"}
        </Button>
      </div>

      {/* Question Selection Dialog */}
      <Dialog open={isQuestionSelectOpen} onOpenChange={setIsQuestionSelectOpen}>
        <DialogContent 
          className="max-h-[80vh] overflow-y-auto"
          style={{
            width: "95vw",
            maxWidth: "1000px"
          }}
        >
          <DialogHeader>
            <DialogTitle>Chọn câu hỏi</DialogTitle>
            <DialogDescription>
              Chọn câu hỏi cho phần thi "{questionCategories.find(c => c.value === examSections.find(s => s.id === currentSectionId)?.type)?.label}"
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4 space-y-4">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm kiếm câu hỏi..."
                value={questionSearchQuery}
                onChange={(e) => setQuestionSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-questions"
              />
            </div>
            
            {/* Filter Dropdowns */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Lọc theo category</label>
                <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                  <SelectTrigger data-testid="select-category-filter">
                    <SelectValue placeholder="Tất cả categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả categories</SelectItem>
                    <SelectItem value="vocabulary">Vocabulary</SelectItem>
                    <SelectItem value="grammar">Grammar</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="listening">Listening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Lọc theo ngôn ngữ</label>
                <Select value={selectedLanguageFilter} onValueChange={setSelectedLanguageFilter}>
                  <SelectTrigger data-testid="select-language-filter">
                    <SelectValue placeholder="Tất cả ngôn ngữ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả ngôn ngữ</SelectItem>
                    <SelectItem value="japanese">Tiếng Nhật</SelectItem>
                    <SelectItem value="english">Tiếng Anh</SelectItem>
                    <SelectItem value="german">Tiếng Đức</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {getFilteredQuestionsForSection().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Không có câu hỏi phù hợp</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Câu hỏi</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Ngôn ngữ</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredQuestionsForSection().map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm line-clamp-2">{question.questionText}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(question.category)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {question.language === "japanese" && "Tiếng Nhật"}
                          {question.language === "english" && "Tiếng Anh"}
                          {question.language === "german" && "Tiếng Đức"}
                          {!["japanese", "english", "german"].includes(question.language) && question.language}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => {
                            addQuestionToSection(currentSectionId, question);
                            toast({
                              title: "Đã thêm",
                              description: "Câu hỏi đã được thêm vào phần thi",
                            });
                          }}
                          variant="outline"
                          size="sm"
                          data-testid={`button-select-question-${question.id}`}
                        >
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
            <Button onClick={() => setIsQuestionSelectOpen(false)} variant="outline">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}