/** Shared exam package / trial access rules for Luyện thi portal */

export const EXAM_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
export type ExamLevel = (typeof EXAM_LEVELS)[number];

/** Default seed price when creating packages */
export const EXAM_PACKAGE_PRICE_VND = 10_000;
export const EXAM_TRIAL_QUESTION_LIMIT = 10;

export function isExamLevel(value: unknown): value is ExamLevel {
  return (
    typeof value === "string" &&
    (EXAM_LEVELS as readonly string[]).includes(value)
  );
}

export type ExamAccessMode = "full" | "trial" | "denied";

export type ExamAccessResult = {
  mode: ExamAccessMode;
  reason?: string;
  level?: ExamLevel | null;
  packageId?: string | null;
  requiresLogin?: boolean;
  requiresPurchase?: boolean;
};

type ExamLike = {
  isDemo?: boolean | null;
  level?: string | null;
  isLevelTrial?: boolean | null;
  isActive?: boolean | null;
  packageId?: string | null;
};

/**
 * Resolve access for taking an exam.
 * - Free (isDemo): anyone → full
 * - Active package entitlement (by packageId or package level) → full
 * - Trial exam + logged in → trial (10 questions)
 * - Paid package exam without entitlement → denied
 * - Legacy official (no package/level): login → full
 */
export function resolveExamAccess(input: {
  exam: ExamLike;
  userId?: string | null;
  role?: string | null;
  activeLevels?: Iterable<string>;
  activePackageIds?: Iterable<string>;
  packagePriceVnd?: number | null;
}): ExamAccessResult {
  const { exam, userId, role } = input;
  const level = isExamLevel(exam.level) ? exam.level : null;
  const packageId = exam.packageId || null;
  const activeLevels = new Set(
    [...(input.activeLevels || [])].filter((l) => isExamLevel(l)),
  );
  const activePackages = new Set(
    [...(input.activePackageIds || [])].filter(Boolean),
  );
  const priceHint =
    input.packagePriceVnd != null
      ? `${input.packagePriceVnd.toLocaleString("vi-VN")}đ`
      : "theo bảng giá gói";

  if (role === "admin" || role === "manager") {
    return { mode: "full", level, packageId };
  }

  if (exam.isDemo) {
    return { mode: "full", level, packageId };
  }

  if (!userId) {
    return {
      mode: "denied",
      reason: "Cần đăng ký / đăng nhập để thi đề này",
      level,
      packageId,
      requiresLogin: true,
    };
  }

  if (packageId && activePackages.has(packageId)) {
    return { mode: "full", level, packageId };
  }

  if (level && activeLevels.has(level)) {
    return { mode: "full", level, packageId };
  }

  if ((packageId || level) && exam.isLevelTrial) {
    return {
      mode: "trial",
      reason: `Thi thử ${EXAM_TRIAL_QUESTION_LIMIT} câu${level ? ` cấp ${level}` : ""}. Mua gói (${priceHint}) để làm đầy đủ.`,
      level,
      packageId,
      requiresPurchase: true,
    };
  }

  if (packageId || level) {
    return {
      mode: "denied",
      reason: `Cần mua gói đề${level ? ` ${level}` : ""} (${priceHint}) để thi đề này`,
      level,
      packageId,
      requiresPurchase: true,
    };
  }

  return { mode: "full", level: null, packageId: null };
}

/** Scorable answer slots: parent with answerable options + subs, or subs only, or single leaf. */
export function countScorableUnits<
  T extends { subQuestions?: T[] | null; options?: unknown },
>(question: T): number {
  if (question.subQuestions?.length) {
    const hasParentOptions =
      Array.isArray(question.options) && question.options.length > 0;
    return (hasParentOptions ? 1 : 0) + question.subQuestions.length;
  }
  return 1;
}

/** Count answered scorable units up to and including `sectionIndex`. */
export function countAnsweredScorableUnits<
  T extends { id: string; subQuestions?: T[] | null },
>(sections: Array<{ questions: T[] }>, sectionIndex: number, answers: Record<string, string>): number {
  let count = 0;
  for (let i = 0; i < sectionIndex; i++) {
    for (const q of sections[i]?.questions ?? []) {
      count += countScorableUnits(q);
    }
  }
  const section = sections[sectionIndex];
  if (!section) return count;
  for (const q of section.questions) {
    if (q.subQuestions?.length) {
      const hasParentOptions =
        Array.isArray((q as { options?: unknown[] }).options) &&
        (q as { options?: unknown[] }).options!.length > 0;
      if (hasParentOptions && answers[q.id]) count += 1;
      for (const sub of q.subQuestions) {
        if (answers[sub.id]) count += 1;
      }
    } else if (answers[q.id]) {
      count += 1;
    }
  }
  return count;
}

/**
 * Keep the first `limit` scorable units across sections (section order preserved).
 */
export function truncateSectionsForTrial<
  T extends { id: string; subQuestions?: T[] | null },
  S extends {
    id: string;
    sectionName?: string;
    timeLimit?: number;
    content?: string;
    descriptionImageUrls?: string[];
    descriptionAudioUrl?: string;
    questions: T[];
  },
>(sections: S[], limit: number = EXAM_TRIAL_QUESTION_LIMIT): S[] {
  const result: S[] = [];
  let remaining = limit;

  for (const section of sections) {
    if (remaining <= 0) break;
    const kept: T[] = [];

    for (const question of section.questions) {
      if (remaining <= 0) break;

      if (question.subQuestions?.length) {
        const hasParentOptions =
          Array.isArray((question as { options?: unknown[] }).options) &&
          (question as { options?: unknown[] }).options!.length > 0;
        const keptSubs: T[] = [];
        let includeParent = false;

        if (hasParentOptions && remaining > 0) {
          includeParent = true;
          remaining -= 1;
        }
        for (const sub of question.subQuestions) {
          if (remaining <= 0) break;
          keptSubs.push(sub);
          remaining -= 1;
        }
        if (!includeParent && keptSubs.length === 0) continue;
        kept.push({
          ...question,
          subQuestions: keptSubs.length > 0 ? keptSubs : undefined,
        });
      } else {
        kept.push(question);
        remaining -= 1;
      }
    }

    if (kept.length > 0) {
      result.push({ ...section, questions: kept });
    }
  }

  return result;
}

/** Collect all scorable question IDs from truncated sections (for server sync). */
export function collectTrialQuestionIdsFromSections<
  T extends { id: string; subQuestions?: T[] | null; options?: unknown },
>(sections: Array<{ questions: T[] }>): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    for (const q of section.questions) {
      if (q.subQuestions?.length) {
        const hasParentOptions =
          Array.isArray(q.options) && q.options.length > 0;
        if (hasParentOptions) ids.push(q.id);
        for (const sub of q.subQuestions) {
          ids.push(sub.id);
        }
      } else {
        ids.push(q.id);
      }
    }
  }
  return ids;
}
