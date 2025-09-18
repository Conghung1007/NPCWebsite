import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, FileText, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { type Exam, type Question, type User } from "@shared/schema";

interface ExamTakingPageProps {
  examId: string;
}

export function ExamTakingPage({ examId }: ExamTakingPageProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);

  // User data is now handled by useAuth hook

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${examId}`],
    retry: false,
  });

  // Fetch exam questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: [`/api/exams/${examId}/questions`],
    retry: false,
  });

  // Shuffle questions when they load
  useEffect(() => {
    if (exam && !questionsLoading) {
      if (questions.length > 0) {
        // Shuffle questions and take only the required number
        const shuffled = [...questions]
          .sort(() => Math.random() - 0.5)
          .slice(0, exam.questionCount);
        setShuffledQuestions(shuffled);
      } else {
        // No questions available for this exam
        setShuffledQuestions([]);
      }
    }
  }, [questions, exam, questionsLoading]);

  // Initialize timer
  useEffect(() => {
    if (exam && shuffledQuestions.length > 0) {
      setTimeLeft(exam.timeLimit * 60); // Convert minutes to seconds
    }
  }, [exam, shuffledQuestions]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Auto submit when time is up
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  // Submit exam mutation
  const submitExamMutation = useMutation({
    mutationFn: async (examData: {
      examId: string;
      userAnswers: Record<string, string>;
      timeSpent: number;
      questionOrder: string[];
    }) => {
      const response = await fetch("/api/exam-attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(examData),
      });
      if (!response.ok) {
        throw new Error("Failed to submit exam");
      }
      return response.json();
    },
    onSuccess: (result) => {
      setLocation(`/exam-result/${result.id}`);
    },
    onError: (error) => {
      console.error("Error submitting exam:", error);
    },
  });

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    const timeSpent = exam ? (exam.timeLimit * 60) - timeLeft : 0;
    
    submitExamMutation.mutate({
      examId,
      userAnswers,
      timeSpent,
      questionOrder: shuffledQuestions.map(q => q.id),
    });
  }, [examId, userAnswers, timeLeft, exam, shuffledQuestions, isSubmitting, submitExamMutation]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Check authentication for official exams
  if (exam && !exam.isDemo && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Cần đăng nhập</h2>
            <p className="text-gray-600 mb-6">
              Đây là đề thi chính thức, bạn cần đăng nhập để tham gia.
            </p>
            <div className="space-x-4">
              <Button variant="outline" onClick={() => setLocation("/login")}>
                Đăng nhập
              </Button>
              <Button onClick={() => setLocation("/online-exam")}>
                Về trang chủ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while fetching data
  if (examLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  // Show error if exam has no questions
  if (exam && !examLoading && !questionsLoading && shuffledQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Đề thi chưa có câu hỏi</h2>
            <p className="text-gray-600 mb-6">
              Đề thi này hiện tại chưa có câu hỏi nào. Vui lòng thử lại sau hoặc chọn đề thi khác.
            </p>
            <Button onClick={() => setLocation("/online-exam")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Không tìm thấy đề thi</h2>
            <p className="text-gray-600 mb-6">
              Đề thi này không tồn tại hoặc đã bị xóa.
            </p>
            <Button onClick={() => setLocation("/online-exam")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / shuffledQuestions.length) * 100;
  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600">
                Câu {currentQuestionIndex + 1} / {shuffledQuestions.length}
              </p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-gray-500" />
                <span className={`font-mono text-lg ${timeLeft < 300 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
              >
                Nộp bài
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Question Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Câu {currentQuestionIndex + 1}: {currentQuestion.questionText}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Question Image */}
                {currentQuestion.imageUrl && (
                  <div className="flex justify-center">
                    <img
                      src={currentQuestion.imageUrl}
                      alt="Question illustration"
                      className="max-w-full h-auto rounded-lg shadow-sm"
                    />
                  </div>
                )}

                {/* Question Audio */}
                {currentQuestion.audioUrl && (
                  <div className="flex justify-center">
                    <audio controls className="w-full max-w-md" key={currentQuestion.id}>
                      <source src={currentQuestion.audioUrl.startsWith('/api/') 
                        ? currentQuestion.audioUrl 
                        : `/api/${currentQuestion.audioUrl}`} type="audio/mpeg" />
                      Trình duyệt của bạn không hỗ trợ phát audio.
                    </audio>
                  </div>
                )}

                {/* Answer Options */}
                <RadioGroup
                  value={userAnswers[currentQuestion.id] || ""}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                >
                  {(currentQuestion.options as string[]).map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                      <Label 
                        htmlFor={`option-${index}`} 
                        className="flex-1 cursor-pointer py-2"
                      >
                        {String.fromCharCode(65 + index)}. {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Câu trước
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentQuestionIndex === shuffledQuestions.length - 1}
              >
                Câu sau
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Question Overview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Tổng quan bài thi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm">
                    <p className="font-medium">Đã trả lời: {answeredCount}/{shuffledQuestions.length}</p>
                    <Progress value={(answeredCount / shuffledQuestions.length) * 100} className="mt-2" />
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {shuffledQuestions.map((question, index) => (
                      <button
                        key={question.id}
                        onClick={() => setCurrentQuestionIndex(index)}
                        className={`
                          w-8 h-8 text-xs rounded font-medium border-2 transition-colors
                          ${index === currentQuestionIndex 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : userAnswers[question.id]
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                          }
                        `}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-primary rounded mr-2"></div>
                      <span>Câu hiện tại</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></div>
                      <span>Đã trả lời</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded mr-2"></div>
                      <span>Chưa trả lời</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận nộp bài</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn nộp bài không? 
              <br />
              <br />
              <strong>Thống kê:</strong>
              <br />
              • Đã trả lời: {answeredCount}/{shuffledQuestions.length} câu
              <br />
              • Thời gian còn lại: {formatTime(timeLeft)}
              <br />
              <br />
              <span className="text-red-600">Sau khi nộp bài, bạn không thể thay đổi câu trả lời.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Tiếp tục làm bài
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang nộp bài...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Nộp bài
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ExamTakingPage;