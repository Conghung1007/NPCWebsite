import { useState, useEffect, useRef } from "react";
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
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, Edit, Trash2, HelpCircle, BookOpen, Volume2, Eye, Filter, Save, X, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { AudioUploader } from "@/components/AudioUploader";
import { QuestionImageUploader } from "@/components/QuestionImageUploader";
import { ImagePreviewBox } from "@/components/ImagePreviewBox";
import type { Question } from "@shared/schema";

const questionCategories = [
  { value: "từ vựng", label: "Từ vựng" },
  { value: "ngữ pháp", label: "Ngữ pháp" },
  { value: "đọc hiểu", label: "Đọc hiểu" },
  { value: "nghe hiểu", label: "Nghe hiểu" },
];

const languageOptions = [
  { value: "japanese", label: "Tiếng Nhật" },
  { value: "english", label: "Tiếng Anh" },
  { value: "german", label: "Tiếng Đức" },
];

// Single question schema for each question box
const singleQuestionSchema = z.object({
  questionText: z.string().min(1, "Nội dung câu hỏi là bắt buộc"),
  options: z.array(z.string()).min(2, "Phải có ít nhất 2 lựa chọn").refine(
    (options) => options.every(opt => opt.trim().length > 0),
    { message: "Tất cả lựa chọn phải có nội dung" }
  ),
  correctAnswer: z.string().min(1, "Phải chọn đáp án đúng"),
  explanation: z.string().optional(),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
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
);

// Form validation schema for multiple questions
const questionSchema = z.object({
  language: z.string().min(1, "Ngôn ngữ là bắt buộc"),
  category: z.string().min(1, "Danh mục là bắt buộc"),
  description: z.string().optional(),
  descriptionImageUrl: z.string().optional(),
  descriptionAudioUrl: z.string().optional(),
  questions: z.array(singleQuestionSchema).min(1, "Phải có ít nhất 1 câu hỏi"),
});

type QuestionFormData = z.infer<typeof questionSchema>;

export function QuestionBankManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; question: Question | null }>({
    isOpen: false,
    question: null
  });

  // File input refs for image uploads
  const descriptionImageInputRef = useRef<HTMLInputElement>(null);
  const questionImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Form for creating/editing questions
  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      language: "japanese",
      category: "ngữ pháp",
      description: "",
      descriptionImageUrl: "",
      descriptionAudioUrl: "",
      questions: [{
        questionText: "",
        options: ["", ""],
        correctAnswer: "",
        explanation: "",
        imageUrl: "",
        audioUrl: "",
      }],
    },
  });

  // Fetch all questions from question bank
  const { data: questions = [], isLoading, refetch } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  // Filter questions based on search, category and language
  const filteredQuestions = questions.filter(question => {
    const matchesSearch = searchQuery === "" || 
      question.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (question.description && question.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || question.category === selectedCategory;
    const matchesLanguage = selectedLanguage === "all" || (question as any).language === selectedLanguage;
    
    return matchesSearch && matchesCategory && matchesLanguage;
  });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);

  // Auto-correct current page if it's out of bounds
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  // Reset to first page when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Update pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedLanguage]);

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

  const getLanguageBadge = (language: string) => {
    const languageConfig = languageOptions.find(lang => lang.value === language);
    const variants: any = {
      "japanese": "default",
      "english": "secondary",
      "german": "outline"
    };
    return (
      <Badge variant={variants[language] || "outline"}>
        {languageConfig?.label || language}
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

  // Handle description image upload
  const handleDescriptionImageUpload = async (file: File) => {
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

      const response = await fetch('/api/temp-description-images/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      form.setValue("descriptionImageUrl", data.url);

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

  // Handle question image upload
  const handleQuestionImageUpload = async (file: File, questionIndex: number) => {
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

      const response = await fetch('/api/question-images/upload-direct', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      form.setValue(`questions.${questionIndex}.imageUrl`, data.url);

      toast({
        title: "Thành công",
        description: "Hình ảnh câu hỏi đã được tải lên thành công.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi tải lên",
        description: error.message || "Không thể tải lên hình ảnh."
      });
    }
  };

  // Create/Update question mutations
  const createQuestionMutation = useMutation({
    mutationFn: async (data: any) => {
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
    mutationFn: async (data: any) => {
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

  const handleSubmit = async (data: QuestionFormData) => {
    if (editingQuestion) {
      // For editing, keep single question behavior (first question in array)
      const question = data.questions[0];
      const backendData = { 
        category: data.category,
        language: data.language,
        description: data.description,
        descriptionImageUrl: data.descriptionImageUrl,
        descriptionAudioUrl: data.descriptionAudioUrl,
        questionText: question.questionText,
        questionType: "multiple_choice" as const,
        imageUrl: question.imageUrl,
        audioUrl: question.audioUrl,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      };
      updateQuestionMutation.mutate({ ...backendData, id: editingQuestion.id });
    } else {
      // For creating, submit each question as separate request
      try {
        for (const question of data.questions) {
          const backendData = {
            category: data.category,
            language: data.language,
            description: data.description,
        descriptionImageUrl: data.descriptionImageUrl,
        descriptionAudioUrl: data.descriptionAudioUrl,
            questionText: question.questionText,
            questionType: "multiple_choice" as const,
            imageUrl: question.imageUrl,
            audioUrl: question.audioUrl,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
          };
          await apiRequest("POST", "/api/questions", backendData);
        }
        
        toast({
          title: "Thành công",
          description: `Đã tạo ${data.questions.length} câu hỏi thành công.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
        setIsAddingQuestion(false);
        form.reset();
      } catch (error: any) {
        toast({
          title: "Lỗi",
          description: error.message || "Không thể tạo câu hỏi.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    // For editing, convert single question to questions array format
    let options;
    try {
      options = typeof question.options === 'string' 
        ? JSON.parse(question.options) 
        : Array.isArray(question.options) 
          ? question.options 
          : [];
    } catch (error) {
      console.warn('Failed to parse question options:', error);
      options = [];
    }
    
    form.reset({
      language: (question as any).language || "japanese",
      category: question.category,
      description: question.description || "",
      descriptionImageUrl: (question as any).descriptionImageUrl || "",
      descriptionAudioUrl: (question as any).descriptionAudioUrl || "",
      questions: [{
        questionText: question.questionText,
        options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation || "",
        imageUrl: question.imageUrl || "",
        audioUrl: question.audioUrl || "",
      }],
    });
  };

  const handleAddOption = (questionIndex: number) => {
    const currentQuestions = form.getValues("questions");
    const updatedQuestions = [...currentQuestions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      options: [...updatedQuestions[questionIndex].options, ""]
    };
    form.setValue("questions", updatedQuestions);
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const currentQuestions = form.getValues("questions");
    const updatedQuestions = [...currentQuestions];
    if (updatedQuestions[questionIndex].options.length > 2) {
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        options: updatedQuestions[questionIndex].options.filter((_, i) => i !== optionIndex)
      };
      form.setValue("questions", updatedQuestions);
    }
  };

  const handleAddQuestion = () => {
    const currentQuestions = form.getValues("questions");
    // Create new question by deep cloning the last one (duplicate entire box)
    const lastQuestion = currentQuestions[currentQuestions.length - 1];
    const newQuestion = JSON.parse(JSON.stringify(lastQuestion));
    // Clear the text fields but keep structure (options count, etc)
    newQuestion.questionText = "";
    newQuestion.correctAnswer = "";
    newQuestion.explanation = "";
    newQuestion.options = newQuestion.options.map(() => ""); // Keep same number of options
    form.setValue("questions", [...currentQuestions, newQuestion]);
  };

  const handleRemoveQuestion = (index: number) => {
    const currentQuestions = form.getValues("questions");
    if (currentQuestions.length > 1) {
      form.setValue("questions", currentQuestions.filter((_, i) => i !== index));
    }
  };

  const cancelForm = async () => {
    // Cleanup any uploaded temporary files before canceling
    const formData = form.getValues();
    const tempFilesToCleanup: {audio: string[], questionImages: string[], answerImages: string[], descriptionImages: string[], descriptionAudio: string[]} = {
      audio: [],
      questionImages: [],
      answerImages: [],
      descriptionImages: [],
      descriptionAudio: []
    };

    // Collect temporary description media files
    if (formData.descriptionImageUrl && formData.descriptionImageUrl.includes('/api/temp-description-images/')) {
      const filename = formData.descriptionImageUrl.split('/').pop();
      if (filename) tempFilesToCleanup.descriptionImages.push(filename);
    }

    if (formData.descriptionAudioUrl && formData.descriptionAudioUrl.includes('/api/temp-description-audio/')) {
      const filename = formData.descriptionAudioUrl.split('/').pop();
      if (filename) tempFilesToCleanup.descriptionAudio.push(filename);
    }

    // Collect temporary files from all questions
    formData.questions?.forEach(question => {
      // Collect temporary audio files
      if (question.audioUrl && question.audioUrl.includes('/api/temp-audio/')) {
        const filename = question.audioUrl.split('/').pop();
        if (filename) tempFilesToCleanup.audio.push(filename);
      }

      // Collect temporary question image files
      if (question.imageUrl && question.imageUrl.includes('/api/temp-question-images/')) {
        const filename = question.imageUrl.split('/').pop();
        if (filename) tempFilesToCleanup.questionImages.push(filename);
      }

      // Collect temporary answer choice image files (future-proofing)
      // Note: Answer choice images are not currently implemented in the UI,
      // but this handles cleanup if they're added in the future
      if (question.options && Array.isArray(question.options)) {
        question.options.forEach((option: any) => {
          // Check if options are objects with imageUrl property
          if (typeof option === 'object' && option.imageUrl && option.imageUrl.includes('/api/temp-answer-images/')) {
            const filename = option.imageUrl.split('/').pop();
            if (filename) tempFilesToCleanup.answerImages.push(filename);
          }
          // Check if option is a string that contains an answer image URL
          if (typeof option === 'string' && option.includes('/api/temp-answer-images/')) {
            const filename = option.split('/').pop();
            if (filename) tempFilesToCleanup.answerImages.push(filename);
          }
        });
      }
    });

    // Cleanup temporary files
    const cleanupPromises = [];
    
    if (tempFilesToCleanup.descriptionImages.length > 0) {
      cleanupPromises.push(
        fetch('/api/temp-description-images/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.descriptionImages })
        }).catch(e => console.warn('Failed to cleanup temporary description image files:', e))
      );
    }

    if (tempFilesToCleanup.descriptionAudio.length > 0) {
      cleanupPromises.push(
        fetch('/api/temp-description-audio/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.descriptionAudio })
        }).catch(e => console.warn('Failed to cleanup temporary description audio files:', e))
      );
    }
    
    if (tempFilesToCleanup.audio.length > 0) {
      cleanupPromises.push(
        fetch('/api/temp-audio/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.audio })
        }).catch(e => console.warn('Failed to cleanup temporary audio files:', e))
      );
    }

    if (tempFilesToCleanup.questionImages.length > 0) {
      cleanupPromises.push(
        fetch('/api/temp-question-images/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.questionImages })
        }).catch(e => console.warn('Failed to cleanup temporary question image files:', e))
      );
    }

    if (tempFilesToCleanup.answerImages.length > 0) {
      cleanupPromises.push(
        fetch('/api/temp-answer-images/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.answerImages })
        }).catch(e => console.warn('Failed to cleanup temporary answer image files:', e))
      );
    }

    // Execute cleanup (don't wait for completion to avoid blocking UI)
    if (cleanupPromises.length > 0) {
      Promise.all(cleanupPromises).then(() => {
        console.log('✓ Temporary files cleaned up on form cancel');
      }).catch(e => {
        console.warn('Some temporary files could not be cleaned up:', e);
      });
    }

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
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  {questionCategories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language Filter */}
            <div className="min-w-[180px]">
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger data-testid="select-language-filter">
                  <SelectValue placeholder="Lọc theo ngôn ngữ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả ngôn ngữ</SelectItem>
                  {languageOptions.map(language => (
                    <SelectItem key={language.value} value={language.value}>
                      {language.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items per page selector */}
            <div className="min-w-[120px]">
              <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                setItemsPerPage(parseInt(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger data-testid="select-items-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / trang</SelectItem>
                  <SelectItem value="20">20 / trang</SelectItem>
                  <SelectItem value="50">50 / trang</SelectItem>
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
              {searchQuery || selectedCategory !== "all" || selectedLanguage !== "all" ? 
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
                  <TableHead>Ngôn ngữ</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedQuestions.map((question) => (
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
                      {getLanguageBadge((question as any).language || "japanese")}
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

      {/* Pagination */}
      {filteredQuestions.length > 0 && (
        <div className="mt-6">
          <div className="mb-4 text-center text-sm text-muted-foreground">
            Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredQuestions.length)} trong tổng số {filteredQuestions.length} câu hỏi
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(totalPages, 1)}
            onPageChange={setCurrentPage}
            className="justify-center"
          />
        </div>
      )}

      {/* Create/Edit Question Dialog */}
      <Dialog open={isAddingQuestion || !!editingQuestion} onOpenChange={(open) => !open && cancelForm()}>
        <DialogContent 
          className="max-h-[85vh] overflow-y-auto"
          style={{
            width: "95vw",
            maxWidth: "1000px",
            marginTop: "40px"
          }}
        >
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
              {/* Language */}
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngôn ngữ *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-question-language">
                          <SelectValue placeholder="Chọn ngôn ngữ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {languageOptions.map(language => (
                          <SelectItem key={language.value} value={language.value}>
                            {language.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4">
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

              {/* Description Image Preview */}
              <ImagePreviewBox
                imageUrl={form.watch("descriptionImageUrl")}
                onRemove={() => form.setValue("descriptionImageUrl", "")}
                onChooseImage={() => descriptionImageInputRef.current?.click()}
                title="Hình ảnh mô tả"
              />
              
              {/* Hidden file input for description image */}
              <input
                ref={descriptionImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleDescriptionImageUpload(file);
                  }
                }}
              />

              {/* Description Audio Upload */}
              <FormField
                control={form.control}
                name="descriptionAudioUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audio mô tả (tùy chọn)</FormLabel>
                    <FormControl>
                      <AudioUploader
                        currentAudioUrl={field.value}
                        onAudioUpload={(audioUrl) => field.onChange(audioUrl)}
                        onRemoveAudio={() => field.onChange("")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Questions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Câu hỏi *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQuestion}
                    className="flex items-center gap-1"
                    data-testid="button-add-question-text"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm câu hỏi
                  </Button>
                </div>
                
                <div className="space-y-6">
                  {(form.watch("questions") || []).map((question, questionIndex) => (
                    <Card key={questionIndex} className="p-4 border-2 border-dashed border-muted-foreground/20">
                      <div className="space-y-4">
                        {/* Question Header */}
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-medium">Câu hỏi {questionIndex + 1}</h4>
                          {form.watch("questions").length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveQuestion(questionIndex)}
                              className="text-red-600 hover:text-red-700"
                              data-testid={`button-remove-question-${questionIndex}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {/* Question Text */}
                        <FormField
                          control={form.control}
                          name={`questions.${questionIndex}.questionText`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nội dung câu hỏi *</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder={`Nhập nội dung câu hỏi ${questionIndex + 1}...`}
                                  className="min-h-[80px]"
                                  data-testid={`textarea-question-${questionIndex}`}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Question Image Upload */}
                        <div>
                          <Label className="text-sm font-medium">Hình ảnh câu hỏi (tùy chọn)</Label>
                          <ImagePreviewBox
                            imageUrl={form.watch(`questions.${questionIndex}.imageUrl`)}
                            onRemove={() => form.setValue(`questions.${questionIndex}.imageUrl`, "")}
                            onChooseImage={() => {
                              const inputRef = questionImageInputRefs.current.get(questionIndex);
                              inputRef?.click();
                            }}
                            title={`Hình ảnh câu hỏi ${questionIndex + 1}`}
                            className="mt-2"
                          />
                          
                          {/* Hidden file input for question image */}
                          <input
                            ref={(el) => {
                              if (el) {
                                questionImageInputRefs.current.set(questionIndex, el);
                              }
                            }}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleQuestionImageUpload(file, questionIndex);
                              }
                            }}
                          />
                        </div>

                        {/* Question Audio Upload */}
                        <div>
                          <FormField
                            control={form.control}
                            name={`questions.${questionIndex}.audioUrl`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Audio câu hỏi (tùy chọn)</FormLabel>
                                <FormControl>
                                  <AudioUploader
                                    currentAudioUrl={field.value}
                                    onAudioUpload={(audioUrl) => field.onChange(audioUrl)}
                                    onRemoveAudio={() => field.onChange("")}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Options */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Lựa chọn *</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddOption(questionIndex)}
                              className="flex items-center gap-1"
                              data-testid={`button-add-option-${questionIndex}`}
                            >
                              <Plus className="w-3 h-3" />
                              Thêm lựa chọn
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Input
                                    placeholder={`Lựa chọn ${optionIndex + 1}`}
                                    value={option}
                                    onChange={(e) => {
                                      const currentQuestions = form.getValues("questions");
                                      const updatedQuestions = [...currentQuestions];
                                      updatedQuestions[questionIndex] = {
                                        ...updatedQuestions[questionIndex],
                                        options: updatedQuestions[questionIndex].options.map((opt, idx) => 
                                          idx === optionIndex ? e.target.value : opt
                                        )
                                      };
                                      form.setValue("questions", updatedQuestions);
                                    }}
                                    data-testid={`input-option-${questionIndex}-${optionIndex}`}
                                  />
                                </div>
                                {question.options.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveOption(questionIndex, optionIndex)}
                                    className="text-red-600 hover:text-red-700"
                                    data-testid={`button-remove-option-${questionIndex}-${optionIndex}`}
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
                          name={`questions.${questionIndex}.correctAnswer`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Đáp án đúng *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-correct-answer-${questionIndex}`}>
                                    <SelectValue placeholder="Chọn đáp án đúng" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {question.options.map((option, index) => (
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
                          name={`questions.${questionIndex}.explanation`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Giải thích (tùy chọn)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Giải thích tại sao đáp án này là đúng..."
                                  className="min-h-[60px]"
                                  data-testid={`textarea-explanation-${questionIndex}`}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

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
        <DialogContent className="w-[90vw] max-w-md">
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