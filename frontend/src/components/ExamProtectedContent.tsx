import { type ImgHTMLAttributes, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { useExamContentProtection } from "@/hooks/useExamContentProtection";
import { resolveExamImageUrl } from "@/lib/examMediaUrl";

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

type ProtectedExamImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** question | answer | description — used when src is a bare filename */
  imageKind?: "question" | "answer" | "description";
};

/** Image that resists right-click save / drag-download. */
export function ProtectedExamImage({
  className,
  alt = "",
  draggable,
  src,
  imageKind = "question",
  onError,
  ...props
}: ProtectedExamImageProps) {
  const resolved = resolveExamImageUrl(
    typeof src === "string" ? src : undefined,
    imageKind,
  );
  const [failed, setFailed] = useState(false);

  if (!resolved) {
    return null;
  }

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-xs text-neutral-500",
          className,
        )}
        role="img"
        aria-label={alt || "Không tải được ảnh"}
      >
        Không tải được ảnh
      </div>
    );
  }

  return (
    <img
      {...props}
      src={resolved}
      alt={alt}
      draggable={draggable ?? false}
      loading="lazy"
      decoding="async"
      className={cn("exam-protected-media pointer-events-auto", className)}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}
