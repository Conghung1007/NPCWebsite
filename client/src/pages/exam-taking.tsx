import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, FileText, CheckCircle, ArrowRight, Volume2, Eye, BookOpen, MessageSquare, Headphones, FileInput } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { type Exam, type Question, type User } from "@shared/schema";

type ExamSection = "vocabulary" | "grammar" | "listening" | "reading";

interface SectionResults {
  answers: Record<string, string>;
  timeSpent: number;
  score: number;
}

interface ExamTakingPageProps {
  examId: string;
}

export function ExamTakingPage({ examId }: ExamTakingPageProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // 4-Section exam state
  const [currentSection, setCurrentSection] = useState<ExamSection>("vocabulary");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sectionTimeLeft, setSectionTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  
  // Section-specific data
  const [sectionQuestions, setSectionQuestions] = useState<Question[]>([]);
  const [sectionAnswers, setSectionAnswers] = useState<Record<string, string>>({});
  const [completedSections, setCompletedSections] = useState<Set<ExamSection>>(new Set());
  const [sectionResults, setSectionResults] = useState<Record<ExamSection, SectionResults>>({});
  
  // Wait time tracking between sections
  const [waitStartTime, setWaitStartTime] = useState<number | null>(null);

  // User data is now handled by useAuth hook

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${examId}`],
    retry: false,
  });

  // Helper functions for section management
  const getSectionConfig = () => {
    const configs = {
      vocabulary: { 
        title: "Từ vựng", 
        icon: BookOpen, 
        color: "bg-green-500",
        timeLimit: exam?.vocabularyTimeLimit || 10,
        questions: exam?.vocabularyQuestions || []
      },
      grammar: { 
        title: "Ngữ pháp", 
        icon: MessageSquare, 
        color: "bg-blue-500",
        timeLimit: exam?.grammarTimeLimit || 10,
        questions: exam?.grammarQuestions || []
      },
      listening: { 
        title: "Nghe hiểu", 
        icon: Headphones, 
        color: "bg-yellow-500",
        timeLimit: exam?.listeningTimeLimit || 5,
        questions: exam?.listeningQuestions || []
      },
      reading: { 
        title: "Đọc hiểu", 
        icon: FileInput, 
        color: "bg-purple-500",
        timeLimit: exam?.readingTimeLimit || 5,
        questions: exam?.readingQuestions || []
      }
    };
    return configs[currentSection];
  };

  // Fetch questions for current section
  const { data: allQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    retry: false,
  });

  // Filter questions for current section when section changes
  useEffect(() => {
    if (exam && allQuestions.length > 0) {
      const sectionConfig = getSectionConfig();
      const questionIds = sectionConfig.questions as string[];
      const filteredQuestions = allQuestions.filter(q => questionIds.includes(q.id));
      setSectionQuestions(filteredQuestions);
      setCurrentQuestionIndex(0);
      setSectionAnswers({});
    }
  }, [currentSection, exam, allQuestions]);

  // Initialize section timer when section starts
  useEffect(() => {
    if (exam && examStarted && sectionQuestions.length > 0) {
      const sectionConfig = getSectionConfig();
      setSectionTimeLeft(sectionConfig.timeLimit * 60); // Convert minutes to seconds
    }
  }, [currentSection, exam, examStarted, sectionQuestions]);

  // Section timer countdown
  useEffect(() => {
    if (sectionTimeLeft > 0 && examStarted) {
      const timer = setInterval(() => {
        setSectionTimeLeft(prev => {
          if (prev <= 1) {
            // Auto move to next section when time is up
            handleSectionTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [sectionTimeLeft, examStarted]);

  // Submit final exam mutation (all 4 sections completed)
  const submitExamMutation = useMutation({
    mutationFn: async (examData: {
      examId: string;
      vocabularyAnswers: Record<string, string>;
      vocabularyTimeSpent: number;
      vocabularyScore: number;
      grammarAnswers: Record<string, string>;
      grammarTimeSpent: number;
      grammarScore: number;
      listeningAnswers: Record<string, string>;
      listeningTimeSpent: number;
      listeningScore: number;
      readingAnswers: Record<string, string>;
      readingTimeSpent: number;
      readingScore: number;
      totalScore: number;
      totalTimeSpent: number;
      waitTimeBetweenSections: number;
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

  // Calculate section score
  const calculateSectionScore = (answers: Record<string, string>, questions: Question[]) => {
    let correct = 0;
    questions.forEach(question => {
      const userAnswer = answers[question.id];
      if (userAnswer === question.correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / questions.length) * 100);
  };

  // Handle section completion
  const handleSectionComplete = useCallback(() => {
    if (isSubmitting) return;
    
    const sectionConfig = getSectionConfig();
    const timeSpent = (sectionConfig.timeLimit * 60) - sectionTimeLeft;
    const score = calculateSectionScore(sectionAnswers, sectionQuestions);
    
    // Save section results
    const results: SectionResults = {
      answers: sectionAnswers,
      timeSpent,
      score
    };
    
    setSectionResults(prev => ({
      ...prev,
      [currentSection]: results
    }));
    
    setCompletedSections(prev => new Set([...prev, currentSection]));
    
    // Move to next section or complete exam
    const nextSection = getNextSection(currentSection);
    if (nextSection) {
      setWaitStartTime(Date.now());
      setCurrentSection(nextSection);
    } else {
      // All sections completed, submit final exam
      handleFinalSubmit();
    }
  }, [currentSection, sectionAnswers, sectionQuestions, sectionTimeLeft, isSubmitting]);

  // Handle section time up
  const handleSectionTimeUp = useCallback(() => {
    handleSectionComplete();
  }, [handleSectionComplete]);

  // Get next section in sequence
  const getNextSection = (current: ExamSection): ExamSection | null => {
    const sections: ExamSection[] = ["vocabulary", "grammar", "listening", "reading"];
    const currentIndex = sections.indexOf(current);
    return currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;
  };

  // Handle final exam submission
  const handleFinalSubmit = useCallback(() => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Calculate totals
    const allResults = Object.values(sectionResults);
    const totalTimeSpent = allResults.reduce((sum, result) => sum + result.timeSpent, 0);
    const totalScore = Math.round(allResults.reduce((sum, result) => sum + result.score, 0) / 4);
    
    // Calculate wait time between sections (excluding exam completion)
    const waitTime = waitStartTime ? Math.round((Date.now() - waitStartTime) / 1000) : 0;
    
    submitExamMutation.mutate({
      examId,
      vocabularyAnswers: sectionResults.vocabulary?.answers || {},
      vocabularyTimeSpent: sectionResults.vocabulary?.timeSpent || 0,
      vocabularyScore: sectionResults.vocabulary?.score || 0,
      grammarAnswers: sectionResults.grammar?.answers || {},
      grammarTimeSpent: sectionResults.grammar?.timeSpent || 0,
      grammarScore: sectionResults.grammar?.score || 0,
      listeningAnswers: sectionResults.listening?.answers || {},
      listeningTimeSpent: sectionResults.listening?.timeSpent || 0,
      listeningScore: sectionResults.listening?.score || 0,
      readingAnswers: sectionResults.reading?.answers || {},
      readingTimeSpent: sectionResults.reading?.timeSpent || 0,
      readingScore: sectionResults.reading?.score || 0,
      totalScore,
      totalTimeSpent,
      waitTimeBetweenSections: waitTime,
    });
  }, [examId, sectionResults, waitStartTime, isSubmitting, submitExamMutation]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setSectionAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < sectionQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const startExam = () => {
    setExamStarted(true);
    setWaitStartTime(Date.now());
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

  // Show exam start screen
  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 text-primary mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4">{exam?.title}</h1>
            <p className="text-gray-600 mb-8">{exam?.description}</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-semibold text-blue-900 mb-4">Cấu trúc bài thi gồm 4 phần:</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-green-600" />
                  <span>1. Từ vựng ({exam?.vocabularyTimeLimit} phút)</span>
                </div>
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <span>2. Ngữ pháp ({exam?.grammarTimeLimit} phút)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Headphones className="w-5 h-5 text-yellow-600" />
                  <span>3. Nghe hiểu ({exam?.listeningTimeLimit} phút)</span>
                </div>
                <div className="flex items-center gap-3">
                  <FileInput className="w-5 h-5 text-purple-600" />
                  <span>4. Đọc hiểu ({exam?.readingTimeLimit} phút)</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-sm">
                <strong>Lưu ý:</strong> Bạn không thể quay lại phần trước đã hoàn thành. Hãy cân nhắc kỹ trước khi chuyển sang phần tiếp theo.
              </div>
            </div>

            <Button onClick={startExam} size="lg" className="px-8">
              <CheckCircle className="w-5 h-5 mr-2" />
              Bắt đầu thi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  // Show error if exam has no questions for any section
  if (exam && !examLoading && !questionsLoading) {
    const hasAnyQuestions = 
      (exam.vocabularyQuestions as string[]).length > 0 ||
      (exam.grammarQuestions as string[]).length > 0 ||
      (exam.listeningQuestions as string[]).length > 0 ||
      (exam.readingQuestions as string[]).length > 0;

    if (!hasAnyQuestions) {
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

  const currentQuestion = sectionQuestions[currentQuestionIndex];
  const progress = sectionQuestions.length > 0 ? ((currentQuestionIndex + 1) / sectionQuestions.length) * 100 : 0;
  const answeredCount = Object.keys(sectionAnswers).length;
  const sectionConfig = getSectionConfig();
  const SectionIcon = sectionConfig.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${sectionConfig.color} text-white`}>
                  <SectionIcon className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {sectionConfig.title} - {exam.title}
                  </h1>
                  <p className="text-sm text-gray-600">
                    Câu {currentQuestionIndex + 1} / {sectionQuestions.length}
                  </p>
                </div>
              </div>
              {/* Section Progress Indicator */}
              <div className="flex items-center gap-2">
                {["vocabulary", "grammar", "listening", "reading"].map((section, index) => (
                  <div key={section} className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${
                      completedSections.has(section as ExamSection) ? 'bg-green-500' :
                      section === currentSection ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                    {index < 3 && <div className="w-6 h-0.5 bg-gray-300 mx-1" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-gray-500" />
                <span className={`font-mono text-lg ${sectionTimeLeft < 300 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatTime(sectionTimeLeft)}
                </span>
              </div>
              <Button 
                variant="outline" 
                onClick={handleSectionComplete}
                disabled={isSubmitting}
              >
                {getNextSection(currentSection) ? "Hoàn thành phần này" : "Nộp bài"}
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

            {/* Navigation - Within Section Only */}
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
                disabled={currentQuestionIndex === sectionQuestions.length - 1}
              >
                Câu sau
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Section Overview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <SectionIcon className="w-4 h-4" />
                  {sectionConfig.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm">
                    <p className="font-medium">Đã trả lời: {answeredCount}/{sectionQuestions.length}</p>
                    <Progress value={(answeredCount / sectionQuestions.length) * 100} className="mt-2" />
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {sectionQuestions.map((question, index) => {
                      const isCurrent = index === currentQuestionIndex;
                      const isAnswered = sectionAnswers[question.id];
                      const canNavigate = index <= currentQuestionIndex; // Allow navigation to current and previous questions
                      
                      return (
                        <button
                          key={question.id}
                          onClick={() => canNavigate ? setCurrentQuestionIndex(index) : undefined}
                          disabled={!canNavigate}
                          className={`
                            w-8 h-8 text-xs rounded font-medium border-2 transition-colors
                            ${isCurrent
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : isAnswered
                                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                : canNavigate
                                  ? 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                                  : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                            }
                          `}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
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
                      <span>Có thể trả lời</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded mr-2"></div>
                      <span>Chưa mở khóa</span>
                    </div>
                  </div>

                  {/* Section Navigation Info */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-sm mb-2">Tiến độ bài thi</h4>
                    <div className="space-y-2 text-xs">
                      {["vocabulary", "grammar", "listening", "reading"].map((section) => {
                        const config = {
                          vocabulary: { title: "Từ vựng", icon: BookOpen },
                          grammar: { title: "Ngữ pháp", icon: MessageSquare },
                          listening: { title: "Nghe hiểu", icon: Headphones },
                          reading: { title: "Đọc hiểu", icon: FileInput }
                        }[section as ExamSection];
                        
                        return (
                          <div key={section} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              completedSections.has(section as ExamSection) ? 'bg-green-500' :
                              section === currentSection ? 'bg-blue-500' : 'bg-gray-300'
                            }`} />
                            <span className={`${section === currentSection ? 'font-medium' : ''}`}>
                              {config.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Section Complete Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {getNextSection(currentSection) ? `Hoàn thành phần ${sectionConfig.title}` : "Hoàn thành bài thi"}
            </DialogTitle>
            <DialogDescription>
              {getNextSection(currentSection) ? (
                <>
                  Bạn có chắc chắn muốn hoàn thành phần {sectionConfig.title} không?
                  <br />
                  <br />
                  <strong>Thống kê phần này:</strong>
                  <br />
                  • Đã trả lời: {answeredCount}/{sectionQuestions.length} câu
                  <br />
                  • Thời gian còn lại: {formatTime(sectionTimeLeft)}
                  <br />
                  <br />
                  <span className="text-amber-600">
                    Sau khi hoàn thành, bạn không thể quay lại phần này và sẽ chuyển sang phần tiếp theo.
                  </span>
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn hoàn thành bài thi không?
                  <br />
                  <br />
                  <strong>Thống kê phần cuối:</strong>
                  <br />
                  • Đã trả lời: {answeredCount}/{sectionQuestions.length} câu
                  <br />
                  • Thời gian còn lại: {formatTime(sectionTimeLeft)}
                  <br />
                  <br />
                  <span className="text-red-600">
                    Sau khi nộp bài, bạn không thể thay đổi câu trả lời và sẽ nhận kết quả ngay.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              {getNextSection(currentSection) ? "Tiếp tục làm bài" : "Xem lại bài"}
            </Button>
            <Button onClick={handleSectionComplete} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {getNextSection(currentSection) ? "Đang chuyển phần..." : "Đang nộp bài..."}
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {getNextSection(currentSection) ? "Chuyển phần tiếp theo" : "Nộp bài"}
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