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
              id: `qs-${Date.now()}`,
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
    }
  };
}
