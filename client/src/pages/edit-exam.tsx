import { useState, useEffect, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import { Plus, Save, ArrowLeft, Trash2, Search, HelpCircle, Volume2, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MultipleImagePreviewBox } from "@/components/MultipleImagePreviewBox";
import { AudioUploader } from "@/components/AudioUploader";
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
  content?: string;
  descriptionImageUrls?: string[];
  descriptionAudioUrl?: string;
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
  
  // State for question selection dialog
  const [isQuestionSelectOpen, setIsQuestionSelectOpen] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string>("");
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  
  // Refs for handling file uploads
  const sectionImageInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const sectionAudioInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

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
      
      // Check if exam has new sections format
      if (exam.sections && Array.isArray(exam.sections) && exam.sections.length > 0) {
        // Load from new sections format
        exam.sections.forEach((section: any) => {
          const sectionQuestions = (section.questionIds || [])
            .map((id: string) => availableQuestions.find((q: Question) => q.id === id))
            .filter(Boolean) as Question[];
            
          sections.push({
            id: section.id || `section-${Date.now()}-${Math.random()}`,
            type: section.type,
            timeLimit: section.timeLimit || 10,
            content: section.content || "",
            descriptionImageUrls: section.descriptionImageUrls || [],
            descriptionAudioUrl: section.descriptionAudioUrl || "",
            questions: sectionQuestions
          });
        });
      } else {
        // Legacy: Add sections based on existing question arrays for backward compatibility
        if (exam.vocabularyQuestions && Array.isArray(exam.vocabularyQuestions) && exam.vocabularyQuestions.length > 0) {
          const vocabularyQs = exam.vocabularyQuestions
            .map((id: string) => availableQuestions.find((q: Question) => q.id === id))
            .filter(Boolean) as Question[];
            
          sections.push({
            id: "vocab-section",
            type: "từ vựng",
            timeLimit: exam.vocabularyTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: "",
            questions: vocabularyQs
          });
        }

        if (exam.grammarQuestions && Array.isArray(exam.grammarQuestions) && exam.grammarQuestions.length > 0) {
          const grammarQs = exam.grammarQuestions
            .map((id: string) => availableQuestions.find((q: Question) => q.id === id))
            .filter(Boolean) as Question[];
            
          sections.push({
            id: "grammar-section",
            type: "ngữ pháp",
            timeLimit: exam.grammarTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: "",
            questions: grammarQs
          });
        }

        if (exam.listeningQuestions && Array.isArray(exam.listeningQuestions) && exam.listeningQuestions.length > 0) {
          const listeningQs = exam.listeningQuestions
            .map((id: string) => availableQuestions.find((q: Question) => q.id === id))
            .filter(Boolean) as Question[];
            
          sections.push({
            id: "listening-section",
            type: "nghe hiểu",
            timeLimit: exam.listeningTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: "",
            questions: listeningQs
          });
        }

        if (exam.readingQuestions && Array.isArray(exam.readingQuestions) && exam.readingQuestions.length > 0) {
          const readingQs = exam.readingQuestions
            .map((id: string) => availableQuestions.find((q: Question) => q.id === id))
            .filter(Boolean) as Question[];
            
          sections.push({
            id: "reading-section",
            type: "đọc hiểu",
            timeLimit: exam.readingTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: "",
            questions: readingQs
          });
        }
      }

      // If no sections found, create a default section
      if (sections.length === 0) {
        sections.push({
          id: "section-1",
          type: "từ vựng",
          timeLimit: 10,
          content: "",
          descriptionImageUrls: [],
          descriptionAudioUrl: "",
          questions: []
        });
      }

      setExamSections(sections);
    }
  }, [exam, availableQuestions, form]);

  // Helper functions for managing dynamic sections
  const addExamSection = () => {
    const newSection: ExamSection = {
      id: `section-${Date.now()}`,
      type: "từ vựng",
      timeLimit: 10,
      content: "",
      descriptionImageUrls: [],
      descriptionAudioUrl: "",
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
        ? { ...section, type }
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

  const updateSectionContent = (sectionId: string, content: string) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, content }
        : section
    ));
  };

  const updateSectionDescriptionImages = (sectionId: string, imageUrls: string[]) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, descriptionImageUrls: imageUrls }
        : section
    ));
  };

  const updateSectionDescriptionAudio = (sectionId: string, audioUrl: string) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, descriptionAudioUrl: audioUrl }
        : section
    ));
  };

  // Question management functions
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

  // File upload handlers
  const handleSectionImageUpload = async (sectionId: string, files: FileList) => {
    const file = files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/temp-description-images/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      const currentUrls = examSections.find(s => s.id === sectionId)?.descriptionImageUrls || [];
      const newUrls = [...currentUrls, data.url];
      updateSectionDescriptionImages(sectionId, newUrls);
      
      toast({
        title: "Thành công",
        description: "Đã tải lên hình ảnh",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải lên hình ảnh",
        variant: "destructive",
      });
    }
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

      // Prepare exam data with new sections format
      const examData = {
        ...data,
        timeLimit: totalTimeLimit,
        sections: examSections.map(section => ({
          id: section.id,
          type: section.type,
          timeLimit: section.timeLimit,
          content: section.content || "",
          descriptionImageUrls: section.descriptionImageUrls || [],
          descriptionAudioUrl: section.descriptionAudioUrl || "",
          questionIds: section.questions.map(q => q.id)
        }))
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

  if (examLoading) {
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

                  {/* Save Button */}
                  <Button 
                    type="submit" 
                    className="w-full mt-6"
                    disabled={updateExamMutation.isPending}
                    data-testid="button-save"
                  >
                    {updateExamMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Lưu thay đổi
                  </Button>

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
                  <div key={section.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-6">
                      <h4 className="font-medium text-gray-900 text-lg">Phần thi {index + 1}</h4>
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

                    {/* Section Content */}
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor={`content-${section.id}`} className="text-sm font-medium text-gray-700">
                          Nội dung phần thi
                        </Label>
                        <Textarea
                          id={`content-${section.id}`}
                          placeholder="Nhập nội dung, hướng dẫn hoặc mô tả cho phần thi này..."
                          value={section.content || ""}
                          onChange={(e) => updateSectionContent(section.id, e.target.value)}
                          rows={4}
                          className="mt-2"
                          data-testid={`textarea-content-${section.id}`}
                        />
                      </div>

                      {/* Description Images */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700">
                          Hình ảnh mô tả (tối đa 5 ảnh)
                        </Label>
                        <div className="mt-2">
                          <MultipleImagePreviewBox
                            imageUrls={section.descriptionImageUrls || []}
                            onRemove={(imageIndex) => {
                              const currentUrls = section.descriptionImageUrls || [];
                              const newUrls = currentUrls.filter((_, i) => i !== imageIndex);
                              updateSectionDescriptionImages(section.id, newUrls);
                            }}
                            onChooseImage={() => {
                              const inputRef = sectionImageInputRefs.current.get(section.id);
                              inputRef?.click();
                            }}
                            title="Hình ảnh mô tả phần thi"
                            maxImages={5}
                          />
                          
                          {/* Hidden file input for section description image */}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            ref={(el) => sectionImageInputRefs.current.set(section.id, el)}
                            onChange={(e) => {
                              if (e.target.files) {
                                handleSectionImageUpload(section.id, e.target.files);
                              }
                            }}
                            data-testid={`input-section-images-${section.id}`}
                          />
                        </div>
                      </div>

                      {/* Description Audio */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700">
                          Audio mô tả
                        </Label>
                        <div className="mt-2">
                          <AudioUploader
                            currentAudioUrl={section.descriptionAudioUrl || ""}
                            onAudioUpload={(audioUrl: string) => updateSectionDescriptionAudio(section.id, audioUrl)}
                            onRemoveAudio={() => updateSectionDescriptionAudio(section.id, "")}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">
                            Loại phần thi
                          </Label>
                          <Select 
                            value={section.type} 
                            onValueChange={(value) => updateSectionType(section.id, value as ExamSection['type'])}
                          >
                            <SelectTrigger className="mt-2" data-testid={`select-section-type-${section.id}`}>
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
                          <Label className="text-sm font-medium text-gray-700">
                            Thời gian thi (phút)
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            value={section.timeLimit}
                            onChange={(e) => updateSectionTimeLimit(section.id, parseInt(e.target.value) || 1)}
                            className="mt-2"
                            data-testid={`input-time-limit-${section.id}`}
                          />
                        </div>
                      </div>

                      {/* Question Management */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <Label className="text-sm font-medium text-gray-700">
                            Câu hỏi ({section.questions.length})
                          </Label>
                          <Button
                            onClick={() => openQuestionSelector(section.id)}
                            variant="outline"
                            size="sm"
                            disabled={questionsLoading}
                            data-testid={`button-add-questions-${section.id}`}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Thêm câu hỏi
                          </Button>
                        </div>

                        {/* Questions List */}
                        <div className="space-y-3">
                          {section.questions.length === 0 ? (
                            <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded-lg text-center">
                              Chưa có câu hỏi nào. Nhấn "Thêm câu hỏi" để chọn từ ngân hàng câu hỏi.
                            </div>
                          ) : (
                            section.questions.map((question) => (
                              <div
                                key={question.id}
                                className="p-4 border border-gray-200 rounded-lg"
                                data-testid={`question-${question.id}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      {getCategoryBadge(question.category)}
                                      <Badge variant="outline">{question.language}</Badge>
                                    </div>
                                    
                                    <p className="text-sm text-gray-800 mb-2">{question.questionText}</p>
                                    
                                    {/* Question Image Preview */}
                                    {question.imageUrl && (
                                      <div className="mb-2">
                                        <img 
                                          src={question.imageUrl} 
                                          alt="Question image"
                                          className="h-20 w-auto object-cover rounded border"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                          }}
                                        />
                                      </div>
                                    )}

                                    {/* Answer Options */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {[question.optionA, question.optionB, question.optionC, question.optionD]
                                        .filter(Boolean)
                                        .map((option, index) => (
                                          <div key={index} className={`p-2 rounded ${
                                            String.fromCharCode(65 + index) === question.correctAnswer 
                                              ? 'bg-green-50 text-green-800 border border-green-200' 
                                              : 'bg-gray-50 text-gray-600'
                                          }`}>
                                            <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
                                          </div>
                                        ))}
                                    </div>
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
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Question Selection Dialog */}
      <Dialog open={isQuestionSelectOpen} onOpenChange={setIsQuestionSelectOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chọn câu hỏi từ ngân hàng</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Tìm kiếm</Label>
                <Input
                  placeholder="Tìm kiếm câu hỏi..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  data-testid="input-search-questions"
                />
              </div>
              
              <div>
                <Label>Ngôn ngữ</Label>
                <Select value={selectedLanguageFilter || "all"} onValueChange={setSelectedLanguageFilter}>
                  <SelectTrigger data-testid="select-language-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả ngôn ngữ</SelectItem>
                    <SelectItem value="vi">Tiếng Việt</SelectItem>
                    <SelectItem value="ja">Tiếng Nhật</SelectItem>
                    <SelectItem value="en">Tiếng Anh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Danh mục</Label>
                <Select value={selectedCategoryFilter || "all"} onValueChange={setSelectedCategoryFilter}>
                  <SelectTrigger data-testid="select-category-filter">
                    <SelectValue />
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
              <div className="p-4 border-b bg-gray-50">
                <h4 className="font-medium">
                  Câu hỏi có sẵn ({getFilteredQuestionsForSection().length})
                </h4>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {questionsLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Đang tải câu hỏi...</p>
                  </div>
                ) : getFilteredQuestionsForSection().length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>Không có câu hỏi phù hợp với bộ lọc hiện tại.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {getFilteredQuestionsForSection().map((question) => (
                      <div
                        key={question.id}
                        className="p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          if (currentSectionId) {
                            addQuestionToSection(currentSectionId, question);
                            // Don't close dialog immediately - let user add multiple questions
                          }
                        }}
                        data-testid={`selectable-question-${question.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getCategoryBadge(question.category)}
                              <Badge variant="outline">{question.language}</Badge>
                            </div>
                            
                            <p className="text-sm text-gray-800 mb-2">{question.questionText}</p>
                            
                            {/* Question Image Preview */}
                            {question.imageUrl && (
                              <div className="mb-2">
                                <img 
                                  src={question.imageUrl} 
                                  alt="Question image"
                                  className="h-16 w-auto object-cover rounded border"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}

                            {/* Answer Options */}
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {[question.optionA, question.optionB, question.optionC, question.optionD]
                                .filter(Boolean)
                                .map((option, index) => (
                                  <div key={index} className={`p-1 rounded ${
                                    String.fromCharCode(65 + index) === question.correctAnswer 
                                      ? 'bg-green-50 text-green-800' 
                                      : 'bg-gray-50 text-gray-600'
                                  }`}>
                                    <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
                                  </div>
                                ))}
                            </div>
                          </div>
                          
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentSectionId) {
                                addQuestionToSection(currentSectionId, question);
                              }
                            }}
                            variant="outline"
                            size="sm"
                            className="ml-2"
                            data-testid={`button-add-question-${question.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsQuestionSelectOpen(false)}
              data-testid="button-close-dialog"
            >
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}