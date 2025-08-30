import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus, Minus } from "lucide-react";
import { AudioUploader } from "@/components/AudioUploader";
import { type Exam, type Question } from "@shared/schema";

const questionSchema = z.object({
  questionText: z.string().min(1, "Nội dung câu hỏi không được để trống"),
  questionType: z.string().default("multiple_choice"),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  options: z.array(z.string()).min(2, "Phải có ít nhất 2 lựa chọn"),
  correctAnswer: z.string().min(1, "Phải chọn đáp án đúng"),
  explanation: z.string().optional(),
});

const editExamSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  description: z.string().optional(),
  timeLimit: z.number().min(1, "Thời gian làm bài phải lớn hơn 0"),
  isDemo: z.boolean().default(false),
  questions: z.array(questionSchema).min(1, "Phải có ít nhất 1 câu hỏi"),
});

type EditExamFormData = z.infer<typeof editExamSchema>;

export default function EditExam({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get exam ID from params
  const examId = params.id;

  // Fetch exam data
  const { data: examData, isLoading: examLoading } = useQuery({
    queryKey: ["/api/exams", examId],
    enabled: !!examId,
  });

  // Fetch questions for this exam
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions", examId],
    enabled: !!examId,
  });

  const form = useForm<EditExamFormData>({
    resolver: zodResolver(editExamSchema),
    defaultValues: {
      title: "",
      description: "",
      timeLimit: 30,
      isDemo: false,
      questions: [
        {
          questionText: "",
          questionType: "multiple_choice",
          options: ["", ""],
          correctAnswer: "",
          explanation: "",
          audioUrl: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  // Load exam data into form when available
  useEffect(() => {
    if (examData && questions.length > 0) {
      const formattedQuestions = questions.map((q) => ({
        questionText: q.questionText,
        questionType: q.questionType || "multiple_choice",
        imageUrl: q.imageUrl || "",
        audioUrl: q.audioUrl || "",
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "",
      }));

      form.reset({
        title: examData.title,
        description: examData.description || "",
        timeLimit: examData.timeLimit,
        isDemo: examData.isDemo || false,
        questions: formattedQuestions,
      });
    }
  }, [examData, questions, form]);

  // Update exam mutation
  const updateExamMutation = useMutation({
    mutationFn: async (data: EditExamFormData) => {
      const response = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          timeLimit: data.timeLimit,
          isDemo: data.isDemo,
          questions: data.questions,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update exam");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Bài thi đã được cập nhật",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      setLocation("/cpanel");
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditExamFormData) => {
    updateExamMutation.mutate(data);
  };

  const addQuestion = () => {
    append({
      questionText: "",
      questionType: "multiple_choice",
      options: ["", ""],
      correctAnswer: "",
      explanation: "",
      audioUrl: "",
    });
  };

  const addOption = (questionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`);
    form.setValue(`questions.${questionIndex}.options`, [...currentOptions, ""]);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`);
    const newOptions = currentOptions.filter((_, index) => index !== optionIndex);
    form.setValue(`questions.${questionIndex}.options`, newOptions);
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

  if (!examData) {
    return (
      <div className="min-h-screen bg-gray-50/50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center py-8">
            <p className="text-lg text-gray-500">Không tìm thấy bài thi</p>
            <Button onClick={() => setLocation("/cpanel")} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
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
        <div className="mb-6 flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/cpanel")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Chỉnh sửa bài thi
            </h1>
            <p className="text-gray-600">
              Cập nhật thông tin và câu hỏi cho bài thi
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cơ bản</CardTitle>
                <CardDescription>
                  Thông tin chung về bài thi
                </CardDescription>
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
                
                {/* Add Question Button at the bottom */}
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
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={updateExamMutation.isPending}
                className="min-w-[120px]"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateExamMutation.isPending ? "Đang cập nhật..." : "Cập nhật bài thi"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}