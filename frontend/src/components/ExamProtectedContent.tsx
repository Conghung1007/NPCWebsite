import { type ImgHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useExamContentProtection } from "@/hooks/useExamContentProtection";

type ExamProtectedContentProps = {
  children: ReactNode;
  className?: string;
  /** Enable document-level copy/contextmenu/hotkey blocking (default true) */
  protectDocument?: boolean;
};

/**
 * Wraps exam content: no text selection, no context menu, no image drag/save via UI.
 */
export function ExamProtectedContent({
  children,
  className,
  protectDocument = true,
}: ExamProtectedContentProps) {
  useExamContentProtection(protectDocument);

  if (!protectDocument) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn("exam-content-protected select-none", className)}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

type ProtectedExamImageProps = ImgHTMLAttributes<HTMLImageElement>;

/** Image that resists right-click save / drag-download. */
export function ProtectedExamImage({ className, alt = "", draggable, ...props }: ProtectedExamImageProps) {
  return (
    <img
      {...props}
      alt={alt}
      draggable={draggable ?? false}
      className={cn("exam-protected-media pointer-events-auto", className)}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    />
  );
}
