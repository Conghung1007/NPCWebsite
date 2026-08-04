import type { ExamAttempt, Question } from "@shared/schema";
import { storage } from "./storage";
import {
  collectValidAnswerIds,
  listExamSections,
  scoreSingleSection,
  buildScoringSnapshot,
  computeServerSectionTimeSpent,
  computeWaitSeconds,
  filterAnswersToValidIds,
  type ScoredSectionResult,
  type ScoringSnapshot,
} from "./examScoring";

export type QuestionsById = Map<
  string,
  Question & { subQuestions?: Question[] }
>;

export async function loadQuestionsByIdForExam(
  examId: string
): Promise<QuestionsById> {
  const rawQuestions = await storage.getQuestionsByExamId(examId);
  const parentQuestions = rawQuestions.filter((q) => !q.parentId);
  const subsByParent = new Map<string, Question[]>();
  for (const q of rawQuestions) {
    if (!q.parentId) continue;
    if (!subsByParent.has(q.parentId)) subsByParent.set(q.parentId, []);
    subsByParent.get(q.parentId)!.push(q);
  }
  return new Map(
    parentQuestions.map((q) => {
      const subs = (subsByParent.get(q.id) || []).sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
      );
      return [
        q.id,
        {
          ...q,
          subQuestions: subs.length > 0 ? subs : undefined,
        },
      ] as const;
    })
  );
}

export function isAttemptOwner(
  attempt: ExamAttempt,
  sessionUser: { id: string } | null | undefined
): boolean {
  if (!attempt.userId) {
    // Anonymous session: anyone with the attempt id may continue (UUID secrecy)
    return true;
  }
  return !!sessionUser && sessionUser.id === attempt.userId;
}

export function assertInProgress(attempt: ExamAttempt): string | null {
  if (attempt.status !== "in_progress") {
    return "Phiên làm bài đã kết thúc hoặc không hợp lệ";
  }
  return null;
}

export function normalizeSectionResults(
  sectionResults: unknown
): ScoredSectionResult[] {
  if (Array.isArray(sectionResults)) return sectionResults as ScoredSectionResult[];
  if (sectionResults && typeof sectionResults === "object") {
    return Object.values(sectionResults as Record<string, ScoredSectionResult>);
  }
  return [];
}

export async function completeSectionOnAttempt(params: {
  attempt: ExamAttempt;
  exam: any;
  sectionId: string;
  answers: Record<string, string>;
  questionsById: QuestionsById;
}): Promise<
  | { ok: true; attempt: ExamAttempt; unknownIds: string[] }
  | { ok: false; status: number; message: string; unknownIds?: string[] }
> {
  const { attempt, exam, sectionId, answers, questionsById } = params;
  const sections = listExamSections(exam).filter((s) =>
    s.questionIds.some((id) => questionsById.has(id))
  );
  const section = sections.find((s) => s.id === sectionId);
  if (!section) {
    return { ok: false, status: 400, message: "Phần thi không hợp lệ" };
  }

  const validIds = collectValidAnswerIds(questionsById);
  const timeSpent = computeServerSectionTimeSpent(
    attempt.sectionStartedAt,
    section.timeLimit
  );

  const { result, unknownIds } = scoreSingleSection({
    sectionId,
    type: section.type,
    questionIds: section.questionIds,
    answers,
    timeSpent,
    questionsById,
    validIds,
  });

  if (unknownIds.length > 0) {
    return {
      ok: false,
      status: 400,
      message: "Có đáp án không thuộc đề thi",
      unknownIds,
    };
  }

  const existing = normalizeSectionResults(attempt.sectionResults).filter(
    (r) => r.sectionId !== sectionId
  );
  existing.push(result);

  const updated = await storage.updateExamAttempt(attempt.id, {
    sectionResults: existing as any,
    lastSectionCompletedAt: new Date(),
    sectionStartedAt: null,
    currentSectionId: null,
  } as any);

  if (!updated) {
    return { ok: false, status: 500, message: "Không cập nhật được phần thi" };
  }
  return { ok: true, attempt: updated, unknownIds: [] };
}

export async function finalizeAttempt(params: {
  attempt: ExamAttempt;
  exam: any;
  questionsById: QuestionsById;
  waitTimeBetweenSections: number;
}): Promise<ExamAttempt | null> {
  const { attempt, exam, questionsById, waitTimeBetweenSections } = params;
  const sectionResults = normalizeSectionResults(attempt.sectionResults);
  const totalScore =
    Math.round(sectionResults.reduce((s, r) => s + (r.score || 0), 0) * 100) /
    100;
  const totalTimeSpent = sectionResults.reduce(
    (s, r) => s + (r.timeSpent || 0),
    0
  );
  const scoringSnapshot: ScoringSnapshot = buildScoringSnapshot(
    exam,
    questionsById
  );

  return storage.updateExamAttempt(attempt.id, {
    status: "completed",
    completedAt: new Date(),
    totalScore,
    totalTimeSpent,
    waitTimeBetweenSections,
    scoringSnapshot: scoringSnapshot as any,
    sectionStartedAt: null,
    currentSectionId: null,
    clientState: null,
  } as any);
}

export function applyScoringSnapshotToQuestion(
  question: any,
  snapshot: ScoringSnapshot | null | undefined
): any {
  if (!snapshot?.questions) return question;
  const snap = snapshot.questions[question.id];
  if (!snap) return question;
  const subQuestions = Array.isArray(question.subQuestions)
    ? question.subQuestions.map((sub: any) => {
        const subSnap = snapshot.questions[sub.id];
        if (!subSnap) return sub;
        return {
          ...sub,
          correctAnswer: subSnap.correctAnswer,
          points: subSnap.points,
        };
      })
    : question.subQuestions;
  return {
    ...question,
    correctAnswer: snap.correctAnswer,
    points: snap.points,
    subQuestions,
  };
}

export { filterAnswersToValidIds, collectValidAnswerIds, listExamSections, computeWaitSeconds };
