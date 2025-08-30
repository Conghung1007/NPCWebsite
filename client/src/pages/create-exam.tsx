import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioUploader } from "@/components/AudioUploader";
import { apiRequest } from "@/lib/queryClient";

// Form validation schema
const questionSchema = z.object({
  questionText: z.string().min(1, "Nội dung câu hỏi là bắt buộc"),
  questionType: z.enum(["multiple_choice", "true_false"]),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  options: z.array(z.string()).min(2, "Phải có ít nhất 2 lựa chọn"),
  correctAnswer: z.string().min(1, "Phải chọn đáp án đúng"),
  explanation: z.string().optional(),
  sortOrder: z.number().default(0),
});

const examSchema = z.object({
  title: z.string().min(1, "Tiêu đề bài thi là bắt buộc"),
  description: z.string().optional(),
  isDemo: z.boolean().default(false),
  timeLimit: z.number().min(1, "Thời gian làm bài phải lớn hơn 0"),
  questions: z.array(questionSchema).min(1, "Phải có ít nhất 1 câu hỏi"),
});

type ExamFormData = z.infer<typeof examSchema>;

export default function CreateExam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: "",
      description: "",
      isDemo: false,
      timeLimit: 30,
      questions: [
        {
          questionText: "",
          questionType: "multiple_choice",
          options: ["", ""],
          correctAnswer: "",
          explanation: "",
          sortOrder: 0,
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: ExamFormData) => {
      // Transform data for API
      const examData = {
        ...data,
        questionCount: data.questions.length,
        questions: data.questions.map((q, index) => ({
          ...q,
          sortOrder: index,
        })),
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
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Tạo bài thi thành công",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      setLocation("/cpanel");
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo bài thi",
        variant: "destructive",
      });
    },
  });

  const addQuestion = () => {
    append({
      questionText: "",
      questionType: "multiple_choice",
      options: ["", ""],
      correctAnswer: "",
      explanation: "",
      sortOrder: fields.length,
    });
  };

  const addOption = (questionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`);
    form.setValue(`questions.${questionIndex}.options`, [...currentOptions, ""]);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`);
    if (currentOptions.length > 2) {
      const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
      form.setValue(`questions.${questionIndex}.options`, newOptions);
      
      // Reset correct answer if it was pointing to removed option
      const correctAnswer = form.getValues(`questions.${questionIndex}.correctAnswer`);
      if (correctAnswer === optionIndex.toString()) {
        form.setValue(`questions.${questionIndex}.correctAnswer`, "");
      }
    }
  };

  const onSubmit = (data: ExamFormData) => {
    createExamMutation.mutate(data);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation("/cpanel")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại Control Panel
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Tạo Bài Thi Mới</h1>
        <p className="text-gray-600 mt-2">Tạo bài thi với câu hỏi, hình ảnh và âm thanh</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Exam Information */}
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Bài Thi</CardTitle>
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
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Bài thi demo
                        </FormLabel>
                      </div>
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
              disabled={createExamMutation.isPending}
              className="min-w-[120px]"
            >
              <Save className="w-4 h-4 mr-2" />
              {createExamMutation.isPending ? "Đang tạo..." : "Tạo bài thi"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}