import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ExamFormEditor,
  type ExamFormData,
} from "@/components/ExamFormEditor";
import {
  hydrateExamSectionsFromExam,
  serializeExamSectionsForApi,
  type ExamSection,
} from "@/lib/examQuestionSets";
import type { Exam, Question } from "@shared/schema";
import { examKeys } from "@/lib/queryKeys";

export default function EditExam() {
  const [, setLocation] = useLocation();
  const { examId } = useParams() as { examId: string };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, hasImageEditPermission } = useAuth();

  const [hydratedSections, setHydratedSections] = useState<ExamSection[] | null>(null);
  const [missingQuestionIds, setMissingQuestionIds] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<ExamFormData | null>(null);
  const hydratedExamIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !hasImageEditPermission)) {
      setLocation("/cpanel/exams");
    }
  }, [authLoading, user, hasImageEditPermission, setLocation]);

  const { data: examData, isLoading: examLoading } = useQuery<Exam>({
    queryKey: examKeys.detail(examId!),
    enabled: !!examId && !!user && hasImageEditPermission,
  });

  const { data: availableQuestions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    enabled: !!user && hasImageEditPermission,
  });

  useEffect(() => {
    if (!examData || questionsLoading) return;
    if (hydratedExamIdRef.current === examData.id) return;
    hydratedExamIdRef.current = examData.id;

    setFormValues({
      title: examData.title,
      description: examData.description || "",
      passingScore: (examData as { passingScore?: number | null }).passingScore ?? 0,
      isDemo: examData.isDemo || false,
    });

    const { sections, missingQuestionIds: missing } = hydrateExamSectionsFromExam(
      examData as Parameters<typeof hydrateExamSectionsFromExam>[0],
      availableQuestions,
    );
    setHydratedSections(sections.length > 0 ? sections : null);
    setMissingQuestionIds(missing);
  }, [examData, availableQuestions, questionsLoading]);

  const initialFormValues = useMemo(
    () =>
      formValues ?? {
        title: "",
        description: "",
        passingScore: 0,
        isDemo: false,
      },
    [formValues],
  );

  const updateExamMutation = useMutation({
    mutationFn: async ({
      data,
      sections,
    }: {
      data: ExamFormData;
      sections: ExamSection[];
    }) => {
      const response = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          sections: serializeExamSectionsForApi(sections),
        }),
        credentials: "include",
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Failed to update exam");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Cập nhật bài thi thành công",
      });
      queryClient.invalidateQueries({ queryKey: examKeys.all });
      queryClient.invalidateQueries({ queryKey: examKeys.adminAll });
      queryClient.invalidateQueries({ queryKey: examKeys.detail(examId!) });
      queryClient.invalidateQueries({ queryKey: examKeys.questions(examId!) });
      window.history.back();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật bài thi",
        variant: "destructive",
      });
    },
  });

  const ready =
    !!examData && !!formValues && !questionsLoading && hydratedExamIdRef.current === examData.id;

  if (authLoading || examLoading || (examData && !ready)) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!user || !hasImageEditPermission) {
    return null;
  }

  if (!examData || !formValues) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <p className="text-center text-muted-foreground">Không tìm thấy bài thi.</p>
      </div>
    );
  }

  return (
    <ExamFormEditor
      key={examData.id}
      pageTitle="Chỉnh sửa bài thi"
      submitLabel="Lưu thay đổi"
      submittingLabel="Đang lưu..."
      isPending={updateExamMutation.isPending}
      initialFormValues={initialFormValues}
      initialSections={hydratedSections ?? undefined}
      formResetKey={examData.id}
      missingQuestionIds={missingQuestionIds}
      readyToSubmit
      onSubmitExam={(data, sections) =>
        updateExamMutation.mutateAsync({ data, sections })
      }
    />
  );
}
