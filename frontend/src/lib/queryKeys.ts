/** Canonical React Query keys for exam-related resources */
export const examKeys = {
  all: ["/api/exams"] as const,
  adminAll: ["/api/exams", "includeInactive"] as const,
  detail: (examId: string) => ["/api/exams", examId] as const,
  questions: (examId: string) => ["/api/exams", examId, "questions"] as const,
  attempts: (examId: string) => ["/api/exams", examId, "attempts"] as const,
  attemptCounts: ["/api/exams", "attempt-counts"] as const,
  adminAttempts: (params: {
    examId?: string;
    q?: string;
    result?: string;
    limit?: number;
    offset?: number;
  }) => ["/api/admin/exam-attempts", params] as const,
};

export const profileKeys = {
  exams: ["/api/profile/exams"] as const,
  attempts: ["/api/profile/attempts"] as const,
};

export const testimonialKeys = {
  all: ["/api/testimonials"] as const,
};

/** Path strings used by routes that still expect a single URL key */
export const examPaths = {
  detail: (examId: string) => `/api/exams/${examId}`,
  questions: (examId: string) => `/api/exams/${examId}/questions`,
  attempts: (examId: string) => `/api/exams/${examId}/attempts`,
};
