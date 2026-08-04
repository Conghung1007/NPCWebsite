import type { Exam, ExamAttempt } from "@shared/schema";

type SectionLike = {
  id?: string;
  sectionName?: string;
  type?: string;
  passingScore?: number | null;
  questionSets?: Array<{ questionIds?: string[]; questions?: unknown[] }>;
  questionIds?: string[];
};

type SectionResultLike = {
  sectionId?: string;
  type?: string;
  score?: number;
};

function sectionHasQuestions(section: SectionLike): boolean {
  if (section.questionSets && Array.isArray(section.questionSets)) {
    return section.questionSets.some((qs) => {
      const ids = qs.questionIds || qs.questions || [];
      return Array.isArray(ids) && ids.length > 0;
    });
  }
  return Array.isArray(section.questionIds) && section.questionIds.length > 0;
}

function normalizeSectionResults(sectionResults: unknown): SectionResultLike[] {
  if (Array.isArray(sectionResults)) return sectionResults;
  if (sectionResults && typeof sectionResults === "object") {
    return Object.values(sectionResults as Record<string, SectionResultLike>);
  }
  return [];
}

function getExamSectionsForPass(exam: Exam, attempt: ExamAttempt): SectionLike[] {
  const snapshot = (attempt as any).scoringSnapshot as
    | {
        sections?: Array<{
          id: string;
          sectionName?: string;
          passingScore?: number | null;
          questionIds?: string[];
        }>;
      }
    | null
    | undefined;

  if (snapshot?.sections?.length) {
    return snapshot.sections.map((s) => ({
      id: s.id,
      sectionName: s.sectionName,
      passingScore: s.passingScore,
      questionIds: s.questionIds || ["x"],
    }));
  }

  return ((exam as any).sections as SectionLike[]) || [];
}

/** Pass/fail: prefer scoringSnapshot thresholds when present, else live exam. */
export function didAttemptPass(exam: Exam, attempt: ExamAttempt): boolean {
  const sections = getExamSectionsForPass(exam, attempt);
  const results = normalizeSectionResults(attempt.sectionResults);
  const totalScore = Number(attempt.totalScore) || 0;

  if (Array.isArray(sections) && sections.length > 0) {
    for (const section of sections) {
      if (!sectionHasQuestions(section)) continue;
      const passing = section.passingScore;
      if (passing == null || passing <= 0) continue;
      const result = results.find((r) => r.sectionId === section.id);
      const earned = Number(result?.score) || 0;
      if (earned < passing) return false;
    }
  }

  const snapshotPassing = (attempt as any).scoringSnapshot?.examPassingScore;
  const examPassing =
    snapshotPassing != null ? snapshotPassing : (exam as any).passingScore;
  if (examPassing != null && examPassing > 0 && totalScore < examPassing) {
    return false;
  }

  return true;
}
