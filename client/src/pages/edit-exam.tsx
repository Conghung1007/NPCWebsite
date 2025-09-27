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
import { Label } from "@/components/ui/label";
import { Plus, Save, ArrowLeft, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MultipleImagePreviewBox } from "@/components/MultipleImagePreviewBox";
import { AudioUploader } from "@/components/AudioUploader";
import type { Exam } from "@shared/schema";

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

  // Load existing exam data into sections
  useEffect(() => {
    if (exam) {
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
          sections.push({
            id: section.id || `section-${Date.now()}-${Math.random()}`,
            type: section.type,
            timeLimit: section.timeLimit || 10,
            content: section.content || "",
            descriptionImageUrls: section.descriptionImageUrls || [],
            descriptionAudioUrl: section.descriptionAudioUrl || ""
          });
        });
      } else {
        // Legacy: Add sections based on existing question arrays for backward compatibility
        if (exam.vocabularyQuestions && Array.isArray(exam.vocabularyQuestions) && exam.vocabularyQuestions.length > 0) {
          sections.push({
            id: "vocab-section",
            type: "từ vựng",
            timeLimit: exam.vocabularyTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: ""
          });
        }

        if (exam.grammarQuestions && Array.isArray(exam.grammarQuestions) && exam.grammarQuestions.length > 0) {
          sections.push({
            id: "grammar-section",
            type: "ngữ pháp",
            timeLimit: exam.grammarTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: ""
          });
        }

        if (exam.listeningQuestions && Array.isArray(exam.listeningQuestions) && exam.listeningQuestions.length > 0) {
          sections.push({
            id: "listening-section",
            type: "nghe hiểu",
            timeLimit: exam.listeningTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: ""
          });
        }

        if (exam.readingQuestions && Array.isArray(exam.readingQuestions) && exam.readingQuestions.length > 0) {
          sections.push({
            id: "reading-section",
            type: "đọc hiểu",
            timeLimit: exam.readingTimeLimit || 10,
            content: "",
            descriptionImageUrls: [],
            descriptionAudioUrl: ""
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
          descriptionAudioUrl: ""
        });
      }

      setExamSections(sections);
    }
  }, [exam, form]);

  // Helper functions for managing dynamic sections
  const addExamSection = () => {
    const newSection: ExamSection = {
      id: `section-${Date.now()}`,
      type: "từ vựng",
      timeLimit: 10,
      content: "",
      descriptionImageUrls: [],
      descriptionAudioUrl: ""
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

  // Calculate total time
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
          descriptionAudioUrl: section.descriptionAudioUrl || ""
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
                            audioUrl={section.descriptionAudioUrl || ""}
                            onAudioChange={(audioUrl) => updateSectionDescriptionAudio(section.id, audioUrl)}
                            uploadEndpoint="/api/temp-description-audio/upload"
                            data-testid={`audio-${section.id}`}
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
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}