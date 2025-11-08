import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
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
import { Plus, Save, ArrowLeft, Search, Trash2, HelpCircle, Volume2, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MultipleImagePreviewBox } from "@/components/MultipleImagePreviewBox";
import { AudioUploader } from "@/components/AudioUploader";
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
  sectionName: string;
  timeLimit: number;
  passingScore?: number;
  content?: string;
  descriptionImageUrls?: string[];
  descriptionAudioUrl?: string;
  questions: Question[];
}

// Form validation schema for exam information
const examSchema = z.object({
  title: z.string().min(1, "Tiêu đề bài thi là bắt buộc"),
  description: z.string().optional(),
  passingScore: z.number().min(0, "Số điểm đạt phải lớn hơn hoặc bằng 0").optional(),
  isDemo: z.boolean().default(false),
});

type ExamFormData = z.infer<typeof examSchema>;

export default function CreateExam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, hasImageEditPermission } = useAuth();

  // State for dynamic exam sections
  const [examSections, setExamSections] = useState<ExamSection[]>([
    {
      id: "section-1",
      sectionName: "",
      timeLimit: 10,
      content: "",
      descriptionImageUrls: [],
      descriptionAudioUrl: "",
      questions: []
    }
  ]);
  
  const [isQuestionSelectOpen, setIsQuestionSelectOpen] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string>("");
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  
  // File input refs for section uploads
  const sectionImageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const sectionAudioInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      description: "",
      passingScore: undefined,
      isDemo: false,
    },
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

  // Helper functions for managing dynamic sections
  const addExamSection = () => {
    // Add new section with empty name
    const newSection: ExamSection = {
      id: `section-${Date.now()}`,
      sectionName: "",
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

  const updateSectionName = (sectionId: string, sectionName: string) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, sectionName }
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

  const updateSectionPassingScore = (sectionId: string, passingScore: number | undefined) => {
    setExamSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, passingScore }
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

  // Handle section description image upload
  const handleSectionDescriptionImageUpload = async (file: File, sectionId: string) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: "Vui lòng chọn file hình ảnh hợp lệ."
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: "Kích thước file phải nhỏ hơn 5MB."
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/temp-description-images/upload?context=exam', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add to current section's description image URLs
      const currentSection = examSections.find(s => s.id === sectionId);
      const currentUrls = currentSection?.descriptionImageUrls || [];
      updateSectionDescriptionImages(sectionId, [...currentUrls, data.url]);

      toast({
        title: "Thành công",
        description: "Hình ảnh mô tả đã được tải lên thành công.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: error.message || "Không thể tải lên hình ảnh."
      });
    }
  };

  const getCurrentSection = () => {
    return examSections.find(section => section.id === currentSectionId);
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

  // Filter and sort available questions for current section
  const filteredQuestions = availableQuestions.filter(question => {
    const currentSection = getCurrentSection();
    if (!currentSection) return false;

    // Don't show questions already selected in current section
    if (currentSection.questions.find(sq => sq.id === question.id)) return false;
    
    // Apply search filter (search in both question text and description)
    if (questionSearchQuery) {
      const searchLower = questionSearchQuery.toLowerCase();
      const questionTextMatch = question.questionText.toLowerCase().includes(searchLower);
      const descriptionMatch = question.description && question.description.toLowerCase().includes(searchLower);
      
      if (!questionTextMatch && !descriptionMatch) {
        return false;
      }
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
  }).sort((a, b) => {
    // Sort by creation time, newest first
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      // Validate that we have at least one section
      if (examSections.length === 0) {
        throw new Error('Bài thi phải có ít nhất một phần thi.');
      }

      // Validate that each section has at least one question
      for (let i = 0; i < examSections.length; i++) {
        const section = examSections[i];
        if (section.questions.length === 0) {
          throw new Error(`Phải chọn ít nhất một câu hỏi cho phần thi ${i + 1}`);
        }
      }

      // Create the exam with flexible sections format
      const examData: any = {
        ...data,
        sections: examSections.map(section => ({
          id: section.id,
          sectionName: section.sectionName,
          timeLimit: section.timeLimit,
          passingScore: section.passingScore,
          content: section.content || "",
          descriptionImageUrls: section.descriptionImageUrls || [],
          descriptionAudioUrl: section.descriptionAudioUrl || "",
          questionIds: section.questions.map(q => q.id)
        }))
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
    setSelectedLanguageFilter("all");
    setSelectedCategoryFilter("all");
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <FormField
                    control={form.control}
                    name="passingScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số điểm đạt (tùy chọn)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Nhập số câu đúng tối thiểu để đạt"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
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
                </div>
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

                    {/* Section Name */}
                    <div className="mb-6">
                      <Label className="block text-sm font-medium mb-2">Tên phần thi</Label>
                      <Input
                        placeholder="Nhập tên phần thi (ví dụ: Từ vựng, Ngữ pháp, Đọc hiểu...)"
                        value={section.sectionName}
                        onChange={(e) => updateSectionName(section.id, e.target.value)}
                      />
                    </div>

                    {/* Section Content */}
                    <div className="mb-6">
                      <Label className="block text-sm font-medium mb-2">Nội dung phần thi (tùy chọn)</Label>
                      <Textarea
                        placeholder="Nhập nội dung, hướng dẫn hoặc mô tả cho phần thi này..."
                        className="min-h-[100px]"
                        value={section.content || ""}
                        onChange={(e) => updateSectionContent(section.id, e.target.value)}
                      />
                    </div>

                    {/* Section Description Images */}
                    <div className="mb-6">
                      <Label className="block text-sm font-medium mb-2">Hình ảnh mô tả (tùy chọn)</Label>
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
                        ref={(el) => {
                          if (el) {
                            sectionImageInputRefs.current.set(section.id, el);
                          }
                        }}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleSectionDescriptionImageUpload(file, section.id);
                          }
                        }}
                      />
                    </div>

                    {/* Section Description Audio */}
                    <div className="mb-6">
                      <Label className="block text-sm font-medium mb-2">Audio mô tả (tùy chọn)</Label>
                      <AudioUploader
                        currentAudioUrl={section.descriptionAudioUrl || ""}
                        onAudioUpload={(audioUrl) => updateSectionDescriptionAudio(section.id, audioUrl)}
                        onRemoveAudio={() => updateSectionDescriptionAudio(section.id, "")}
                        context="exam"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                      {/* Số điểm đạt */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Số điểm đạt (tùy chọn)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Số câu đúng tối thiểu"
                          value={section.passingScore ?? ""}
                          onChange={(e) => updateSectionPassingScore(section.id, e.target.value ? parseInt(e.target.value) : undefined)}
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
                  Thêm phần thi ({examSections.length})
                </Button>
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setLocation("/cpanel?tab=exams")}
                data-testid="button-cancel"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={createExamMutation.isPending}
                data-testid="button-create"
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
          <DialogContent className="w-[95vw] max-w-[1000px] max-h-[85vh] flex flex-col gap-0 p-0 top-[55%]">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>
                Chọn câu hỏi
              </DialogTitle>
              <DialogDescription>
                Chọn các câu hỏi cho phần thi này
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
              
              {/* Filter Dropdowns */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lọc theo phần thi</label>
                  <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                    <SelectTrigger data-testid="select-category-filter">
                      <SelectValue placeholder="Tất cả phần thi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="ngữ pháp">Ngữ pháp</SelectItem>
                      <SelectItem value="đọc hiểu">Đọc hiểu</SelectItem>
                      <SelectItem value="từ vựng">Từ vựng</SelectItem>
                      <SelectItem value="nghe hiểu">Nghe hiểu</SelectItem>
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

              {/* Question List */}
              <div className="overflow-x-hidden">
                {questionsLoading ? (
                  <div className="text-center py-4">Đang tải câu hỏi...</div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    Không tìm thấy câu hỏi phù hợp
                  </div>
                ) : (
                  <div className="w-full">
                    <Table className="table-fixed w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[25%]">Mô tả</TableHead>
                          <TableHead className="w-[35%]">Câu hỏi</TableHead>
                          <TableHead className="w-[15%]">Phần thi</TableHead>
                          <TableHead className="w-[13%]">Ngôn ngữ</TableHead>
                          <TableHead className="w-[12%]">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQuestions.map((question) => (
                          <TableRow key={question.id}>
                            <TableCell className="truncate">
                              <p className="text-sm text-gray-500 truncate">{question.description || "Không có"}</p>
                            </TableCell>
                            <TableCell className="truncate">
                              <p className="font-medium truncate">{question.questionText}</p>
                            </TableCell>
                            <TableCell className="truncate">
                              <Badge variant="outline" className="truncate max-w-full">
                                {question.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="truncate">
                              <Badge variant="outline" className="truncate max-w-full">
                                {question.language === "japanese" && "Tiếng Nhật"}
                                {question.language === "english" && "Tiếng Anh"}
                                {question.language === "german" && "Tiếng Đức"}
                                {!["japanese", "english", "german"].includes(question.language) && question.language}
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
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t">
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