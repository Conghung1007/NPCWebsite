import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, ChevronLeft, ChevronRight, FileText, CheckCircle, ArrowRight, ShoppingCart, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type Exam, type Question, type User } from "@shared/schema";
import { ExamAudioPlayer } from "@/components/ExamAudioPlayer";
import { ExamProtectedContent, ProtectedExamImage } from "@/components/ExamProtectedContent";
import { examKeys } from "@/lib/queryKeys";
import { resolveExamMediaUrl, asMediaUrlList } from "@/lib/examMediaUrl";
import { examPublicPath } from "@/lib/contentPaths";
import { looksLikeUuid } from "@shared/contentSlug";
import {
  getExamReturnPath,
  clearExamReturnPath,
} from "@/lib/examReturn";
import { useExamSessionLock } from "@/components/ExamReturnTracker";
import {
  EXAM_PACKAGE_PRICE_VND,
  EXAM_TRIAL_QUESTION_LIMIT,
  type ExamAccessMode,
  truncateSectionsForTrial,
  countAnsweredScorableUnits,
  collectTrialQuestionIdsFromSections,
} from "@shared/examAccess";

function optionList(options: unknown): unknown[] {
  if (Array.isArray(options)) return options;
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Passage parents have subs but no answer options. */
function isPassageParent(question: Question | any): boolean {
  const subs = question?.subQuestions;
  const hasSubs = Array.isArray(subs) && subs.length > 0;
  return hasSubs && optionList(question?.options).length === 0;
}

function isQuestionFullyAnswered(
  question: Question | any,
  answers: Record<string, string>,
): boolean {
  const subs = (question as any).subQuestions || [];
  if (Array.isArray(subs) && subs.length > 0) {
    const allSubs = subs.every((sq: any) => answers[sq.id] !== undefined);
    if (isPassageParent(question)) return allSubs;
    return answers[question.id] !== undefined && allSubs;
  }
  return answers[question.id] !== undefined;
}

function countScorableUnitsSafe(question: Question | any): number {
  const subs = (question as any).subQuestions || [];
  if (Array.isArray(subs) && subs.length > 0) {
    return (isPassageParent(question) ? 0 : 1) + subs.length;
  }
  return 1;
}

function countAnsweredInSection(
  questions: Question[],
  answers: Record<string, string>,
): number {
  let n = 0;
  for (const q of questions) {
    const subs = (q as any).subQuestions || [];
    if (Array.isArray(subs) && subs.length > 0) {
      if (!isPassageParent(q) && answers[q.id] !== undefined) n += 1;
      for (const sq of subs) {
        if (answers[sq.id] !== undefined) n += 1;
      }
    } else if (answers[q.id] !== undefined) {
      n += 1;
    }
  }
  return n;
}

function TakingOptionImages({ option }: { option: unknown }) {
  if (typeof option === "string" || !option || typeof option !== "object") {
    return null;
  }
  const o = option as { imageUrl?: string; imageUrls?: unknown };
  const urls = asMediaUrlList(o.imageUrls);
  const legacy = o.imageUrl?.trim();
  const list = urls.length > 0 ? urls : legacy ? [legacy] : [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((imageUrl, imgIndex) => (
        <ProtectedExamImage
          key={imgIndex}
          src={imageUrl}
          imageKind="answer"
          alt={`Option illustration ${imgIndex + 1}`}
          className="max-w-full h-auto rounded-md shadow-sm max-h-[700px]"
        />
      ))}
    </div>
  );
}

function ExamOptionRow({
  id,
  value,
  selected,
  label,
  option,
}: {
  id: string;
  value: string;
  selected: boolean;
  label: string;
  option: unknown;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-neutral-200 bg-white hover:border-primary/40 hover:bg-neutral-50",
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-1 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <span className="text-base text-neutral-900 leading-relaxed block">
          {label}
        </span>
        <TakingOptionImages option={option} />
      </div>
    </Label>
  );
}

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
  trialQuestionIds?: string[];
  trialSectionIds?: string[];
  accessMode?: ExamAccessMode;
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
  useExamSessionLock();
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
  const trialMetaRef = useRef<{
    trialQuestionIds?: string[];
    trialSectionIds?: string[];
  }>({});

  // Derive/shuffle sections only once (or restore from draft) — avoid wiping answers/timer
  const sectionsInitializedRef = useRef(false);

  // User data is now handled by useAuth hook

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: examKeys.detail(examId),
    retry: false,
  });

  // Prefer title slug URL: /luyen-thi/de-thi-n5 instead of /luyen-thi/exam/<uuid>
  useEffect(() => {
    if (!exam?.slug) return;
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path.includes("/exam/") && (looksLikeUuid(examId) || path.includes(exam.id))) {
      setLocation(examPublicPath(exam), { replace: true });
    }
  }, [exam, examId, setLocation]);

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
    setLocation(getExamReturnPath());
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
        let sections: ExamSection[] =
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
        if (modeFromCs === "trial") {
          trialMetaRef.current = {
            trialQuestionIds:
              cs.trialQuestionIds ||
              draft?.trialQuestionIds ||
              collectTrialQuestionIdsFromSections(sections),
            trialSectionIds:
              cs.trialSectionIds ||
              draft?.trialSectionIds ||
              sections.map((s) => s.id),
          };
        }
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
      accessMode,
      trialQuestionIds: trialMetaRef.current.trialQuestionIds,
      trialSectionIds: trialMetaRef.current.trialSectionIds,
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
            trialQuestionIds: trialMetaRef.current.trialQuestionIds,
            trialSectionIds: trialMetaRef.current.trialSectionIds,
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
    const handlePopState = () => {
      setPendingExitAction(null);
      setPendingNavigation(getExamReturnPath());
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
      setPendingNavigation(getExamReturnPath());
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
      (sum, question) => sum + countScorableUnitsSafe(question),
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

    const isLastSection = currentSectionIndex >= examSections.length - 1;

    // Last section: submit without optimistic local complete (rollback-safe)
    if (isLastSection) {
      setIsSubmitting(true);
      submitExamMutation.mutate({
        attemptId,
        sectionId: currentSection.id,
        answers: sectionAnswers,
      });
      return;
    }

    const prevResults = sectionResults;
    const prevCompleted = completedSections;
    setSectionResults(updatedSectionResults);
    setCompletedSections((prev) => new Set([...Array.from(prev), currentSection.id]));

    try {
      setIsSubmitting(true);
      await completeSectionOnServer(attemptId, currentSection.id, sectionAnswers);
      setSectionCompleted(true);
    } catch (error) {
      console.error("Error completing section:", error);
      setSectionResults(prevResults);
      setCompletedSections(prevCompleted);
      trialSubmitTriggeredRef.current = false;
      toast({
        title: "Không hoàn thành được phần thi",
        description: error instanceof Error ? error.message : "Thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [getCurrentSection, getSectionConfig, sectionAnswers, sectionTimeLeft, isSubmitting, sectionResults, completedSections, currentSectionIndex, examSections, attemptId, submitExamMutation, toast]);

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
        if (modeFromServer === "trial") {
          trialMetaRef.current = {
            trialQuestionIds:
              cs.trialQuestionIds ||
              collectTrialQuestionIdsFromSections(restored),
            trialSectionIds:
              cs.trialSectionIds || restored.map((s) => s.id),
          };
        }
        const section = restored[cs.currentSectionIndex || 0];
        if (!cs.sectionCompleted && section) {
          const limitSec = section.timeLimit * 60;
          const sameSectionStarted =
            attempt.currentSectionId === section.id && attempt.sectionStartedAt;
          if (sameSectionStarted) {
            const elapsed = Math.floor(
              (Date.now() - new Date(attempt.sectionStartedAt).getTime()) / 1000
            );
            setSectionTimeLeft(Math.max(0, limitSec - elapsed));
          } else {
            await startSectionOnServer(attempt.id, section.id);
            setSectionTimeLeft(limitSec);
          }
        }
        setExamStarted(true);
        setWaitStartTime(Date.now());
        return;
      }

      if (modeFromServer === "trial") {
        trialMetaRef.current = {
          trialQuestionIds: collectTrialQuestionIdsFromSections(firstSections),
          trialSectionIds: firstSections.map((s) => s.id),
        };
      } else {
        trialMetaRef.current = {};
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
      toast({
        title: "Không bắt đầu được bài thi",
        description:
          error instanceof Error ? error.message : "Thử lại sau.",
        variant: "destructive",
      });
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
            <Button onClick={() => setLocation(getExamReturnPath())}>Quay lại</Button>
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
            <Button onClick={() => handleNavigateWithConfirm(getExamReturnPath())}>
              Quay lại
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
            <Button onClick={() => handleNavigateWithConfirm(getExamReturnPath())}>
              Quay lại
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
              <Button onClick={() => handleNavigateWithConfirm(getExamReturnPath())}>
                Quay lại
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
              <Button variant="outline" onClick={() => handleNavigateWithConfirm(getExamReturnPath())}>
                Quay lại
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
              <Button onClick={() => handleNavigateWithConfirm(getExamReturnPath())}>
                Quay lại
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // Show exam start screen
  if (!examStarted) {
    const totalTime = examSections.reduce((sum, section) => sum + section.timeLimit, 0);
    const totalQuestions = examSections.reduce((sum, section) => sum + getTotalQuestionCount(section.questions), 0);

    return (
      <div className="min-h-[80vh] bg-neutral-50 py-8">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-primary px-6 py-5 text-primary-foreground">
              <h1 className="text-xl sm:text-2xl font-semibold leading-snug" data-testid="exam-title">
                {exam?.title}
              </h1>
              {exam?.description ? (
                <p className="mt-1.5 text-sm text-primary-foreground/85 line-clamp-3" data-testid="exam-description">
                  {exam.description}
                </p>
              ) : null}
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-neutral-900 tabular-nums" data-testid="total-time">
                    {totalTime}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">phút</div>
                </div>
                <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-4 py-3 text-center">
                  <div className="text-2xl font-bold text-neutral-900 tabular-nums" data-testid="total-questions">
                    {totalQuestions}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">câu</div>
                </div>
              </div>

              <ul className="space-y-2">
                {examSections.map((section, index) => (
                  <li
                    key={section.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 px-3.5 py-3"
                    data-testid={`section-preview-${index}`}
                  >
                    <span className="text-sm font-medium text-neutral-900 min-w-0 truncate">
                      {index + 1}. {section.sectionName || (section as any).type || `Phần ${index + 1}`}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                      {section.timeLimit}′ · {getTotalQuestionCount(section.questions)} câu
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2.5 pt-1">
                <Button
                  onClick={startExam}
                  size="lg"
                  disabled={isStarting || examSections.length === 0}
                  className="w-full"
                  data-testid="button-start-exam"
                >
                  {isStarting ? "Đang bắt đầu..." : "Bắt đầu làm bài"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigateWithConfirm(getExamReturnPath())}
                  className="w-full text-neutral-600"
                  data-testid="button-back-to-list"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Quay lại
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSection = getCurrentSection();
  const currentQuestion = currentSection?.questions[currentQuestionIndex];
  const totalQuestionsInSection = currentSection ? getTotalQuestionCount(currentSection.questions) : 0;
  const answeredCount = currentSection
    ? countAnsweredInSection(currentSection.questions, sectionAnswers)
    : 0;
  const sectionConfig = getSectionConfig();
  const parentCount = currentSection?.questions.length || 0;
  const timeUrgent = sectionTimeLeft < 300;
  const progressPct =
    totalQuestionsInSection > 0
      ? (answeredCount / totalQuestionsInSection) * 100
      : 0;

  return (
    <ExamProtectedContent className="min-h-screen bg-neutral-50 pb-28 lg:pb-8">
      {/* Sticky chrome: title + timer always visible */}
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 text-neutral-500 hover:text-neutral-900"
              onClick={showExitConfirmation}
              aria-label="Thoát"
              data-testid="button-exit-exam"
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-semibold text-neutral-900 truncate">
                {exam.title}
              </h1>
              <p className="text-xs text-neutral-500 truncate">
                {sectionConfig?.title || `Phần ${currentSectionIndex + 1}`}
                {" · "}
                Câu {currentQuestionIndex + 1}/{parentCount}
                {" · "}
                {answeredCount}/{totalQuestionsInSection}
              </p>
            </div>

            <div
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-base sm:text-lg font-bold tabular-nums",
                timeUrgent
                  ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                  : "bg-neutral-100 text-neutral-900",
              )}
              data-testid="exam-timer"
            >
              <Clock className="h-4 w-4 opacity-70" />
              {formatTime(sectionTimeLeft)}
            </div>
          </div>

          {examSections.length > 1 && (
            <div className="mt-2 flex items-center gap-1.5 pl-11">
              {examSections.map((section, index) => (
                <div
                  key={section.id}
                  className={cn(
                    "h-1.5 flex-1 max-w-8 rounded-full transition-colors",
                    completedSections.has(section.id)
                      ? "bg-primary"
                      : currentSectionIndex === index
                        ? "bg-primary/60"
                        : "bg-neutral-200",
                  )}
                  title={section.sectionName || `Phần ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="h-0.5 bg-neutral-100">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
      </div>

      {/* Section Completion Overlay */}
      {sectionCompleted && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="max-w-sm w-full shadow-xl border-neutral-200">
            <CardContent className="text-center py-8 px-6">
              <CheckCircle className="w-14 h-14 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-6">
                Xong {sectionConfig?.title || "phần này"}
              </h3>
              <Button onClick={handleProceedToNext} className="w-full" size="lg">
                {hasNextSection() ? "Phần tiếp theo" : "Nộp bài"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            {/* Section Description */}
            {currentSection && (currentSection.content || asMediaUrlList(currentSection.descriptionImageUrls).length > 0 || currentSection.descriptionAudioUrl) && (
              <div>
              <Card className="border-neutral-200 shadow-sm">
                <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
                  <CardTitle className="text-base font-semibold text-neutral-800">
                    {currentSection.sectionName || (currentSection as any).type || `Phần ${currentSectionIndex + 1}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-5 pb-5">
                  {currentSection.content && (
                    <p className="text-neutral-800 whitespace-pre-wrap leading-relaxed text-[15px]">
                      {currentSection.content}
                    </p>
                  )}
                  
                  {asMediaUrlList(currentSection.descriptionImageUrls).length > 0 && (
                    <div className="flex justify-center flex-wrap gap-3">
                      {asMediaUrlList(currentSection.descriptionImageUrls).map((imageUrl: string, index: number) => (
                        <ProtectedExamImage
                          key={index}
                          src={imageUrl}
                          imageKind="description"
                          alt=""
                          className="max-w-full h-auto rounded-lg max-h-[700px]"
                          data-testid={`section-image-${index}`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {currentSection.descriptionAudioUrl &&
                    resolveExamMediaUrl(
                      currentSection.descriptionAudioUrl,
                      "section-description-audio",
                    ) && (
                    <div className="flex justify-center">
                      <ExamAudioPlayer
                        src={resolveExamMediaUrl(
                          currentSection.descriptionAudioUrl,
                          "section-description-audio"
                        )}
                        maxPlays={1}
                        className="w-full max-w-md"
                        key={`section-audio-${currentSection.id}`}
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
              <Card className="border-neutral-200">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                  <p className="text-neutral-500 text-sm">Đang tải…</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {(currentQuestion as any).questionSetName && (
                  <p className="text-sm font-medium text-primary px-0.5">
                    {(currentQuestion as any).questionSetName}
                  </p>
                )}

                {/* Common Description (for questions with sub-questions only) */}
                {(currentQuestion as any).subQuestions && (currentQuestion as any).subQuestions.length > 0 && 
                 ((currentQuestion as any).description || 
                  asMediaUrlList((currentQuestion as any).descriptionImageUrls).length > 0 || 
                  (currentQuestion as any).descriptionAudioUrl) && (
                  <Card className="border-neutral-200 shadow-sm bg-neutral-50/50">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      {(currentQuestion as any).description && (
                        <div className="text-[15px] text-neutral-800 whitespace-pre-wrap leading-relaxed">
                          {(currentQuestion as any).description}
                        </div>
                      )}
                      
                      {asMediaUrlList((currentQuestion as any).descriptionImageUrls).length > 0 && (
                        <div className="flex justify-center flex-wrap gap-3">
                          {asMediaUrlList((currentQuestion as any).descriptionImageUrls).map((imageUrl: string, index: number) => (
                            <ProtectedExamImage
                              key={index}
                              src={imageUrl}
                              imageKind="description"
                              alt=""
                              className="max-w-full h-auto rounded-lg max-h-[700px]"
                            />
                          ))}
                        </div>
                      )}
                      
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

                {(currentQuestion as any).subQuestions && (currentQuestion as any).subQuestions.length > 0 ? (
                  <>
                    <Card className="border-neutral-200 shadow-sm">
                      <CardHeader className="pb-3 pt-4 px-4 sm:px-5 border-b border-neutral-100">
                        <CardTitle className="text-base sm:text-lg font-semibold text-neutral-900 space-y-1">
                          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                            {isPassageParent(currentQuestion)
                              ? `Đoạn văn · Câu ${currentQuestionIndex + 1}`
                              : `Câu ${currentQuestionIndex + 1}.1`}
                          </div>
                          <div className="whitespace-pre-wrap font-normal text-[15px] sm:text-base leading-relaxed">
                            {currentQuestion.questionText}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4 sm:p-5">
                        {asMediaUrlList((currentQuestion as any).imageUrls).length > 0 && (
                          <div className="flex justify-center flex-wrap gap-3">
                            {asMediaUrlList((currentQuestion as any).imageUrls).map((imageUrl: string, index: number) => (
                              <ProtectedExamImage
                                key={index}
                                src={imageUrl}
                                imageKind="question"
                                alt=""
                                className="max-w-full h-auto rounded-lg max-h-[700px]"
                              />
                            ))}
                          </div>
                        )}

                        {(currentQuestion as any).audioUrl && (
                          <ExamAudioPlayer
                            src={resolveExamMediaUrl((currentQuestion as any).audioUrl, "question-audio")}
                            maxPlays={1}
                            className="w-full"
                            key={`parent-audio-${currentQuestion.id}`}
                          />
                        )}

                        {!isPassageParent(currentQuestion) && optionList(currentQuestion.options).length > 0 && (
                          <RadioGroup
                            value={sectionAnswers[currentQuestion.id] || ""}
                            onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                            className="gap-2.5"
                            disabled={sectionCompleted}
                          >
                            {optionList(currentQuestion.options).map((option: any, index: number) => {
                              const optionText = typeof option === "string" ? option : option?.text;
                              const value = index.toString();
                              return (
                                <ExamOptionRow
                                  key={index}
                                  id={`parent-option-${currentQuestion.id}-${index}`}
                                  value={value}
                                  selected={sectionAnswers[currentQuestion.id] === value}
                                  label={`${String.fromCharCode(65 + index)}. ${optionText ?? ""}`}
                                  option={option}
                                />
                              );
                            })}
                          </RadioGroup>
                        )}
                      </CardContent>
                    </Card>

                    {(currentQuestion as any).subQuestions.map((subQuestion: any, subIndex: number) => (
                      <Card key={subQuestion.id} className="border-neutral-200 shadow-sm">
                        <CardHeader className="pb-3 pt-4 px-4 sm:px-5 border-b border-neutral-100">
                          <CardTitle className="text-base sm:text-lg font-semibold text-neutral-900 space-y-1">
                            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                              Câu {currentQuestionIndex + 1}.{subIndex + (isPassageParent(currentQuestion) ? 1 : 2)}
                            </div>
                            <div className="whitespace-pre-wrap font-normal text-[15px] sm:text-base leading-relaxed">
                              {subQuestion.questionText}
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 sm:p-5">
                          {asMediaUrlList(subQuestion.imageUrls).length > 0 && (
                            <div className="flex justify-center flex-wrap gap-3">
                              {asMediaUrlList(subQuestion.imageUrls).map((imageUrl: string, index: number) => (
                                <ProtectedExamImage
                                  key={index}
                                  src={imageUrl}
                                  imageKind="question"
                                  alt=""
                                  className="max-w-full h-auto rounded-lg max-h-[700px]"
                                />
                              ))}
                            </div>
                          )}

                          {subQuestion.audioUrl && (
                            <ExamAudioPlayer
                              src={resolveExamMediaUrl(subQuestion.audioUrl, "question-audio")}
                              maxPlays={1}
                              className="w-full"
                              key={`sub-audio-${subQuestion.id}`}
                            />
                          )}

                          <RadioGroup
                            value={sectionAnswers[subQuestion.id] || ""}
                            onValueChange={(value) => handleAnswerChange(subQuestion.id, value)}
                            className="gap-2.5"
                            disabled={sectionCompleted}
                          >
                            {optionList(subQuestion.options).map((option: any, index: number) => {
                              const optionText = typeof option === "string" ? option : option?.text;
                              const value = index.toString();
                              return (
                                <ExamOptionRow
                                  key={index}
                                  id={`sub-option-${subQuestion.id}-${index}`}
                                  value={value}
                                  selected={sectionAnswers[subQuestion.id] === value}
                                  label={`${String.fromCharCode(65 + index)}. ${optionText ?? ""}`}
                                  option={option}
                                />
                              );
                            })}
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : (
                  <>
                    {((currentQuestion as any).description || 
                      asMediaUrlList((currentQuestion as any).descriptionImageUrls).length > 0 || 
                      (currentQuestion as any).descriptionAudioUrl) && (
                      <Card className="border-neutral-200 shadow-sm bg-neutral-50/50">
                        <CardContent className="p-4 sm:p-5 space-y-3">
                          {(currentQuestion as any).description && (
                            <div className="text-[15px] text-neutral-800 whitespace-pre-wrap leading-relaxed">
                              {(currentQuestion as any).description}
                            </div>
                          )}
                          {asMediaUrlList((currentQuestion as any).descriptionImageUrls).length > 0 && (
                            <div className="flex justify-center flex-wrap gap-3">
                              {asMediaUrlList((currentQuestion as any).descriptionImageUrls).map((imageUrl: string, index: number) => (
                                <ProtectedExamImage
                                  key={index}
                                  src={imageUrl}
                                  imageKind="description"
                                  alt=""
                                  className="max-w-full h-auto rounded-lg max-h-[700px]"
                                />
                              ))}
                            </div>
                          )}
                          {(currentQuestion as any).descriptionAudioUrl && (
                            <ExamAudioPlayer
                              src={resolveExamMediaUrl(
                                (currentQuestion as any).descriptionAudioUrl,
                                "question-description-audio"
                              )}
                              maxPlays={1}
                              className="w-full"
                              key={`desc-audio-${currentQuestion.id}`}
                            />
                          )}
                        </CardContent>
                      </Card>
                    )}
                    
                    <Card className="border-neutral-200 shadow-sm">
                      <CardHeader className="pb-3 pt-4 px-4 sm:px-5 border-b border-neutral-100">
                        <CardTitle className="text-base sm:text-lg font-semibold text-neutral-900 space-y-1">
                          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                            Câu {currentQuestionIndex + 1}
                          </div>
                          <div className="whitespace-pre-wrap font-normal text-[15px] sm:text-base leading-relaxed">
                            {currentQuestion.questionText}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4 sm:p-5">
                        {(asMediaUrlList((currentQuestion as any).imageUrls).length > 0 ||
                          !!(currentQuestion as any).imageUrl) && (
                          <div className="flex justify-center flex-wrap gap-3">
                            {asMediaUrlList((currentQuestion as any).imageUrls).map((imageUrl: string, index: number) => (
                              <ProtectedExamImage
                                key={index}
                                src={imageUrl}
                                imageKind="question"
                                alt=""
                                className="max-w-full h-auto rounded-lg max-h-[700px]"
                              />
                            ))}
                            {asMediaUrlList((currentQuestion as any).imageUrls).length === 0 &&
                              (currentQuestion as any).imageUrl && (
                              <ProtectedExamImage
                                src={(currentQuestion as any).imageUrl}
                                imageKind="question"
                                alt=""
                                className="max-w-full h-auto rounded-lg max-h-[700px]"
                              />
                            )}
                          </div>
                        )}

                        {(currentQuestion as any).audioUrl && (
                          <ExamAudioPlayer
                            src={resolveExamMediaUrl((currentQuestion as any).audioUrl, "question-audio")}
                            maxPlays={1}
                            className="w-full"
                            key={`audio-${currentQuestion.id}`}
                          />
                        )}

                        <RadioGroup
                          value={sectionAnswers[currentQuestion.id] || ""}
                          onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                          className="gap-2.5"
                          disabled={sectionCompleted}
                        >
                          {optionList(currentQuestion.options).map((option: any, index: number) => {
                            const optionText = typeof option === "string" ? option : option?.text;
                            const value = index.toString();
                            return (
                              <ExamOptionRow
                                key={index}
                                id={`option-${currentQuestion.id}-${index}`}
                                value={value}
                                selected={sectionAnswers[currentQuestion.id] === value}
                                label={`${String.fromCharCode(65 + index)}. ${optionText ?? ""}`}
                                option={option}
                              />
                            );
                          })}
                        </RadioGroup>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Desktop nav */}
            {currentQuestion && (
              <div className="hidden sm:flex justify-between gap-3 mt-2">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0 || sectionCompleted}
                  size="lg"
                  className="min-w-[8rem]"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Trước
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={currentQuestionIndex >= parentCount - 1 || sectionCompleted}
                  size="lg"
                  className="min-w-[8rem]"
                >
                  Sau
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
            </div>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-24 space-y-3">
              <Button
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting || sectionCompleted}
                size="lg"
                className="w-full"
              >
                {hasNextSection() ? "Xong phần này" : "Nộp bài"}
              </Button>

              <Card className="border-neutral-200 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium text-neutral-600">
                    Câu hỏi
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-5 gap-1.5">
                    {(currentSection?.questions || []).map((question, index) => {
                      const isCurrent = index === currentQuestionIndex;
                      const isAnswered = isQuestionFullyAnswered(question, sectionAnswers);
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => !sectionCompleted && setCurrentQuestionIndex(index)}
                          disabled={sectionCompleted}
                          className={cn(
                            "aspect-square text-sm rounded-lg font-semibold border transition-colors",
                            isCurrent
                              ? "bg-primary text-primary-foreground border-primary"
                              : isAnswered
                                ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
                                : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300",
                            sectionCompleted && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden border-t border-neutral-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="px-3 py-2.5 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0 || sectionCompleted}
            aria-label="Câu trước"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            className="flex-1 h-11"
            disabled={isSubmitting || sectionCompleted}
            onClick={() => setShowSubmitDialog(true)}
          >
            {hasNextSection() ? "Xong phần" : "Nộp bài"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleNext}
            disabled={currentQuestionIndex >= parentCount - 1 || sectionCompleted}
            aria-label="Câu sau"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {parentCount > 0 && (
          <div className="px-3 pb-2.5 overflow-x-auto flex gap-1.5">
            {(currentSection?.questions || []).map((question, index) => {
              const isCurrent = index === currentQuestionIndex;
              const isAnswered = isQuestionFullyAnswered(question, sectionAnswers);
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => !sectionCompleted && setCurrentQuestionIndex(index)}
                  disabled={sectionCompleted}
                  className={cn(
                    "h-8 min-w-8 px-2 rounded-md text-xs font-semibold border shrink-0",
                    isCurrent
                      ? "bg-primary text-primary-foreground border-primary"
                      : isAnswered
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200",
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Section Complete Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasNextSection() ? `Xong ${sectionConfig?.title || "phần này"}?` : "Nộp bài?"}
            </DialogTitle>
            <DialogDescription>
              Đã trả lời {answeredCount}/{totalQuestionsInSection} · Còn {formatTime(sectionTimeLeft)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Quay lại
            </Button>
            <Button
              onClick={() => {
                setShowSubmitDialog(false);
                handleSectionComplete();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "…"
                : hasNextSection()
                  ? "Xong phần"
                  : "Nộp bài"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Rời bài thi?</DialogTitle>
            <DialogDescription>
              Tiến độ đang làm sẽ được giữ nếu bạn quay lại.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={handleExitCancel}
              data-testid="button-cancel-exit"
            >
              Ở lại
            </Button>
            <Button 
              onClick={handleExitConfirm}
              data-testid="button-confirm-exit"
              variant="destructive"
            >
              Rời đi
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
          setLocation(getExamReturnPath());
        }}
      >
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Mua gói để tiếp tục</DialogTitle>
            <DialogDescription>
              {examAccess?.requiresPurchase || examAccess?.mode === "denied"
                ? `Cần mua gói${examAccess?.level ? ` ${examAccess.level}` : ""}${
                    purchasePriceVnd
                      ? ` (${purchasePriceVnd.toLocaleString("vi-VN")}đ)`
                      : ""
                  } để làm đầy đủ đề.`
                : `Hết ${EXAM_TRIAL_QUESTION_LIMIT} câu thi thử. Mua gói (${purchasePriceVnd.toLocaleString("vi-VN")}đ) để làm đầy đủ đề.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handlePurchaseDismiss}>
              Quay lại
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