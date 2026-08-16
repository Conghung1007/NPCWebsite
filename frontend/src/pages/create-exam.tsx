import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  ExamFormEditor,
  type ExamFormData,
} from "@/components/ExamFormEditor";
import { 
  serializeExamSectionsForApi,
  type ExamSection,
} from "@/lib/examQuestionSets";
import { examKeys } from "@/lib/queryKeys";

export default function CreateExam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, hasImageEditPermission } = useAuth();

  useEffect(() => {
    if (!authLoading && (!user || !hasImageEditPermission)) {
      setLocation("/cpanel/exams");
    }
  }, [authLoading, user, hasImageEditPermission, setLocation]);

  const createExamMutation = useMutation({
    mutationFn: async ({
      data,
      sections,
    }: {
      data: ExamFormData;
      sections: ExamSection[];
    }) => {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          sections: serializeExamSectionsForApi(sections),
        }),
        credentials: "include",
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Failed to create exam");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Tạo bài thi thành công",
      });
      queryClient.invalidateQueries({ queryKey: examKeys.all });
      queryClient.invalidateQueries({ queryKey: examKeys.adminAll });
      window.history.back();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo bài thi",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
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

  return (
    <ExamFormEditor
      pageTitle="Tạo bài thi mới"
      submitLabel="Tạo bài thi"
      submittingLabel="Đang tạo..."
      isPending={createExamMutation.isPending}
      onSubmitExam={(data, sections) =>
        createExamMutation.mutateAsync({ data, sections })
      }
    />
  );
}
