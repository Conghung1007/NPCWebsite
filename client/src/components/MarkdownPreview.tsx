import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MarkdownPreviewProps {
  content: string;
  title?: string;
}

export function MarkdownPreview({ content, title }: MarkdownPreviewProps) {
  // Simple markdown rendering function
  const renderMarkdown = (text: string) => {
    if (!text) return "Nhập nội dung để xem trước...";
    
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3 mt-5">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 mt-6">$1</h1>')
      
      // Bold and Italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>')
      
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-2" />')
      
      // Lists
      .replace(/^\d+\.\s(.*)$/gim, '<li class="ml-4">$1</li>')
      .replace(/^-\s(.*)$/gim, '<li class="ml-4">$1</li>')
      
      // Line breaks
      .replace(/\n/g, '<br />');
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-gray-600">👁️</span>
          Xem trước
        </CardTitle>
      </CardHeader>
      <CardContent>
        {title && (
          <h1 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200">
            {title}
          </h1>
        )}
        <div 
          className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: renderMarkdown(content) 
          }}
        />
      </CardContent>
    </Card>
  );
}