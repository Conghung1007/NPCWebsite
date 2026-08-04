import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import type { Question } from "@shared/schema";

function languageLabel(language: string) {
  switch (language) {
    case "vi":
      return "Tiếng Việt";
    case "en":
    case "english":
      return "Tiếng Anh";
    case "ja":
    case "japanese":
      return "Tiếng Nhật";
    case "de":
    case "german":
      return "Tiếng Đức";
    default:
      return language;
  }
}

interface ExamQuestionPickerListProps {
  questions: Question[];
  isLoading?: boolean;
  onSelect: (question: Question) => void;
}

/** Mobile card list + desktop table for picking bank questions. */
export function ExamQuestionPickerList({
  questions,
  isLoading,
  onSelect,
}: ExamQuestionPickerListProps) {
  if (isLoading) {
    return <div className="text-center py-4 text-sm text-muted-foreground">Đang tải câu hỏi...</div>;
  }
  if (questions.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Không tìm thấy câu hỏi phù hợp
      </div>
    );
  }

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden space-y-3 max-h-[50vh] overflow-y-auto">
        {questions.map((question) => (
          <div
            key={question.id}
            className="rounded-lg border border-border/70 bg-white p-3 text-left space-y-2"
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {question.category}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {languageLabel(question.language)}
              </Badge>
            </div>
            {question.questionTitle ? (
              <p className="text-sm font-semibold text-foreground line-clamp-2">
                {question.questionTitle}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground line-clamp-3">
              {question.questionText}
            </p>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => onSelect(question)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Chọn
            </Button>
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto max-h-[50vh]">
        <Table className="w-full min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Tiêu đề</TableHead>
              <TableHead className="w-[22%]">Mô tả</TableHead>
              <TableHead className="w-[28%]">Câu hỏi</TableHead>
              <TableHead className="w-[12%]">Phần</TableHead>
              <TableHead className="w-[10%]">Ngôn ngữ</TableHead>
              <TableHead className="w-[10%]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id}>
                <TableCell>
                  <p className="text-sm font-medium line-clamp-2">
                    {question.questionTitle || "—"}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {question.description || "Không có"}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm line-clamp-2">{question.questionText}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{question.category}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{languageLabel(question.language)}</Badge>
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" onClick={() => onSelect(question)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Chọn
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
