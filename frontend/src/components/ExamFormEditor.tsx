import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Save, ArrowLeft, Search, Trash2, Volume2, X, ImageIcon, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { ExamQuestionPickerList } from "@/components/ExamQuestionPickerList";
import {
  cleanupTempMediaUrl,
  cleanupTempMediaUrls,
  isTempMediaUrl,
} from "@/lib/tempMediaCleanup";
import type { Question } from "@shared/schema";
import {
  createQuestionSetActions,
  validateExamSectionsClient,
  newExamEntityId,
  isMissingQuestion,
  type ExamSection,
} from "@/lib/examQuestionSets";

export const examFormSchema = z.object({
  title: z.string().min(1, "Tiêu đề bài thi là bắt buộc"),
  description: z.string().optional(),
  passingScore: z.number().min(0, "Ngưỡng đạt phải lớn hơn hoặc bằng 0"),
  isDemo: z.boolean().default(false),
});

export type ExamFormData = z.infer<typeof examFormSchema>;

export type ExamFormEditorProps = {
  pageTitle: string;
  submitLabel: string;
  submittingLabel: string;
  isPending: boolean;
  onSubmitExam: (data: ExamFormData, sections: ExamSection[]) => void | Promise<void>;
  initialFormValues?: ExamFormData;
  initialSections?: ExamSection[];
  formResetKey?: string;
  missingQuestionIds?: string[];
  readyToSubmit?: boolean;
};

const emptySection = (): ExamSection => ({
  id: newExamEntityId("section"),
  sectionName: "",
  timeLimit: 10,
  content: "",
  descriptionImageUrls: [],
  descriptionAudioUrl: "",
  questionSets: [{ id: newExamEntityId("qs"), name: "", questions: [] }],
});

export function ExamFormEditor({
  pageTitle,
  submitLabel,
  submittingLabel,
  isPending,
  onSubmitExam,
  initialFormValues,
  initialSections,
  formResetKey,
  missingQuestionIds = [],
  readyToSubmit = true,
}: ExamFormEditorProps) {
  const { toast } = useToast();
  const { user, hasImageEditPermission } = useAuth();

  // State for dynamic exam sections
  const [examSections, setExamSectionsState] = useState<ExamSection[]>(
    initialSections?.length ? initialSections : [emptySection()],
  );
  const [sectionsDirty, setSectionsDirty] = useState(false);
  const setExamSections: typeof setExamSectionsState = (value) => {
    setSectionsDirty(true);
    setExamSectionsState(value);
  };
  
  // Unified dialog state to prevent async state issues
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    sectionId: string;
    questionSetId: string;
  }>({ isOpen: false, sectionId: "", questionSetId: "" });
  
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  
  // File input refs for section uploads
  const sectionImageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const audioXhrRefs = useRef<Map<string, XMLHttpRequest>>(new Map());

  // Audio upload state per section
  const [audioUploadState, setAudioUploadState] = useState<{[key: string]: {
    isUploading: boolean;
    progress: number;
    uploadedBytes: number;
    totalBytes: number;
    fileName: string;
  }}>({});

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examFormSchema),
    defaultValues: initialFormValues ?? {
      title: "",
      description: "",
      passingScore: 0,
      isDemo: false,
    },
  });

  const hydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!formResetKey) return;
    if (hydratedKeyRef.current === formResetKey) return;
    if (!initialSections?.length && !initialFormValues) return;
    hydratedKeyRef.current = formResetKey;
    if (initialFormValues) form.reset(initialFormValues);
    if (initialSections?.length) {
      setExamSectionsState(initialSections);
      setSectionsDirty(false);
    }
  }, [formResetKey, initialFormValues, initialSections, form]);

  // Calculate max section passing score for validation
  const maxSectionPassingScore = Math.max(
    ...examSections.map(section => section.passingScore ?? 0),
    0
  );

  // Fetch questions from question bank - only when authenticated
  const { data: availableQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    enabled: !!user && hasImageEditPermission,
  });

  // Helper functions for managing dynamic sections
  const addExamSection = () => {
    setExamSections((prev) => [...prev, emptySection()]);
  };

  const moveExamSection = (sectionId: string, direction: "up" | "down") => {
    setExamSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const totalTimeLimit = examSections.reduce((sum, s) => sum + (s.timeLimit || 0), 0);
  const totalQuestions = examSections.reduce(
    (sum, s) => sum + s.questionSets.reduce((n, qs) => n + qs.questions.length, 0),
    0,
  );

  const collectSectionTempUrls = (sections: ExamSection[]): string[] => {
    const urls: string[] = [];
    for (const section of sections) {
      (section.descriptionImageUrls || []).forEach((u) => {
        if (isTempMediaUrl(u)) urls.push(u);
      });
      if (section.descriptionAudioUrl && isTempMediaUrl(section.descriptionAudioUrl)) {
        urls.push(section.descriptionAudioUrl);
      }
    }
    return urls;
  };

  const leaveExamForm = () => {
    void cleanupTempMediaUrls(collectSectionTempUrls(examSections), "exam");
    window.history.back();
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
    const removed = examSections.find((s) => s.id === sectionId);
    if (removed) {
      void cleanupTempMediaUrls(collectSectionTempUrls([removed]), "exam");
    }
    setExamSections((prev) => prev.filter((section) => section.id !== sectionId));
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
    setExamSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const removed = (section.descriptionImageUrls || []).filter(
          (url) => !imageUrls.includes(url),
        );
        void cleanupTempMediaUrls(removed, "exam");
        return { ...section, descriptionImageUrls: imageUrls };
      }),
    );
  };

  const updateSectionDescriptionAudio = (sectionId: string, audioUrl: string) => {
    setExamSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        if (
          section.descriptionAudioUrl &&
          section.descriptionAudioUrl !== audioUrl
        ) {
          cleanupTempMediaUrl(section.descriptionAudioUrl, "exam");
        }
        return { ...section, descriptionAudioUrl: audioUrl };
      }),
    );
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
      const uploadedUrl = data.imageUrl || data.url;
      if (!uploadedUrl) {
        throw new Error("Server không trả về URL hình ảnh");
      }

      setExamSections((prev) =>
        prev.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                descriptionImageUrls: [
                  ...(section.descriptionImageUrls || []),
                  uploadedUrl,
                ],
              }
            : section,
        ),
      );

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
    return examSections.find(section => section.id === dialogState.sectionId);
  };

  // Initialize question set actions using the factory
  const questionSetActions = createQuestionSetActions(setExamSections, toast);

  // Filter and sort available questions for current section
  const filteredQuestions = availableQuestions.filter(question => {
    const currentSection = getCurrentSection();
    if (!currentSection) return false;

    // Don't show questions already selected in ANY question set in current section
    const isAlreadySelected = currentSection.questionSets.some(qs =>
      qs.questions.find(sq => sq.id === question.id)
    );
    if (isAlreadySelected) return false;
    
    // Apply search filter (search in question title, text, and description)
    if (questionSearchQuery) {
      const searchLower = questionSearchQuery.toLowerCase();
      const questionTitleMatch = question.questionTitle && question.questionTitle.toLowerCase().includes(searchLower);
      const questionTextMatch = question.questionText.toLowerCase().includes(searchLower);
      const descriptionMatch = question.description && question.description.toLowerCase().includes(searchLower);
      
      if (!questionTitleMatch && !questionTextMatch && !descriptionMatch) {
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

  useUnsavedChangesWarning(
    (sectionsDirty || form.formState.isDirty) && !isPending,
  );

  const onSubmit = async (data: ExamFormData) => {
    if (!readyToSubmit) {
      toast({
        title: "Đang tải",
        description: "Vui lòng đợi tải xong dữ liệu trước khi lưu.",
        variant: "destructive",
      });
      return;
    }
    const uploading = Object.values(audioUploadState).some((st) => st.isUploading);
    if (uploading) {
      toast({
        title: "Đang tải lên",
        description: "Vui lòng đợi upload audio hoàn tất trước khi lưu.",
        variant: "destructive",
      });
      return;
    }
    const sectionError = validateExamSectionsClient(examSections);
    if (sectionError) {
      toast({ title: "Lỗi", description: sectionError, variant: "destructive" });
      return;
    }
    const maxSectionScore = Math.max(...examSections.map((sec) => sec.passingScore ?? 0), 0);
    if (data.passingScore < maxSectionScore) {
      toast({
        title: "Lỗi",
        description: `Ngưỡng đạt của bài thi (${data.passingScore}) không được nhỏ hơn ngưỡng cao nhất của các phần thi (${maxSectionScore})`,
        variant: "destructive",
      });
      return;
    }
    try {
      await onSubmitExam(data, examSections);
      setSectionsDirty(false);
    } catch {
      // Parent mutation onError already surfaces the API message (e.g. promote failure)
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={leaveExamForm}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{pageTitle}</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {missingQuestionIds.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium mb-1">
                  {missingQuestionIds.length} câu hỏi không còn trong ngân hàng
                </p>
                <p className="text-amber-900/80">
                  Các câu này vẫn được giữ trong đề để tránh mất liên kết khi lưu.
                  Hãy thay bằng câu khác hoặc xóa khỏi phần thi nếu không cần.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground rounded-lg border border-border/70 bg-white px-4 py-3">
              <span>
                Tổng thời gian:{" "}
                <strong className="text-foreground">{totalTimeLimit} phút</strong>
              </span>
              <span>
                Tổng câu hỏi:{" "}
                <strong className="text-foreground">{totalQuestions}</strong>
              </span>
              <span>
                Số phần:{" "}
                <strong className="text-foreground">{examSections.length}</strong>
              </span>
            </div>

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
                        <FormLabel>Số câu đúng tối thiểu để đạt (bắt buộc)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={maxSectionPassingScore}
                            placeholder="Nhập số câu đúng tối thiểu"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          Theo số câu trả lời đúng (không phải tổng điểm từng câu). Tối thiểu:{" "}
                          {maxSectionPassingScore} (bằng ngưỡng cao nhất của các phần).
                        </p>
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
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <h3 className="text-lg font-medium">Phần thi {index + 1}</h3>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => moveExamSection(section.id, "up")}
                          aria-label="Đưa phần thi lên"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={index === examSections.length - 1}
                          onClick={() => moveExamSection(section.id, "down")}
                          aria-label="Đưa phần thi xuống"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
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
                    </div>

                    {/* Section Name */}
                    <div className="mb-6">
                      <Label className="block text-sm font-medium mb-2">
                        Tên phần thi <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="Nhập tên phần thi (ví dụ: Từ vựng, Ngữ pháp, Đọc hiểu...)"
                        value={section.sectionName}
                        onChange={(e) => updateSectionName(section.id, e.target.value)}
                        required
                      />
                      {!section.sectionName.trim() ? (
                        <p className="text-xs text-destructive mt-1">Bắt buộc nhập tên phần thi</p>
                      ) : null}                    </div>

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

                    {/* Section Description Media - Compact UI */}
                    <div className="mb-6">
                      {/* Compact buttons row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const inputRef = sectionImageInputRefs.current.get(section.id);
                            inputRef?.click();
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Thêm hình ảnh
                        </Button>
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const audioInput = document.getElementById(`section-audio-${section.id}`) as HTMLInputElement;
                            audioInput?.click();
                          }}
                          className="flex items-center gap-1.5"
                          disabled={audioUploadState[section.id]?.isUploading}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          {audioUploadState[section.id]?.isUploading ? "Đang tải..." : "Thêm audio (tối đa 50MB)"}
                        </Button>

                        {!audioUploadState[section.id]?.isUploading && (section.descriptionImageUrls || []).length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({(section.descriptionImageUrls || []).length} hình ảnh)
                          </span>
                        )}

                        {!audioUploadState[section.id]?.isUploading && section.descriptionAudioUrl && (
                          <span className="text-xs text-muted-foreground">
                            (có audio)
                          </span>
                        )}
                      </div>
                      
                      {/* Audio Upload Progress */}
                      {audioUploadState[section.id]?.isUploading && (
                        <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-blue-800 truncate max-w-[200px]">
                              {audioUploadState[section.id]?.fileName}
                            </span>
                            <span className="text-blue-600 font-medium">
                              {formatFileSize(audioUploadState[section.id]?.uploadedBytes || 0)} / {formatFileSize(audioUploadState[section.id]?.totalBytes || 0)}
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-3">
                            <div 
                              className="bg-blue-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center"
                              style={{ width: `${audioUploadState[section.id]?.progress || 0}%` }}
                            >
                              {(audioUploadState[section.id]?.progress || 0) > 15 && (
                                <span className="text-xs text-white font-medium">{audioUploadState[section.id]?.progress}%</span>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const xhr = audioXhrRefs.current.get(section.id);
                              if (xhr) {
                                xhr.abort();
                                audioXhrRefs.current.delete(section.id);
                              }
                            }}
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Hủy upload
                          </Button>
                        </div>
                      )}

                      {/* Hidden file inputs */}
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

                      <input
                        id={`section-audio-${section.id}`}
                        type="file"
                        accept="audio/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const maxSize = 50 * 1024 * 1024;
                          if (file.size > maxSize) {
                            toast({
                              variant: "destructive",
                              title: "File quá lớn",
                              description: `File audio không được vượt quá 50MB. File của bạn: ${formatFileSize(file.size)}`
                            });
                            e.target.value = '';
                            return;
                          }
                          
                          setAudioUploadState(prev => ({
                            ...prev,
                            [section.id]: {
                              isUploading: true,
                              progress: 0,
                              uploadedBytes: 0,
                              totalBytes: file.size,
                              fileName: file.name
                            }
                          }));
                          
                          // Use chunked upload to bypass proxy body size limits (413 error)
                          (async () => {

                            const CHUNK_SIZE = 512 * 1024; // 512KB per chunk
                            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                            let uploadId: string | null = null;
                            let aborted = false;

                            const abortController = new AbortController();
                            audioXhrRefs.current.set(section.id, { abort: () => { aborted = true; abortController.abort(); } } as any);

                            try {
                              // Step 1: Initialize chunked upload
                              const initResponse = await fetch('/api/audio/chunked-upload/init', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  totalChunks,
                                  contentType: file.type,
                                  target: 'sectionAudio',
                                  context: 'exam',
                                  totalSize: file.size
                                }),
                                signal: abortController.signal
                              });

                              if (!initResponse.ok) {
                                const error = await initResponse.json();
                                throw new Error(error.message || 'Failed to initialize upload');
                              }

                              const initData = await initResponse.json();
                              uploadId = initData.uploadId;

                              // Step 2: Upload chunks sequentially
                              for (let i = 0; i < totalChunks; i++) {
                                if (aborted) throw new Error('Upload cancelled');

                                const start = i * CHUNK_SIZE;
                                const end = Math.min(start + CHUNK_SIZE, file.size);
                                const chunk = file.slice(start, end);

                                const chunkResponse = await fetch(
                                  `/api/audio/chunked-upload/chunk?uploadId=${uploadId}&chunkIndex=${i}`,
                                  { method: 'POST', body: chunk, signal: abortController.signal }
                                );

                                if (!chunkResponse.ok) {
                                  const error = await chunkResponse.json();
                                  throw new Error(error.message || `Failed to upload chunk ${i}`);
                                }

                                const progress = Math.round(((i + 1) / totalChunks) * 100);
                                setAudioUploadState(prev => ({
                                  ...prev,
                                  [section.id]: { ...prev[section.id], progress, uploadedBytes: end, totalBytes: file.size }
                                }));
                              }

                              // Step 3: Complete upload
                              const completeResponse = await fetch('/api/audio/chunked-upload/complete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ uploadId }),
                                signal: abortController.signal
                              });

                              if (!completeResponse.ok) {
                                const error = await completeResponse.json();
                                throw new Error(error.message || 'Failed to complete upload');
                              }

                              const result = await completeResponse.json();
                              updateSectionDescriptionAudio(section.id, result.audioUrl);
                              toast({
                                title: "Thành công",
                                description: `Audio mô tả đã được tải lên (${formatFileSize(file.size)})`
                              });
                            } catch (uploadError: any) {
                              console.error('Chunked upload error:', uploadError);
                              if (uploadId && !aborted) {
                                try {
                                  await fetch('/api/audio/chunked-upload/abort', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ uploadId })
                                  });
                                } catch {}
                              }
                              if (uploadError.name === 'AbortError' || aborted) {
                                toast({ title: "Đã hủy", description: "Upload đã bị hủy" });
                              } else {
                                toast({
                                  variant: "destructive",
                                  title: "Lỗi",
                                  description: uploadError.message || "Không thể tải lên audio"
                                });
                              }
                            } finally {
                              setAudioUploadState(prev => {
                                const newState = { ...prev };
                                delete newState[section.id];
                                return newState;
                              });
                              audioXhrRefs.current.delete(section.id);
                              e.target.value = '';
                            }
                          })();
                        }}
                      />

                      {/* Media Preview (only when media exists) */}
                      {(((section.descriptionImageUrls || []).length > 0) || section.descriptionAudioUrl) && (
                        <div className="border rounded-lg p-3 space-y-3">
                          {(section.descriptionImageUrls || []).length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-2 block">Hình ảnh đã tải lên:</Label>
                              <div className="flex flex-wrap gap-2">
                                {(section.descriptionImageUrls || []).map((url, idx) => (
                                  <div key={idx} className="relative group">
                                    <img src={url} alt="" className="w-16 h-16 object-cover rounded border" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentUrls = section.descriptionImageUrls || [];
                                        const newUrls = currentUrls.filter((_, i) => i !== idx);
                                        updateSectionDescriptionImages(section.id, newUrls);
                                      }}
                                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                                      aria-label="Xóa ảnh"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {section.descriptionAudioUrl && (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-2 block">Audio đã tải lên:</Label>
                              <div className="flex items-center gap-2">
                                <audio key={section.descriptionAudioUrl} controls className="h-8 flex-1">
                                  <source src={section.descriptionAudioUrl} type="audio/mpeg" />
                                </audio>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateSectionDescriptionAudio(section.id, "")}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                          Số câu đúng tối thiểu để đạt phần này (tùy chọn)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Số câu đúng tối thiểu"
                          value={section.passingScore ?? ""}
                          onChange={(e) => updateSectionPassingScore(section.id, e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Để trống nếu phần này không chặn điểm riêng.
                        </p>                      </div>
                    </div>

                    {/* BỘ CÂU HỎI */}
                    <div className="border-t pt-4">
                      <h4 className="text-md font-medium mb-3">Bộ câu hỏi</h4>
                      <div className="space-y-4">
                        {section.questionSets.map((questionSet, qsIndex) => (
                          <div key={questionSet.id} className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-medium">Bộ câu hỏi {qsIndex + 1}</h5>
                              {section.questionSets.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => questionSetActions.removeQuestionSetFromSection(section.id, questionSet.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            {/* Tên bộ câu hỏi và Nút chọn câu hỏi trên cùng hàng */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <div>
                                <Label className="block text-sm font-medium mb-1">Tên bộ câu hỏi (tùy chọn)</Label>
                                <Input
                                  placeholder={`Bộ câu hỏi ${qsIndex + 1}`}
                                  value={questionSet.name}
                                  onChange={(e) => questionSetActions.updateQuestionSetName(section.id, questionSet.id, e.target.value)}
                                />
                              </div>
                              
                              <div className="flex items-end">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setDialogState({
                                      isOpen: true,
                                      sectionId: section.id,
                                      questionSetId: questionSet.id
                                    });
                                    setQuestionSearchQuery("");
                                    setSelectedLanguageFilter("all");
                                    setSelectedCategoryFilter("all");
                                  }}
                                  variant="outline"
                                  className="w-full"
                                >
                                  <Search className="w-4 h-4 mr-2" />
                                  Chọn câu hỏi ({questionSet.questions.length})
                                </Button>
                              </div>
                            </div>

                            {/* Hiển thị câu hỏi đã chọn */}
                            {questionSet.questions.length > 0 && (
                              <div>
                                <h6 className="text-xs font-medium text-gray-600 mb-2">
                                  Câu hỏi đã chọn ({questionSet.questions.length}):
                                </h6>
                                <div className="space-y-2">
                                  {questionSet.questions.map((question, idx) => (
                                    <div key={question.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                                      {/* Question content */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">
                                          {isMissingQuestion(question) ? (
                                            <Badge variant="outline" className="mr-2 border-amber-400 text-amber-800 bg-amber-50">
                                              Đã xóa khỏi ngân hàng
                                            </Badge>
                                          ) : null}
                                          {question.questionTitle && (
                                            <span className="font-semibold text-primary">{question.questionTitle}: </span>
                                          )}
                                          {question.questionText}
                                        </p>
                                      </div>
                                      
                                      {/* Move buttons */}
                                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => questionSetActions.moveQuestionInSet(section.id, questionSet.id, question.id, 'up')}
                                          disabled={idx === 0}
                                          className="h-5 w-5 p-0"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => questionSetActions.moveQuestionInSet(section.id, questionSet.id, question.id, 'down')}
                                          disabled={idx === questionSet.questions.length - 1}
                                          className="h-5 w-5 p-0"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </Button>
                                      </div>
                                      
                                      {/* Delete button */}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => questionSetActions.removeQuestionFromSet(section.id, questionSet.id, question.id)}
                                        className="text-red-600 hover:text-red-700 flex-shrink-0"
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

                        {/* Nút thêm bộ câu hỏi */}
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={() => questionSetActions.addQuestionSetToSection(section.id)}
                            variant="outline"
                            className="w-1/2"
                            data-testid={`button-add-question-set-${section.id}`}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Thêm bộ câu hỏi
                          </Button>
                        </div>
                      </div>
                    </div>
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
                onClick={leaveExamForm}
                data-testid="button-cancel"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={
                  isPending ||
                  !readyToSubmit ||
                  Object.values(audioUploadState).some((st) => st.isUploading)
                }
                data-testid="button-create"
              >
                {isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {submittingLabel}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {submitLabel}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Question Selection Dialog */}
        <Dialog 
          open={dialogState.isOpen} 
          onOpenChange={(open) => setDialogState(open ? dialogState : { isOpen: false, sectionId: "", questionSetId: "" })}
        >
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
                      <SelectItem value="vi">Tiếng Việt</SelectItem>
                      <SelectItem value="en">Tiếng Anh</SelectItem>
                      <SelectItem value="ja">Tiếng Nhật</SelectItem>
                      <SelectItem value="de">Tiếng Đức</SelectItem>
                      <SelectItem value="japanese">Japanese (legacy)</SelectItem>
                      <SelectItem value="english">English (legacy)</SelectItem>
                      <SelectItem value="german">German (legacy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Question List */}
              <ExamQuestionPickerList
                questions={filteredQuestions}
                isLoading={questionsLoading}
                onSelect={(question) => {
                  questionSetActions.addQuestionToSet(
                    dialogState.sectionId,
                    dialogState.questionSetId,
                    question,
                  );
                }}
              />
            </div>

            <DialogFooter className="px-6 py-4 border-t">
              <Button onClick={() => setDialogState({ isOpen: false, sectionId: "", questionSetId: "" })}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}