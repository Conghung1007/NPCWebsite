import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Image, Bold, Italic, Link2, List, ListOrdered, Upload } from "lucide-react";
import { ImageUploader } from "./ImageUploader";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Nhập nội dung...",
  className 
}: RichTextEditorProps) {
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (beforeText: string, afterText: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = 
      value.substring(0, start) + 
      beforeText + 
      selectedText + 
      afterText + 
      value.substring(end);
    
    onChange(newText);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      const newCursorPos = start + beforeText.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const insertImage = () => {
    if (!imageUrl.trim()) return;
    
    const imageMarkdown = `![${imageAlt || 'Hình ảnh'}](${imageUrl})`;
    const textarea = textareaRef.current;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const newText = 
        value.substring(0, start) + 
        imageMarkdown + 
        value.substring(start);
      
      onChange(newText);
      
      // Reset dialog
      setImageUrl("");
      setImageAlt("");
      setIsImageDialogOpen(false);
      
      // Focus back to textarea
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + imageMarkdown.length, start + imageMarkdown.length);
      }, 100);
    }
  };

  const formatButtons = [
    {
      icon: Bold,
      label: "Đậm",
      action: () => insertText("**", "**"),
    },
    {
      icon: Italic,
      label: "Nghiêng", 
      action: () => insertText("*", "*"),
    },
    {
      icon: Link2,
      label: "Liên kết",
      action: () => insertText("[", "](url)"),
    },
    {
      icon: List,
      label: "Danh sách",
      action: () => insertText("- "),
    },
    {
      icon: ListOrdered,
      label: "Danh sách số",
      action: () => insertText("1. "),
    },
  ];

  return (
    <div className={className}>
      {/* Instruction */}
      <div className="bg-blue-50 p-2 text-xs text-gray-600 border rounded-t-md">
        <strong>Mẹo:</strong> Đặt con trỏ chuột ở vị trí muốn chèn hình ảnh, sau đó nhấn nút tải lên hoặc chèn từ URL
      </div>
      
      {/* Toolbar */}
      <div className="border border-b-0 bg-gray-50 p-2 flex flex-wrap gap-1">
        {formatButtons.map((button, index) => (
          <Button
            key={index}
            type="button"
            variant="ghost"
            size="sm"
            onClick={button.action}
            className="h-8 w-8 p-0"
            title={button.label}
          >
            <button.icon className="h-4 w-4" />
          </Button>
        ))}
        
        <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Chèn hình ảnh từ URL"
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
                />
              </div>
              <div>
                <label className="text-sm font-medium">Mô tả (Alt text)</label>
                <Input
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Mô tả hình ảnh..."
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImageDialogOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={insertImage}
                  disabled={!imageUrl.trim()}
                >
                  Chèn hình ảnh
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        <ImageUploader
          onImageUploaded={(url, alt) => {
            // Instead of inserting immediately, open dialog with pre-filled URL
            setImageUrl(url);
            setImageAlt(alt || '');
            setIsImageDialogOpen(true);
          }}
          triggerButton={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Tải lên hình ảnh từ máy tính"
            >
              <Upload className="h-4 w-4" />
            </Button>
          }
          insertAtCursor={false}
        />
      </div>

      {/* Text Area */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[300px] rounded-t-none border-t-0 resize-y"
      />

      {/* Preview section */}
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Xem trước:</h4>
        <div className="border rounded-md p-4 bg-gray-50 max-h-60 overflow-y-auto">
          <div className="prose prose-sm max-w-none">
            {value.trim() ? (
              value.split('\n').map((line, index) => {
                // Handle images
                const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                if (imageMatch) {
                  const altText = imageMatch[1];
                  return (
                    <div key={index} className="my-4">
                      <img 
                        src={imageMatch[2]} 
                        alt={altText} 
                        className="max-w-full h-auto rounded border"
                        style={{ maxHeight: '200px' }}
                      />
                      {altText && (
                        <p className="text-sm text-gray-600 italic mt-2 text-center">
                          {altText}
                        </p>
                      )}
                    </div>
                  );
                }
                
                // Handle bold text
                line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                
                // Handle italic text
                line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
                
                // Handle links
                line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline">$1</a>');
                
                // Handle lists
                if (line.startsWith('- ')) {
                  return <li key={index} dangerouslySetInnerHTML={{ __html: line.substring(2) }} />;
                }
                
                if (/^\d+\.\s/.test(line)) {
                  return <li key={index} dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '') }} />;
                }
                
                return line.trim() ? (
                  <p key={index} dangerouslySetInnerHTML={{ __html: line }} />
                ) : (
                  <br key={index} />
                );
              })
            ) : (
              <p className="text-gray-500 italic">Nhập nội dung để xem trước...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}