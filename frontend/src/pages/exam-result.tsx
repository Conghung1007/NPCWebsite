import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  RotateCcw,
  Home,
  Share2,
  ArrowLeft,
  Award,
  Shield,
  Lock,
} from "lucide-react";
import { type ExamAttempt, type Exam } from "@shared/schema";
import { examKeys } from "@/lib/queryKeys";
import { ExamProtectedContent, ProtectedExamImage } from "@/components/ExamProtectedContent";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { examPublicPath } from "@/lib/contentPaths";
import {
  PostExamPackagePromoDialog,
  hasSeenPackagePromo,
  markPackagePromoSeen,
} from "@/components/PostExamPackagePromoDialog";
import { didAttemptPass, getAttemptSectionScores } from "@/lib/examPass";
import { asMediaUrlList, resolveExamMediaUrl } from "@/lib/examMediaUrl";
import { portalPath } from "@/lib/portal";
import {
  getExamReturnPath,
  clearExamReturnPath,
} from "@/lib/examReturn";
import { useExamSessionLock } from "@/components/ExamReturnTracker";

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

function hasUserAnswer(userAnswer: unknown): boolean {
  return userAnswer != null && String(userAnswer).trim() !== "";
}

function answersMatch(userAnswer: unknown, correctAnswer: unknown): boolean {
  if (!hasUserAnswer(userAnswer)) return false;
  return String(userAnswer) === String(correctAnswer);
}

/** Passage-only parents (have subs, no options) are not scored. */
function isScorableItem(item: {
  question: { options?: unknown; subQuestions?: unknown[] };
}): boolean {
  const hasSubs =
    Array.isArray(item.question.subQuestions) &&
    item.question.subQuestions.length > 0;
  const opts = optionList(item.question.options);
  if (hasSubs && opts.length === 0) return false;
  return true;
}

function ResultOptionImages({ option }: { option: unknown }) {
  if (typeof option === "string" || !option || typeof option !== "object") {
    return null;
  }
  const o = option as { imageUrl?: string; imageUrls?: unknown };
  const urls = asMediaUrlList(o.imageUrls);
  const legacy = o.imageUrl?.trim();
  const list = urls.length > 0 ? urls : legacy ? [legacy] : [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {list.map((imageUrl, imgIndex) => (
        <ProtectedExamImage
          key={imgIndex}
          src={imageUrl}
          imageKind="answer"
          alt={`Option illustration ${imgIndex + 1}`}
          className="max-w-full h-auto rounded-md shadow-sm max-h-[420px]"
        />
      ))}
    </div>
  );
}

function maxPointsFromSnapshot(
  snap: {
    questions?: Record<string, { points?: number; parentId?: string | null }>;
  } | null,
): number {
  if (!snap?.questions) return 0;
  const entries = Object.entries(snap.questions);
  const childParentIds = new Set(
    entries
      .map(([, q]) => q?.parentId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  let total = 0;
  for (const [id, q] of entries) {
    // Skip passage parents that only exist as containers for children
    if (childParentIds.has(id) && (q?.parentId == null || q.parentId === "")) {
      continue;
    }
    total += Number(q?.points) || 1;
  }
  return total;
}

interface ExamResultPageProps {
  attemptId: string;
}

export function ExamResultPage({ attemptId }: ExamResultPageProps) {
  const [, setLocation] = useLocation();
  useExamSessionLock();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdminViewer = user?.role === "admin" || user?.role === "manager";
  const returnHref = getExamReturnPath();
  const goBackAfterExam = () => {
    clearExamReturnPath();
    setLocation(returnHref);
  };

  // Fetch exam attempt details
  const { data: attempt, isLoading: attemptLoading } = useQuery<ExamAttempt & { scoreOnly?: boolean }>({
    queryKey: [`/api/exam-attempts/${attemptId}`],
    retry: false,
  });

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: examKeys.detail(attempt?.examId || ""),
    enabled: !!attempt?.examId,
    retry: false,
  });

  const isDemoExam = Boolean(exam?.isDemo);
  const attemptAccessMode =
    attempt?.clientState &&
    typeof attempt.clientState === "object" &&
    !Array.isArray(attempt.clientState)
      ? (attempt.clientState as { accessMode?: string }).accessMode
      : undefined;
  /** Logged-in trial of package exam #1 (10 questions). */
  const isTrialAttempt = attemptAccessMode === "trial";
  /** Post-exam package promo: free demo OR package trial (skip for staff). */
  const needsPackagePromo =
    Boolean(exam) && !isAdminViewer && (isDemoExam || isTrialAttempt);
  const promoKind: "demo" | "trial" = isTrialAttempt ? "trial" : "demo";
  const isGuestDemo =
    needsPackagePromo && isDemoExam && !authLoading && !isAuthenticated;
  /** Trial attempts always have a userId; guests cannot open them. */
  const isMemberPromo =
    needsPackagePromo && !authLoading && isAuthenticated;
  /** Wait until exam is known so guests never fetch answer keys for demo. */
  const canFetchAnswerDetails =
    !authLoading &&
    !!exam &&
    (!exam.isDemo || isAuthenticated || isAdminViewer);

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);

  useEffect(() => {
    if (!needsPackagePromo || authLoading || !attemptId) return;
    if (isGuestDemo) {
      setPromoOpen(true);
      setPromoDismissed(false);
      return;
    }
    if (isMemberPromo) {
      if (hasSeenPackagePromo(attemptId)) {
        setPromoDismissed(true);
        setPromoOpen(false);
      } else {
        setPromoOpen(true);
        setPromoDismissed(false);
      }
    }
  }, [needsPackagePromo, authLoading, isGuestDemo, isMemberPromo, attemptId]);

  const handlePromoOpenChange = (open: boolean) => {
    setPromoOpen(open);
    if (!open && isMemberPromo) {
      markPackagePromoSeen(attemptId);
      setPromoDismissed(true);
    }
  };

  // Fetch questions with answers (supports legacy array or { questions, scoringSnapshot })
  const {
    data: detailsPayload,
    isLoading: questionsLoading,
    isError: detailsError,
    refetch: refetchDetails,
  } = useQuery<any>({
    queryKey: [`/api/exam-attempts/${attemptId}/details`],
    enabled: !!attemptId && !!exam && canFetchAnswerDetails && !authLoading,
    retry: false,
  });

  const scoreOnlyPayload = Boolean(
    detailsPayload?.scoreOnly || (attempt as { scoreOnly?: boolean } | undefined)?.scoreOnly,
  );
  const questionsWithAnswers = Array.isArray(detailsPayload)
    ? detailsPayload
    : scoreOnlyPayload
      ? []
      : detailsPayload?.questions || [];
  /** Prefer details payload; guest score-only falls back to attempt snapshot (answers stripped server-side). */
  const scoringSnapshot = Array.isArray(detailsPayload)
    ? null
    : detailsPayload?.scoringSnapshot ||
      (attempt as { scoringSnapshot?: unknown } | undefined)?.scoringSnapshot ||
      null;
  const snapshotExamPassing =
    !Array.isArray(detailsPayload) && detailsPayload?.examPassingScore != null
      ? detailsPayload.examPassingScore
      : (scoringSnapshot as { examPassingScore?: number | null } | null)
          ?.examPassingScore ?? null;

  const showAnswerBreakdown =
    !needsPackagePromo ||
    isAdminViewer ||
    (isMemberPromo && promoDismissed && !promoOpen && questionsWithAnswers.length > 0);

  /** Member promo: hide score UI until package promo dismissed. */
  const showResultBody =
    !isMemberPromo || promoDismissed || isAdminViewer;

  /** Don't block promo on details fetch — only block result body when answers needed. */
  const blockOnDetails =
    canFetchAnswerDetails &&
    questionsLoading &&
    (!isMemberPromo || promoDismissed);

  if (attemptLoading || examLoading || authLoading || blockOnDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        {needsPackagePromo && exam ? (
          <PostExamPackagePromoDialog
            open={promoOpen}
            onOpenChange={handlePromoOpenChange}
            mode={isGuestDemo ? "guest" : "member"}
            promoKind={promoKind}
            examTitle={exam.title}
            preferredPackageId={exam.packageId}
            preferredLevel={exam.level}
            returnPath={`/exam-result/${attemptId}`}
          />
        ) : null}
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Đang tải kết quả thi...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Không tìm thấy kết quả</h2>
            <p className="text-gray-600 mb-6">
              Kết quả thi này không tồn tại hoặc đã bị xóa.
            </p>
            <Button onClick={goBackAfterExam}>
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailsError && canFetchAnswerDetails && !scoreOnlyPayload) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
        <Card className="max-w-md mx-auto w-full">
          <CardContent className="text-center py-12 space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold">Không tải được chi tiết kết quả</h2>
            <p className="text-gray-600 text-sm">
              Có lỗi khi tải đáp án. Bạn vẫn có thể xem tổng điểm sau khi thử lại.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={() => refetchDetails()}>Thử lại</Button>
              <Button
                variant="outline"
                onClick={goBackAfterExam}
              >
                Quay lại
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detect sections format vs legacy format
  const useSections =
    (scoringSnapshot?.sections && scoringSnapshot.sections.length > 0) ||
    ((exam as any).sections && Array.isArray((exam as any).sections) && (exam as any).sections.length > 0);
  
  const countQuestions = (item: any) => {
    let count = 0;
    if (isScorableItem(item)) count += 1;
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      count += item.question.subQuestions.length;
    }
    return count;
  };

  const countCorrect = (item: any) => {
    let correct = 0;
    if (isScorableItem(item) && answersMatch(item.userAnswer, item.question.correctAnswer)) {
      correct++;
    }
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any) => {
        if (answersMatch(sub.userAnswer, sub.correctAnswer)) correct++;
      });
    }
    return correct;
  };

  const calculateTotalPoints = (item: any) => {
    let total = 0;
    if (isScorableItem(item)) {
      total += parseFloat(item.question.points) || 1;
    }
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any) => {
        total += parseFloat(sub.points) || 1;
      });
    }
    return total;
  };

  const calculateEarnedPoints = (item: any) => {
    let earned = 0;
    if (isScorableItem(item) && answersMatch(item.userAnswer, item.question.correctAnswer)) {
      earned += parseFloat(item.question.points) || 1;
    }
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any) => {
        if (answersMatch(sub.userAnswer, sub.correctAnswer)) {
          earned += parseFloat(sub.points) || 1;
        }
      });
    }
    return earned;
  };
  
  // Group questions by sections (new format)
  let sectionGroups: any[] = [];
  let totalTimeLimit = 0;
  
  if (useSections) {
    // Prefer frozen section meta from scoring snapshot when present
    const sourceSections =
      scoringSnapshot?.sections?.length > 0
        ? scoringSnapshot.sections.map((s: any) => ({
            id: s.id,
            sectionName: s.sectionName,
            timeLimit: s.timeLimit,
            passingScore: s.passingScore,
            questionSets: [{ questionIds: s.questionIds }],
          }))
        : (exam as any).sections;

    sectionGroups = sourceSections.map((section: any, sectionIdx: number) => {
      // Extract question IDs from either questionSets (new) or questionIds (legacy)
      let sectionQuestionIds: string[] = [];
      
      if (section.questionSets && Array.isArray(section.questionSets)) {
        // New structure: flatten all questions from all question sets
        sectionQuestionIds = section.questionSets.flatMap((qs: any) => 
          qs.questionIds || []
        );
      } else if (section.questionIds) {
        // Legacy structure: use questionIds directly
        sectionQuestionIds = section.questionIds;
      }
      
      const sectionQuestions = questionsWithAnswers.filter(item => 
        sectionQuestionIds.includes(item.question.id)
      );
      
      // Calculate section stats based on points
      let sectionTotalPoints = 0;
      let sectionEarnedPoints = 0;
      let sectionTotalQuestions = 0;
      let sectionCorrect = 0;
      
      sectionQuestions.forEach(item => {
        sectionTotalPoints += calculateTotalPoints(item);
        sectionEarnedPoints += calculateEarnedPoints(item);
        sectionTotalQuestions += countQuestions(item); // Keep for display
        sectionCorrect += countCorrect(item); // Keep for display
      });
      
      const sectionScore = sectionTotalPoints > 0 
        ? (sectionEarnedPoints / sectionTotalPoints) * 100 
        : 0;
      
      // Determine if section passed based on passing score (now compares points)
      const sectionPassingScore = section.passingScore;
      const sectionPassed = (sectionPassingScore == null || sectionPassingScore === undefined) ? true : sectionEarnedPoints >= sectionPassingScore;
      
      return {
        id: section.id,
        title: section.sectionName || section.type || `Phần ${sectionIdx + 1}`,
        content: section.content,
        timeLimit: section.timeLimit || 0,
        passingScore: sectionPassingScore,
        questions: sectionQuestions,
        totalQuestions: sectionTotalQuestions,
        correctAnswers: sectionCorrect,
        totalPoints: sectionTotalPoints,
        earnedPoints: sectionEarnedPoints,
        score: sectionScore,
        passed: sectionPassed
      };
    }).filter((section: any) => section.totalQuestions > 0 || questionsWithAnswers.length === 0);

    totalTimeLimit = (Array.isArray(sourceSections) ? sourceSections : []).reduce(
      (sum: number, s: any) => sum + (Number(s.timeLimit) || 0),
      0,
    );
  } else {
    // Legacy format - create groups from legacy fields
    const legacySections = [
      { 
        key: 'vocabulary', 
        title: 'Từ vựng',
        questionIds: (exam as any).vocabularyQuestions || [],
        timeLimit: (exam as any).vocabularyTimeLimit || 0
      },
      { 
        key: 'grammar', 
        title: 'Ngữ pháp',
        questionIds: (exam as any).grammarQuestions || [],
        timeLimit: (exam as any).grammarTimeLimit || 0
      },
      { 
        key: 'listening', 
        title: 'Nghe hiểu',
        questionIds: (exam as any).listeningQuestions || [],
        timeLimit: (exam as any).listeningTimeLimit || 0
      },
      { 
        key: 'reading', 
        title: 'Đọc hiểu',
        questionIds: (exam as any).readingQuestions || [],
        timeLimit: (exam as any).readingTimeLimit || 0
      }
    ];
    
    sectionGroups = legacySections
      .filter(section => section.questionIds.length > 0)
      .map(section => {
        const sectionQuestions = questionsWithAnswers.filter(item => 
          section.questionIds.includes(item.question.id)
        );
        
        let sectionTotalPoints = 0;
        let sectionEarnedPoints = 0;
        let sectionTotalQuestions = 0;
        let sectionCorrect = 0;
        
        sectionQuestions.forEach(item => {
          sectionTotalPoints += calculateTotalPoints(item);
          sectionEarnedPoints += calculateEarnedPoints(item);
          sectionTotalQuestions += countQuestions(item); // Keep for display
          sectionCorrect += countCorrect(item); // Keep for display
        });
        
        const sectionScore = sectionTotalPoints > 0 
          ? (sectionEarnedPoints / sectionTotalPoints) * 100 
          : 0;
        
        // Legacy sections don't have passing scores
        return {
          id: section.key,
          title: section.title,
          timeLimit: section.timeLimit,
          passingScore: undefined,
          questions: sectionQuestions,
          totalQuestions: sectionTotalQuestions,
          correctAnswers: sectionCorrect,
          totalPoints: sectionTotalPoints,
          earnedPoints: sectionEarnedPoints,
          score: sectionScore,
          passed: true // Legacy sections always pass
        };
      });
    
    totalTimeLimit = ((exam as any).vocabularyTimeLimit || 0) + ((exam as any).grammarTimeLimit || 0) + ((exam as any).listeningTimeLimit || 0) + ((exam as any).readingTimeLimit || 0);
  }
  
  // Calculate overall stats based on points
  let totalPoints = sectionGroups.reduce((sum, section) => sum + (Number(section.totalPoints) || 0), 0);
  let earnedPoints = sectionGroups.reduce((sum, section) => sum + section.earnedPoints, 0);

  const isScoreOnlyView = questionsWithAnswers.length === 0 || scoreOnlyPayload;

  // Score-only: use attempt totals + section scores (server truth)
  if (isScoreOnlyView) {
    earnedPoints = Number(attempt.totalScore) || 0;
    const maxFromSnap = maxPointsFromSnapshot(
      scoringSnapshot as {
        questions?: Record<string, { points?: number; parentId?: string | null }>;
      } | null,
    );
    totalPoints = maxFromSnap > 0 ? maxFromSnap : Math.max(earnedPoints, 0);
    const rows = getAttemptSectionScores(exam, attempt);
    if (rows.length > 0) {
      sectionGroups = rows.map((row) => ({
        id: row.sectionId,
        title: row.label,
        content: undefined,
        timeLimit: 0,
        passingScore: row.passingScore,
        questions: [],
        totalQuestions: 0,
        correctAnswers: 0,
        totalPoints: row.passingScore != null && row.passingScore > 0 ? row.passingScore : null,
        earnedPoints: row.score,
        score: 0,
        passed: row.passed,
        scoreOnly: true,
      }));
    }
  } else if (attempt.totalScore != null) {
    earnedPoints = Number(attempt.totalScore) || earnedPoints;
  }

  const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

  const examPassingScore =
    snapshotExamPassing != null
      ? snapshotExamPassing
      : (exam as any).passingScore;
  const failedSections = sectionGroups.filter((section) => !section.passed);

  // Single source of truth for pass/fail (matches certificate / admin)
  const examPassed = didAttemptPass(exam, attempt);
  let failureReason = "";
  if (!examPassed) {
    failureReason = failedSections.length
      ? `Không đạt do không đạt điểm tối thiểu tại: ${failedSections.map((s) => s.title).join(", ")}`
      : examPassingScore != null && examPassingScore > 0
        ? `Không đạt do tổng điểm (${earnedPoints}) thấp hơn điểm đạt của bài thi (${examPassingScore})`
        : "Không đạt yêu cầu điểm của bài thi";
  }

  const totalTimeSpentSec = Math.max(0, Number(attempt.totalTimeSpent) || 0);
  const totalTimeMinutes = Math.floor(totalTimeSpentSec / 60);
  const totalTimeSeconds = totalTimeSpentSec % 60;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const scoreBadge = examPassed
    ? { text: "Đạt", color: "bg-green-600" }
    : { text: "Không đạt", color: "bg-red-600" };

  const packagesHref = portalPath("luyenthi", "/online-exam") + "#exam-packages";

  return (
    <ExamProtectedContent
      className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12"
      protectDocument={!isAdminViewer}
    >
      {needsPackagePromo ? (
        <PostExamPackagePromoDialog
          open={promoOpen}
          onOpenChange={handlePromoOpenChange}
          mode={isGuestDemo ? "guest" : "member"}
          promoKind={promoKind}
          examTitle={exam.title}
          preferredPackageId={exam.packageId}
          preferredLevel={exam.level}
          returnPath={`/exam-result/${attemptId}`}
        />
      ) : null}

      {!showResultBody ? (
        <div className="max-w-lg mx-auto px-4 py-24 text-center text-muted-foreground space-y-3">
          <p className="text-base font-medium text-foreground">Xem gói đề luyện thi</p>
          <p className="text-sm">Đóng hộp thoại phía trên để xem chi tiết kết quả bài vừa làm.</p>
        </div>
      ) : (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {isAdminViewer && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Xem bởi admin</p>
                <p className="text-sm text-amber-800">
                  Chế độ quản trị: tắt chống sao chép để thuận tiện đối chiếu / hỗ trợ.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 bg-white hover:bg-amber-100"
              onClick={() => setLocation("/cpanel/results")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Về kết quả thi
            </Button>
          </div>
        )}

        {isGuestDemo ? (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-orange-950">
            <div className="flex items-start gap-2">
              <Lock className="w-5 h-5 mt-0.5 shrink-0 text-orange-600" />
              <div>
                <p className="font-semibold">Chỉ xem tổng điểm (đề miễn phí)</p>
                <p className="text-sm text-orange-800">
                  Đăng ký / đăng nhập để mở đáp án chi tiết, lưu kết quả và mua gói đề chính thức.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="font-bold text-white shrink-0"
              style={{ backgroundColor: "#F97316" }}
              onClick={() => setPromoOpen(true)}
            >
              Đăng ký & xem gói đề
            </Button>
          </div>
        ) : null}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full ${scoreBadge.color} flex items-center justify-center`}>
              <Trophy className="w-10 h-10 text-white" aria-hidden />
            </div>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Kết quả bài thi
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-green-700 mb-2 leading-tight">
            {exam.title}
          </h1>
          <Badge className={`${scoreBadge.color} text-white`}>
            {scoreBadge.text}
          </Badge>
        </div>

        {/* Score Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className={`text-3xl font-bold ${examPassed ? 'text-green-600' : 'text-red-600'} whitespace-nowrap`}>
                {examPassed ? 'Đạt' : 'Không đạt'}
              </div>
              <p className="text-sm text-gray-600 mt-1 whitespace-nowrap">Kết quả</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 mr-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {totalTimeMinutes}:{totalTimeSeconds.toString().padStart(2, '0')}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Thời gian làm bài</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600 mr-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {totalTimeLimit}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Giới hạn (phút)</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900">
                {new Date(attempt.completedAt || Date.now()).toLocaleDateString("vi-VN")}
              </div>
              <p className="text-sm text-gray-600 mt-1">Ngày thi</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Visualization */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Chi tiết kết quả
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Điểm số đạt được</span>
                  <span className={getScoreColor(scorePercentage)}>
                    {earnedPoints.toFixed(1)}/{totalPoints.toFixed(1)} điểm ({scorePercentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={scorePercentage} className="h-3" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm">
                    <strong>{earnedPoints.toFixed(1)}</strong> điểm đạt được
                  </span>
                </div>
                <div className="flex items-center">
                  <XCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-sm">
                    <strong>{(totalPoints - earnedPoints).toFixed(1)}</strong> điểm bị mất
                  </span>
                </div>
              </div>
              
              {/* Passing score information */}
              {examPassingScore != null && examPassingScore > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Điểm đạt yêu cầu của bài thi:</span>
                    <span className="font-semibold">{examPassingScore} điểm</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Trạng thái:</span>
                    <Badge variant={examPassed ? "default" : "destructive"}>
                      {examPassed ? "Đạt" : "Không đạt"}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Failure reason message */}
        {!examPassed && failureReason && (
          <Card className="mb-8 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start">
                <XCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Lý do không đạt</h3>
                  <p className="text-sm text-red-800">{failureReason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Details with Questions */}
        {showAnswerBreakdown && sectionGroups.length > 0 && sectionGroups.map((section, sectionIdx) => (
          <Card key={section.id} className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">
                    {section.title}
                    {section.content && <span className="text-sm font-normal text-gray-600 ml-2">- {section.content}</span>}
                  </CardTitle>
                  {section.passingScore != null && section.passingScore > 0 && (
                    <Badge variant={section.passed ? "default" : "destructive"} className="ml-2">
                      {section.passed ? "Đạt" : "Không đạt"}
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${section.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {section.passed ? 'Đạt' : 'Không đạt'}
                  </div>
                  <div className="text-xs text-gray-600">
                    {section.scoreOnly || section.totalPoints == null
                      ? `${Number(section.earnedPoints).toFixed(1)} điểm`
                      : `${Number(section.earnedPoints).toFixed(1)}/${Number(section.totalPoints).toFixed(1)} điểm`}
                    {section.passingScore != null && section.passingScore > 0 && (
                      <span className="ml-1">(yêu cầu: {section.passingScore} điểm)</span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {section.questions.map((item: any, qIdx: number) => {
                  const hasSubQuestions = item.question.subQuestions && item.question.subQuestions.length > 0;
                  const descriptionImageUrls = asMediaUrlList(
                    item.question.descriptionImageUrls,
                  );
                  const questionImageUrls = asMediaUrlList(item.question.imageUrls);
                  const legacyQuestionImage =
                    typeof item.question.imageUrl === "string"
                      ? item.question.imageUrl.trim()
                      : "";
                  const parentOptions = optionList(item.question.options);
                  
                  return (
                    <div key={item.question.id} className="border-b pb-6 last:border-b-0">
                      {/* Parent Question Description (if has sub-questions) */}
                      {hasSubQuestions && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          {item.question.description && (
                            <div className="mb-3">
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {item.question.description}
                              </p>
                            </div>
                          )}
                          
                          {/* Parent Description Images */}
                          {descriptionImageUrls.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-3 justify-center">
                              {descriptionImageUrls.map((imgUrl: string, imgIdx: number) => (
                                <ProtectedExamImage
                                  key={imgIdx}
                                  src={imgUrl}
                                  imageKind="description"
                                  alt={`Description ${imgIdx + 1}`}
                                  className="max-w-full h-auto rounded-lg border shadow-sm max-h-[560px]"
                                />
                              ))}
                            </div>
                          )}
                          
                          {/* Parent Description Audio */}
                          {item.question.descriptionAudioUrl && (
                            <div className="mb-3">
                              <audio controls className="w-full max-w-md" preload="metadata">
                                <source
                                  src={resolveExamMediaUrl(
                                    item.question.descriptionAudioUrl,
                                    "question-description-audio",
                                  )}
                                />
                              </audio>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Parent Question */}
                      <div className="mb-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            Câu {qIdx + 1}{hasSubQuestions ? '.1' : ''}: {item.question.questionText}
                          </h4>
                          {isScorableItem(item) ? (
                            <div className="flex items-center ml-4">
                              {answersMatch(item.userAnswer, item.question.correctAnswer) ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-600" />
                              )}
                            </div>
                          ) : null}
                        </div>
                        
                        {/* Parent Question Images */}
                        {(questionImageUrls.length > 0 || legacyQuestionImage) && (
                          <div className="flex flex-wrap gap-3 mb-4 justify-center">
                            {questionImageUrls.length > 0
                              ? questionImageUrls.map((imgUrl: string, imgIdx: number) => (
                                  <ProtectedExamImage
                                    key={imgIdx}
                                    src={imgUrl}
                                    alt={`Question ${imgIdx + 1}`}
                                    className="max-w-full h-auto rounded-lg shadow-sm max-h-[560px]"
                                  />
                                ))
                              : (
                                  <ProtectedExamImage
                                    src={legacyQuestionImage}
                                    alt="Question illustration"
                                    className="max-w-full h-auto rounded-lg shadow-sm max-h-[560px]"
                                  />
                                )}
                          </div>
                        )}

                        <div className="space-y-2 text-sm">
                          {parentOptions.map((option, optionIndex) => {
                            const isUserAnswer = String(item.userAnswer) === optionIndex.toString();
                            const isCorrectAnswer = String(item.question.correctAnswer) === optionIndex.toString();
                            const optionText = typeof option === 'string' ? option : option?.text;
                            
                            return (
                              <div
                                key={optionIndex}
                                className={`p-2 rounded ${
                                  isCorrectAnswer
                                    ? 'bg-green-100 border border-green-300'
                                    : isUserAnswer
                                      ? 'bg-red-100 border border-red-300'
                                      : 'bg-gray-50'
                                }`}
                              >
                                <span className="font-medium">
                                  {String.fromCharCode(65 + optionIndex)}.
                                </span>{' '}
                                {optionText}
                                {isCorrectAnswer && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Đáp án đúng
                                  </Badge>
                                )}
                                {isUserAnswer && !isCorrectAnswer && (
                                  <Badge variant="destructive" className="ml-2 text-xs">
                                    Bạn đã chọn
                                  </Badge>
                                )}
                                {isUserAnswer && isCorrectAnswer && (
                                  <Badge className="ml-2 text-xs bg-green-600">
                                    Bạn đã chọn đúng
                                  </Badge>
                                )}
                                <ResultOptionImages option={option} />
                              </div>
                            );
                          })}
                        </div>

                        {item.question.explanation && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>Giải thích:</strong> {item.question.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Sub-Questions */}
                      {hasSubQuestions && (
                        <div className="space-y-4">
                          {item.question.subQuestions.map((subQ: any, subIdx: number) => {
                            const subImageUrls = asMediaUrlList(subQ.imageUrls);
                            const subLegacyImage =
                              typeof subQ.imageUrl === "string" ? subQ.imageUrl.trim() : "";
                            const subOptions = optionList(subQ.options);
                            
                            return (
                              <div key={subQ.id}>
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="font-medium text-gray-900">
                                    Câu {qIdx + 1}.{subIdx + 2}: {subQ.questionText}
                                  </h5>
                                  <div className="flex items-center ml-4">
                                    {answersMatch(subQ.userAnswer, subQ.correctAnswer) ? (
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Sub-Question Images */}
                                {(subImageUrls.length > 0 || subLegacyImage) && (
                                  <div className="flex flex-wrap gap-3 mb-4 justify-center">
                                    {subImageUrls.length > 0
                                      ? subImageUrls.map((imgUrl: string, imgIdx: number) => (
                                          <ProtectedExamImage
                                            key={imgIdx}
                                            src={imgUrl}
                                            alt={`Sub-question ${imgIdx + 1}`}
                                            className="max-w-full h-auto rounded-lg shadow-sm max-h-[560px]"
                                          />
                                        ))
                                      : (
                                          <ProtectedExamImage
                                            src={subLegacyImage}
                                            alt="Sub-question illustration"
                                            className="max-w-full h-auto rounded-lg shadow-sm max-h-[560px]"
                                          />
                                        )}
                                  </div>
                                )}

                                <div className="space-y-2 text-sm">
                                  {subOptions.map((option, optionIndex) => {
                                    const isUserAnswer = String(subQ.userAnswer) === optionIndex.toString();
                                    const isCorrectAnswer = String(subQ.correctAnswer) === optionIndex.toString();
                                    const optionText = typeof option === 'string' ? option : option?.text;
                                    
                                    return (
                                      <div
                                        key={optionIndex}
                                        className={`p-2 rounded ${
                                          isCorrectAnswer
                                            ? 'bg-green-100 border border-green-300'
                                            : isUserAnswer
                                              ? 'bg-red-100 border border-red-300'
                                              : 'bg-gray-50'
                                        }`}
                                      >
                                        <span className="font-medium">
                                          {String.fromCharCode(65 + optionIndex)}.
                                        </span>{' '}
                                        {optionText}
                                        {isCorrectAnswer && (
                                          <Badge variant="secondary" className="ml-2 text-xs">
                                            Đáp án đúng
                                          </Badge>
                                        )}
                                        {isUserAnswer && !isCorrectAnswer && (
                                          <Badge variant="destructive" className="ml-2 text-xs">
                                            Bạn đã chọn
                                          </Badge>
                                        )}
                                        {isUserAnswer && isCorrectAnswer && (
                                          <Badge className="ml-2 text-xs bg-green-600">
                                            Bạn đã chọn đúng
                                          </Badge>
                                        )}
                                        <ResultOptionImages option={option} />
                                      </div>
                                    );
                                  })}
                                </div>

                                {subQ.explanation && (
                                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                      <strong>Giải thích:</strong> {subQ.explanation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {isGuestDemo && !showAnswerBreakdown ? (
          <Card className="mb-8 border-dashed">
            <CardContent className="py-10 text-center space-y-3">
              <Lock className="w-10 h-10 mx-auto text-orange-500" />
              <h3 className="text-lg font-semibold text-foreground">
                Đáp án chi tiết đã khóa
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Đăng ký tài khoản để xem từng câu đúng/sai, giải thích và lưu kết quả vào hồ sơ.
                Bạn cũng có thể chọn gói đề JLPT để luyện đầy đủ.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button
                  className="font-bold text-white"
                  style={{ backgroundColor: "#F97316" }}
                  onClick={() => setPromoOpen(true)}
                >
                  Mở khóa kết quả
                </Button>
                <Button variant="outline" asChild>
                  <Link href={packagesHref}>Xem gói đề</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Link href={examPublicPath(exam)}>
            <Button className="w-full sm:w-auto">
              <RotateCcw className="w-4 h-4 mr-2" />
              Thi lại
            </Button>
          </Link>

          {examPassed && (showAnswerBreakdown || isAdminViewer) && (
            <Link href={`/certificate/${attemptId}`}>
              <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700" data-testid="button-certificate">
                <Award className="w-4 h-4 mr-2" />
                Chứng nhận
              </Button>
            </Link>
          )}

          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={goBackAfterExam}
          >
            <Home className="w-4 h-4 mr-2" />
            Quay lại
          </Button>

          {isGuestDemo || isMemberPromo ? (
            <Link href={packagesHref}>
              <Button variant="outline" className="w-full sm:w-auto">
                Xem gói đề
              </Button>
            </Link>
          ) : null}

          <Button
            variant="outline"
            onClick={async () => {
              const shareText = `Tôi vừa hoàn thành bài thi "${exam.title}" với kết quả ${scorePercentage.toFixed(1)}% (${earnedPoints.toFixed(1)}/${totalPoints.toFixed(1)} điểm)`;
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: `Kết quả thi: ${exam.title}`,
                    text: shareText,
                    url: window.location.href,
                  });
                } else {
                  await navigator.clipboard.writeText(window.location.href);
                  toast({ title: "Đã sao chép liên kết kết quả" });
                }
              } catch (err: any) {
                if (err?.name === "AbortError") return;
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast({ title: "Đã sao chép liên kết kết quả" });
                } catch {
                  toast({
                    title: "Không chia sẻ được",
                    description: "Thử sao chép URL từ thanh địa chỉ.",
                    variant: "destructive",
                  });
                }
              }
            }}
            className="w-full sm:w-auto"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Chia sẻ
          </Button>
        </div>
      </div>
      )}
    </ExamProtectedContent>
  );
}

export default ExamResultPage;