import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, FileText, CheckCircle, ArrowRight, Volume2, Eye, BookOpen, MessageSquare, Headphones, FileInput, ShoppingCart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { type Exam, type Question, type User } from "@shared/schema";
import { ExamAudioPlayer } from "@/components/ExamAudioPlayer";
import { ExamProtectedContent, ProtectedExamImage } from "@/components/ExamProtectedContent";
import { examKeys } from "@/lib/queryKeys";
import { resolveExamMediaUrl } from "@/lib/examMediaUrl";
import {
  EXAM_PACKAGE_PRICE_VND,
  EXAM_TRIAL_QUESTION_LIMIT,
  type ExamAccessMode,
  truncateSectionsForTrial,
  countAnsweredScorableUnits,
  collectTrialQuestionIdsFromSections,
  countScorableUnits,
} from "@shared/examAccess";

// Fisher-Yates shuffle algorithm to randomize question order
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const EXAM_DRAFT_VERSION = 2;

// Dynamic section structure - same as create-exam and edit-exam
interface ExamSection {
  id: string;
  sectionName: string;
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

type ExamDraft = {
  version: number;
  attemptId: string | null;
  examStarted: boolean;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  sectionTimeLeft: number;
  sectionAnswers: Record<string, string>;
  completedSections: string[];
  sectionResults: Record<string, SectionResults>;
  examSections: ExamSection[];
  waitStartTime: number | null;
  sectionCompleted: boolean;
};

function examDraftKey(examId: string) {
  return `exam-draft:${examId}`;
}

function loadExamDraft(examId: string): ExamDraft | null {
  try {
    const raw = sessionStorage.getItem(examDraftKey(examId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExamDraft;
    if (parsed?.version !== EXAM_DRAFT_VERSION || !Array.isArray(parsed.examSections)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveExamDraft(examId: string, draft: ExamDraft) {
  try {
    sessionStorage.setItem(examDraftKey(examId), JSON.stringify(draft));
  } catch {
    // Ignore quota / private mode errors
  }
}

function clearExamDraft(examId: string) {
  try {
    sessionStorage.removeItem(examDraftKey(examId));
  } catch {
    // ignore
  }
}

interface ExamTakingPageProps {
  examId: string;
}

export function ExamTakingPage({ examId }: ExamTakingPageProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { addPackage } = useCart();
  const { toast } = useToast();
  
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
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [accessMode, setAccessMode] = useState<ExamAccessMode>("full");
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [sectionsReady, setSectionsReady] = useState(false);
  const purchaseNavRef = useRef<"home" | "cart" | null>(null);
  const trialSubmitTriggeredRef = useRef(false);

  // Derive/shuffle sections only once (or restore from draft) — avoid wiping answers/timer
  const sectionsInitializedRef = useRef(false);

  // User data is now handled by useAuth hook

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: examKeys.detail(examId),
    retry: false,
  });

  const { data: examAccess, isFetched: examAccessFetched, isError: examAccessError } = useQuery<{
    mode: ExamAccessMode;
    reason?: string;
    requiresLogin?: boolean;
    requiresPurchase?: boolean;
    level?: string | null;
    packageId?: string | null;
    priceVnd?: number;
  }>({
    queryKey: ["/api/exams", examId, "access"],
    queryFn: async () => {
      const res = await fetch(`/api/exams/${examId}/access`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("access");
      return res.json();
    },
    enabled: !!examId,
    retry: false,
  });

  // Fetch all questions
  const { data: allQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: examKeys.questions(examId),
    enabled: !!examId && !!exam,
    retry: false,
  });

  useEffect(() => {
    if (examAccess?.mode) setAccessMode(examAccess.mode);
  }, [examAccess?.mode]);

  const linkedPackageId =
    examAccess?.packageId ||
    (exam as { packageId?: string | null } | undefined)?.packageId ||
    null;

  const { data: storePackages = [] } = useQuery<
    Array<{ id: string; level: string | null; name: string }>
  >({
    queryKey: ["/api/exam-packages"],
    enabled: showPurchaseDialog && !linkedPackageId && !!examAccess?.level,
    retry: false,
  });

  const purchasePackageId =
    linkedPackageId ||
    (examAccess?.level
      ? storePackages.find((p) => p.level === examAccess.level)?.id
      : null);

  const purchasePriceVnd =
    examAccess?.priceVnd ?? EXAM_PACKAGE_PRICE_VND;

  const handlePurchaseDismiss = useCallback(() => {
    clearExamDraft(examId);
    setShowPurchaseDialog(false);
    setLocation("/");
  }, [examId, setLocation]);

  const handlePurchaseAddToCart = useCallback(() => {
    if (!purchasePackageId) {
      toast({
        title: "Chưa xác định được gói đề",
        description: "Vui lòng chọn gói trên trang chủ.",
        variant: "destructive",
      });
      handlePurchaseDismiss();
      return;
    }

    purchaseNavRef.current = "cart";
    setShowPurchaseDialog(false);
    addPackage.mutate(purchasePackageId, {
      onSuccess: () => {
        clearExamDraft(examId);
        purchaseNavRef.current = null;
        toast({ title: "Đã thêm vào giỏ", description: "Chuyển tới thanh toán." });
        setLocation("/cart");
      },
      onError: (err: Error) => {
        purchaseNavRef.current = null;
        toast({
          title: "Không thêm được vào giỏ",
          description: err.message || "Thử lại sau.",
          variant: "destructive",
        });
      },
    });
  }, [
    addPackage,
    examId,
    handlePurchaseDismiss,
    purchasePackageId,
    setLocation,
    toast,
  ]);

  const applyTrialLimit = useCallback(
    (sections: ExamSection[], mode: ExamAccessMode) => {
      if (mode !== "trial") return sections;
      return truncateSectionsForTrial(sections, EXAM_TRIAL_QUESTION_LIMIT);
    },
    [],
  );

  // Shared function to derive sections from exam data
  const deriveExamSections = useCallback((exam: any, allQuestions: Question[]): ExamSection[] => {
    if (!exam || !allQuestions.length) return [];
    
    // Handle both new sections format and legacy format
    if (exam.sections && Array.isArray(exam.sections) && exam.sections.length > 0) {
      // New sections-based format
      const sectionsWithQuestions = exam.sections.map((section: any) => {
        // Map questions with their question set names
        let questionsWithSetNames: Array<Question & { questionSetName?: string }> = [];
        
        if (section.questionSets && Array.isArray(section.questionSets)) {
          // New structure: process each question set to attach set name and shuffle within each set
          section.questionSets.forEach((qs: any) => {
            const setIds = Array.isArray(qs.questionIds)
              ? qs.questionIds
              : Array.isArray(qs.questions)
                ? qs.questions
                    .map((q: any) => (typeof q === "string" ? q : q?.id))
                    .filter(Boolean)
                : [];
            const setQuestions = setIds
              .map((qId: string) => {
                const question = allQuestions.find(q => q.id === qId);
                if (question) {
                  return {
                    ...question,
                    questionSetName: qs.name || "Bộ câu hỏi"
                  };
                }
                return undefined;
              })
              .filter((q: any): q is Question & { questionSetName: string } => q !== undefined);
            
            // Shuffle questions within this question set only
            const shuffledSetQuestions = shuffleArray<Question & { questionSetName: string }>(setQuestions);
            questionsWithSetNames.push(...shuffledSetQuestions);
          });
        } else if (section.questionIds) {
          // Legacy structure: use questionIds directly without set names
          questionsWithSetNames = section.questionIds
            .map((qId: string) => allQuestions.find(q => q.id === qId))
            .filter((q: Question | undefined): q is Question => q !== undefined);
        }
        
        // For legacy format (no question sets), shuffle all questions in the section
        // For new format with question sets, questions are already shuffled within each set
        const shuffledQuestions = section.questionSets ? questionsWithSetNames : shuffleArray(questionsWithSetNames);
        
        return {
          id: section.id,
          sectionName: section.sectionName || section.type || "",
          timeLimit: section.timeLimit,
          content: section.content || "",
          descriptionImageUrls: section.descriptionImageUrls || [],
          descriptionAudioUrl: section.descriptionAudioUrl || "",
          questions: shuffledQuestions
        };
      });
      return sectionsWithQuestions.filter((s: ExamSection) => s.questions.length > 0);
    } else {
      // Legacy format with separate question arrays
      const legacySections: ExamSection[] = [];
      
      // Map legacy fields to sections
      const legacyMapping = [
        { sectionName: "Từ vựng", questions: (exam as any).vocabularyQuestions || [], timeLimit: (exam as any).vocabularyTimeLimit || 10 },
        { sectionName: "Ngữ pháp", questions: (exam as any).grammarQuestions || [], timeLimit: (exam as any).grammarTimeLimit || 10 },
        { sectionName: "Đọc hiểu", questions: (exam as any).readingQuestions || [], timeLimit: (exam as any).readingTimeLimit || 10 },
        { sectionName: "Nghe hiểu", questions: (exam as any).listeningQuestions || [], timeLimit: (exam as any).listeningTimeLimit || 10 }
      ];
      
      legacyMapping.forEach((mapping, index) => {
        if (mapping.questions.length > 0) {
          const sectionQuestions = mapping.questions
            .map((qId: string) => allQuestions.find(q => q.id === qId))
            .filter((q: Question | undefined): q is Question => q !== undefined);
          
          if (sectionQuestions.length > 0) {
            // Shuffle questions for random order each time exam is taken
            const shuffledQuestions = shuffleArray<Question>(sectionQuestions);
            
            legacySections.push({
              id: `section-${index + 1}`,
              sectionName: mapping.sectionName,
              timeLimit: mapping.timeLimit,
              content: "",
              descriptionImageUrls: [],
              descriptionAudioUrl: "",
              questions: shuffledQuestions
            });
          }
        }
      });
      
      return legacySections;
    }
  }, []);

  // Load exam sections once when exam data is available (restore draft if present)
  useEffect(() => {
    if (sectionsInitializedRef.current) return;
    if (!exam || allQuestions.length === 0) return;

    const restore = async () => {
      const draft = loadExamDraft(examId);
      let serverAttempt: any = null;

      if (draft?.attemptId) {
        try {
          const res = await fetch(`/api/exam-attempts/${draft.attemptId}`, {
            credentials: "include",
          });
          if (res.ok) {
            serverAttempt = await res.json();
          }
        } catch {
          // ignore — fall back to local draft / fresh start
        }
      }

      if (serverAttempt?.status === "in_progress") {
        const cs = (serverAttempt.clientState || {}) as any;
        let sections =
          (cs.examSections?.length ? cs.examSections : draft?.examSections) ||
          deriveExamSections(exam, allQuestions);
        const modeFromCs = (cs.accessMode || examAccess?.mode) as ExamAccessMode | undefined;
        if (modeFromCs === "trial") {
          sections = truncateSectionsForTrial(sections, EXAM_TRIAL_QUESTION_LIMIT);
        }
        setExamSections(sections);
        setAttemptId(serverAttempt.id);
        setExamStarted(true);
        if (modeFromCs) setAccessMode(modeFromCs);
        const idx = cs.currentSectionIndex ?? draft?.currentSectionIndex ?? 0;
        setCurrentSectionIndex(idx);
        setCurrentQuestionIndex(cs.currentQuestionIndex ?? draft?.currentQuestionIndex ?? 0);
        setSectionAnswers(
          cs.currentSectionAnswers || draft?.sectionAnswers || {}
        );
        setCompletedSections(
          new Set(cs.completedSections || draft?.completedSections || [])
        );
        setSectionResults(cs.sectionResults || draft?.sectionResults || {});
        setSectionCompleted(!!(cs.sectionCompleted ?? draft?.sectionCompleted));
        const section = sections[idx];
        const limitSec = section ? section.timeLimit * 60 : 0;
        let remaining = draft?.sectionTimeLeft ?? limitSec;
        if (serverAttempt.sectionStartedAt && section && !cs.sectionCompleted) {
          const elapsed = Math.floor(
            (Date.now() - new Date(serverAttempt.sectionStartedAt).getTime()) / 1000
          );
          remaining = Math.max(0, limitSec - elapsed);
        }
        setSectionTimeLeft(remaining);
        sectionsInitializedRef.current = true;
        setSectionsReady(true);
        return;
      }

      if (draft && draft.examSections.length > 0 && draft.version === EXAM_DRAFT_VERSION) {
        // Local-only draft without valid server session — keep UI but clear attemptId
        setExamSections(draft.examSections);
        setAttemptId(null);
        setExamStarted(false);
        setCurrentSectionIndex(0);
        setCurrentQuestionIndex(0);
        setSectionAnswers({});
        setCompletedSections(new Set());
        setSectionResults({});
        setSectionCompleted(false);
        sectionsInitializedRef.current = true;
        setSectionsReady(true);
        return;
      }

      let sections = deriveExamSections(exam, allQuestions);
      if (!examAccess) {
        if (!examAccessFetched) return;
      } else if (examAccess.mode === "trial") {
        sections = truncateSectionsForTrial(sections, EXAM_TRIAL_QUESTION_LIMIT);
      }
      setExamSections(sections);
      sectionsInitializedRef.current = true;
      setSectionsReady(true);
    };

    void restore();
  }, [exam, allQuestions, deriveExamSections, examId, examAccess, examAccessFetched]);

  // Persist local cache + server draft while in progress
  useEffect(() => {
    if (!examStarted || examSections.length === 0) return;
    saveExamDraft(examId, {
      version: EXAM_DRAFT_VERSION,
      attemptId,
      examStarted,
      currentSectionIndex,
      currentQuestionIndex,
      sectionTimeLeft,
      sectionAnswers,
      completedSections: Array.from(completedSections),
      sectionResults,
      examSections,
      waitStartTime,
      sectionCompleted,
    });
  }, [
    examId,
    attemptId,
    examStarted,
    accessMode,
    currentSectionIndex,
    currentQuestionIndex,
    sectionTimeLeft,
    sectionAnswers,
    completedSections,
    sectionResults,
    examSections,
    waitStartTime,
    sectionCompleted,
  ]);

  // Debounced server-side draft save
  useEffect(() => {
    if (!attemptId || !examStarted || sectionCompleted) return;
    const timer = setTimeout(() => {
      void fetch(`/api/exam-attempts/${attemptId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientState: {
            accessMode,
            currentSectionIndex,
            currentQuestionIndex,
            completedSections: Array.from(completedSections),
            sectionResults,
            sectionCompleted,
            examSections: examSections.map((s) => ({
              ...s,
            })),
          },
          currentSectionAnswers: sectionAnswers,
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    attemptId,
    examStarted,
    accessMode,
    sectionCompleted,
    sectionAnswers,
    currentSectionIndex,
    currentQuestionIndex,
    completedSections,
    sectionResults,
    examSections,
  ]);

  // Helper functions for section management
  const getCurrentSection = () => {
    return examSections[currentSectionIndex];
  };

  const getSectionConfig = () => {
    const currentSection = getCurrentSection();
    if (!currentSection) return null;
    
    return {
      title: currentSection.sectionName || (currentSection as any).type || `Phần ${currentSectionIndex + 1}`,
      icon: FileText,
      color: "bg-green-500",
      timeLimit: currentSection.timeLimit,
      questions: currentSection.questions
    };
  };

  // Scroll to top when switching questions or sections
  useEffect(() => {
    if (examStarted) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentQuestionIndex, currentSectionIndex, examStarted]);

  // Check if exam is in progress (started but not all sections completed)
  const isExamInProgress = examStarted && completedSections.size < examSections.length;

  // Warn on tab close / refresh while exam in progress
  useEffect(() => {
    if (!isExamInProgress) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isExamInProgress]);

  // Comprehensive exit confirmation
  useEffect(() => {
    if (!isExamInProgress) return;

    // Handle browser back/forward navigation
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Show custom dialog instead of window.confirm
      setPendingExitAction(() => () => {
        // Allow navigation by not pushing back to history
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
        e.preventDefault();
        e.stopPropagation();
        
        // Extract path from link.href for router navigation
        const url = new URL(link.href);
        const targetPath = url.pathname;
        
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
      setPendingNavigation("/");
      setShowExitDialog(true);
    }
  };

  // Handle exit confirmation
  const handleExitConfirm = () => {
    const nav = pendingNavigation;
    const exitAction = pendingExitAction;
    setPendingExitAction(null);
    setPendingNavigation(null);
    setShowExitDialog(false);

    if (nav) {
      setLocation(nav);
      return;
    }
    if (exitAction) {
      exitAction();
    }
  };

  const handleExitCancel = () => {
    setShowExitDialog(false);
    setPendingExitAction(null);
    setPendingNavigation(null);
  };

  // Custom setLocation with immediate confirmation (kept for compatibility)
  const handleNavigateWithConfirm = (path: string) => {
    if (isExamInProgress) {
      setPendingNavigation(path);
      setShowExitDialog(true);
    } else {
      setLocation(path);
    }
  };

  // Submit / session APIs
  const submitExamMutation = useMutation({
    mutationFn: async (payload: {
      attemptId: string;
      sectionId: string;
      answers: Record<string, string>;
    }) => {
      const response = await fetch(`/api/exam-attempts/${payload.attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sectionId: payload.sectionId,
          answers: payload.answers,
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to submit exam");
      }
      return response.json();
    },
    onSuccess: (result) => {
      clearExamDraft(examId);
      setIsSubmitting(false);
      setLocation(`/exam-result/${result.id}`);
    },
    onError: (error) => {
      console.error("Error submitting exam:", error);
      setIsSubmitting(false);
      trialSubmitTriggeredRef.current = false;
      toast({
        title: "Không nộp được bài thi",
        description: error instanceof Error ? error.message : "Thử lại sau.",
        variant: "destructive",
      });
    },
  });

  const completeSectionOnServer = async (
    id: string,
    sectionId: string,
    answers: Record<string, string>
  ) => {
    const response = await fetch(`/api/exam-attempts/${id}/complete-section`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sectionId, answers }),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || "Failed to complete section");
    }
    return response.json();
  };

  const startSectionOnServer = async (id: string, sectionId: string) => {
    const response = await fetch(`/api/exam-attempts/${id}/section-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sectionId }),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || "Failed to start section");
    }
    return response.json();
  };

  // Helper: Get total scorable units in a section (aligned with trial limit)
  const getTotalQuestionCount = (questions: Question[]) => {
    return questions.reduce(
      (sum, question) => sum + countScorableUnits(question as any),
      0,
    );
  };

  // Helper: Flatten all questions (parent + sub) into a single array
  const getAllQuestionsFlat = (questions: Question[]) => {
    const allQuestions: any[] = [];
    questions.forEach(question => {
      // Add parent question
      allQuestions.push(question);
      // Add sub-questions if they exist
      if ((question as any).subQuestions && Array.isArray((question as any).subQuestions)) {
        allQuestions.push(...(question as any).subQuestions);
      }
    });
    return allQuestions;
  };

  // Calculate section score based on points (includes parent questions + sub-questions)
  // Returns total points earned (not percentage)
  const calculateSectionScore = (answers: Record<string, string>, questions: Question[]) => {
    let earnedPoints = 0;
    const allQuestions = getAllQuestionsFlat(questions);
    
    allQuestions.forEach(question => {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correctAnswer;
      const questionPoints = parseFloat((question as any).points) || 1;
      
      if (isCorrect) {
        earnedPoints += questionPoints;
      }
    });
    
    return earnedPoints;
  };

  // Handle section completion
  const handleSectionComplete = useCallback(async () => {
    if (isSubmitting) return;
    if (!attemptId) return;
    
    const sectionConfig = getSectionConfig();
    if (!sectionConfig) return;
    
    const currentSection = getCurrentSection();
    if (!currentSection) return;
    
    const timeSpent = ((sectionConfig?.timeLimit || 0) * 60) - sectionTimeLeft;
    const score = calculateSectionScore(sectionAnswers, currentSection.questions);
    
    const results: SectionResults = {
      answers: sectionAnswers,
      timeSpent,
      score
    };
    
    const updatedSectionResults = {
      ...sectionResults,
      [currentSection.id]: results
    };
    
    setSectionResults(updatedSectionResults);
    setCompletedSections(prev => new Set([...Array.from(prev), currentSection.id]));
    
    const isLastSection = currentSectionIndex >= examSections.length - 1;
    
    if (isLastSection) {
      setIsSubmitting(true);
      submitExamMutation.mutate({
        attemptId,
        sectionId: currentSection.id,
        answers: sectionAnswers,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await completeSectionOnServer(attemptId, currentSection.id, sectionAnswers);
      setSectionCompleted(true);
    } catch (error) {
      console.error("Error completing section:", error);
      trialSubmitTriggeredRef.current = false;
      toast({
        title: "Không hoàn thành được phần thi",
        description: error instanceof Error ? error.message : "Thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [getCurrentSection, getSectionConfig, sectionAnswers, sectionTimeLeft, isSubmitting, sectionResults, currentSectionIndex, examSections, attemptId, submitExamMutation, toast]);

  // Handle final exam submission (after last section overlay)
  const handleFinalSubmit = useCallback(() => {
    if (isSubmitting || !attemptId) return;
    const lastSection = examSections[examSections.length - 1];
    if (!lastSection) return;
    setIsSubmitting(true);
    submitExamMutation.mutate({
      attemptId,
      sectionId: lastSection.id,
      answers: sectionResults[lastSection.id]?.answers || sectionAnswers,
    });
  }, [attemptId, examSections, sectionResults, sectionAnswers, isSubmitting, submitExamMutation]);

  // Handle manual progression to next section
  const handleProceedToNext = useCallback(async () => {
    const nextSectionIndex = currentSectionIndex + 1;
    if (nextSectionIndex < examSections.length) {
      const nextSection = examSections[nextSectionIndex];
      if (attemptId && nextSection) {
        try {
          await startSectionOnServer(attemptId, nextSection.id);
        } catch (error) {
          console.error("Error starting next section:", error);
          return;
        }
      }
      setSectionCompleted(false);
      setWaitStartTime(Date.now());
      setCurrentQuestionIndex(0);
      setSectionAnswers({});
      setSectionTimeLeft((nextSection?.timeLimit || 0) * 60);
      setCurrentSectionIndex(nextSectionIndex);
    } else {
      handleFinalSubmit();
    }
  }, [currentSectionIndex, examSections, attemptId, handleFinalSubmit]);

  // Handle section time up
  const handleSectionTimeUp = useCallback(() => {
    handleSectionComplete();
  }, [handleSectionComplete]);

  const triggerTrialSubmit = useCallback(() => {
    if (trialSubmitTriggeredRef.current || accessMode !== "trial") return;
    if (isSubmitting || sectionCompleted) return;
    trialSubmitTriggeredRef.current = true;
    void handleSectionComplete();
  }, [accessMode, handleSectionComplete, isSubmitting, sectionCompleted]);

  // Stable timer: one interval per section, not recreated every second
  const sectionTimeUpRef = useRef(handleSectionTimeUp);
  sectionTimeUpRef.current = handleSectionTimeUp;
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    timeUpFiredRef.current = false;
  }, [currentSectionIndex]);

  useEffect(() => {
    if (!examStarted || sectionCompleted || isSubmitting) return;
    const timer = setInterval(() => {
      setSectionTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [examStarted, sectionCompleted, currentSectionIndex, isSubmitting]);

  useEffect(() => {
    if (!examStarted || sectionCompleted || isSubmitting) return;
    if (sectionTimeLeft !== 0) return;
    if (timeUpFiredRef.current) return;
    timeUpFiredRef.current = true;
    sectionTimeUpRef.current();
  }, [sectionTimeLeft, examStarted, sectionCompleted, isSubmitting]);

  // Helper function to check if there's a next section
  const hasNextSection = (): boolean => {
    return currentSectionIndex + 1 < examSections.length;
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    if (accessMode === "trial" && trialSubmitTriggeredRef.current) return;
    setSectionAnswers((prev) => {
      const next = { ...prev, [questionId]: answer };
      if (accessMode === "trial") {
        const answered = countAnsweredScorableUnits(
          examSections,
          currentSectionIndex,
          next,
        );
        if (answered >= EXAM_TRIAL_QUESTION_LIMIT) {
          queueMicrotask(() => triggerTrialSubmit());
        }
      }
      return next;
    });
  };

  const handleNext = () => {
    const currentSection = getCurrentSection();
    if (
      currentSection &&
      currentQuestionIndex < currentSection.questions.length - 1
    ) {
      setCurrentQuestionIndex((prev) => prev + 1);
      return;
    }
    if (accessMode === "trial") {
      const answered = countAnsweredScorableUnits(
        examSections,
        currentSectionIndex,
        sectionAnswers,
      );
      if (answered >= EXAM_TRIAL_QUESTION_LIMIT) {
        triggerTrialSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const startExam = async () => {
    if (isStarting) return;
    if (examAccess?.mode === "denied") {
      if (examAccess.requiresPurchase) setShowPurchaseDialog(true);
      return;
    }
    const mode = examAccess?.mode || accessMode;
    let firstSections = examSections;
    if (mode === "trial" && examSections.length) {
      firstSections = applyTrialLimit(examSections, "trial");
      setExamSections(firstSections);
      setAccessMode("trial");
    }
    const firstSection = firstSections[0];
    if (!firstSection) return;
    setIsStarting(true);
    try {
      const startRes = await fetch("/api/exam-attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          examId,
          trialQuestionIds:
            mode === "trial"
              ? collectTrialQuestionIdsFromSections(firstSections)
              : undefined,
        }),
      });
      if (!startRes.ok) {
        const errBody = await startRes.json().catch(() => ({}));
        if (startRes.status === 403 || startRes.status === 401) {
          setShowPurchaseDialog(true);
        }
        throw new Error(errBody.message || "Không bắt đầu được bài thi");
      }
      const attempt = await startRes.json();
      setAttemptId(attempt.id);
      const modeFromServer = (attempt.accessMode ||
        attempt.clientState?.accessMode ||
        mode) as ExamAccessMode;
      setAccessMode(modeFromServer);

      trialSubmitTriggeredRef.current = false;

      // If server resumed an existing session with clientState, restore it
      const cs = attempt.clientState as any;
      if (cs?.examSections?.length) {
        const restored = applyTrialLimit(cs.examSections, modeFromServer);
        setExamSections(restored);
        setCurrentSectionIndex(cs.currentSectionIndex || 0);
        setCurrentQuestionIndex(cs.currentQuestionIndex || 0);
        setSectionAnswers(cs.currentSectionAnswers || {});
        setCompletedSections(new Set(cs.completedSections || []));
        setSectionResults(cs.sectionResults || {});
        setSectionCompleted(!!cs.sectionCompleted);
        const section = restored[cs.currentSectionIndex || 0];
        if (!cs.sectionCompleted && section) {
          await startSectionOnServer(attempt.id, section.id);
          setSectionTimeLeft(section.timeLimit * 60);
        }
        setExamStarted(true);
        setWaitStartTime(Date.now());
        return;
      }

      await startSectionOnServer(attempt.id, firstSection.id);
      setExamStarted(true);
      setWaitStartTime(Date.now());
      setCurrentSectionIndex(0);
      setCurrentQuestionIndex(0);
      setSectionAnswers({});
      setSectionCompleted(false);
      setSectionTimeLeft(firstSection.timeLimit * 60);
    } catch (error) {
      console.error("Error starting exam:", error);
      alert(error instanceof Error ? error.message : "Không bắt đầu được bài thi");
    } finally {
      setIsStarting(false);
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

  // Show loading while fetching data
  if (examLoading || questionsLoading || !sectionsReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (examAccessFetched && (examAccessError || !examAccess)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Không kiểm tra được quyền thi</h2>
            <p className="text-gray-600 mb-6">
              Vui lòng đăng nhập lại hoặc tải lại trang.
            </p>
            <Button onClick={() => setLocation("/")}>Về trang chủ</Button>
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
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Không tìm thấy đề thi</h2>
            <p className="text-gray-600 mb-6">
              Đề thi này không tồn tại, đã bị ẩn, hoặc đã bị xóa.
            </p>
            <Button onClick={() => handleNavigateWithConfirm("/")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (exam.isActive === false && user?.role !== "admin" && user?.role !== "manager") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Đề thi chưa mở</h2>
            <p className="text-gray-600 mb-6">
              Đề thi này hiện không mở để làm bài. Vui lòng chọn đề khác.
            </p>
            <Button onClick={() => handleNavigateWithConfirm("/")}>
              Về danh sách đề thi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Access gates — before start screen
  if (examAccess?.mode === "denied" && examAccess.requiresLogin && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Cần đăng ký / đăng nhập</h2>
            <p className="text-gray-600 mb-6">
              {examAccess.reason ||
                "Đăng ký tài khoản để thi thử đề số 1 mỗi cấp hoặc mua gói đề."}
            </p>
            <div className="space-x-4">
              <Button variant="outline" onClick={() => handleNavigateWithConfirm("/login")}>
                Đăng nhập
              </Button>
              <Button onClick={() => handleNavigateWithConfirm("/")}>
                Về cổng Luyện thi
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (examAccess?.mode === "denied" && examAccess.requiresPurchase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Cần mua gói đề</h2>
            <p className="text-gray-600 mb-6">
              {examAccess.reason ||
                `Mua gói ${examAccess.level || ""} (${EXAM_PACKAGE_PRICE_VND.toLocaleString("vi-VN")}đ) để thi đầy đủ.`}
            </p>
            <div className="space-x-4">
              <Button onClick={() => handleNavigateWithConfirm("/#exam-packages")}>
                Xem gói &amp; QR
              </Button>
              <Button variant="outline" onClick={() => handleNavigateWithConfirm("/")}>
                Về cổng Luyện thi
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if exam has no questions for any section
  {
    let hasAnyQuestions = false;
    
    if ((exam as any).sections && Array.isArray((exam as any).sections) && (exam as any).sections.length > 0) {
      hasAnyQuestions = (exam as any).sections.some((section: any) => {
        if (section.questionSets && Array.isArray(section.questionSets)) {
          return section.questionSets.some((qs: any) => {
            const ids = qs.questionIds || qs.questions || [];
            return Array.isArray(ids) && ids.length > 0;
          });
        }
        return section.questionIds && section.questionIds.length > 0;
      });
    } else {
      hasAnyQuestions = 
        ((exam.vocabularyQuestions as string[]) || []).length > 0 ||
        ((exam.grammarQuestions as string[]) || []).length > 0 ||
        ((exam.listeningQuestions as string[]) || []).length > 0 ||
        ((exam.readingQuestions as string[]) || []).length > 0;
    }

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

  // Show exam start screen
  if (!examStarted) {
    // Calculate totals from dynamic sections (including sub-questions)
    const totalTime = examSections.reduce((sum, section) => sum + section.timeLimit, 0);
    const totalQuestions = examSections.reduce((sum, section) => sum + getTotalQuestionCount(section.questions), 0);
    
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
      <div className="bg-gradient-to-br from-blue-50 via-white to-green-50 py-8 min-h-[80vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">
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


                    <div className="pt-4">
                      <Button 
                        onClick={startExam} 
                        size="lg" 
                        disabled={isStarting || examSections.length === 0}
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        data-testid="button-start-exam"
                      >
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-5 h-5" />
                          {isStarting ? "Đang bắt đầu..." : "Bắt đầu làm bài"}
                        </div>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={() => handleNavigateWithConfirm("/")}
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
                      return (
                        <div 
                          key={section.id} 
                          className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          data-testid={`section-preview-${index}`}
                        >
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                              <FileText className="w-5 h-5 text-green-600" />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-gray-900">
                                {index + 1}. {section.sectionName || (section as any).type || `Phần ${index + 1}`}
                              </h4>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {section.timeLimit} phút
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {getTotalQuestionCount(section.questions)} câu
                                </span>
                              </div>
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

  const currentSection = getCurrentSection();
  const currentQuestion = currentSection?.questions[currentQuestionIndex];
  const totalQuestionsInSection = currentSection ? getTotalQuestionCount(currentSection.questions) : 0;
  // Calculate progress based on parent questions (since navigation is parent-based)
  const progress = (currentSection?.questions.length || 0) > 0 ? ((currentQuestionIndex + 1) / (currentSection?.questions.length || 1)) * 100 : 0;
  // Count all answered questions (including sub-questions)
  const allQuestionsFlat = currentSection ? getAllQuestionsFlat(currentSection.questions) : [];
  const answeredCount = allQuestionsFlat.filter(q => sectionAnswers[q.id] !== undefined).length;
  const sectionConfig = getSectionConfig();
  const SectionIcon = sectionConfig?.icon;

  return (
    <ExamProtectedContent className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Simplified Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${sectionConfig?.color || 'bg-gradient-to-br from-blue-500 to-blue-600'} text-white shadow-md`}>
                {SectionIcon && <SectionIcon className="w-5 h-5" />}
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {exam.title}
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  {sectionConfig?.title || 'Đang tải'} - Câu {currentQuestionIndex + 1}/{currentSection?.questions.length || 0}
                </p>
              </div>
            </div>
            {/* Section Progress Dots */}
            <div className="flex items-center gap-2">
              {examSections.map((section, index) => (
                <div key={section.id} className="flex items-center">
                  <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                    completedSections.has(section.id) ? 'bg-green-500 ring-2 ring-green-200' :
                    currentSectionIndex === index ? 'bg-blue-500 ring-2 ring-blue-200 scale-125' : 'bg-gray-300'
                  }`} />
                  {index < examSections.length - 1 && <div className="w-4 h-0.5 bg-gray-300 mx-1" />}
                </div>
              ))}
            </div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Section Description + Question Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section Description */}
            {currentSection && (currentSection.content || (currentSection.descriptionImageUrls && currentSection.descriptionImageUrls.length > 0) || currentSection.descriptionAudioUrl) && (
              <div>
              <Card className="shadow-lg border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                <CardHeader className="bg-gradient-to-r from-emerald-100/50 to-emerald-50/50 border-b border-emerald-200">
                  <CardTitle className="text-xl font-bold text-emerald-700 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                    Phần {currentSectionIndex + 1}: {currentSection.sectionName || (currentSection as any).type || ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  {/* Section Description Text */}
                  {currentSection.content && (
                    <div className="bg-blue-50/80 border border-blue-200 p-5 rounded-xl">
                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {currentSection.content}
                      </p>
                    </div>
                  )}
                  
                  {/* Section Description Images */}
                  {currentSection.descriptionImageUrls && currentSection.descriptionImageUrls.length > 0 && (
                    <div className="flex justify-center flex-wrap gap-4">
                      {currentSection.descriptionImageUrls.map((imageUrl: string, index: number) => (
                        <ProtectedExamImage
                          key={index}
                          src={imageUrl}
                          alt={`Section description ${index + 1}`}
                          className="max-w-full h-auto rounded-lg shadow-sm max-h-[700px]"
                          data-testid={`section-image-${index}`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Section Description Audio */}
                  {currentSection.descriptionAudioUrl && (
                    <div className="flex justify-center">
                      <ExamAudioPlayer
                        src={resolveExamMediaUrl(
                          currentSection.descriptionAudioUrl,
                          "section-description-audio"
                        )}
                        maxPlays={1}
                        className="w-full max-w-md"
                        key={`section-audio-${currentSectionIndex}`}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            )}
            
            {/* Question Content */}
            <div>
            {!currentQuestion ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Đang tải câu hỏi...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Question Set Name Display */}
                {(currentQuestion as any).questionSetName && (
                  <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-sm">
                    <CardContent className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-green-600 rounded-full"></div>
                        <span className="text-sm font-semibold text-green-700">
                          {(currentQuestion as any).questionSetName}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Common Description (for questions with sub-questions only) */}
                {(currentQuestion as any).subQuestions && (currentQuestion as any).subQuestions.length > 0 && 
                 ((currentQuestion as any).description || 
                  ((currentQuestion as any).descriptionImageUrls && (currentQuestion as any).descriptionImageUrls.length > 0) || 
                  (currentQuestion as any).descriptionAudioUrl) && (
                  <Card className="shadow-md border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
                    <CardContent className="p-6 space-y-4">
                      {/* Description Text */}
                      {(currentQuestion as any).description && (
                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {(currentQuestion as any).description}
                        </div>
                      )}
                      
                      {/* Description Images */}
                      {((currentQuestion as any).descriptionImageUrls && (currentQuestion as any).descriptionImageUrls.length > 0) && (
                        <div className="flex justify-center flex-wrap gap-4">
                          {(currentQuestion as any).descriptionImageUrls.map((imageUrl: string, index: number) => (
                            <ProtectedExamImage
                              key={index}
                              src={imageUrl}
                              alt={`Question description illustration ${index + 1}`}
                              className="max-w-full h-auto rounded-lg shadow-sm max-h-[700px]"
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Description Audio */}
                      {(currentQuestion as any).descriptionAudioUrl && (
                        <div className="flex justify-center">
                          <ExamAudioPlayer
                            src={resolveExamMediaUrl(
                              (currentQuestion as any).descriptionAudioUrl,
                              "question-description-audio"
                            )}
                            maxPlays={1}
                            className="w-full max-w-md"
                            key={`desc-audio-${currentQuestion.id}`}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Regular Question or Sub-Questions */}
                {(currentQuestion as any).subQuestions && (currentQuestion as any).subQuestions.length > 0 ? (
                  /* Render Parent + Sub-Questions */
                  <>
                    {/* Parent Question (Câu 1) */}
                    <Card className="shadow-md border-blue-200 bg-gradient-to-br from-white to-blue-50/30">
                      <CardHeader className="bg-gradient-to-r from-blue-100/50 to-blue-50/50 border-b border-blue-200">
                        <CardTitle className="text-lg font-bold text-blue-900">
                          <div>Câu {currentQuestionIndex + 1}.1:</div>
                          <div className="whitespace-pre-wrap mt-1">{currentQuestion.questionText}</div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Parent Question Images */}
                        {((currentQuestion as any).imageUrls && (currentQuestion as any).imageUrls.length > 0) && (
                          <div className="flex justify-center flex-wrap gap-4">
                            {(currentQuestion as any).imageUrls.map((imageUrl: string, index: number) => (
                              <ProtectedExamImage
                                key={index}
                                src={imageUrl}
                                alt={`Question illustration ${index + 1}`}
                                className="max-w-full h-auto rounded-lg shadow-sm max-h-[700px]"
                              />
                            ))}
                          </div>
                        )}

                        {/* Parent Question Audio */}
                        {(currentQuestion as any).audioUrl && (
                          <div className="flex justify-center">
                            <ExamAudioPlayer
                              src={resolveExamMediaUrl((currentQuestion as any).audioUrl, "question-audio")}
                              maxPlays={1}
                              className="w-full max-w-md"
                              key={`parent-audio-${currentQuestion.id}`}
                            />
                          </div>
                        )}

                        {/* Answer Options for Parent Question */}
                        <RadioGroup
                          value={sectionAnswers[currentQuestion.id] || ""}
                          onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                        >
                          {(currentQuestion.options as any[]).map((option: any, index: number) => {
                            const optionText = typeof option === 'string' ? option : option.text;
                            const optionImageUrl = typeof option === 'string' ? '' : option.imageUrl;
                            const optionImageUrls = typeof option === 'string' ? [] : (option.imageUrls || []);
                            
                            return (
                              <div key={index} className="flex items-start space-x-3 p-4 border-2 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer">
                                <RadioGroupItem 
                                  value={index.toString()} 
                                  id={`parent-option-${currentQuestion.id}-${index}`} 
                                  className="mt-1.5"
                                />
                                <div className="flex-1">
                                  <Label 
                                    htmlFor={`parent-option-${currentQuestion.id}-${index}`} 
                                    className="cursor-pointer flex flex-col space-y-2"
                                  >
                                    <span className="text-sm">
                                      {String.fromCharCode(65 + index)}. {optionText}
                                    </span>
                                    
                                    {optionImageUrls.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {optionImageUrls.map((imageUrl: string, imgIndex: number) => (
                                          <ProtectedExamImage
                                            key={imgIndex}
                                            src={imageUrl}
                                            alt={`Option ${String.fromCharCode(65 + index)} illustration ${imgIndex + 1}`}
                                            className="max-w-full h-auto rounded-md shadow-sm max-h-[700px]"
                                          />
                                        ))}
                                      </div>
                                    )}
                                    
                                    {optionImageUrl && optionImageUrls.length === 0 && (
                                      <ProtectedExamImage
                                        src={optionImageUrl}
                                        alt={`Option ${String.fromCharCode(65 + index)} illustration`}
                                        className="max-w-full h-auto rounded-md shadow-sm max-h-[700px]"
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

                    {/* Sub-Questions (Câu 2, 3, ...) */}
                    {(currentQuestion as any).subQuestions.map((subQuestion: any, subIndex: number) => (
                      <Card key={subQuestion.id} className="shadow-md border-purple-200 bg-gradient-to-br from-white to-purple-50/30">
                        <CardHeader className="bg-gradient-to-r from-purple-100/50 to-purple-50/50 border-b border-purple-200">
                          <CardTitle className="text-lg font-bold text-purple-900">
                            <div>Câu {currentQuestionIndex + 1}.{subIndex + 2}:</div>
                            <div className="whitespace-pre-wrap mt-1">{subQuestion.questionText}</div>
                          </CardTitle>
                        </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Sub-Question Images */}
                        {(subQuestion.imageUrls && subQuestion.imageUrls.length > 0) && (
                          <div className="flex justify-center flex-wrap gap-4">
                            {subQuestion.imageUrls.map((imageUrl: string, index: number) => (
                              <ProtectedExamImage
                                key={index}
                                src={imageUrl}
                                alt={`Question illustration ${index + 1}`}
                                className="max-w-full h-auto rounded-lg shadow-sm max-h-[700px]"
                              />
                            ))}
                          </div>
                        )}

                        {/* Sub-Question Audio */}
                        {subQuestion.audioUrl && (
                          <div className="flex justify-center">
                            <ExamAudioPlayer
                              src={resolveExamMediaUrl(subQuestion.audioUrl, "question-audio")}
                              maxPlays={1}
                              className="w-full max-w-md"
                              key={`sub-audio-${subQuestion.id}`}
                            />
                          </div>
                        )}

                        {/* Answer Options for Sub-Question */}
                        <RadioGroup
                          value={sectionAnswers[subQuestion.id] || ""}
                          onValueChange={(value) => handleAnswerChange(subQuestion.id, value)}
                        >
                          {(subQuestion.options as any[]).map((option: any, index: number) => {
                            const optionText = typeof option === 'string' ? option : option.text;
                            const optionImageUrl = typeof option === 'string' ? '' : option.imageUrl;
                            const optionImageUrls = typeof option === 'string' ? [] : (option.imageUrls || []);
                            
                            return (
                              <div key={index} className="flex items-start space-x-3 p-4 border-2 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer">
                                <RadioGroupItem 
                                  value={index.toString()} 
                                  id={`sub-option-${subQuestion.id}-${index}`} 
                                  className="mt-1.5"
                                />
                                <div className="flex-1">
                                  <Label 
                                    htmlFor={`sub-option-${subQuestion.id}-${index}`} 
                                    className="cursor-pointer flex flex-col space-y-2"
                                  >
                                    <span className="text-sm">
                                      {String.fromCharCode(65 + index)}. {optionText}
                                    </span>
                                    
                                    {/* Display multiple option images (new format) */}
                                    {optionImageUrls.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {optionImageUrls.map((imageUrl: string, imgIndex: number) => (
                                          <ProtectedExamImage
                                            key={imgIndex}
                                            src={imageUrl}
                                            alt={`Option ${String.fromCharCode(65 + index)} illustration ${imgIndex + 1}`}
                                            className="max-w-full h-auto rounded-md shadow-sm max-h-[700px]"
                                          />
                                        ))}
                                      </div>
                                    )}
                                    
                                    {/* Display single option image (legacy format) */}
                                    {optionImageUrl && optionImageUrls.length === 0 && (
                                      <ProtectedExamImage
                                        src={optionImageUrl}
                                        alt={`Option ${String.fromCharCode(65 + index)} illustration`}
                                        className="max-w-full h-auto rounded-md shadow-sm max-h-[700px]"
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
                  ))}
                  </>
                ) : (
                  /* Render Regular Question (No Sub-Questions) */
                  <>
                    {/* Common Description (for regular questions) */}
                    {((currentQuestion as any).description || 
                      ((currentQuestion as any).descriptionImageUrls && (currentQuestion as any).descriptionImageUrls.length > 0) || 
                      (currentQuestion as any).descriptionAudioUrl) && (
                      <Card className="shadow-md border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
                        <CardContent className="p-6 space-y-4">
                          {/* Description Text */}
                          {(currentQuestion as any).description && (
                            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {(currentQuestion as any).description}
                            </div>
                          )}
                          
                          {/* Description Images */}
                          {((currentQuestion as any).descriptionImageUrls && (currentQuestion as any).descriptionImageUrls.length > 0) && (
                            <div className="flex justify-center flex-wrap gap-4">
                              {(currentQuestion as any).descriptionImageUrls.map((imageUrl: string, index: number) => (
                                <ProtectedExamImage
                                  key={index}
                                  src={imageUrl}
                                  alt={`Question description illustration ${index + 1}`}
                                  className="max-w-full h-auto rounded-lg shadow-sm max-h-[700px]"
                                />
                              ))}
                            </div>
                          )}
                          
                          {/* Description Audio */}
                          {(currentQuestion as any).descriptionAudioUrl && (
                            <div className="flex justify-center">
                              <ExamAudioPlayer
                                src={resolveExamMediaUrl(
                                  (currentQuestion as any).descriptionAudioUrl,
                                  "question-description-audio"
                                )}
                                maxPlays={1}
                                className="w-full max-w-md"
                                key={`desc-audio-${currentQuestion.id}`}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Regular Question */}
                    <Card className="shadow-md border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30">
                      <CardHeader className="bg-gradient-to-r from-indigo-100/50 to-indigo-50/50 border-b border-indigo-200">
                        <CardTitle className="text-lg font-bold text-indigo-900">
                          <div>Câu {currentQuestionIndex + 1}:</div>
                          <div className="whitespace-pre-wrap mt-1">{currentQuestion.questionText}</div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Question Images */}
                        {((currentQuestion as any).imageUrls && (currentQuestion as any).imageUrls.length > 0) || (currentQuestion as any).imageUrl ? (
                          <div className="flex justify-center flex-wrap gap-4">
                            {/* Show imageUrls array first (new format) */}
                            {(currentQuestion as any).imageUrls && (currentQuestion as any).imageUrls.map((imageUrl: string, index: number) => (
                              <ProtectedExamImage
                                key={index}
                                src={imageUrl}
                                alt={`Question illustration ${index + 1}`}
                                className="max-w-full h-auto rounded-lg shadow-sm max-h-[700px]"
                              />
                            ))}
                            {/* Show single imageUrl if no imageUrls (legacy support) */}
                            {(currentQuestion as any).imageUrl && (!(currentQuestion as any).imageUrls || (currentQuestion as any).imageUrls.length === 0) && (
                              <ProtectedExamImage
                                src={(currentQuestion as any).imageUrl}
                                alt="Question illustration"
                                className="max-w-full h-auto rounded-lg shadow-sm max-h-[700px]"
                              />
                            )}
                          </div>
                        ) : null}

                        {/* Question Audio */}
                        {(currentQuestion as any).audioUrl && (
                          <div className="flex justify-center">
                            <ExamAudioPlayer
                              src={resolveExamMediaUrl((currentQuestion as any).audioUrl, "question-audio")}
                              maxPlays={1}
                              className="w-full max-w-md"
                              key={`audio-${currentQuestion.id}`}
                            />
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
                            <div key={index} className="flex items-start space-x-3 p-4 border-2 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                              <RadioGroupItem 
                                value={index.toString()} 
                                id={`option-${index}`} 
                                className="mt-1.5"
                              />
                              <div className="flex-1">
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
                                        <ProtectedExamImage
                                          key={imgIndex}
                                          src={imageUrl}
                                          alt={`Option ${String.fromCharCode(65 + index)} illustration ${imgIndex + 1}`}
                                          className="max-w-full h-auto rounded-md shadow-sm max-h-[700px]"
                                        />
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Display single option image (legacy format) */}
                                  {optionImageUrl && optionImageUrls.length === 0 && (
                                    <ProtectedExamImage
                                      src={optionImageUrl}
                                      alt={`Option ${String.fromCharCode(65 + index)} illustration`}
                                      className="max-w-full h-auto rounded-md shadow-sm max-h-[700px]"
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
                  </>
                )}
              </div>
            )}

            {/* Navigation - Within Section Only */}
            {currentQuestion && (
              <div className="flex justify-between mt-8 gap-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0 || sectionCompleted}
                  size="lg"
                  className="flex-1 border-2 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Câu trước
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={currentQuestionIndex === (currentSection?.questions.length || 0) - 1 || sectionCompleted}
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                >
                  Câu sau
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}
            </div>
          </div>

          {/* Sticky Control Panel */}
          <div className="lg:col-span-4">
            <div className="sticky top-20 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
              {/* Timer Card */}
              <Card className={`shadow-lg border-2 ${sectionTimeLeft < 300 ? 'border-red-400 bg-red-50' : 'border-blue-200 bg-gradient-to-br from-blue-50 to-white'}`}>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Clock className={`w-6 h-6 ${sectionTimeLeft < 300 ? 'text-red-600' : 'text-blue-600'}`} />
                      <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Thời gian</span>
                    </div>
                    <div className={`text-4xl font-bold font-mono ${sectionTimeLeft < 300 ? 'text-red-600' : 'text-blue-700'}`}>
                      {formatTime(sectionTimeLeft)}
                    </div>
                    {sectionTimeLeft < 300 && (
                      <p className="text-xs text-red-600 mt-2 font-medium">Sắp hết giờ!</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Progress Card */}
              <Card className="shadow-md border-green-200 bg-gradient-to-br from-green-50 to-white">
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Tiến độ</span>
                      <span className="text-sm font-bold text-green-700">{answeredCount}/{totalQuestionsInSection}</span>
                    </div>
                    <Progress 
                      value={totalQuestionsInSection > 0 ? (answeredCount / totalQuestionsInSection) * 100 : 0} 
                      className="h-3" 
                    />
                    <p className="text-xs text-gray-600">Đã trả lời {answeredCount} câu</p>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <Button 
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting || sectionCompleted}
                size="lg"
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-lg text-base font-semibold py-6"
              >
                {hasNextSection() ? "Hoàn thành phần này" : "Nộp bài"}
              </Button>

              {/* Question Grid */}
              <Card className="shadow-md border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-gray-700">
                    <FileText className="w-4 h-4" />
                    Danh sách câu hỏi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {(currentSection?.questions || []).map((question, index) => {
                      const isCurrent = index === currentQuestionIndex;
                      const parentAnswered = sectionAnswers[question.id] !== undefined;
                      const subQuestions = (question as any).subQuestions || [];
                      const allSubAnswered = subQuestions.length > 0 
                        ? subQuestions.every((sq: any) => sectionAnswers[sq.id] !== undefined)
                        : true;
                      const isAnswered = parentAnswered && allSubAnswered;
                      
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => !sectionCompleted && setCurrentQuestionIndex(index)}
                          disabled={sectionCompleted}
                          className={`
                            w-full aspect-square text-sm rounded-lg font-semibold border-2 transition-all
                            ${isCurrent
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' 
                              : isAnswered
                                ? 'bg-green-100 text-green-800 border-green-400 hover:bg-green-200 hover:scale-105'
                                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:scale-105'
                            }
                            ${sectionCompleted ? 'cursor-not-allowed opacity-60' : ''}
                          `}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="text-xs text-gray-600 space-y-1.5 border-t pt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-600 rounded-lg border-2 border-blue-600"></div>
                      <span>Câu hiện tại</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-100 rounded-lg border-2 border-green-400"></div>
                      <span>Đã trả lời</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-100 rounded-lg border-2 border-gray-300"></div>
                      <span>Chưa trả lời</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                  • Đã trả lời: {answeredCount}/{totalQuestionsInSection} câu
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
                  • Đã trả lời: {answeredCount}/{totalQuestionsInSection} câu
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
            <Button
              onClick={() => {
                setShowSubmitDialog(false);
                handleSectionComplete();
              }}
              disabled={isSubmitting}
            >
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

      <Dialog
        open={showPurchaseDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowPurchaseDialog(true);
            return;
          }
          setShowPurchaseDialog(false);
          if (purchaseNavRef.current === "cart") {
            purchaseNavRef.current = null;
            return;
          }
          clearExamDraft(examId);
          setLocation("/");
        }}
      >
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Mua gói để tiếp tục</DialogTitle>
            <DialogDescription>
              Bạn đã làm hết {EXAM_TRIAL_QUESTION_LIMIT} câu thi thử
              {examAccess?.level ? ` cấp ${examAccess.level}` : ""}. Thêm gói đề (
              {purchasePriceVnd.toLocaleString("vi-VN")}đ) vào giỏ để làm đầy đủ
              đề. Đóng hộp thoại sẽ quay về trang chủ Luyện thi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handlePurchaseDismiss}>
              Về trang chủ
            </Button>
            <Button
              onClick={handlePurchaseAddToCart}
              disabled={addPackage.isPending}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              {addPackage.isPending ? "Đang thêm…" : "Thêm vào giỏ hàng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ExamProtectedContent>
  );
}

export default ExamTakingPage;