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
import { Plus, Search, Edit, Trash2, HelpCircle, BookOpen, Volume2, Eye, Filter, Save, X, Minus, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { AudioUploader } from "@/components/AudioUploader";
import { QuestionImageUploader } from "@/components/QuestionImageUploader";
import { ImagePreviewBox } from "@/components/ImagePreviewBox";
import { MultipleImagePreviewBox } from "@/components/MultipleImagePreviewBox";
import type { Question } from "@shared/schema";

const questionCategories = [
  { value: "từ vựng", label: "Từ vựng" },
  { value: "ngữ pháp", label: "Ngữ pháp" },
  { value: "đọc hiểu", label: "Đọc hiểu" },
  { value: "nghe hiểu", label: "Nghe hiểu" },
];

// Category mapping between English and Vietnamese to handle database inconsistencies
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

const languageOptions = [
  { value: "japanese", label: "Tiếng Nhật" },
  { value: "english", label: "Tiếng Anh" },
  { value: "german", label: "Tiếng Đức" },
];

// Option schema - can be either string (legacy) or object with text + imageUrls array
const optionSchema = z.union([
  z.string(), // Legacy string format
  z.object({
    text: z.string(),
    imageUrl: z.string().optional(), // Legacy single image for backward compatibility
    imageUrls: z.array(z.string()).optional().default([]), // New multiple images array
  })
]);

// Single question schema for each question box
const singleQuestionSchema = z.object({
  questionText: z.string().min(1, "Nội dung câu hỏi là bắt buộc"),
  description: z.string().optional(),
  descriptionImageUrls: z.array(z.string()).default([]), // Array of description image URLs
  points: z.coerce.number().min(0.1, "Điểm phải lớn hơn hoặc bằng 0.1").default(1), // Point value (default 1, supports decimals like 1.5, 2.25) - coerce to handle string from database
  options: z.array(optionSchema).min(2, "Phải có ít nhất 2 lựa chọn").refine(
    (options) => options.every(opt => {
      const text = typeof opt === 'string' ? opt : opt.text;
      return text.trim().length > 0;
    }),
    { message: "Tất cả lựa chọn phải có nội dung" }
  ),
  correctAnswer: z.string().min(1, "Phải chọn đáp án đúng"),
  explanation: z.string().optional(),
  imageUrl: z.string().optional(), // Legacy single image for backward compatibility
  imageUrls: z.array(z.string()).default([]), // Array of image URLs
  audioUrl: z.string().optional(),
}).refine(
  (data) => {
    // Validate that correctAnswer is a valid index (0, 1, 2...)
    const answerIndex = parseInt(data.correctAnswer);
    if (isNaN(answerIndex)) return false;
    return answerIndex >= 0 && answerIndex < data.options.length;
  },
  {
    message: "Đáp án đúng phải là một trong các lựa chọn đã nhập",
    path: ["correctAnswer"],
  }
);

// Form validation schema for question form (supports multiple sub-questions)
const questionSchema = z.object({
  language: z.string().min(1, "Ngôn ngữ là bắt buộc"),
  category: z.string().min(1, "Danh mục là bắt buộc"),
  questionTitle: z.string().optional(), // Optional short title for easy identification
  sortOrder: z.number().default(0),
  questions: z.array(singleQuestionSchema).min(1, "Phải có ít nhất 1 câu hỏi").max(10, "Tối đa 10 câu hỏi"),
});

type QuestionFormData = z.infer<typeof questionSchema>;

// Default form values for creating new questions
const defaultFormValues: QuestionFormData = {
  language: "japanese",
  category: "ngữ pháp",
  questionTitle: "",
  sortOrder: 0,
  questions: [{
    questionText: "",
    description: "",
    descriptionImageUrls: [],
    points: 1,
    options: [
      { text: "", imageUrl: "", imageUrls: [] },
      { text: "", imageUrl: "", imageUrls: [] }
    ],
    correctAnswer: "",
    explanation: "",
    imageUrl: "",
    imageUrls: [],
    audioUrl: "",
  }],
};

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
  const questionImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const optionImageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map()); // questionIndex-optionIndex as key
  const descriptionImageInputRef = useRef<HTMLInputElement>(null); // For description images

  // Form for creating/editing questions
  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: defaultFormValues,
  });

  // Fetch all questions from question bank
  const { data: questions = [], isLoading, refetch } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  // Filter questions based on search, category and language
  const filteredQuestions = questions.filter(question => {
    const matchesSearch = searchQuery === "" || 
      question.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (question.description && question.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ((question as any).questionTitle && (question as any).questionTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Map question category to Vietnamese for consistent filtering
    const questionCategoryVietnamese = categoryMapping[question.category] || question.category;
    const matchesCategory = selectedCategory === "all" || questionCategoryVietnamese === selectedCategory;
    const matchesLanguage = selectedLanguage === "all" || (question as any).language === selectedLanguage;
    
    return matchesSearch && matchesCategory && matchesLanguage;
  });

  // Sort questions by newest first and then paginate
  const sortedQuestions = [...filteredQuestions].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(sortedQuestions.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQuestions = sortedQuestions.slice(startIndex, endIndex);

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
      queryClient.invalidateQueries({ predicate: ({ queryKey }) => queryKey[0] === '/api/exams' });
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

      const response = await fetch('/api/description-images/upload-direct', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add to descriptionImageUrls array
      const currentUrls = form.getValues(`questions.0.descriptionImageUrls`) || [];
      form.setValue(`questions.0.descriptionImageUrls`, [...currentUrls, data.imageUrl]);

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
      
      // Add to array instead of replacing single value
      const currentUrls = form.getValues(`questions.${questionIndex}.imageUrls`) || [];
      form.setValue(`questions.${questionIndex}.imageUrls`, [...currentUrls, data.imageUrl]);

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
      queryClient.invalidateQueries({ predicate: ({ queryKey }) => queryKey[0] === '/api/exams' });
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
      queryClient.invalidateQueries({ predicate: ({ queryKey }) => queryKey[0] === '/api/exams' });
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
      // For editing: Update parent question with sub-questions
      try {
        const firstQuestion = data.questions[0];
        const remainingQuestions = data.questions.slice(1);
        
        const updateData = { 
          category: data.category,
          language: data.language,
          questionTitle: data.questionTitle,
          sortOrder: data.sortOrder,
          // Parent question data
          questionText: firstQuestion.questionText,
          description: firstQuestion.description,
          descriptionImageUrls: firstQuestion.descriptionImageUrls,
          descriptionAudioUrl: firstQuestion.audioUrl,
          questionType: "multiple_choice" as const,
          imageUrl: firstQuestion.imageUrl,
          imageUrls: firstQuestion.imageUrls,
          audioUrl: firstQuestion.audioUrl,
          options: firstQuestion.options,
          correctAnswer: firstQuestion.correctAnswer,
          explanation: firstQuestion.explanation,
          points: firstQuestion.points, // Include points for parent question
          // Sub-questions array
          subQuestions: remainingQuestions.map(q => ({
            questionText: q.questionText,
            imageUrl: q.imageUrl,
            imageUrls: q.imageUrls,
            audioUrl: q.audioUrl,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            points: q.points, // Include points for each sub-question
          }))
        };

        await apiRequest("PUT", `/api/questions/${editingQuestion.id}`, updateData);
        
        const subCount = remainingQuestions.length;
        
        toast({
          title: "Thành công",
          description: subCount > 0 
            ? `Đã cập nhật câu hỏi chính với ${subCount} câu hỏi con.`
            : "Câu hỏi đã được cập nhật thành công.",
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
        setEditingQuestion(null);
        form.reset();
      } catch (error: any) {
        toast({
          title: "Lỗi",
          description: error.message || "Không thể cập nhật câu hỏi.",
          variant: "destructive",
        });
      }
    } else {
      // For creating: Create parent question with sub-questions
      try {
        const firstQuestion = data.questions[0];
        const remainingQuestions = data.questions.slice(1);
        
        const backendData = {
          category: data.category,
          language: data.language,
          questionTitle: data.questionTitle,
          sortOrder: data.sortOrder,
          // Parent question data (from first question)
          questionText: firstQuestion.questionText,
          description: firstQuestion.description,
          descriptionImageUrls: firstQuestion.imageUrls,
          descriptionAudioUrl: firstQuestion.audioUrl,
          questionType: "multiple_choice" as const,
          imageUrl: firstQuestion.imageUrl,
          imageUrls: firstQuestion.imageUrls,
          audioUrl: firstQuestion.audioUrl,
          options: firstQuestion.options,
          correctAnswer: firstQuestion.correctAnswer,
          explanation: firstQuestion.explanation,
          points: firstQuestion.points, // Include points for parent question
          // Sub-questions array
          subQuestions: remainingQuestions.map(q => ({
            questionText: q.questionText,
            imageUrl: q.imageUrl,
            imageUrls: q.imageUrls,
            audioUrl: q.audioUrl,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            points: q.points, // Include points for each sub-question
          }))
        };

        await apiRequest("POST", "/api/questions", backendData);
        
        const totalCount = data.questions.length;
        const subCount = remainingQuestions.length;
        
        toast({
          title: "Thành công",
          description: subCount > 0 
            ? `Đã tạo thành công câu hỏi chính với ${subCount} câu hỏi con.`
            : "Đã tạo thành công câu hỏi.",
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
    console.log('handleEditQuestion - Raw question data:', question);
    setEditingQuestion(question);
    // For editing, convert single question to questions array format
    let options;
    try {
      const rawOptions = typeof question.options === 'string' 
        ? JSON.parse(question.options) 
        : Array.isArray(question.options) 
          ? question.options 
          : [];
      
      console.log('handleEditQuestion - Raw options:', rawOptions);
      
      // Convert string array to object array format for backward compatibility
      options = rawOptions.map((opt: any, index: number) => {
        if (typeof opt === 'string') {
          return { text: opt, imageUrl: "", imageUrls: [] };
        } else {
          // Parse opt.imageUrls if it's stored as a JSON string
          let optionImageUrls;
          try {
            const rawOptImageUrls = opt.imageUrls;
            console.log(`Option ${index} - rawOptImageUrls:`, rawOptImageUrls);
            optionImageUrls = typeof rawOptImageUrls === 'string' 
              ? JSON.parse(rawOptImageUrls) 
              : Array.isArray(rawOptImageUrls) 
                ? rawOptImageUrls 
                : [];
          } catch (error) {
            console.warn('Failed to parse option imageUrls:', error);
            optionImageUrls = [];
          }
          
          const result = { 
            text: opt.text || "", 
            imageUrl: opt.imageUrl || "", 
            imageUrls: optionImageUrls
          };
          console.log(`Option ${index} - processed result:`, result);
          return result;
        }
      });
    } catch (error) {
      console.warn('Failed to parse question options:', error);
      options = [{ text: "", imageUrl: "", imageUrls: [] }, { text: "", imageUrl: "", imageUrls: [] }];
    }

    // Parse image URLs fields that may be stored as JSON strings
    let questionImageUrls;
    try {
      const rawImageUrls = (question as any).imageUrls;
      console.log('handleEditQuestion - rawImageUrls:', rawImageUrls);
      questionImageUrls = typeof rawImageUrls === 'string' 
        ? JSON.parse(rawImageUrls) 
        : Array.isArray(rawImageUrls) 
          ? rawImageUrls 
          : [];
    } catch (error) {
      console.warn('Failed to parse question imageUrls:', error);
      questionImageUrls = [];
    }

    // Parse description image URLs fields that may be stored as JSON strings
    let descriptionImageUrls;
    try {
      const rawDescImageUrls = (question as any).descriptionImageUrls;
      console.log('handleEditQuestion - rawDescImageUrls:', rawDescImageUrls);
      descriptionImageUrls = typeof rawDescImageUrls === 'string' 
        ? JSON.parse(rawDescImageUrls) 
        : Array.isArray(rawDescImageUrls) 
          ? rawDescImageUrls 
          : [];
    } catch (error) {
      console.warn('Failed to parse question descriptionImageUrls:', error);
      descriptionImageUrls = [];
    }
    
    console.log('handleEditQuestion - Final parsed data:', {
      questionImageUrls,
      descriptionImageUrls,
      options
    });
    
    // Build questions array: parent + sub-questions
    const questionsArray = [{
      questionText: question.questionText,
      description: question.description || "",
      descriptionImageUrls: descriptionImageUrls,
      points: parseFloat((question as any).points) || 1, // Parse as float since DB returns NUMERIC as string
      options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || "",
      imageUrl: question.imageUrl || "",
      imageUrls: questionImageUrls,
      audioUrl: question.audioUrl || "",
    }];
    
    // Add sub-questions if they exist
    if ((question as any).subQuestions && Array.isArray((question as any).subQuestions)) {
      for (const subQ of (question as any).subQuestions) {
        // Parse sub-question options
        let subOptions;
        try {
          const rawSubOptions = typeof subQ.options === 'string' 
            ? JSON.parse(subQ.options) 
            : Array.isArray(subQ.options) 
              ? subQ.options 
              : [];
          
          subOptions = rawSubOptions.map((opt: any) => {
            if (typeof opt === 'string') {
              return { text: opt, imageUrl: "", imageUrls: [] };
            } else {
              let optionImageUrls;
              try {
                const rawOptImageUrls = opt.imageUrls;
                optionImageUrls = typeof rawOptImageUrls === 'string' 
                  ? JSON.parse(rawOptImageUrls) 
                  : Array.isArray(rawOptImageUrls) 
                    ? rawOptImageUrls 
                    : [];
              } catch (error) {
                optionImageUrls = [];
              }
              return { 
                text: opt.text || "", 
                imageUrl: opt.imageUrl || "", 
                imageUrls: optionImageUrls
              };
            }
          });
        } catch (error) {
          subOptions = [{ text: "", imageUrl: "", imageUrls: [] }, { text: "", imageUrl: "", imageUrls: [] }];
        }
        
        // Parse sub-question image URLs
        let subImageUrls;
        try {
          const rawSubImageUrls = subQ.imageUrls;
          subImageUrls = typeof rawSubImageUrls === 'string' 
            ? JSON.parse(rawSubImageUrls) 
            : Array.isArray(rawSubImageUrls) 
              ? rawSubImageUrls 
              : [];
        } catch (error) {
          subImageUrls = [];
        }
        
        questionsArray.push({
          questionText: subQ.questionText || "",
          description: "", // Sub-questions don't have description
          descriptionImageUrls: [],
          points: parseFloat(subQ.points) || 1, // Parse as float since DB returns NUMERIC as string
          options: subOptions,
          correctAnswer: subQ.correctAnswer || "",
          explanation: subQ.explanation || "",
          imageUrl: subQ.imageUrl || "",
          imageUrls: subImageUrls,
          audioUrl: subQ.audioUrl || "",
        });
      }
    }
    
    form.reset({
      language: (question as any).language || "japanese",
      category: question.category,
      questionTitle: (question as any).questionTitle || "",
      sortOrder: (question as any).sortOrder || 0,
      questions: questionsArray,
    });
  };

  const handleAddOption = (questionIndex: number) => {
    const currentQuestions = form.getValues("questions");
    const updatedQuestions = [...currentQuestions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      options: [...updatedQuestions[questionIndex].options, { text: "", imageUrl: "", imageUrls: [] }]
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
    // Clear all content fields but keep structure (options count, etc)
    newQuestion.questionText = "";
    newQuestion.description = "";
    newQuestion.correctAnswer = "";
    newQuestion.explanation = "";
    newQuestion.imageUrl = "";  // Clear single image
    newQuestion.imageUrls = []; // Clear multiple images
    newQuestion.audioUrl = "";  // Clear audio
    newQuestion.options = newQuestion.options.map(() => ({ text: "", imageUrl: "", imageUrls: [] })); // Keep same number of options but clear content
    form.setValue("questions", [...currentQuestions, newQuestion]);
  };

  const handleRemoveQuestion = (index: number) => {
    const currentQuestions = form.getValues("questions");
    if (currentQuestions.length > 1) {
      form.setValue("questions", currentQuestions.filter((_, i) => i !== index));
    }
  };

  const handleOpenCreate = () => {
    setEditingQuestion(null);
    form.reset(defaultFormValues);
    setIsAddingQuestion(true);
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

    // No more description media files to clean up since they're now handled at section level

    // Collect temporary files from all questions (supports both legacy and context-based URLs)
    formData.questions?.forEach(question => {
      // Collect temporary audio files
      if (question.audioUrl && (question.audioUrl.includes('/api/temp-audio/') || question.audioUrl.match(/\/api\/(qbank|exam)-temp-audio\//))) {
        const filename = question.audioUrl.split('/').pop();
        if (filename) tempFilesToCleanup.audio.push(filename);
      }

      // Collect temporary question image files
      if (question.imageUrl && (question.imageUrl.includes('/api/temp-question-images/') || question.imageUrl.match(/\/api\/(qbank|exam)-temp-question-images\//))) {
        const filename = question.imageUrl.split('/').pop();
        if (filename) tempFilesToCleanup.questionImages.push(filename);
      }

      // Collect temporary answer choice image files (future-proofing)
      // Note: Answer choice images are not currently implemented in the UI,
      // but this handles cleanup if they're added in the future
      if (question.options && Array.isArray(question.options)) {
        question.options.forEach((option: any) => {
          // Check if options are objects with imageUrl property
          if (typeof option === 'object' && option.imageUrl && (option.imageUrl.includes('/api/temp-answer-images/') || option.imageUrl.match(/\/api\/(qbank|exam)-temp-answer-images\//))) {
            const filename = option.imageUrl.split('/').pop();
            if (filename) tempFilesToCleanup.answerImages.push(filename);
          }
          // Check if option is a string that contains an answer image URL
          if (typeof option === 'string' && (option.includes('/api/temp-answer-images/') || option.match(/\/api\/(qbank|exam)-temp-answer-images\//))) {
            const filename = option.split('/').pop();
            if (filename) tempFilesToCleanup.answerImages.push(filename);
          }
        });
      }
    });

    // Cleanup temporary files (QuestionBankManager uses qbank context)
    const cleanupPromises = [];
    const context = 'qbank'; // QuestionBankManager is for Question Bank only
    
    if (tempFilesToCleanup.descriptionImages.length > 0) {
      cleanupPromises.push(
        fetch(`/api/temp-description-images/cleanup?context=${context}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.descriptionImages })
        }).catch(e => console.warn('Failed to cleanup temporary description image files:', e))
      );
    }

    if (tempFilesToCleanup.descriptionAudio.length > 0) {
      cleanupPromises.push(
        fetch(`/api/temp-description-audio/cleanup?context=${context}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.descriptionAudio })
        }).catch(e => console.warn('Failed to cleanup temporary description audio files:', e))
      );
    }
    
    if (tempFilesToCleanup.audio.length > 0) {
      cleanupPromises.push(
        fetch(`/api/temp-audio/cleanup?context=${context}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.audio })
        }).catch(e => console.warn('Failed to cleanup temporary audio files:', e))
      );
    }

    if (tempFilesToCleanup.questionImages.length > 0) {
      cleanupPromises.push(
        fetch(`/api/temp-question-images/cleanup?context=${context}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: tempFilesToCleanup.questionImages })
        }).catch(e => console.warn('Failed to cleanup temporary question image files:', e))
      );
    }

    if (tempFilesToCleanup.answerImages.length > 0) {
      cleanupPromises.push(
        fetch(`/api/temp-answer-images/cleanup?context=${context}`, {
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
    form.reset(defaultFormValues);
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
              onClick={handleOpenCreate} 
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
                  <TableHead>Ngôn ngữ</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead>Nội dung câu hỏi</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="max-w-12 text-[12px]">
                      {getLanguageBadge((question as any).language || "japanese")}
                    </TableCell>
                    <TableCell className="max-w-12 text-[12px]">
                      {getCategoryBadge(question.category)}
                    </TableCell>
                    <TableCell className="max-w-[80rem]">
                      <div className="truncate text-sm font-medium">
                        {(question as any).questionTitle || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[12rem]">
                      <div className="truncate text-sm text-muted-foreground">
                        {question.description || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[10rem]">
                      <div className="flex items-start gap-2">
                        {question.audioUrl && <Volume2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />}
                        {question.imageUrl && <Eye className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />}
                        <div className="truncate" title={question.questionText}>
                          {question.questionText}
                        </div>
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
              {/* Language and Category in same row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Question Title */}
              <FormField
                control={form.control}
                name="questionTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiêu đề câu hỏi (tùy chọn)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nhập tên câu hỏi ngắn gọn dễ tìm"
                        data-testid="input-question-title"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Question Description */}
              <FormField
                control={form.control}
                name={`questions.0.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả câu hỏi (tùy chọn)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Nhập mô tả hoặc ghi chú cho câu hỏi..."
                        className="min-h-[60px]"
                        data-testid="textarea-question-description"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description Media Upload - Compact Design */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Image Upload Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const inputRef = descriptionImageInputRef.current;
                    inputRef?.click();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Thêm hình ảnh
                </Button>
                
                {/* Audio Upload Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const audioInput = document.getElementById('question-audio-input-0') as HTMLInputElement;
                    audioInput?.click();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Thêm audio
                </Button>

                {/* Image Preview (only when images exist) */}
                {(form.watch(`questions.0.descriptionImageUrls`) || []).length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({(form.watch(`questions.0.descriptionImageUrls`) || []).length} hình ảnh)
                  </span>
                )}

                {/* Audio Preview (only when audio exists) */}
                {form.watch(`questions.0.audioUrl`) && (
                  <span className="text-xs text-muted-foreground">
                    (có audio)
                  </span>
                )}
                
                {/* Hidden file input for description images */}
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
                
                <input
                  id="question-audio-input-0"
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      const response = await fetch('/api/description-audio/upload-direct', {
                        method: 'POST',
                        body: formData
                      });
                      
                      if (!response.ok) throw new Error('Upload failed');
                      
                      const result = await response.json();
                      form.setValue(`questions.0.audioUrl`, result.audioUrl);
                      
                      toast({
                        title: "Thành công",
                        description: "Audio đã được tải lên"
                      });
                    } catch (error) {
                      toast({
                        variant: "destructive",
                        title: "Lỗi upload",
                        description: "Không thể tải lên audio"
                      });
                    }
                  }}
                />
              </div>

              {/* Description Media Preview (expandable) */}
              {((form.watch(`questions.0.descriptionImageUrls`) || []).length > 0 || form.watch(`questions.0.audioUrl`)) && (
                <div className="border rounded-lg p-3 space-y-3">
                  {(form.watch(`questions.0.descriptionImageUrls`) || []).length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Hình ảnh đã tải lên:</Label>
                      <div className="flex flex-wrap gap-2">
                        {(form.watch(`questions.0.descriptionImageUrls`) || []).map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img src={url} alt="" className="w-16 h-16 object-cover rounded border" />
                            <button
                              type="button"
                              onClick={() => {
                                const currentUrls = form.getValues(`questions.0.descriptionImageUrls`) || [];
                                const newUrls = currentUrls.filter((_, i) => i !== idx);
                                form.setValue(`questions.0.descriptionImageUrls`, newUrls);
                              }}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {form.watch(`questions.0.audioUrl`) && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Audio đã tải lên:</Label>
                      <div className="flex items-center gap-2">
                        <audio controls className="h-8 flex-1">
                          <source src={form.watch(`questions.0.audioUrl`)} type="audio/mpeg" />
                        </audio>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => form.setValue(`questions.0.audioUrl`, "")}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Questions Section */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Câu hỏi *</Label>
                
                <div className="space-y-6">
                  {(form.watch("questions") || []).map((question, questionIndex) => (
                    <Card key={questionIndex} className="p-4 border-2 border-dashed border-muted-foreground/20">
                      <div className="space-y-4">
                        {/* Question Header with number, points, and delete button */}
                        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4 pb-2 border-b">
                          <h3 className="text-lg font-semibold text-green-600">
                            {editingQuestion && questionIndex === 0 ? (
                              <span>Câu hỏi gốc (đang chỉnh sửa)</span>
                            ) : (
                              <span>Câu hỏi {questionIndex + 1}</span>
                            )}
                          </h3>
                          
                          {/* Points Input - inline with header */}
                          <FormField
                            control={form.control}
                            name={`questions.${questionIndex}.points`}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-3" data-testid={`wrapper-points-${questionIndex}`}>
                                <FormLabel className="sr-only">Điểm câu hỏi *</FormLabel>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium whitespace-nowrap">Điểm:</span>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0.1"
                                      step="0.1"
                                      placeholder="1"
                                      {...field}
                                      value={field.value || 1}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                                      className="w-28 text-center"
                                      data-testid={`input-points-${questionIndex}`}
                                    />
                                  </FormControl>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {form.watch("questions").length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveQuestion(questionIndex)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              data-testid={`button-remove-question-${questionIndex}`}
                              disabled={editingQuestion !== null && questionIndex === 0}
                              title={editingQuestion !== null && questionIndex === 0 ? "Không thể xóa câu hỏi gốc" : "Xóa câu hỏi này"}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Xóa câu hỏi
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
                                  placeholder="Nhập nội dung câu hỏi..."
                                  className="min-h-[80px]"
                                  data-testid="textarea-question"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Question Text Images Upload - Compact */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const inputRef = questionImageInputRefs.current.get(questionIndex);
                                inputRef?.click();
                              }}
                              className="flex items-center gap-1.5"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              Thêm hình ảnh cho câu hỏi
                            </Button>
                            
                            {(form.watch(`questions.${questionIndex}.imageUrls`) || []).length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({(form.watch(`questions.${questionIndex}.imageUrls`) || []).length} hình)
                              </span>
                            )}
                          </div>
                          
                          {/* Image Preview */}
                          {(form.watch(`questions.${questionIndex}.imageUrls`) || []).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {(form.watch(`questions.${questionIndex}.imageUrls`) || []).map((url, idx) => (
                                <div key={idx} className="relative group">
                                  <img src={url} alt="" className="w-16 h-16 object-cover rounded border" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentUrls = form.getValues(`questions.${questionIndex}.imageUrls`) || [];
                                      const newUrls = currentUrls.filter((_, i) => i !== idx);
                                      form.setValue(`questions.${questionIndex}.imageUrls`, newUrls);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
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
                          
                          <div className="space-y-4">
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="border rounded-lg p-3 space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <Input
                                      placeholder={`Lựa chọn ${optionIndex + 1}`}
                                      value={typeof option === 'string' ? option : option.text}
                                      onChange={(e) => {
                                        const currentQuestions = form.getValues("questions");
                                        const updatedQuestions = [...currentQuestions];
                                        updatedQuestions[questionIndex] = {
                                          ...updatedQuestions[questionIndex],
                                          options: updatedQuestions[questionIndex].options.map((opt, idx) => 
                                            idx === optionIndex ? 
                                              (typeof opt === 'string' ? e.target.value : { ...opt, text: e.target.value }) : 
                                              opt
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
                                {/* Option Images Upload - Compact */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const inputRef = optionImageInputRefs.current.get(`${questionIndex}-${optionIndex}`);
                                        inputRef?.click();
                                      }}
                                      className="flex items-center gap-1.5"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      Thêm hình ảnh
                                    </Button>
                                    
                                    {(typeof option !== 'string' && (option.imageUrls || []).length > 0) && (
                                      <span className="text-xs text-muted-foreground">
                                        ({(option.imageUrls || []).length} hình)
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Image Preview */}
                                  {typeof option !== 'string' && (option.imageUrls || []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {(option.imageUrls || []).map((url: string, idx: number) => (
                                        <div key={idx} className="relative group">
                                          <img src={url} alt="" className="w-12 h-12 object-cover rounded border" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const currentQuestions = form.getValues("questions");
                                              const updatedQuestions = [...currentQuestions];
                                              const currentImageUrls = typeof updatedQuestions[questionIndex].options[optionIndex] === 'string' 
                                                ? [] 
                                                : (updatedQuestions[questionIndex].options[optionIndex] as any).imageUrls || [];
                                              const newImageUrls = currentImageUrls.filter((_: string, i: number) => i !== idx);
                                              
                                              updatedQuestions[questionIndex] = {
                                                ...updatedQuestions[questionIndex],
                                                options: updatedQuestions[questionIndex].options.map((opt, i) => 
                                                  i === optionIndex ? 
                                                    (typeof opt === 'string' ? 
                                                      { text: opt, imageUrl: '', imageUrls: newImageUrls } : 
                                                      { ...opt, imageUrls: newImageUrls }) : 
                                                    opt
                                                )
                                              };
                                              form.setValue("questions", updatedQuestions);
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <input
                                    ref={(el) => {
                                      if (el) {
                                        optionImageInputRefs.current.set(`${questionIndex}-${optionIndex}`, el);
                                      }
                                    }}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length === 0) return;
                                      
                                      try {
                                        const currentQuestions = form.getValues("questions");
                                        const currentOption = currentQuestions[questionIndex].options[optionIndex];
                                        const currentImageUrls = typeof currentOption === 'string' ? [] : (currentOption.imageUrls || []);
                                        
                                        if (currentImageUrls.length + files.length > 3) {
                                          toast({
                                            variant: "destructive",
                                            title: "Quá nhiều hình ảnh",
                                            description: "Chỉ có thể tối đa 3 hình ảnh cho mỗi lựa chọn"
                                          });
                                          return;
                                        }
                                        
                                        // Upload each file using the correct answer images endpoint
                                        const uploadPromises = files.map(async (file) => {
                                          const formData = new FormData();
                                          formData.append('image', file);
                                          
                                          const response = await fetch('/api/answer-images/upload-direct', {
                                            method: 'POST',
                                            body: formData
                                          });
                                          
                                          if (!response.ok) {
                                            throw new Error('Upload failed');
                                          }
                                          
                                          const result = await response.json();
                                          return result.imageUrl;
                                        });
                                        
                                        const newImageUrls = await Promise.all(uploadPromises);
                                        const updatedImageUrls = [...currentImageUrls, ...newImageUrls];
                                        
                                        const updatedQuestions = [...currentQuestions];
                                        updatedQuestions[questionIndex] = {
                                          ...updatedQuestions[questionIndex],
                                          options: updatedQuestions[questionIndex].options.map((opt, idx) => 
                                            idx === optionIndex ? 
                                              (typeof opt === 'string' ? 
                                                { text: opt, imageUrl: '', imageUrls: updatedImageUrls } : 
                                                { ...opt, imageUrls: updatedImageUrls }) : 
                                              opt
                                          )
                                        };
                                        form.setValue("questions", updatedQuestions);
                                        
                                        toast({
                                          title: "Upload thành công",
                                          description: `Đã upload ${newImageUrls.length} hình ảnh`
                                        });
                                      } catch (error) {
                                        console.error('Upload error:', error);
                                        toast({
                                          variant: "destructive",
                                          title: "Lỗi upload",
                                          description: "Không thể upload hình ảnh. Vui lòng thử lại."
                                        });
                                      } finally {
                                        // Reset input
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                </div>
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
                                  {question.options.map((option, index) => {
                                    const optionText = typeof option === 'string' ? option : option.text;
                                    return optionText.trim() && (
                                      <SelectItem key={index} value={index.toString()}>
                                        {String.fromCharCode(65 + index)}. {optionText}
                                      </SelectItem>
                                    );
                                  })}
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
                
                {/* Add Question Button at Bottom */}
                {form.watch("questions").length < 10 && (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddQuestion}
                      className="flex items-center gap-1"
                      data-testid="button-add-question"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Thêm câu hỏi
                    </Button>
                  </div>
                )}
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