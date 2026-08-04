import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Upload,
  Loader2,
  Trash2,
} from "lucide-react";
import { ImageUploader } from "./ImageUploader";
import { useToast } from "@/hooks/use-toast";
import { isHtmlContent, markdownToHtml } from "@/lib/articleContent";
import { uploadImageToR2 } from "@/lib/uploadImage";
import {
  cleanupTempMediaUrls,
  extractTempImageUrlsFromHtml,
} from "@/lib/tempMediaCleanup";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

async function uploadArticleImage(file: File): Promise<string> {
  return uploadImageToR2(file);
}

/** Collect image files from paste (files + clipboard items — screenshots often only appear in items). */
function collectClipboardImageFiles(event: ClipboardEvent): File[] {
  const seen = new Set<string>();
  const out: File[] = [];

  const push = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const key = `${file.name}-${file.size}-${file.lastModified}-${file.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  for (const file of Array.from(event.clipboardData?.files ?? [])) {
    push(file);
  }
  for (const item of Array.from(event.clipboardData?.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      push(item.getAsFile());
    }
  }
  return out;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Bắt đầu soạn thảo nội dung bài viết...",
  className,
}: RichTextEditorProps) {
  const { toast } = useToast();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isImageUrlDialogOpen, setIsImageUrlDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const lastOnChangeValue = useRef("");
  const lastHtmlForCleanup = useRef("");
  const handleImageFilesRef = useRef<(files: File[]) => Promise<void>>(
    async () => {},
  );

  const initialContent = useMemo(() => {
    if (!value) return "";
    return isHtmlContent(value) ? value : markdownToHtml(value);
    // Only seed on first mount — sync later via effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lastHtmlForCleanup.current = initialContent;
  }, [initialContent]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
      TiptapImage.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline hover:text-primary/80",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const prevTemps = extractTempImageUrlsFromHtml(lastHtmlForCleanup.current);
      const nextTemps = new Set(extractTempImageUrlsFromHtml(html));
      const removed = prevTemps.filter((url) => !nextTemps.has(url));
      if (removed.length > 0) {
        void cleanupTempMediaUrls(removed, "qbank");
      }
      lastHtmlForCleanup.current = html;
      lastOnChangeValue.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: "tiptap-wysiwyg focus:outline-none",
        "data-testid": "wysiwyg-editor-content",
      },
      handlePaste: (_view, event) => {
        const files = collectClipboardImageFiles(event);
        if (files.length === 0) return false;
        event.preventDefault();
        void handleImageFilesRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(
          (event as DragEvent).dataTransfer?.files ?? [],
        ).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void handleImageFilesRef.current(files);
        return true;
      },
    },
  });

  const handleImageFiles = useCallback(
    async (files: File[]) => {
      if (!editor) return;
      setIsUploading(true);
      try {
        for (const file of files) {
          if (!file.type.startsWith("image/")) continue;
          if (file.size > 5 * 1024 * 1024) {
            toast({
              title: "Lỗi",
              description: "Ảnh không được vượt quá 5MB",
              variant: "destructive",
            });
            continue;
          }
          try {
            const url = await uploadArticleImage(file);
            editor.chain().focus().setImage({ src: url, alt: "Hình ảnh" }).run();
          } catch {
            toast({
              title: "Lỗi",
              description: "Không thể tải lên hình ảnh",
              variant: "destructive",
            });
          }
        }
      } finally {
        setIsUploading(false);
      }
    },
    [editor, toast],
  );

  useEffect(() => {
    handleImageFilesRef.current = handleImageFiles;
  }, [handleImageFiles]);

  useEffect(() => {
    if (!editor) return;
    const htmlValue = !value
      ? ""
      : isHtmlContent(value)
        ? value
        : markdownToHtml(value);
    if (htmlValue !== lastOnChangeValue.current && htmlValue !== editor.getHTML()) {
      editor.commands.setContent(htmlValue, { emitUpdate: false });
      lastOnChangeValue.current = htmlValue;
    }
  }, [value, editor]);

  const applyLink = () => {
    if (!linkUrl.trim()) {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().setLink({ href: linkUrl.trim() }).run();
    }
    setLinkUrl("");
    setIsLinkDialogOpen(false);
  };

  const insertImageFromUrl = () => {
    if (!imageUrl.trim()) return;
    editor
      ?.chain()
      .focus()
      .setImage({ src: imageUrl.trim(), alt: imageAlt || "Hình ảnh" })
      .run();
    setImageUrl("");
    setImageAlt("");
    setIsImageUrlDialogOpen(false);
  };

  const ToolbarButton = ({
    onClick,
    active,
    title,
    children,
    disabled,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      disabled={disabled}
      className={`h-8 w-8 p-0 ${active ? "bg-primary/10 text-primary hover:bg-primary/15" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className={className}>
      <div className="border border-b-0 rounded-t-md bg-muted/40 p-2 flex flex-wrap items-center gap-0.5">
        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-0.5">
          <ToolbarButton
            title="Tiêu đề lớn (H1)"
            active={editor?.isActive("heading", { level: 1 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Tiêu đề vừa (H2)"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Tiêu đề nhỏ (H3)"
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-0.5">
          <ToolbarButton
            title="Chữ đậm (Ctrl+B)"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Chữ nghiêng (Ctrl+I)"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant={editor?.isActive("link") ? "default" : "ghost"}
                size="sm"
                className={`h-8 w-8 p-0 ${editor?.isActive("link") ? "bg-primary/10 text-primary" : ""}`}
                title="Chèn liên kết"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setLinkUrl(editor?.getAttributes("link").href || "")}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Chèn liên kết</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  onKeyDown={(e) => e.key === "Enter" && applyLink()}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="button" onClick={applyLink}>
                    {linkUrl ? "Áp dụng" : "Xóa liên kết"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-0.5">
          <ToolbarButton
            title="Danh sách dấu chấm"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Danh sách số"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Đường kẻ ngang"
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-0.5">
          <Dialog open={isImageUrlDialogOpen} onOpenChange={setIsImageUrlDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Chèn hình từ URL"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Image className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Chèn hình ảnh từ URL</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">URL hình ảnh *</label>
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="mt-1"
                    onKeyDown={(e) => e.key === "Enter" && insertImageFromUrl()}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Mô tả hình ảnh</label>
                  <Input
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    placeholder="Mô tả..."
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsImageUrlDialogOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    onClick={insertImageFromUrl}
                    disabled={!imageUrl.trim()}
                  >
                    Chèn hình
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <ImageUploader
            onImageUploaded={(url, alt) =>
              editor
                ?.chain()
                .focus()
                .setImage({ src: url, alt: alt || "Hình ảnh" })
                .run()
            }
            triggerButton={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Tải lên hình từ máy tính"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Upload className="h-4 w-4" />
              </Button>
            }
          />

          <ToolbarButton
            title="Xóa hình đang chọn"
            disabled={!editor?.isActive("image")}
            onClick={() => editor?.chain().focus().deleteSelection().run()}
          >
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      <div className="bg-primary/5 border border-t-0 border-b-0 px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
        {isUploading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span>Đang tải lên hình ảnh...</span>
          </>
        ) : (
          <span>
            <strong>Chèn ảnh:</strong>{" "}
            <kbd className="bg-muted px-1 rounded text-[10px]">Ctrl+V</kbd>{" "}
            dán ảnh / screenshot, kéo thả file vào khung soạn thảo, hoặc dùng nút
            tải lên — không cần URL
          </span>
        )}
      </div>

      <div className="border border-t-0 rounded-b-md bg-white min-h-[380px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
