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

// Dynamic section structure - same as create-exam and edit-exam
interface ExamSection {
  id: string;
  type: "từ vựng" | "ngữ pháp" | "đọc hiểu" | "nghe hiểu";
  timeLimit: number;
  content?: string;
  descriptionImageUrls?: string[];
  descriptionAudioUrl?: string;
  questions: Question[];
}

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
  
  // Dynamic section exam state
  const [examSections, setExamSections] = useState<ExamSection[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sectionTimeLeft, setSectionTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [sectionCompleted, setSectionCompleted] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null);
  
  // Section-specific data
  const [sectionAnswers, setSectionAnswers] = useState<Record<string, string>>({});
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [sectionResults, setSectionResults] = useState<Record<string, SectionResults>>({});
  
  // Wait time tracking between sections
  const [waitStartTime, setWaitStartTime] = useState<number | null>(null);

  // User data is now handled by useAuth hook

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${examId}`],
    retry: false,
  });

  // Fetch all questions
  const { data: allQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: [`/api/exams/${examId}/questions`],
    enabled: !!examId && !!exam,
    retry: false,
  });

  // Shared function to derive sections from exam data
  const deriveExamSections = useCallback((exam: any, allQuestions: Question[]): ExamSection[] => {
    if (!exam || !allQuestions.length) return [];
    
    // Handle both new sections format and legacy format
    if (exam.sections && Array.isArray(exam.sections) && exam.sections.length > 0) {
      // New sections-based format
      const sectionsWithQuestions = exam.sections.map((section: any) => {
        const questionIds = section.questionIds || [];
        const sectionQuestions = questionIds
          .map((qId: string) => allQuestions.find(q => q.id === qId))
          .filter((q: Question | undefined): q is Question => q !== undefined);
        
        return {
          id: section.id,
          type: section.type,
          timeLimit: section.timeLimit,
          content: section.content || "",
          descriptionImageUrls: section.descriptionImageUrls || [],
          descriptionAudioUrl: section.descriptionAudioUrl || "",
          questions: sectionQuestions
        };
      });
      return sectionsWithQuestions.filter(s => s.questions.length > 0);
    } else {
      // Legacy format with separate question arrays
      const legacySections: ExamSection[] = [];
      
      // Map legacy fields to sections
      const legacyMapping = [
        { type: "từ vựng" as const, questions: (exam as any).vocabularyQuestions || [], timeLimit: (exam as any).vocabularyTimeLimit || 10 },
        { type: "ngữ pháp" as const, questions: (exam as any).grammarQuestions || [], timeLimit: (exam as any).grammarTimeLimit || 10 },
        { type: "đọc hiểu" as const, questions: (exam as any).readingQuestions || [], timeLimit: (exam as any).readingTimeLimit || 10 },
        { type: "nghe hiểu" as const, questions: (exam as any).listeningQuestions || [], timeLimit: (exam as any).listeningTimeLimit || 10 }
      ];
      
      legacyMapping.forEach((mapping, index) => {
        if (mapping.questions.length > 0) {
          const sectionQuestions = mapping.questions
            .map((qId: string) => allQuestions.find(q => q.id === qId))
            .filter((q: Question | undefined): q is Question => q !== undefined);
          
          if (sectionQuestions.length > 0) {
            legacySections.push({
              id: `section-${index + 1}`,
              type: mapping.type,
              timeLimit: mapping.timeLimit,
              content: "",
              descriptionImageUrls: [],
              descriptionAudioUrl: "",
              questions: sectionQuestions
            });
          }
        }
      });
      
      return legacySections;
    }
  }, []);

  // Load exam sections when exam data is available
  useEffect(() => {
    if (exam && allQuestions.length > 0) {
      console.log("Loading exam sections for taking:", exam);
      const derivedSections = deriveExamSections(exam, allQuestions);
      setExamSections(derivedSections);
    }
  }, [exam, allQuestions, deriveExamSections]);

  // Helper functions for section management
  const getCurrentSection = () => {
    return examSections[currentSectionIndex];
  };

  const getSectionConfig = () => {
    const currentSection = getCurrentSection();
    if (!currentSection) return null;
    
    const iconMap = {
      "từ vựng": BookOpen,
      "ngữ pháp": MessageSquare,
      "đọc hiểu": FileInput,
      "nghe hiểu": Headphones,
    };
    
    const colorMap = {
      "từ vựng": "bg-green-500",
      "ngữ pháp": "bg-blue-500", 
      "đọc hiểu": "bg-purple-500",
      "nghe hiểu": "bg-yellow-500",
    };
    
    return {
      title: currentSection.type.charAt(0).toUpperCase() + currentSection.type.slice(1),
      icon: iconMap[currentSection.type],
      color: colorMap[currentSection.type],
      timeLimit: currentSection.timeLimit,
      questions: currentSection.questions
    };
  };

  // Initialize section when current section changes
  useEffect(() => {
    if (examSections.length > 0 && currentSectionIndex < examSections.length) {
      setCurrentQuestionIndex(0);
      setSectionCompleted(false);
      setSectionAnswers({});
    }
  }, [currentSectionIndex, examSections]);

  // Initialize section timer when section starts
  useEffect(() => {
    if (examStarted && examSections.length > 0 && currentSectionIndex < examSections.length) {
      const currentSection = examSections[currentSectionIndex];
      setSectionTimeLeft(currentSection.timeLimit * 60); // Convert minutes to seconds
    }
  }, [currentSectionIndex, examStarted, examSections]);

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

  // Check if exam is in progress (started but not all sections completed)
  const isExamInProgress = examStarted && completedSections.size < examSections.length;
  
  // Debug logging
  useEffect(() => {
    console.log('Exam progress state:', {
      examStarted,
      completedSections: completedSections.size,
      isExamInProgress
    });
  }, [examStarted, completedSections.size, isExamInProgress]);

  // Comprehensive exit confirmation
  useEffect(() => {
    if (!isExamInProgress) return;

    // Handle browser back/forward navigation
    const handlePopState = (e: PopStateEvent) => {
      console.log('Browser navigation detected during exam');
      e.preventDefault();
      // Show custom dialog instead of window.confirm
      setPendingExitAction(() => () => {
        // Allow navigation by not pushing back to history
        console.log('User confirmed navigation via browser back/forward');
      });
      setShowExitDialog(true);
      // Always push back to stay on page until user decides
      window.history.pushState(null, '', window.location.href);
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F5, Ctrl+R refresh
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        showExitConfirmation();
      }
      // Block Alt+F4, Ctrl+W close
      if ((e.altKey && e.key === 'F4') || (e.ctrlKey && e.key === 'w')) {
        e.preventDefault();
        showExitConfirmation();
      }
    };

    // Intercept all link clicks during exam
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href && !link.href.includes('#')) {
        console.log('Link click detected during exam:', link.href);
        e.preventDefault();
        e.stopPropagation();
        
        // Extract path from link.href for router navigation
        const url = new URL(link.href);
        const targetPath = url.pathname;
        console.log('Extracted target path:', targetPath);
        
        // Use router navigation for speed
        setPendingNavigation(targetPath);
        setShowExitDialog(true);
      }
    };

    // Add a history entry to detect back button
    window.history.pushState(null, '', window.location.href);
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleLinkClick, true); // Use capture phase
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [isExamInProgress]);

  // Show immediate exit confirmation
  const showExitConfirmation = () => {
    if (isExamInProgress) {
      // Use router navigation for speed
      setPendingNavigation("/online-exam");
      setShowExitDialog(true);
    }
  };

  // Handle exit confirmation
  const handleExitConfirm = () => {
    console.log('User confirmed exit via custom dialog');
    
    // Clean up immediately
    setPendingExitAction(null);
    setPendingNavigation(null);
    setShowExitDialog(false);
    
    // Navigate immediately if there's a pending navigation
    if (pendingNavigation) {
      console.log('Navigating immediately to:', pendingNavigation);
      setLocation(pendingNavigation);
      return;
    }
    
    // Execute pending exit action immediately
    if (pendingExitAction) {
      console.log('Executing immediate exit action');
      pendingExitAction();
    }
  };

  const handleExitCancel = () => {
    console.log('User cancelled exit via custom dialog');
    setShowExitDialog(false);
    setPendingExitAction(null);
    setPendingNavigation(null);
  };

  // Custom setLocation with immediate confirmation (kept for compatibility)
  const handleNavigateWithConfirm = (path: string) => {
    console.log('Navigation attempt:', { path, isExamInProgress });
    if (isExamInProgress) {
      console.log('Showing exit confirmation dialog');
      setPendingNavigation(path);
      setShowExitDialog(true);
    } else {
      console.log('Navigation allowed directly');
      setLocation(path);
    }
  };

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
    if (!sectionConfig) return;
    
    const currentSection = getCurrentSection();
    if (!currentSection) return;
    
    const timeSpent = ((sectionConfig?.timeLimit || 0) * 60) - sectionTimeLeft;
    const score = calculateSectionScore(sectionAnswers, currentSection.questions);
    
    // Save section results
    const results: SectionResults = {
      answers: sectionAnswers,
      timeSpent,
      score
    };
    
    setSectionResults(prev => ({
      ...prev,
      [currentSection.id]: results
    }));
    
    setCompletedSections(prev => new Set([...Array.from(prev), currentSection.id]));
    
    // Mark section as completed and wait for user to proceed
    setSectionCompleted(true);
  }, [getCurrentSection, sectionAnswers, sectionTimeLeft, isSubmitting]);

  // Handle manual progression to next section
  const handleProceedToNext = useCallback(() => {
    const nextSectionIndex = currentSectionIndex + 1;
    if (nextSectionIndex < examSections.length) {
      setSectionCompleted(false);
      setWaitStartTime(Date.now());
      setCurrentSectionIndex(nextSectionIndex);
    } else {
      // All sections completed, submit final exam
      handleFinalSubmit();
    }
  }, [currentSectionIndex, examSections.length]);

  // Handle section time up
  const handleSectionTimeUp = useCallback(() => {
    handleSectionComplete();
  }, [handleSectionComplete]);

  // Helper function to check if there's a next section
  const hasNextSection = (): boolean => {
    return currentSectionIndex + 1 < examSections.length;
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
    const currentSection = getCurrentSection();
    if (currentSection && currentQuestionIndex < currentSection.questions.length - 1) {
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
    // Calculate totals from dynamic sections
    const totalTime = examSections.reduce((sum, section) => sum + section.timeLimit, 0);
    const totalQuestions = examSections.reduce((sum, section) => sum + section.questions.length, 0);
    
    // Get section icon and color
    const getSectionIcon = (type: string) => {
      const iconMap = {
        "từ vựng": BookOpen,
        "ngữ pháp": MessageSquare,
        "đọc hiểu": FileInput,
        "nghe hiểu": Headphones,
      };
      return iconMap[type as keyof typeof iconMap] || FileText;
    };
    
    const getSectionColor = (type: string) => {
      const colorMap = {
        "từ vựng": "text-green-600",
        "ngữ pháp": "text-blue-600", 
        "đọc hiểu": "text-purple-600",
        "nghe hiểu": "text-yellow-600",
      };
      return colorMap[type as keyof typeof colorMap] || "text-gray-600";
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* Left Column - Exam Overview */}
            <div className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <FileText className="w-8 h-8" data-testid="exam-icon" />
                    <div>
                      <CardTitle className="text-2xl" data-testid="exam-title">{exam?.title}</CardTitle>
                      <p className="text-blue-100 mt-1" data-testid="exam-description">
                        {exam?.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-600" data-testid="total-time">
                        {totalTime}
                      </div>
                      <div className="text-sm text-gray-600">phút</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-600" data-testid="total-questions">
                        {totalQuestions}
                      </div>
                      <div className="text-sm text-gray-600">câu hỏi</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Eye className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                          <strong>Lưu ý quan trọng:</strong> Bạn không thể quay lại phần trước đã hoàn thành. 
                          Hãy cân nhắc kỹ trước khi chuyển sang phần tiếp theo.
                        </div>
                      </div>
                    </div>

                    {!user && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Volume2 className="w-5 h-5 text-orange-600 mt-0.5" />
                          <div className="text-sm text-orange-800">
                            <strong>Thông báo:</strong> Bạn đang thi với tư cách khách. 
                            Kết quả sẽ không được lưu vào hệ thống.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4">
                      <Button 
                        onClick={startExam} 
                        size="lg" 
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        data-testid="button-start-exam"
                      >
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-5 h-5" />
                          Bắt đầu làm bài
                        </div>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={() => handleNavigateWithConfirm("/online-exam")}
                        className="w-full mt-3"
                        data-testid="button-back-to-list"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Quay về danh sách đề thi
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Section Timeline */}
            <div className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Cấu trúc bài thi ({examSections.length} phần)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {examSections.map((section, index) => {
                      const SectionIcon = getSectionIcon(section.type);
                      const sectionColor = getSectionColor(section.type);
                      
                      return (
                        <div 
                          key={section.id} 
                          className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          data-testid={`section-preview-${index}`}
                        >
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                              <SectionIcon className={`w-5 h-5 ${sectionColor}`} />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-gray-900">
                                {index + 1}. {section.type.charAt(0).toUpperCase() + section.type.slice(1)}
                              </h4>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {section.timeLimit} phút
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {section.questions.length} câu
                                </span>
                              </div>
                            </div>
                            
                            {section.content && (
                              <p className="text-sm text-gray-600 truncate">
                                {section.content}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2">
                              {section.descriptionImageUrls && section.descriptionImageUrls.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <Eye className="w-3 h-3 mr-1" />
                                  {section.descriptionImageUrls.length} hình ảnh
                                </Badge>
                              )}
                              {section.descriptionAudioUrl && (
                                <Badge variant="secondary" className="text-xs">
                                  <Volume2 className="w-3 h-3 mr-1" />
                                  Audio
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
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
              <Button variant="outline" onClick={() => handleNavigateWithConfirm("/login")}>
                Đăng nhập
              </Button>
              <Button onClick={() => handleNavigateWithConfirm("/online-exam")}>
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
              <Button onClick={() => handleNavigateWithConfirm("/online-exam")}>
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
            <Button onClick={() => handleNavigateWithConfirm("/online-exam")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSection = getCurrentSection();
  const currentQuestion = currentSection?.questions[currentQuestionIndex];
  const progress = currentSection?.questions.length > 0 ? ((currentQuestionIndex + 1) / currentSection.questions.length) * 100 : 0;
  const answeredCount = Object.keys(sectionAnswers).length;
  const sectionConfig = getSectionConfig();
  const SectionIcon = sectionConfig?.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${sectionConfig?.color || 'bg-blue-500'} text-white`}>
                  {SectionIcon && <SectionIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {sectionConfig?.title || 'Đang tải'} - {exam.title}
                  </h1>
                  <p className="text-sm text-gray-600">
                    Câu {currentQuestionIndex + 1} / {currentSection?.questions.length || 0}
                  </p>
                </div>
              </div>
              {/* Dynamic Section Progress Indicator */}
              <div className="flex items-center gap-2">
                {examSections.map((section, index) => (
                  <div key={section.id} className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${
                      completedSections.has(section.id) ? 'bg-green-500' :
                      currentSectionIndex === index ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                    {index < examSections.length - 1 && <div className="w-6 h-0.5 bg-gray-300 mx-1" />}
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
                disabled={isSubmitting || sectionCompleted}
              >
                {hasNextSection() ? "Hoàn thành phần này" : "Nộp bài"}
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
          </div>
        </div>
      </div>

      {/* Section Completion Overlay */}
      {sectionCompleted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardContent className="text-center py-8">
              <div className="mb-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Hoàn thành phần {sectionConfig?.title || 'Đang tải'}!
                </h3>
                <p className="text-gray-600 mb-6">
                  Bạn đã hoàn thành phần thi này. {hasNextSection() 
                    ? "Nhấn nút bên dưới để chuyển sang phần tiếp theo."
                    : "Nhấn nút bên dưới để nộp bài thi."
                  }
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm text-gray-500">
                  <p>Điểm số: {sectionResults[getCurrentSection()?.id || '']?.score || 0}%</p>
                  <p>Thời gian: {formatTime(((sectionConfig?.timeLimit || 0) * 60) - sectionTimeLeft)}</p>
                </div>
                
                <Button 
                  onClick={handleProceedToNext}
                  className="w-full"
                  size="lg"
                >
                  {hasNextSection() 
                    ? `Chuyển sang phần tiếp theo`
                    : "Nộp bài thi"
                  }
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Section Description */}
          {currentSection && (currentSection.content || (currentSection.descriptionImageUrls && currentSection.descriptionImageUrls.length > 0) || currentSection.descriptionAudioUrl) && (
            <div className="lg:col-span-3 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-green-600">
                    Phần {currentSectionIndex + 1}: {currentSection.type}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Section Description Text */}
                  {currentSection.content && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {currentSection.content}
                      </p>
                    </div>
                  )}
                  
                  {/* Section Description Images */}
                  {currentSection.descriptionImageUrls && currentSection.descriptionImageUrls.length > 0 && (
                    <div className="flex justify-center flex-wrap gap-4">
                      {currentSection.descriptionImageUrls.map((imageUrl: string, index: number) => (
                        <img
                          key={index}
                          src={imageUrl}
                          alt={`Section description ${index + 1}`}
                          className="max-w-full h-auto rounded-lg shadow-sm max-h-48"
                          data-testid={`section-image-${index}`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Section Description Audio */}
                  {currentSection.descriptionAudioUrl && (
                    <div className="flex justify-center">
                      <audio 
                        controls 
                        className="w-full max-w-md" 
                        data-testid="section-audio"
                        key={`section-audio-${currentSectionIndex}`}
                      >
                        <source src={currentSection.descriptionAudioUrl.startsWith('/api/') 
                          ? currentSection.descriptionAudioUrl 
                          : `/api/temp-description-audio/${currentSection.descriptionAudioUrl}`} 
                          type="audio/mpeg" />
                        <source src={currentSection.descriptionAudioUrl.startsWith('/api/') 
                          ? currentSection.descriptionAudioUrl 
                          : `/api/temp-description-audio/${currentSection.descriptionAudioUrl}`} 
                          type="audio/wav" />
                        Trình duyệt của bạn không hỗ trợ phát audio.
                      </audio>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Question Content */}
          <div className="lg:col-span-3">
            {!currentQuestion ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Đang tải câu hỏi...</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Câu {currentQuestionIndex + 1}: {currentQuestion.questionText}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Question Images */}
                  {((currentQuestion as any).imageUrls && (currentQuestion as any).imageUrls.length > 0) || (currentQuestion as any).imageUrl ? (
                    <div className="flex justify-center flex-wrap gap-4">
                      {/* Show imageUrls array first (new format) */}
                      {(currentQuestion as any).imageUrls && (currentQuestion as any).imageUrls.map((imageUrl: string, index: number) => (
                        <img
                          key={index}
                          src={imageUrl}
                          alt={`Question illustration ${index + 1}`}
                          className="max-w-full h-auto rounded-lg shadow-sm max-h-64"
                        />
                      ))}
                      {/* Show single imageUrl if no imageUrls (legacy support) */}
                      {(currentQuestion as any).imageUrl && (!(currentQuestion as any).imageUrls || (currentQuestion as any).imageUrls.length === 0) && (
                        <img
                          src={(currentQuestion as any).imageUrl}
                          alt="Question illustration"
                          className="max-w-full h-auto rounded-lg shadow-sm max-h-64"
                        />
                      )}
                    </div>
                  ) : null}

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
                    value={sectionAnswers[currentQuestion.id] || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    {(currentQuestion.options as any[]).map((option: any, index: number) => {
                      const optionText = typeof option === 'string' ? option : option.text;
                      const optionImageUrl = typeof option === 'string' ? '' : option.imageUrl;
                      const optionImageUrls = typeof option === 'string' ? [] : (option.imageUrls || []);
                      
                      return (
                        <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                          <RadioGroupItem 
                            value={index.toString()} 
                            id={`option-${index}`} 
                            className="mt-1"
                          />
                          <div className="flex-1 cursor-pointer">
                            <Label 
                              htmlFor={`option-${index}`} 
                              className="cursor-pointer flex flex-col space-y-2"
                            >
                              <span className="text-sm">
                                {String.fromCharCode(65 + index)}. {optionText}
                              </span>
                              
                              {/* Display multiple option images (new format) */}
                              {optionImageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {optionImageUrls.map((imageUrl: string, imgIndex: number) => (
                                    <img
                                      key={imgIndex}
                                      src={imageUrl}
                                      alt={`Option ${String.fromCharCode(65 + index)} illustration ${imgIndex + 1}`}
                                      className="max-w-full h-auto rounded-md shadow-sm max-h-48"
                                    />
                                  ))}
                                </div>
                              )}
                              
                              {/* Display single option image (legacy format) */}
                              {optionImageUrl && optionImageUrls.length === 0 && (
                                <img
                                  src={optionImageUrl}
                                  alt={`Option ${String.fromCharCode(65 + index)} illustration`}
                                  className="max-w-full h-auto rounded-md shadow-sm max-h-48"
                                />
                              )}
                            </Label>
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Navigation - Within Section Only */}
            {currentQuestion && (
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0 || sectionCompleted}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Câu trước
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={currentQuestionIndex === (currentSection?.questions.length || 0) - 1 || sectionCompleted}
                >
                  Câu sau
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>

          {/* Section Overview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {SectionIcon && <SectionIcon className="w-4 h-4" />}
                  {sectionConfig?.title || 'Đang tải'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm">
                    <p className="font-medium">Đã trả lời: {answeredCount}/{currentSection?.questions.length || 0}</p>
                    <Progress value={((currentSection?.questions.length || 0) > 0) ? (answeredCount / (currentSection?.questions.length || 1)) * 100 : 0} className="mt-2" />
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {(currentSection?.questions || []).map((question, index) => {
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

                  {/* Dynamic Section Navigation Info */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-sm mb-2">Tiến độ bài thi ({examSections.length} phần)</h4>
                    <div className="space-y-2 text-xs">
                      {examSections.map((section, index) => {
                        const iconMap = {
                          "từ vựng": BookOpen,
                          "ngữ pháp": MessageSquare,
                          "đọc hiểu": FileInput,
                          "nghe hiểu": Headphones,
                        };
                        const SectionIcon = iconMap[section.type] || FileText;
                        
                        return (
                          <div key={section.id} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              completedSections.has(section.id) ? 'bg-green-500' :
                              currentSectionIndex === index ? 'bg-blue-500' : 'bg-gray-300'
                            }`} />
                            <SectionIcon className="w-3 h-3 text-gray-500" />
                            <span className={`flex-1 ${
                              currentSectionIndex === index ? 'font-medium' : ''
                            }`}>
                              {index + 1}. {section.type.charAt(0).toUpperCase() + section.type.slice(1)}
                            </span>
                            <span className="text-gray-500">
                              {section.questions.length} câu
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
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasNextSection() ? `Hoàn thành phần ${sectionConfig?.title || 'Đang tải'}` : "Hoàn thành bài thi"}
            </DialogTitle>
            <DialogDescription>
              {hasNextSection() ? (
                <>
                  Bạn có chắc chắn muốn hoàn thành phần {sectionConfig?.title || 'Đang tải'} không?
                  <br />
                  <br />
                  <strong>Thống kê phần này:</strong>
                  <br />
                  • Đã trả lời: {answeredCount}/{currentSection?.questions.length || 0} câu
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
                  • Đã trả lời: {answeredCount}/{currentSection?.questions.length || 0} câu
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
              {hasNextSection() ? "Tiếp tục làm bài" : "Xem lại bài"}
            </Button>
            <Button onClick={handleSectionComplete} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {hasNextSection() ? "Đang chuyển phần..." : "Đang nộp bài..."}
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {hasNextSection() ? "Chuyển phần tiếp theo" : "Nộp bài"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Xác nhận</DialogTitle>
            <DialogDescription className="text-base">
              Bạn đang làm bài thi, bạn có rời bài thi không?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={handleExitCancel}
              data-testid="button-cancel-exit"
            >
              Hủy
            </Button>
            <Button 
              onClick={handleExitConfirm}
              data-testid="button-confirm-exit"
              className="bg-red-600 hover:bg-red-700"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ExamTakingPage;