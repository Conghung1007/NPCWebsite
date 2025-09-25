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

export default function CreateExam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for dynamic exam sections
  const [examSections, setExamSections] = useState<ExamSection[]>([
    {
      id: "section-1",
      type: "từ vựng",
      timeLimit: 10,
      questions: []
    }
  ]);
  
  const [isQuestionSelectOpen, setIsQuestionSelectOpen] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string>("");
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      description: "",
      isDemo: false,
    },
  });

  // Fetch questions from question bank
  const { data: availableQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  // Helper functions for managing dynamic sections
  const addExamSection = () => {
    const newSection: ExamSection = {
      id: `section-${Date.now()}`,
      type: "từ vựng",
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

  const getCurrentSection = () => {
    return examSections.find(section => section.id === currentSectionId);
  };

  // Filter available questions for current section
  const filteredQuestions = availableQuestions.filter(question => {
    const currentSection = getCurrentSection();
    if (!currentSection) return false;

    // Don't show questions already selected in current section
    if (currentSection.questions.find(sq => sq.id === question.id)) return false;
    
    // Apply search filter
    if (questionSearchQuery && !question.questionText.toLowerCase().includes(questionSearchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply category filter - only show questions matching the current section type
    if (question.category !== currentSection.type) {
      return false;
    }
    
    return true;
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      // Validate that each section has at least one question
      for (const section of examSections) {
        if (section.questions.length === 0) {
          throw new Error(`Phải chọn ít nhất một câu hỏi cho phần ${questionCategories.find(c => c.value === section.type)?.label}`);
        }
      }

      // Create the exam with dynamic sections
      // Convert to the fixed 4-section format for backend compatibility
      const examData: any = {
        ...data,
        vocabularyTimeLimit: 10,
        vocabularyQuestions: [],
        grammarTimeLimit: 10,
        grammarQuestions: [],
        listeningTimeLimit: 5,
        listeningQuestions: [],
        readingTimeLimit: 5,
        readingQuestions: [],
      };

      // Map dynamic sections to fixed sections
      examSections.forEach(section => {
        switch (section.type) {
          case "từ vựng":
            examData.vocabularyTimeLimit = section.timeLimit;
            examData.vocabularyQuestions = section.questions.map(q => q.id);
            break;
          case "ngữ pháp":
            examData.grammarTimeLimit = section.timeLimit;
            examData.grammarQuestions = section.questions.map(q => q.id);
            break;
          case "nghe hiểu":
            examData.listeningTimeLimit = section.timeLimit;
            examData.listeningQuestions = section.questions.map(q => q.id);
            break;
          case "đọc hiểu":
            examData.readingTimeLimit = section.timeLimit;
            examData.readingQuestions = section.questions.map(q => q.id);
            break;
        }
      });
      
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

  // Question selection functions
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

  const openQuestionSelect = (sectionId: string) => {
    setCurrentSectionId(sectionId);
    setIsQuestionSelectOpen(true);
    setQuestionSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/cpanel?tab=exams")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Tạo bài thi mới</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* PHẦN 1: THÔNG TIN BÀI THI */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Phần 1: Thông tin bài thi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiêu đề bài thi</FormLabel>
                      <FormControl>
                        <Input placeholder="Nhập tiêu đề bài thi" {...field} />
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
                          className="min-h-[100px]"
                          {...field}
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
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Bài thi demo (không cần đăng nhập)
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* PHẦN 2: PHẦN BÀI THI */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Phần 2: Phần bài thi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {examSections.map((section, index) => (
                  <div key={section.id} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Phần thi {index + 1}</h3>
                      {examSections.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeExamSection(section.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Phần thi dropdown */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Phần thi
                        </label>
                        <Select
                          value={section.type}
                          onValueChange={(value: ExamSection['type']) => 
                            updateSectionType(section.id, value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn phần thi" />
                          </SelectTrigger>
                          <SelectContent>
                            {questionCategories.map((category) => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Thời gian thi */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Thời gian thi (phút)
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={section.timeLimit}
                          onChange={(e) => updateSectionTimeLimit(section.id, parseInt(e.target.value) || 1)}
                        />
                      </div>

                      {/* Nút chọn câu hỏi */}
                      <div className="flex items-end">
                        <Button
                          type="button"
                          onClick={() => openQuestionSelect(section.id)}
                          variant="outline"
                          className="w-full"
                        >
                          <Search className="w-4 h-4 mr-2" />
                          Chọn câu hỏi ({section.questions.length})
                        </Button>
                      </div>
                    </div>

                    {/* Hiển thị câu hỏi đã chọn */}
                    {section.questions.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">
                          Câu hỏi đã chọn ({section.questions.length}):
                        </h4>
                        <div className="space-y-2">
                          {section.questions.map((question) => (
                            <div key={question.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm truncate flex-1 mr-2">
                                {question.questionText}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeQuestionFromSection(section.id, question.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Nút thêm phần thi */}
                <Button
                  type="button"
                  onClick={addExamSection}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm phần thi
                </Button>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={createExamMutation.isPending}
              >
                {createExamMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Tạo bài thi
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Question Selection Dialog */}
        <Dialog open={isQuestionSelectOpen} onOpenChange={setIsQuestionSelectOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                Chọn câu hỏi - {questionCategories.find(c => c.value === getCurrentSection()?.type)?.label}
              </DialogTitle>
              <DialogDescription>
                Chọn các câu hỏi cho phần thi này
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Tìm kiếm câu hỏi..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Question List */}
              <div className="max-h-96 overflow-y-auto">
                {questionsLoading ? (
                  <div className="text-center py-4">Đang tải câu hỏi...</div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    Không tìm thấy câu hỏi phù hợp
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Câu hỏi</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead>Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuestions.map((question) => (
                        <TableRow key={question.id}>
                          <TableCell className="max-w-md">
                            <div className="space-y-1">
                              <p className="font-medium truncate">{question.questionText}</p>
                              {question.description && (
                                <p className="text-sm text-gray-500 truncate">{question.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {questionCategories.find(c => c.value === question.category)?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => {
                                addQuestionToSection(currentSectionId, question);
                              }}
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
            </div>

            <DialogFooter>
              <Button onClick={() => setIsQuestionSelectOpen(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}