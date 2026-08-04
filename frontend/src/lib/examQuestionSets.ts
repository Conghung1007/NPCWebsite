import type { Question, QuestionSet } from "@shared/schema";

/**
 * Dynamic section structure for exam creation/editing
 */
export interface ExamSection {
  id: string;
  sectionName: string;
  timeLimit: number;
  passingScore?: number;
  content?: string;
  descriptionImageUrls?: string[];
  descriptionAudioUrl?: string;
  questionSets: QuestionSet[];
}

/** Marker on hydrated stubs when question was removed from the bank */
export const MISSING_QUESTION_CATEGORY = "__missing__";

export function resolveQuestionSetIds(qs: {
  questionIds?: string[];
  questions?: Array<string | { id?: string }>;
}): string[] {
  if (Array.isArray(qs.questionIds) && qs.questionIds.length > 0) {
    return qs.questionIds.filter(Boolean);
  }
  if (Array.isArray(qs.questions)) {
    return qs.questions
      .map((q) => (typeof q === "string" ? q : q?.id))
      .filter((id): id is string => Boolean(id));
  }
  return [];
}

export function createMissingQuestionStub(id: string): Question {
  return {
    id,
    parentId: null,
    examId: null,
    category: MISSING_QUESTION_CATEGORY,
    language: "japanese",
    questionTitle: "Câu hỏi không còn trong ngân hàng",
    description: null,
    descriptionImageUrl: null,
    descriptionImageUrls: null,
    descriptionAudioUrl: null,
    questionText: `(ID: ${id})`,
    questionType: "multiple_choice",
    imageUrl: null,
    imageUrls: null,
    audioUrl: null,
    options: [],
    correctAnswer: "0",
    explanation: null,
    points: "0",
    sortOrder: 0,
    createdAt: new Date(),
  } as Question;
}

export function isMissingQuestion(q: Question): boolean {
  return q.category === MISSING_QUESTION_CATEGORY;
}

export function hydrateQuestionsFromIds(
  ids: string[],
  bank: Question[],
): { questions: Question[]; missingIds: string[] } {
  const missingIds: string[] = [];
  const questions = ids.map((id) => {
    const found = bank.find((q) => q.id === id);
    if (found) return found;
    missingIds.push(id);
    return createMissingQuestionStub(id);
  });
  return { questions, missingIds };
}

export function newExamEntityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Serialize editor sections for POST/PUT /api/exams */
export function serializeExamSectionsForApi(sections: ExamSection[]) {
  return sections.map((section) => ({
    id: section.id,
    sectionName: section.sectionName.trim(),
    timeLimit: section.timeLimit,
    passingScore: section.passingScore,
    content: section.content || "",
    descriptionImageUrls: section.descriptionImageUrls || [],
    descriptionAudioUrl: section.descriptionAudioUrl || "",
    questionSets: section.questionSets.map((qs, qsIdx) => ({
      id: qs.id,
      name: qs.name || `Bộ câu hỏi ${qsIdx + 1}`,
      questionIds: qs.questions.map((q) => q.id),
    })),
  }));
}

/** Hydrate exam.sections (or legacy fields) into editor ExamSection[] */
export function hydrateExamSectionsFromExam(
  examData: {
    id: string;
    sections?: unknown;
    vocabularyQuestions?: string[];
    grammarQuestions?: string[];
    readingQuestions?: string[];
    listeningQuestions?: string[];
    vocabularyTimeLimit?: number;
    grammarTimeLimit?: number;
    readingTimeLimit?: number;
    listeningTimeLimit?: number;
  },
  availableQuestions: Question[],
): { sections: ExamSection[]; missingQuestionIds: string[] } {
  const missing: string[] = [];

  if (examData.sections && Array.isArray(examData.sections) && examData.sections.length > 0) {
    const sections: ExamSection[] = examData.sections.map((section: any) => {
      const rawSets =
        section.questionSets && section.questionSets.length > 0
          ? section.questionSets
          : section.questionIds
            ? [{ id: `qs-${section.id}`, name: "", questionIds: section.questionIds }]
            : [{ id: newExamEntityId("qs"), name: "", questionIds: [] }];

      const populatedQuestionSets = rawSets.map((qs: any) => {
        const ids = resolveQuestionSetIds(qs);
        const { questions, missingIds } = hydrateQuestionsFromIds(ids, availableQuestions);
        missing.push(...missingIds);
        return {
          id: qs.id || newExamEntityId("qs"),
          name: qs.name || "",
          questions,
        };
      });

      return {
        id: section.id,
        sectionName: section.sectionName || section.type || "",
        timeLimit: section.timeLimit ?? 10,
        passingScore: section.passingScore,
        content: section.content || "",
        descriptionImageUrls: section.descriptionImageUrls || [],
        descriptionAudioUrl: section.descriptionAudioUrl || "",
        questionSets:
          populatedQuestionSets.length > 0
            ? populatedQuestionSets
            : [{ id: newExamEntityId("qs"), name: "", questions: [] }],
      };
    });

    return { sections, missingQuestionIds: Array.from(new Set(missing)) };
  }

  const legacySections: ExamSection[] = [];
  const legacyMapping = [
    {
      sectionName: "Từ vựng",
      questions: examData.vocabularyQuestions || [],
      timeLimit: examData.vocabularyTimeLimit || 10,
    },
    {
      sectionName: "Ngữ pháp",
      questions: examData.grammarQuestions || [],
      timeLimit: examData.grammarTimeLimit || 10,
    },
    {
      sectionName: "Đọc hiểu",
      questions: examData.readingQuestions || [],
      timeLimit: examData.readingTimeLimit || 10,
    },
    {
      sectionName: "Nghe hiểu",
      questions: examData.listeningQuestions || [],
      timeLimit: examData.listeningTimeLimit || 10,
    },
  ];

  legacyMapping.forEach((mapping) => {
    if (mapping.questions.length > 0 || mapping.timeLimit > 0) {
      const { questions, missingIds } = hydrateQuestionsFromIds(
        mapping.questions,
        availableQuestions,
      );
      missing.push(...missingIds);
      legacySections.push({
        id: newExamEntityId("section"),
        sectionName: mapping.sectionName,
        timeLimit: mapping.timeLimit,
        content: "",
        descriptionImageUrls: [],
        descriptionAudioUrl: "",
        questionSets: [
          {
            id: newExamEntityId("qs"),
            name: "",
            questions,
          },
        ],
      });
    }
  });

  return {
    sections: legacySections,
    missingQuestionIds: Array.from(new Set(missing)),
  };
}

/** Client-side section checks before create/update exam. Returns error message or null. */
export function validateExamSectionsClient(sections: ExamSection[]): string | null {
  if (!sections.length) {
    return "Bài thi phải có ít nhất một phần thi.";
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const label = i + 1;
    if (!section.sectionName?.trim()) {
      return `Phần thi ${label} cần có tên.`;
    }
    if (!section.timeLimit || section.timeLimit < 1) {
      return `Phần thi ${label} cần thời gian tối thiểu 1 phút.`;
    }
    if (!section.questionSets?.length) {
      return `Phần thi ${label} cần ít nhất một bộ câu hỏi.`;
    }
    for (let j = 0; j < section.questionSets.length; j++) {
      if (section.questionSets[j].questions.length === 0) {
        return `Bộ câu hỏi ${j + 1} trong phần thi ${label} phải có ít nhất một câu hỏi.`;
      }
    }
  }

  const idToSections = new Map<string, number[]>();
  sections.forEach((section, i) => {
    section.questionSets.forEach((qs) => {
      qs.questions.forEach((q) => {
        if (isMissingQuestion(q)) return;
        const list = idToSections.get(q.id) || [];
        list.push(i + 1);
        idToSections.set(q.id, list);
      });
    });
  });

  for (const [, sectionNums] of Array.from(idToSections.entries())) {
    const unique = Array.from(new Set(sectionNums));
    if (unique.length > 1) {
      return `Có câu hỏi trùng ở các phần thi ${unique.join(", ")}. Mỗi câu chỉ nên thuộc một phần.`;
    }
  }

  return null;
}

/**
 * Utility functions for index-based access (O(1) operations)
 */
export const getSectionIndex = (sectionId: string, sections: ExamSection[]) => {
  return sections.findIndex(s => s.id === sectionId);
};

export const getQuestionSetIndex = (questionSetId: string, questionSets: QuestionSet[]) => {
  return questionSets.findIndex(qs => qs.id === questionSetId);
};

/**
 * Category mapping between English and Vietnamese
 */
export const categoryMapping: Record<string, string> = {
  "vocabulary": "từ vựng",
  "grammar": "ngữ pháp", 
  "reading": "đọc hiểu",
  "listening": "nghe hiểu",
  "từ vựng": "từ vựng",
  "ngữ pháp": "ngữ pháp",
  "đọc hiểu": "đọc hiểu", 
  "nghe hiểu": "nghe hiểu"
};

/**
 * Factory function to create question set management actions
 * @param setExamSections - State setter for exam sections
 * @param toast - Toast notification function
 * @returns Object with all question set management functions
 */
export function createQuestionSetActions(
  setExamSections: React.Dispatch<React.SetStateAction<ExamSection[]>>,
  toast: (options: { title: string; description: string; variant?: "default" | "destructive" }) => void
) {
  return {
    addQuestionSetToSection: (sectionId: string) => {
      setExamSections(prev => {
        const sectionIdx = getSectionIndex(sectionId, prev);
        if (sectionIdx === -1) return prev;

        const newSections = [...prev];
        newSections[sectionIdx] = {
          ...newSections[sectionIdx],
          questionSets: [
            ...newSections[sectionIdx].questionSets,
            {
              id: newExamEntityId("qs"),
              name: "",
              questions: []
            }
          ]
        };
        return newSections;
      });
    },

    removeQuestionSetFromSection: (sectionId: string, questionSetId: string) => {
      setExamSections(prev => {
        const sectionIdx = getSectionIndex(sectionId, prev);
        if (sectionIdx === -1) return prev;

        const section = prev[sectionIdx];
        
        // Guard: must have at least 1 question set
        if (section.questionSets.length <= 1) {
          toast({
            title: "Lỗi",
            description: "Phần thi phải có ít nhất 1 bộ câu hỏi",
            variant: "destructive",
          });
          return prev;
        }

        const newSections = [...prev];
        newSections[sectionIdx] = {
          ...section,
          questionSets: section.questionSets.filter(qs => qs.id !== questionSetId)
        };
        return newSections;
      });
    },

    updateQuestionSetName: (sectionId: string, questionSetId: string, name: string) => {
      setExamSections(prev => {
        const sectionIdx = getSectionIndex(sectionId, prev);
        if (sectionIdx === -1) return prev;

        const section = prev[sectionIdx];
        const setIdx = getQuestionSetIndex(questionSetId, section.questionSets);
        if (setIdx === -1) return prev;

        const newSections = [...prev];
        const newQuestionSets = [...section.questionSets];
        newQuestionSets[setIdx] = {
          ...newQuestionSets[setIdx],
          name
        };
        newSections[sectionIdx] = {
          ...section,
          questionSets: newQuestionSets
        };
        return newSections;
      });
    },

    addQuestionToSet: (sectionId: string, questionSetId: string, question: Question) => {
      // Defensive guard
      if (!sectionId || !questionSetId) {
        toast({
          title: "Lỗi",
          description: "Không tìm thấy bộ câu hỏi. Vui lòng thử lại.",
          variant: "destructive",
        });
        return;
      }

      setExamSections(prev => {
        const sectionIdx = getSectionIndex(sectionId, prev);
        if (sectionIdx === -1) {
          toast({
            title: "Lỗi",
            description: "Không tìm thấy phần thi.",
            variant: "destructive",
          });
          return prev;
        }

        const section = prev[sectionIdx];
        const setIdx = getQuestionSetIndex(questionSetId, section.questionSets);
        if (setIdx === -1) {
          toast({
            title: "Lỗi",
            description: "Không tìm thấy bộ câu hỏi.",
            variant: "destructive",
          });
          return prev;
        }

        const newSections = [...prev];
        const newQuestionSets = [...section.questionSets];
        newQuestionSets[setIdx] = {
          ...newQuestionSets[setIdx],
          questions: [...newQuestionSets[setIdx].questions, question]
        };
        newSections[sectionIdx] = {
          ...section,
          questionSets: newQuestionSets
        };
        return newSections;
      });
    },

    removeQuestionFromSet: (sectionId: string, questionSetId: string, questionId: string) => {
      setExamSections(prev => {
        const sectionIdx = getSectionIndex(sectionId, prev);
        if (sectionIdx === -1) return prev;

        const section = prev[sectionIdx];
        const setIdx = getQuestionSetIndex(questionSetId, section.questionSets);
        if (setIdx === -1) return prev;

        const newSections = [...prev];
        const newQuestionSets = [...section.questionSets];
        newQuestionSets[setIdx] = {
          ...newQuestionSets[setIdx],
          questions: newQuestionSets[setIdx].questions.filter(q => q.id !== questionId)
        };
        newSections[sectionIdx] = {
          ...section,
          questionSets: newQuestionSets
        };
        return newSections;
      });
    },

    moveQuestionInSet: (sectionId: string, questionSetId: string, questionId: string, direction: 'up' | 'down') => {
      setExamSections(prev => {
        const sectionIdx = getSectionIndex(sectionId, prev);
        if (sectionIdx === -1) return prev;

        const section = prev[sectionIdx];
        const setIdx = getQuestionSetIndex(questionSetId, section.questionSets);
        if (setIdx === -1) return prev;

        const questions = [...section.questionSets[setIdx].questions];
        const questionIdx = questions.findIndex(q => q.id === questionId);
        if (questionIdx === -1) return prev;

        // Check boundaries
        if (direction === 'up' && questionIdx === 0) return prev;
        if (direction === 'down' && questionIdx === questions.length - 1) return prev;

        // Swap questions
        const newIdx = direction === 'up' ? questionIdx - 1 : questionIdx + 1;
        [questions[questionIdx], questions[newIdx]] = [questions[newIdx], questions[questionIdx]];

        const newSections = [...prev];
        const newQuestionSets = [...section.questionSets];
        newQuestionSets[setIdx] = {
          ...newQuestionSets[setIdx],
          questions
        };
        newSections[sectionIdx] = {
          ...section,
          questionSets: newQuestionSets
        };
        return newSections;
      });
    }
  };
}
