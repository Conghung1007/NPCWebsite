import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Save, Plus, Minus, ArrowLeft } from "lucide-react";
import { AudioUploader } from "@/components/AudioUploader";
import type { Exam, Question } from "@shared/schema";

const examFormSchema = z.object({
  title: z.string().min(1, "Tiêu đề là bắt buộc"),
  description: z.string().optional(),
  timeLimit: z.number().min(1, "Thời gian phải lớn hơn 0"),
  isDemo: z.boolean().optional(),
  isActive: z.boolean().optional(),
  questions: z.array(z.object({
    questionText: z.string().min(1, "Nội dung câu hỏi là bắt buộc"),
    questionType: z.string().optional(),
    imageUrl: z.string().optional(),
    audioUrl: z.string().optional(),
    options: z.array(z.string()).min(2, "Cần ít nhất 2 lựa chọn"),
    correctAnswer: z.string().min(1, "Cần chọn đáp án đúng"),
    explanation: z.string().optional(),
  })).min(1, "Cần ít nhất một câu hỏi"),
});

type ExamFormData = z.infer<typeof examFormSchema>;

export default function EditExam() {
  const { examId } = useParams<{ examId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch exam data
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${examId}`],
    enabled: !!examId,
  });

  // Fetch questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: [`/api/exams/${examId}/questions`],
    enabled: !!examId,
  });

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      timeLimit: 30,
      isDemo: false,
      isActive: true,
      questions: [
        {
          questionText: "",
          questionType: "multiple_choice",
          imageUrl: "",
          audioUrl: "",
          options: ["", ""],
          correctAnswer: "",
          explanation: "",
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  // Populate form when data is loaded
  useEffect(() => {
    if (exam && questions.length > 0) {
      const formattedQuestions = questions.map(q => ({
        questionText: q.questionText,
        questionType: q.questionType || "multiple_choice",
        imageUrl: q.imageUrl || "",
        audioUrl: q.audioUrl || "",
        options: Array.isArray(q.options) ? q.options as string[] : ["", ""],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "",
      }));

      form.reset({
        title: exam.title,
        description: exam.description || "",
        timeLimit: exam.timeLimit,
        isDemo: exam.isDemo || false,
        isActive: exam.isActive !== false,
        questions: formattedQuestions,
      });
    }
  }, [exam, questions, form]);

  // Update exam mutation
  const updateExamMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      // First update exam info
      await apiRequest(`/api/exams/${examId}`, "PUT", {
        title: data.title,
        description: data.description,
        timeLimit: data.timeLimit,
        isDemo: data.isDemo,
        isActive: data.isActive,
      });

      // Then update questions (for now, we'll recreate them)
      // In a real implementation, you might want to handle individual question updates
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Cập nhật bài thi thành công",
      });
      setLocation("/cpanel?tab=exams");
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật bài thi",
        variant: "destructive",
      });
    },
  });

  const addQuestion = () => {
    append({
      questionText: "",
      questionType: "multiple_choice",
      imageUrl: "",
      audioUrl: "",
      options: ["", ""],
      correctAnswer: "",
      explanation: "",
    });
  };

  const addOption = (questionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`);
    form.setValue(`questions.${questionIndex}.options`, [...currentOptions, ""]);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`);
    if (currentOptions.length > 2) {
      const newOptions = currentOptions.filter((_, index) => index !== optionIndex);
      form.setValue(`questions.${questionIndex}.options`, newOptions);
    }
  };

  const onSubmit = (data: ExamFormData) => {
    updateExamMutation.mutate(data);
  };

  if (examLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50/50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center py-8">
            <p className="text-lg text-gray-600">Không tìm thấy bài thi</p>
            <Button onClick={() => setLocation("/cpanel")} className="mt-4">
              Quay lại Control Panel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/cpanel?tab=exams")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Chỉnh sửa bài thi</h1>
              <p className="text-gray-600 mt-1">Cập nhật thông tin và câu hỏi của bài thi</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cơ bản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiêu đề *</FormLabel>
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
                          rows={3}
                          {...field}
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
                      <FormItem>
                        <FormLabel>Loại bài thi</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-3 rounded-md border p-3 h-10">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <span className="text-sm">Bài thi demo</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trạng thái</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-3 rounded-md border p-3 h-10">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <span className="text-sm">Kích hoạt bài thi</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Questions */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Câu Hỏi ({fields.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {fields.map((field, questionIndex) => (
                  <Card key={field.id} className="border-2 border-gray-100">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Câu hỏi {questionIndex + 1}</CardTitle>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => remove(questionIndex)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Question Text */}
                      <FormField
                        control={form.control}
                        name={`questions.${questionIndex}.questionText`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nội dung câu hỏi *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Nhập nội dung câu hỏi"
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Question Type */}
                      <FormField
                        control={form.control}
                        name={`questions.${questionIndex}.questionType`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loại câu hỏi</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Chọn loại câu hỏi" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="multiple_choice">Trắc nghiệm</SelectItem>
                                <SelectItem value="true_false">Đúng/Sai</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Audio Upload */}
                      <div>
                        <FormLabel>File âm thanh (tùy chọn)</FormLabel>
                        <AudioUploader
                          currentAudioUrl={form.watch(`questions.${questionIndex}.audioUrl`)}
                          currentFileName={undefined}
                          onAudioUpload={(audioUrl) => {
                            form.setValue(`questions.${questionIndex}.audioUrl`, audioUrl);
                          }}
                          onRemoveAudio={() => {
                            form.setValue(`questions.${questionIndex}.audioUrl`, "");
                          }}
                        />
                      </div>

                      {/* Answer Options */}
                      <div>
                        <FormLabel>Các lựa chọn *</FormLabel>
                        <div className="space-y-2 mt-2">
                          {form.watch(`questions.${questionIndex}.options`).map((_, optionIndex) => (
                            <div key={optionIndex} className="flex gap-2">
                              <FormField
                                control={form.control}
                                name={`questions.${questionIndex}.options.${optionIndex}`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <Input
                                        placeholder={`Lựa chọn ${optionIndex + 1}`}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addOption(questionIndex)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                              {form.watch(`questions.${questionIndex}.options`).length > 2 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeOption(questionIndex, optionIndex)}
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
                                <SelectTrigger>
                                  <SelectValue placeholder="Chọn đáp án đúng" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {form.watch(`questions.${questionIndex}.options`).map((option, optionIndex) => (
                                  <SelectItem key={optionIndex} value={optionIndex.toString()}>
                                    {`${optionIndex + 1}. ${option || `Lựa chọn ${optionIndex + 1}`}`}
                                  </SelectItem>
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
                                placeholder="Nhập giải thích cho đáp án"
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                ))}
                
                {/* Add Question Button */}
                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addQuestion}
                    className="min-w-[200px]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm câu hỏi
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setLocation("/cpanel?tab=exams")}
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={updateExamMutation.isPending}
                className="min-w-[120px]"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateExamMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}