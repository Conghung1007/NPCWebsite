/** Server-side exam attempt scoring — never trust client-reported scores. */

export type ScoredSectionResult = {
  sectionId: string;
  type: string;
  answers: Record<string, string>;
  timeSpent: number;
  score: number;
};

export type ScoringSnapshotQuestion = {
  correctAnswer: string;
  points: number;
  parentId: string | null;
  questionText?: string;
  options?: unknown;
};

export type ScoringSnapshot = {
  capturedAt: string;
  examPassingScore: number | null;
  sections: Array<{
    id: string;
    sectionName: string;
    timeLimit: number;
    passingScore: number | null;
    questionIds: string[];
  }>;
  questions: Record<string, ScoringSnapshotQuestion>;
};

type QuestionLike = {
  id: string;
  correctAnswer?: string | null;
  points?: string | number | null;
  parentId?: string | null;
  questionText?: string | null;
  options?: unknown;
  subQuestions?: QuestionLike[];
};

function flattenForScoring(question: QuestionLike): QuestionLike[] {
  const items: QuestionLike[] = [question];
  if (Array.isArray(question.subQuestions)) {
    items.push(...question.subQuestions);
  }
  return items;
}

/** All scorable question IDs (parents + subs) for an exam. */
export function collectValidAnswerIds(
  questionsById: Map<string, QuestionLike>
): Set<string> {
  const ids = new Set<string>();
  for (const q of questionsById.values()) {
    for (const item of flattenForScoring(q)) {
      ids.add(item.id);
    }
  }
  return ids;
}

/**
 * Keep only answers for known question IDs.
 * Returns unknownIds so the API can reject tampering.
 */
export function filterAnswersToValidIds(
  answers: Record<string, string> | null | undefined,
  validIds: Set<string>
): { filtered: Record<string, string>; unknownIds: string[] } {
  const filtered: Record<string, string> = {};
  const unknownIds: string[] = [];
  if (!answers || typeof answers !== "object") {
    return { filtered, unknownIds };
  }
  for (const [id, value] of Object.entries(answers)) {
    if (!validIds.has(id)) {
      unknownIds.push(id);
      continue;
    }
    if (value == null || value === "") continue;
    filtered[id] = String(value);
  }
  return { filtered, unknownIds };
}

export function scoreAnswersAgainstQuestions(
  answers: Record<string, string>,
  questions: QuestionLike[]
): number {
  let earned = 0;
  for (const question of questions) {
    for (const item of flattenForScoring(question)) {
      const userAnswer = answers[item.id];
      if (userAnswer == null || userAnswer === "") continue;
      if (String(userAnswer) === String(item.correctAnswer)) {
        earned += parseFloat(String(item.points ?? "1")) || 1;
      }
    }
  }
  return earned;
}

export function extractSectionQuestionIds(section: any): string[] {
  if (section?.questionSets && Array.isArray(section.questionSets)) {
    return section.questionSets.flatMap((set: any) => {
      if (Array.isArray(set.questionIds)) return set.questionIds.filter(Boolean);
      if (Array.isArray(set.questions)) {
        return set.questions
          .map((q: any) => (typeof q === "string" ? q : q?.id))
          .filter(Boolean);
      }
      return [];
    });
  }
  if (section?.questionIds && Array.isArray(section.questionIds)) {
    return section.questionIds.filter(Boolean);
  }
  return [];
}

export function listExamSections(
  exam: any
): Array<{ id: string; type: string; timeLimit: number; passingScore: number | null; questionIds: string[] }> {
  if (exam.sections && Array.isArray(exam.sections) && exam.sections.length > 0) {
    return exam.sections.map((section: any) => ({
      id: section.id,
      type: section.sectionName || section.type || "",
      timeLimit: Number(section.timeLimit) || 0,
      passingScore:
        section.passingScore == null ? null : Number(section.passingScore),
      questionIds: extractSectionQuestionIds(section),
    }));
  }
  return [
    {
      id: "section-1",
      type: "Từ vựng",
      timeLimit: Number(exam.vocabularyTimeLimit) || 0,
      passingScore: null,
      questionIds: Array.isArray(exam.vocabularyQuestions) ? exam.vocabularyQuestions : [],
    },
    {
      id: "section-2",
      type: "Ngữ pháp",
      timeLimit: Number(exam.grammarTimeLimit) || 0,
      passingScore: null,
      questionIds: Array.isArray(exam.grammarQuestions) ? exam.grammarQuestions : [],
    },
    {
      id: "section-3",
      type: "Đọc hiểu",
      timeLimit: Number(exam.readingTimeLimit) || 0,
      passingScore: null,
      questionIds: Array.isArray(exam.readingQuestions) ? exam.readingQuestions : [],
    },
    {
      id: "section-4",
      type: "Nghe hiểu",
      timeLimit: Number(exam.listeningTimeLimit) || 0,
      passingScore: null,
      questionIds: Array.isArray(exam.listeningQuestions) ? exam.listeningQuestions : [],
    },
  ];
}

export function buildScoringSnapshot(
  exam: any,
  questionsById: Map<string, QuestionLike>
): ScoringSnapshot {
  const sections = listExamSections(exam)
    .map((s) => ({
      id: s.id,
      sectionName: s.type,
      timeLimit: s.timeLimit,
      passingScore: s.passingScore,
      questionIds: s.questionIds.filter((id) => questionsById.has(id)),
    }))
    .filter((s) => s.questionIds.length > 0);

  const questions: Record<string, ScoringSnapshotQuestion> = {};
  for (const q of questionsById.values()) {
    for (const item of flattenForScoring(q)) {
      questions[item.id] = {
        correctAnswer: String(item.correctAnswer ?? ""),
        points: parseFloat(String(item.points ?? "1")) || 1,
        parentId: item.parentId ?? (item.id === q.id ? null : q.id),
        questionText: item.questionText ?? undefined,
        options: item.options,
      };
    }
  }

  return {
    capturedAt: new Date().toISOString(),
    examPassingScore:
      exam.passingScore == null ? null : Number(exam.passingScore),
    sections,
    questions,
  };
}

/** Cap section duration using server clock vs section time limit (minutes). */
export function computeServerSectionTimeSpent(
  sectionStartedAt: Date | string | null | undefined,
  timeLimitMinutes: number,
  now: Date = new Date()
): number {
  if (!sectionStartedAt) return 0;
  const started =
    sectionStartedAt instanceof Date
      ? sectionStartedAt
      : new Date(sectionStartedAt);
  if (Number.isNaN(started.getTime())) return 0;
  const elapsed = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000));
  const cap = Math.max(0, Math.round(timeLimitMinutes * 60));
  return cap > 0 ? Math.min(elapsed, cap) : elapsed;
}

export function computeWaitSeconds(
  lastSectionCompletedAt: Date | string | null | undefined,
  nextSectionStartedAt: Date = new Date()
): number {
  if (!lastSectionCompletedAt) return 0;
  const completed =
    lastSectionCompletedAt instanceof Date
      ? lastSectionCompletedAt
      : new Date(lastSectionCompletedAt);
  if (Number.isNaN(completed.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((nextSectionStartedAt.getTime() - completed.getTime()) / 1000)
  );
}

/**
 * Recalculate section scores and total from exam structure + question bank.
 * Answers are filtered to valid IDs; unknown IDs are reported.
 */
export function scoreExamAttempt(params: {
  exam: any;
  questionsById: Map<string, QuestionLike>;
  clientSectionResults: Array<{
    sectionId: string;
    type?: string;
    answers?: Record<string, string>;
    timeSpent?: number;
    score?: number;
  }>;
  /** When set, use these server-computed times instead of client timeSpent */
  serverTimeBySectionId?: Record<string, number>;
  rejectUnknownAnswers?: boolean;
}): {
  sectionResults: ScoredSectionResult[];
  totalScore: number;
  totalTimeSpent: number;
  unknownAnswerIds: string[];
  scoringSnapshot: ScoringSnapshot;
} {
  const {
    exam,
    questionsById,
    clientSectionResults,
    serverTimeBySectionId,
    rejectUnknownAnswers = true,
  } = params;

  const validIds = collectValidAnswerIds(questionsById);
  const clientBySectionId = new Map(
    clientSectionResults.map((r) => [r.sectionId, r])
  );
  const unknownAnswerIds: string[] = [];

  const buildSection = (
    sectionId: string,
    type: string,
    questionIds: string[],
    _timeLimitMinutes: number
  ): ScoredSectionResult | null => {
    const questions = questionIds
      .map((id) => questionsById.get(id))
      .filter((q): q is QuestionLike => !!q);

    if (questions.length === 0) return null;

    const client = clientBySectionId.get(sectionId);
    const { filtered, unknownIds } = filterAnswersToValidIds(
      client?.answers,
      validIds
    );
    unknownAnswerIds.push(...unknownIds);

    const resolvedTime =
      serverTimeBySectionId != null
        ? Math.max(0, Math.round(serverTimeBySectionId[sectionId] || 0))
        : Math.max(0, Math.round(Number(client?.timeSpent) || 0));

    const score = scoreAnswersAgainstQuestions(filtered, questions);

    return {
      sectionId,
      type: type || client?.type || "",
      answers: filtered,
      timeSpent: resolvedTime,
      score,
    };
  };

  const scored: ScoredSectionResult[] = [];
  for (const section of listExamSections(exam)) {
    const result = buildSection(
      section.id,
      section.type,
      section.questionIds,
      section.timeLimit
    );
    if (result) scored.push(result);
  }

  if (rejectUnknownAnswers && unknownAnswerIds.length > 0) {
    // Caller rejects via unknownAnswerIds
  }

  const totalScore =
    Math.round(scored.reduce((sum, s) => sum + s.score, 0) * 100) / 100;
  const totalTimeSpent = scored.reduce((sum, s) => sum + s.timeSpent, 0);
  const scoringSnapshot = buildScoringSnapshot(exam, questionsById);

  return {
    sectionResults: scored,
    totalScore,
    totalTimeSpent,
    unknownAnswerIds: Array.from(new Set(unknownAnswerIds)),
    scoringSnapshot,
  };
}

export function scoreSingleSection(params: {
  sectionId: string;
  type: string;
  questionIds: string[];
  answers: Record<string, string>;
  timeSpent: number;
  questionsById: Map<string, QuestionLike>;
  validIds: Set<string>;
}): { result: ScoredSectionResult; unknownIds: string[] } {
  const { filtered, unknownIds } = filterAnswersToValidIds(
    params.answers,
    params.validIds
  );
  const questions = params.questionIds
    .map((id) => params.questionsById.get(id))
    .filter((q): q is QuestionLike => !!q);
  const score = scoreAnswersAgainstQuestions(filtered, questions);
  return {
    result: {
      sectionId: params.sectionId,
      type: params.type,
      answers: filtered,
      timeSpent: Math.max(0, Math.round(params.timeSpent)),
      score,
    },
    unknownIds,
  };
}
