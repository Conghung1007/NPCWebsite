import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface EditableTextProps {
  text: string;
  onSave: (newText: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}

export function EditableText({
  text,
  onSave,
  multiline = false,
  className = "",
  placeholder = ""
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const { hasImageEditPermission } = useAuth();

  if (!hasImageEditPermission) {
    return <span className={className}>{text}</span>;
  }

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(text);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 w-full">
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className={`flex-1 ${className}`}
            autoFocus
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className={`flex-1 ${className}`}
            autoFocus
          />
        )}
        <Button size="sm" onClick={handleSave}>
          <Check className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group relative inline-block w-full">
      <span className={className}>{text}</span>
      <Button
        size="sm"
        variant="ghost"
        className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => setIsEditing(true)}
      >
        <Edit className="w-3 h-3" />
      </Button>
    </div>
  );
}